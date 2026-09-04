import { GoogleGenAI } from "@google/genai";

/**
 * Conexion Mayor — Gemini provider (Google AI Studio) for activity search.
 *
 * Mirrors src/server/ai/lovable-actividades.ts: it reuses the SHARED harness
 * from src/server/ai/groq-actividades.ts (Zod schemas, system/user prompt
 * builders, JSON fence stripping, confidence computation shape) and only
 * swaps the client + the generateContent call.
 *
 * Explicitly NOT wired: Tavily/external web search. Tavily is a Groq-path
 * concern; Gemini resolves the search on its own (own knowledge plus any
 * grounding the SDK/model applies) using the same "how to search" context
 * (valid activity definition, format, radius, categories).
 *
 * - GEMINI_API_KEY is read INSIDE getGeminiClient() — Workers-safe (Cloudflare/Nitro)
 * - config.responseMimeType "application/json" requires the word "JSON" in the
 *   prompt (already present in the shared system prompt)
 * - Free tier is ~10 RPM plus a daily cap: 429s get one backoff retry, then a
 *   friendly error telling the user to wait and retry
 */

import {
  GroqBusquedaSchema,
  buildGroqSystemPrompt,
  buildUserPrompt,
  stripJsonFences,
  type BuscarActividadesInput,
  type GroqBusquedaRaw,
  type GroqBusquedaResult,
} from "./groq-actividades";

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export type GeminiModelInfo = {
  id: string;
  label: string;
  description: string;
  contextWindow: number;
  pricingIn: string | null;
  pricingOut: string | null;
  pricing: string | null;
  recommended: boolean;
  vision: boolean;
  supportsLiveSearch: boolean;
};

export const GEMINI_MODELS: GeminiModelInfo[] = [
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash (recommended)",
    description:
      "Fast and cheap — good balance for activity search. Free tier is rate-limited (~10 RPM).",
    contextWindow: 1_000_000,
    pricingIn: null,
    pricingOut: null,
    pricing: "Google AI Studio (free tier available)",
    recommended: true,
    vision: true,
    supportsLiveSearch: false,
  },
  {
    id: "gemini-2.5-flash-latest",
    label: "Gemini 2.5 Flash Latest",
    description:
      "Rolling alias of the 2.5 Flash family — same use as the pinned default, tracks latest patch.",
    contextWindow: 1_000_000,
    pricingIn: null,
    pricingOut: null,
    pricing: "Google AI Studio (free tier available)",
    recommended: false,
    vision: true,
    supportsLiveSearch: false,
  },
];

export function isValidGeminiModel(model: string): boolean {
  return GEMINI_MODELS.some((m) => m.id === model);
}

export function resolveGeminiModel(override?: string): string {
  const trimmed = override?.trim();
  if (trimmed && isValidGeminiModel(trimmed)) return trimmed;
  return (
    process.env["GEMINI_MODEL_OVERRIDE"] ??
    process.env["GEMINI_MODEL"] ??
    DEFAULT_GEMINI_MODEL
  );
}

/**
 * Creates a Gemini client. Reads GEMINI_API_KEY INSIDE the function (Workers-safe).
 */
export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) {
    throw new Error(
      "[gemini] Missing GEMINI_API_KEY. Set it in your server env (Cloudflare / Nitro / .env). " +
        "Get a free key at https://aistudio.google.com/apikey — no credit card required.",
    );
  }
  return new GoogleGenAI({ apiKey });
}

function computeGlobalConfidence(raw: GroqBusquedaRaw): number {
  if (typeof raw.confidence === "number") return Math.min(1, Math.max(0, raw.confidence));
  const acts = raw.actividades ?? [];
  if (acts.length === 0) return 0.5;
  const withConf = acts.filter((a) => typeof a.confidence === "number");
  if (withConf.length === 0) return 0.5;
  const avg = withConf.reduce((acc, a) => acc + a.confidence, 0) / withConf.length;
  return Math.min(1, Math.max(0, Number(avg.toFixed(2))));
}

function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("429") || msg.includes("rate limit") || msg.includes("resource_exhausted"))
      return true;
    if (msg.includes("quota") || msg.includes("exceed")) return true;
  }
  const status = (error as { status?: unknown })?.status;
  if (status === 429) return true;
  return false;
}

function toFriendlyError(error: unknown): Error {
  if (isRateLimitError(error)) {
    return new Error(
      "[gemini] Rate limit exceeded (429). Gemini free tier is ~10 RPM with a daily cap. " +
        "Wait a minute and retry. " +
        `Details: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (error instanceof Error) {
    const lower = error.message.toLowerCase();
    if (lower.includes("401") || lower.includes("unauthorized") || lower.includes("api key")) {
      return new Error(
        `[gemini] Unauthorized — check GEMINI_API_KEY at https://aistudio.google.com/apikey. Cause: ${error.message}`,
      );
    }
    return new Error(`[gemini] ${error.message}`);
  }
  return new Error(`[gemini] Unknown error: ${String(error)}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Searches activities using Gemini. Same result shape as Groq/Lovable.
 * No Tavily results are injected — Gemini resolves the search on its own
 * from the shared prompt context.
 */
export async function buscarActividadesConGemini(
  input: BuscarActividadesInput,
): Promise<GroqBusquedaResult> {
  const ubicacion = input.ubicacion?.trim() ?? "";
  if (ubicacion.length < 3) {
    throw new Error(
      "[gemini] ubicacion must be at least 3 characters (e.g. 'Lo Prado, Santiago').",
    );
  }
  if (ubicacion.length > 200) {
    throw new Error("[gemini] ubicacion must be at most 200 characters.");
  }

  const client = getGeminiClient();
  const model = resolveGeminiModel(input.model);
  const systemPrompt = buildGroqSystemPrompt(ubicacion);
  const userPrompt = buildUserPrompt({ ...input, ubicacion });

  let rawContent: string | null | undefined;
  try {
    const requestOnce = () =>
      client.models.generateContent({
        model,
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      });
    try {
      const response = await requestOnce();
      rawContent = response.text;
    } catch (firstErr) {
      // Free-tier 429: wait with backoff and retry ONCE before surfacing.
      if (!isRateLimitError(firstErr)) throw firstErr;
      console.warn(`[gemini] rate limited on ${model} (429) — retrying once after 2s backoff`);
      await sleep(2000);
      const retryResponse = await requestOnce();
      rawContent = retryResponse.text;
    }
  } catch (error) {
    throw toFriendlyError(error);
  }

  if (!rawContent) {
    throw new Error("[gemini] The model returned no content.");
  }

  const cleaned = stripJsonFences(rawContent);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(
      `[gemini] Could not parse model JSON. First 800 chars: ${cleaned.slice(0, 800)} — ${(e as Error).message}`,
    );
  }

  let validated: GroqBusquedaRaw;
  try {
    validated = GroqBusquedaSchema.parse(parsed);
  } catch (zodErr) {
    if (Array.isArray(parsed)) {
      validated = GroqBusquedaSchema.parse({ actividades: parsed });
    } else {
      throw zodErr;
    }
  }

  const actividades = validated.actividades ?? [];
  return {
    actividades,
    total: validated.total ?? actividades.length,
    confidence: computeGlobalConfidence(validated),
    usedModel: model,
    ubicacion,
    warnings: validated.warnings ?? [],
    raw: validated,
  };
}
