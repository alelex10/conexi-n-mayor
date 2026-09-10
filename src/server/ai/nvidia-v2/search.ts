import OpenAI from "openai";

import { getNvidiaClient } from "@/server/ai/common/client";
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
 * NVIDIA v2 — cost-optimized mirror of groq-v2.
 *
 * Uses OpenAI-compatible client pointing to https://integrate.api.nvidia.com/v1.
 * Model chosen for availability: meta/llama-3.3-70b-instruct (NVIDIA hosted).
 * Alternatives: nvidia/llama-3.3-nemotron-super-49b-v1.5, meta/llama-3.1-405b-instruct.
 * Cost limits: temperature 1, max_completion_tokens 700, no reasoning budget.
 *
 * LIMITATION: NVIDIA API does not expose a browser_search tool. This implementation
 * uses plain JSON generation (no tool) and relies on prompt instruction to simulate
 * diversity ("al menos 2 sitios web distintos"). For real browsing, inject external
 * search results (Tavily / Exa / Serper) into the prompt before calling the model.
 */

export const DEFAULT_NVIDIA_MODEL = "meta/llama-3.3-70b-instruct";
const DEBUG_MODEL = DEFAULT_NVIDIA_MODEL;

export { DEFAULT_NVIDIA_MODEL as DEFAULT_MODEL };

export async function buscarNvidiaCrudo(mensaje: string): Promise<{ raw: string; model: string }> {
  const client = getNvidiaClient();

  const ubicacion = "Lo Prado, Santiago, Chile";
  const system = buildGroqSystemPrompt(ubicacion);
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

function resolveNvidiaModelV2(override?: string): string {
  if (override && typeof override === "string" && override.trim().length > 0) {
    const trimmed = override.trim();
    if (trimmed.includes("/") || trimmed.includes("-")) return trimmed;
  }
  return (
    process.env["AI_EXTRACTOR_MODEL"] ??
    process.env["NVIDIA_MODEL_OVERRIDE"] ??
    process.env["NVIDIA_MODEL"] ??
    process.env["NVAPI_MODEL_OVERRIDE"] ??
    process.env["AI_EXTRACTOR_MODEL_OVERRIDE"] ??
    DEBUG_MODEL ??
    DEFAULT_NVIDIA_MODEL
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
      return new Error(`[nvidia-v2] Bad request (400). ${error.message}. Tip: check model name; NVIDIA uses meta/llama-3.3-70b-instruct format.`);
    }
    if (error.status === 429) {
      return new Error(`[nvidia-v2] Rate limit (429). NVIDIA free tier is quota-limited. Wait and retry. Details: ${error.message}`);
    }
    if (error.status === 401) {
      return new Error(`[nvidia-v2] Unauthorized (401). Check NVIDIA_API_KEY / NVAPI_KEY at https://build.nvidia.com. Details: ${error.message}`);
    }
  }
  if (error instanceof Error) {
    const lower = error.message.toLowerCase();
    if (lower.includes("timeout") || lower.includes("timed out")) {
      return new Error(`[nvidia-v2] Request timed out after 30s. Try again. Cause: ${error.message}`);
    }
    if (lower.includes("429") || lower.includes("rate limit") || lower.includes("quota")) {
      return new Error(`[nvidia-v2] Rate limit / quota (429) — wait and retry. Cause: ${error.message}`);
    }
    if (lower.includes("401") || lower.includes("unauthorized") || lower.includes("nvidia_api_key") || lower.includes("nvapi")) {
      return new Error(`[nvidia-v2] Unauthorized — check NVIDIA_API_KEY / NVAPI_KEY. Cause: ${error.message}`);
    }
  }
  if (error instanceof Error) return error;
  return new Error(`[nvidia-v2] Unknown error: ${String(error)}`);
}

/**
 * v2 activity search for pretty UI — plain JSON generation, low+700, general prompt,
 * 2 distinct domains (conceptual), textual JSON only.
 * Same result shape as groq-v2 so the existing UI needs zero changes.
 */
export async function buscarActividadesConNvidia(input: BuscarActividadesInput): Promise<GroqBusquedaResult> {
  const ubicacion = input.ubicacion?.trim() ?? "";
  if (ubicacion.length < 3) {
    throw new Error("[nvidia-v2] ubicacion must be at least 3 characters (e.g. 'Lo Prado, Santiago').");
  }
  if (ubicacion.length > 200) {
    throw new Error("[nvidia-v2] ubicacion must be at most 200 characters.");
  }

  const client = getNvidiaClient();
  const model = resolveNvidiaModelV2(input.model);
  const systemPrompt = buildGroqSystemPrompt(ubicacion);
  const userBase = buildUserPrompt({ ...input, ubicacion });
  const v2Suffix =
    " Conceptualmente busca en al menos 2 sitios web distintos y verifica cada actividad en su fuente; no repitas la misma fuente_url. Devuelve JSON válido como texto (0-5 actividades), máx 700 tokens.";
  const userPrompt = `${userBase}${v2Suffix}`;

  const parseAndValidate = (raw: string): GroqBusquedaResult => {
    const cleaned = stripJsonFences(raw);
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      throw new Error(`[nvidia-v2] Failed to parse JSON from model. First 800 chars: ${cleaned.slice(0, 800)} — ${(parseErr as Error).message}`);
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
    if (!rawContent) throw new Error("[nvidia-v2] Empty response content from model (no choices[0].message.content).");
    return parseAndValidate(rawContent);
  } catch (error) {
    throw toFriendlyError(error);
  }
}

// Alias for handler convenience
export const buscarActividadesConNvidiaV2 = buscarActividadesConNvidia;
