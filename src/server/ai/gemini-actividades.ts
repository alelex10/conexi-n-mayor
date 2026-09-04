import { GoogleGenAI } from "@google/genai";

/**
 * Conexion Mayor — Gemini provider (Google AI Studio) for activity search.
 *
 * Mirrors src/server/ai/lovable-actividades.ts: it reuses the SHARED harness
 * from src/server/ai/groq-actividades.ts (Zod schemas, system/user prompt
 * builders, JSON fence stripping, confidence computation shape) and only
 * swaps the client + the generateContent call.
 *
 * Explicitly NOT wired: Tavily/external web search (a Groq-path concern, left
 * untouched). Gemini grounds EVERY request with the Google Search tool and
 * exposes the used web pages as `sources` on the result — memory-only answers
 * are flagged with a "no grounded sources" warning and a capped confidence.
 *
 * - GEMINI_API_KEY is read INSIDE getGeminiClient() — Workers-safe (Cloudflare/Nitro)
 * - JSON is requested via the prompt (the word "JSON" is already present in the
 *   shared system prompt) and parsed with stripJsonFences — responseMimeType is
 *   deliberately NOT set because it is incompatible with the googleSearch tool
 *   on gemini-2.5-flash via generateContent
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
  type GroundedSource,
} from "./groq-actividades";

export type { GroundedSource };

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
    // supportsLiveSearch: true means buscarActividadesConGemini always calls the
    // model with the Google Search grounding tool, so answers are backed by real
    // web results exposed as `sources` (groundingChunks[].web {uri, title}).
    supportsLiveSearch: true,
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
    // Same family as the pinned default: grounded with Google Search as well.
    supportsLiveSearch: true,
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

/** Warning attached when the model answered without any grounded web source. */
export const NO_GROUNDED_SOURCES_WARNING =
  "[gemini] No grounded sources: Google Search returned no grounding chunks for this query, " +
  "so these results are ungrounded (model memory) — verify before publishing.";

/**
 * Ungrounded answers can never clear the HITL gate (0.85): cap confidence so
 * they always land in human review instead of being served as verified.
 */
export const UNGROUNDED_CONFIDENCE_CAP = 0.5;

/**
 * Without responseMimeType the model sometimes prefixes the payload
 * ("JSON", "Here is the JSON:", ...) or appends trailing commentary.
 * Slice from the first "{" to the last "}" so JSON.parse sees the object.
 * Returns the input unchanged when no brace pair is found (parse then fails
 * with the usual informative error).
 */
export function extractJsonObject(cleaned: string): string {
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return cleaned;
  return cleaned.slice(start, end + 1);
}

/**
 * Extracts deduplicated {title, url} web references from a generateContent
 * response (response.candidates[0].groundingMetadata.groundingChunks[].web).
 * Takes `unknown` so mocked responses in tests don't need SDK types.
 */
export function extractGroundedSources(response: unknown): GroundedSource[] {
  const candidates = (response as { candidates?: unknown })?.candidates;
  const first = Array.isArray(candidates) ? candidates[0] : undefined;
  const chunks = (first as { groundingMetadata?: { groundingChunks?: unknown } })?.groundingMetadata
    ?.groundingChunks;
  if (!Array.isArray(chunks)) return [];
  const seen = new Set<string>();
  const sources: GroundedSource[] = [];
  for (const chunk of chunks) {
    const web = (chunk as { web?: { uri?: unknown; title?: unknown } })?.web;
    const url = typeof web?.uri === "string" ? web.uri.trim() : "";
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const title = typeof web?.title === "string" && web.title.trim().length > 0 ? web.title.trim() : url;
    sources.push({ title, url });
  }
  return sources;
}

/**
 * Searches activities using Gemini with Google Search grounding ALWAYS on.
 * Same result shape as Groq/Lovable, plus `sources` (real web references).
 *
 * Grounding notes (verified against @google/genai 2.21.0 + Gemini docs):
 * - config.tools [{ googleSearch: {} }] enables live web search; the used
 *   URLs come back in response.candidates[0].groundingMetadata.groundingChunks[].web {uri, title}.
 * - responseMimeType "application/json" is NOT combined with the search tool on
 *   gemini-2.5-flash via generateContent (silent de-grounding / 400s reported) —
 *   so we request JSON through the prompt and parse response.text with the
 *   shared stripJsonFences helper, keeping the Zod validation.
 * - When grounding returns zero chunks the answer is ungrounded (model memory):
 *   we retry ONCE with an explicit reground nudge; if it still comes back
 *   ungrounded we surface an explicit "no grounded sources" warning and cap
 *   confidence so the HITL gate (0.85) routes it to human review instead of
 *   publishing it.
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
  // Shared harness prompts, plus a Gemini-only override appended at the end
  // (the shared text says "simulates web search" for the Groq path — for
  // Gemini that framing is superseded: real tool calls are mandatory).
  const systemPrompt =
    buildGroqSystemPrompt(ubicacion) +
    [
      "",
      "GEMINI GROUNDING OVERRIDE (this request — takes precedence over the lines above):",
      "- The Google Search tool is enabled. USE it: run web searches for the target location BEFORE writing the answer.",
      "- Do NOT answer from memory. Every activity MUST come from a page retrieved in this request.",
      "- If the searches return nothing usable, return {\"actividades\": []} with a warnings entry instead of inventing activities.",
    ].join("\n");
  const userPromptBase = buildUserPrompt({ ...input, ubicacion }, { omitSourceUrls: true });
  const GROUNDING_SUFFIX =
    "\nGrounding is enabled for this request: search the web first, then answer only with what you retrieved.";
  // Second-attempt nudge when the first attempt skipped the search tool.
  const REGROUND_SUFFIX =
    "\nIMPORTANT: the previous answer was rejected because it used no web sources. " +
    "This time you MUST call the Google Search tool before answering — a memory-only answer will be rejected again.";

  const buildRequest = (contents: string) => ({
    model,
    contents,
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.2,
      maxOutputTokens: 8192,
      // Google Search grounding is ALWAYS on (never memory-only answers).
      // NOTE: no responseMimeType here — it is incompatible with the search
      // tool on gemini-2.5-flash via generateContent, so JSON is requested
      // via the prompt and parsed with stripJsonFences below.
      tools: [{ googleSearch: {} }],
    },
  });

  // Single attempt with free-tier 429 backoff (retry ONCE before surfacing).
  const requestWithBackoff = async (contents: string) => {
    try {
      return await client.models.generateContent(buildRequest(contents));
    } catch (firstErr) {
      if (!isRateLimitError(firstErr)) throw firstErr;
      console.warn(`[gemini] rate limited on ${model} (429) — retrying once after 2s backoff`);
      await sleep(2000);
      return await client.models.generateContent(buildRequest(contents));
    }
  };

  const parseResponse = (raw: string | null | undefined) => {
    if (!raw) {
      throw new Error("[gemini] The model returned no content.");
    }
    // stripJsonFences handles ``` fences; extractJsonObject handles the bare
    // "JSON" prefix / trailing commentary the model adds without JSON mode.
    const cleaned = extractJsonObject(stripJsonFences(raw));
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
    return validated;
  };

  let lastResponse: Awaited<ReturnType<typeof requestWithBackoff>>;
  try {
    const firstResponse = await requestWithBackoff(userPromptBase + GROUNDING_SUFFIX);
    if (extractGroundedSources(firstResponse).length > 0) {
      lastResponse = firstResponse;
    } else {
      // The model skipped the search tool: ONE reground attempt with an
      // explicit nudge before accepting an ungrounded answer.
      console.warn("[gemini] first attempt returned no grounding chunks — retrying once with reground nudge");
      lastResponse = await requestWithBackoff(userPromptBase + REGROUND_SUFFIX);
    }
  } catch (error) {
    throw toFriendlyError(error);
  }

  // Parsing/validation errors propagate unwrapped (same as the Groq harness).
  const validated = parseResponse(lastResponse.text);

  const actividades = validated.actividades ?? [];
  const sources = extractGroundedSources(lastResponse);
  const warnings = [...(validated.warnings ?? [])];
  let confidence = computeGlobalConfidence(validated);
  if (sources.length === 0) {
    // Unverified memory answer: flag it and force it below the HITL gate.
    warnings.push(NO_GROUNDED_SOURCES_WARNING);
    confidence = Math.min(confidence, UNGROUNDED_CONFIDENCE_CAP);
  }
  return {
    actividades,
    total: validated.total ?? actividades.length,
    confidence,
    usedModel: model,
    ubicacion,
    warnings,
    raw: validated,
    sources,
  };
}
