import OpenAI from "openai";

import { getOpenRouterClient } from "@/server/ai/common/client";
import { buildGroqSystemPrompt } from "@/server/ai/common/prompts";
import {
  GroqBusquedaSchema,
  buildUserPrompt,
  stripJsonFences,
  type BuscarActividadesInput,
  type GroqBusquedaRaw,
  type GroqBusquedaResult,
} from "@/server/ai/groq/search";

/**
 * OpenRouter v2 — cost-optimized mirror of groq-v2.
 *
 * Uses OpenAI-compatible client pointing to https://openrouter.ai/api/v1.
 * Free model chosen for availability: meta-llama/llama-3.3-70b-instruct:free.
 * Cost limits: temperature 1, max_completion_tokens 700, no reasoning budget.
 *
 * LIMITATION: OpenRouter passes `tools` through to the underlying provider,
 * but free models (including :free variants) typically ignore browser_search /
 * web search tools. This implementation uses plain JSON generation (no tool)
 * and relies on the prompt instruction to simulate diversity ("al menos 2 sitios
 * web distintos"). For real browsing, inject external search results
 * (Tavily / Exa / Serper) into the prompt before calling the model.
 */

export const DEFAULT_OPENROUTER_MODEL = "nex-agi/nex-n2.5-mini:free";
const DEBUG_MODEL = DEFAULT_OPENROUTER_MODEL;

export { DEFAULT_OPENROUTER_MODEL as DEFAULT_MODEL };

export async function buscarOpenRouterCrudo(mensaje: string): Promise<{ raw: string; model: string }> {
  const client = getOpenRouterClient();

  const ubicacion = "Lo Prado, Santiago, Chile";
  const system = buildGroqSystemPrompt(ubicacion);
  // Diversity instruction mirrors groq-v2 suffix; conceptually asks for 2 distinct domains.
  const userContent = `${mensaje}\n\nConceptualmente busca en al menos 2 sitios web distintos y verifica cada actividad en su fuente; no repitas la misma fuente_url. Devuelve JSON válido como texto (0-5 actividades), máx 700 tokens, solo dentro de ${ubicacion}.`;

  const completion = (await client.chat.completions.create({
    model: DEBUG_MODEL,
    temperature: 1,
    max_completion_tokens: 700,
    stream: false,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userContent },
    ],
  } as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming)) as OpenAI.Chat.Completions.ChatCompletion;

  const raw = completion.choices[0]?.message?.content ?? "";
  return { raw, model: DEBUG_MODEL };
}

// ── v2 full search (pretty UI) ───────────────────────────────────────────

function resolveOpenRouterModelV2(override?: string): string {
  if (override && typeof override === "string" && override.trim().length > 0) {
    const trimmed = override.trim();
    if (trimmed.includes("/") || trimmed.includes("-") || trimmed.includes(":")) return trimmed;
  }
  return (
    process.env["AI_EXTRACTOR_MODEL"] ??
    process.env["OPENROUTER_MODEL_OVERRIDE"] ??
    process.env["OPENROUTER_MODEL"] ??
    process.env["AI_EXTRACTOR_MODEL_OVERRIDE"] ??
    DEBUG_MODEL ??
    DEFAULT_OPENROUTER_MODEL
  );
}

function computeGlobalConfidence(raw: GroqBusquedaRaw, actividades: GroqBusquedaRaw["actividades"]): number {
  if (typeof raw.confidence === "number") return Math.min(1, Math.max(0, raw.confidence));
  if (actividades.length === 0) return 0.5;
  const withConf = actividades.filter((a) => typeof a.confidence === "number");
  if (withConf.length === 0) return 0.5;
  const avg = withConf.reduce((acc, a) => acc + a.confidence, 0) / withConf.length;
  return Math.min(1, Math.max(0, Number(avg.toFixed(2))));
}

function toFriendlyError(error: unknown): Error {
  if (error instanceof OpenAI.APIError) {
    if (error.status === 400) {
      return new Error(`[openrouter-v2] Bad request (400). ${error.message}. Tip: free models may reject tool params; this impl uses no tools.`);
    }
    if (error.status === 429) {
      return new Error(`[openrouter-v2] Rate limit (429). OpenRouter free tier is quota-limited. Wait and retry. Details: ${error.message}`);
    }
    if (error.status === 401) {
      return new Error(`[openrouter-v2] Unauthorized (401). Check OPENROUTER_API_KEY at https://openrouter.ai/keys. Details: ${error.message}`);
    }
  }
  if (error instanceof Error) {
    const lower = error.message.toLowerCase();
    if (lower.includes("timeout") || lower.includes("timed out")) {
      return new Error(`[openrouter-v2] Request timed out after 30s. Try again. Cause: ${error.message}`);
    }
    if (lower.includes("429") || lower.includes("rate limit") || lower.includes("quota")) {
      return new Error(`[openrouter-v2] Rate limit / quota (429) — wait and retry. Cause: ${error.message}`);
    }
    if (lower.includes("401") || lower.includes("unauthorized") || lower.includes("openrouter_api_key")) {
      return new Error(`[openrouter-v2] Unauthorized — check OPENROUTER_API_KEY. Cause: ${error.message}`);
    }
  }
  if (error instanceof Error) return error;
  return new Error(`[openrouter-v2] Unknown error: ${String(error)}`);
}

/**
 * v2 activity search for pretty UI — plain JSON generation, low+700, general prompt,
 * 2 distinct domains (conceptual), textual JSON only.
 * Same result shape as groq-v2 so the existing UI needs zero changes.
 */
export async function buscarActividadesConOpenRouter(input: BuscarActividadesInput): Promise<GroqBusquedaResult> {
  const ubicacion = input.ubicacion?.trim() ?? "";
  if (ubicacion.length < 3) {
    throw new Error("[openrouter-v2] ubicacion must be at least 3 characters (e.g. 'Lo Prado, Santiago').");
  }
  if (ubicacion.length > 200) {
    throw new Error("[openrouter-v2] ubicacion must be at most 200 characters.");
  }

  const client = getOpenRouterClient();
  const model = resolveOpenRouterModelV2(input.model);
  const systemPrompt = buildGroqSystemPrompt(ubicacion);
  const userBase = buildUserPrompt({ ...input, ubicacion });
  // v2 suffix: 2 distinct domains (conceptual, no browser_search tool on free models), 700 tokens, JSON as plain text.
  const v2Suffix =
    " Conceptualmente busca en al menos 2 sitios web distintos y verifica cada actividad en su fuente; no repitas la misma fuente_url. Devuelve JSON válido como texto (0-5 actividades), máx 700 tokens.";
  const userPrompt = `${userBase}${v2Suffix}`;

  const parseAndValidate = (raw: string): GroqBusquedaResult => {
    const cleaned = stripJsonFences(raw);
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      throw new Error(`[openrouter-v2] Failed to parse JSON from model. First 800 chars: ${cleaned.slice(0, 800)} — ${(parseErr as Error).message}`);
    }
    let validated: GroqBusquedaRaw;
    try {
      validated = GroqBusquedaSchema.parse(parsed);
    } catch (zodErr) {
      if (Array.isArray(parsed)) {
        validated = GroqBusquedaSchema.parse({ actividades: parsed });
      } else if (parsed && typeof parsed === "object" && "data" in (parsed as Record<string, unknown>)) {
        const maybe = (parsed as Record<string, unknown>)["data"];
        if (Array.isArray(maybe)) validated = GroqBusquedaSchema.parse({ actividades: maybe });
        else throw zodErr;
      } else {
        throw zodErr;
      }
    }
    const actividades = validated.actividades ?? [];
    const warnings = validated.warnings ?? [];
    const confidence = computeGlobalConfidence(validated, actividades);
    const total = validated.total ?? actividades.length;
    return {
      actividades,
      total,
      confidence,
      usedModel: model,
      ubicacion,
      warnings,
      raw: validated,
      sources: [],
      searched: false,
    };
  };

  try {
    const completion = (await client.chat.completions.create({
      model,
      temperature: 1,
      max_completion_tokens: 700,
      stream: false,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    } as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming)) as OpenAI.Chat.Completions.ChatCompletion;

    const rawContent = completion.choices[0]?.message?.content;
    if (!rawContent) throw new Error("[openrouter-v2] Empty response content from model (no choices[0].message.content).");
    return parseAndValidate(rawContent);
  } catch (error) {
    throw toFriendlyError(error);
  }
}

// Alias for handler convenience
export const buscarActividadesConOpenRouterV2 = buscarActividadesConOpenRouter;
