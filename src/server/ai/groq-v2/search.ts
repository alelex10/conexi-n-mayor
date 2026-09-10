import OpenAI from "openai";

import { getGroqClient } from "@/server/ai/common/client";
import { buildGroqSystemPrompt } from "@/server/ai/common/prompts";
import {
  GroqBusquedaSchema,
  buildUserPrompt,
  stripJsonFences,
  type BuscarActividadesInput,
  type GroqBusquedaRaw,
  type GroqBusquedaResult,
} from "@/server/ai/groq/search";
import { DEFAULT_GROQ_MODEL } from "@/server/ai/groq/models";

const DEBUG_MODEL = "openai/gpt-oss-120b";

export { DEFAULT_GROQ_MODEL };

export async function buscarGroqCrudo(mensaje: string): Promise<{ raw: string; model: string }> {
  const client = getGroqClient();

  // General prompt from common — cost-optimized (low reasoning, 700 tokens).
  // NOTE: browser_search is NOT compatible with response_format json_object, so we rely on textual JSON instruction only.
  const ubicacion = "Lo Prado, Santiago, Chile";
  const system = buildGroqSystemPrompt(ubicacion);
  const userContent = `${mensaje}\n\nUsa browser_search en al menos 2 sitios web distintos y verifica cada actividad en su fuente; no repitas la misma fuente_url. Devuelve JSON válido como texto (0-5 actividades), máx 700 tokens, solo dentro de ${ubicacion}.`;

  async function callWithToolChoice(choice: string) {
    return (await client.chat.completions.create({
      model: DEBUG_MODEL,
      temperature: 1,
      max_completion_tokens: 700,
      reasoning_effort: "low",
      stream: false,
      tools: [{ type: "browser_search" }],
      tool_choice: choice,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
    } as any)) as any as {
      choices: Array<{ message?: { content?: string | null } }>;
    };
  }

  let completion: { choices: Array<{ message?: { content?: string | null } }> };
  try {
    completion = await callWithToolChoice("required");
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    if (msg.includes("Tool choice is required") && msg.includes("did not call a tool")) {
      completion = await callWithToolChoice("auto");
    } else {
      throw e;
    }
  }
  const raw = completion.choices[0]?.message?.content ?? "";
  return { raw, model: DEBUG_MODEL };
}

// ── v2 full search (pretty UI) ───────────────────────────────────────────

function resolveGroqModelV2(override?: string): string {
  if (override && typeof override === "string" && override.trim().length > 0) {
    const trimmed = override.trim();
    if (trimmed.includes("/") || trimmed.includes("-")) return trimmed;
  }
  return (
    process.env["AI_EXTRACTOR_MODEL"] ??
    process.env["GROQ_MODEL_OVERRIDE"] ??
    process.env["AI_EXTRACTOR_MODEL_OVERRIDE"] ??
    process.env["GROQ_MODEL"] ??
    DEBUG_MODEL ??
    DEFAULT_GROQ_MODEL
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

function getFailedGenerationSnippet(error: unknown): string | null {
  const nested =
    (error as { error?: { failed_generation?: unknown } })?.error?.failed_generation ??
    (error as { failed_generation?: unknown })?.failed_generation;
  if (typeof nested !== "string" || nested.length === 0) return null;
  return nested.slice(0, 500);
}

function isJsonValidationFailure(error: unknown): boolean {
  if (error instanceof OpenAI.APIError && error.status === 400) {
    const msg = (error.message ?? "").toLowerCase();
    const code = String(
      (error as { code?: unknown })?.code ??
        (error as { error?: { code?: unknown } })?.error?.code ??
        "",
    ).toLowerCase();
    if (msg.includes("failed to validate json") || msg.includes("json_validate_failed") || code.includes("json_validate_failed")) {
      return true;
    }
  }
  if (error instanceof Error) {
    const lower = error.message.toLowerCase();
    if (error.message.includes("400") && (lower.includes("failed to validate json") || lower.includes("json_validate_failed"))) {
      return true;
    }
  }
  return false;
}

function toFriendlyError(error: unknown): Error {
  if (error instanceof OpenAI.APIError) {
    const fg = getFailedGenerationSnippet(error);
    const fgSuffix = fg ? ` failed_generation (first 500 chars): ${fg}` : " failed_generation empty.";
    if (error.status === 400) {
      return new Error(
        `[groq-v2] Bad request (400). ${error.message}.${fgSuffix} Tip: qwen models fail with json_object; retry without format.`,
      );
    }
    if (error.status === 429) {
      return new Error(`[groq-v2] Rate limit (429). Groq free tier 30 RPM. Wait and retry. Details: ${error.message}`);
    }
    if (error.status === 401) {
      return new Error(`[groq-v2] Unauthorized (401). Check GROQ_API_KEY at https://console.groq.com/keys. Details: ${error.message}`);
    }
  }
  if (error instanceof Error) {
    const lower = error.message.toLowerCase();
    if (lower.includes("timeout") || lower.includes("timed out")) {
      return new Error(`[groq-v2] Request timed out after 30s. Try again. Cause: ${error.message}`);
    }
    if (lower.includes("429") || lower.includes("rate limit") || lower.includes("quota")) {
      return new Error(`[groq-v2] Rate limit / quota (429) — wait and retry. Cause: ${error.message}`);
    }
    if (lower.includes("401") || lower.includes("unauthorized") || lower.includes("groq_api_key")) {
      return new Error(`[groq-v2] Unauthorized — check GROQ_API_KEY. Cause: ${error.message}`);
    }
  }
  if (error instanceof Error) return error;
  return new Error(`[groq-v2] Unknown error: ${String(error)}`);
}

/**
 * v2 activity search for pretty UI — browser_search, low reasoning, 700 tokens,
 * general prompt, at least 2 distinct domains, textual JSON only (no response_format).
 * Same result shape as legacy groq/search so the existing UI needs zero changes.
 */
export async function buscarActividadesConGroq(input: BuscarActividadesInput): Promise<GroqBusquedaResult> {
  const ubicacion = input.ubicacion?.trim() ?? "";
  if (ubicacion.length < 3) {
    throw new Error("[groq-v2] ubicacion must be at least 3 characters (e.g. 'Lo Prado, Santiago').");
  }
  if (ubicacion.length > 200) {
    throw new Error("[groq-v2] ubicacion must be at most 200 characters.");
  }

  const client = getGroqClient();
  const model = resolveGroqModelV2(input.model);
  const systemPrompt = buildGroqSystemPrompt(ubicacion);
  const userBase = buildUserPrompt({ ...input, ubicacion });
  // v2 suffix: 2 distinct domains, 700 tokens, browser_search mandatory, JSON as plain text.
  // NOTE: browser_search is NOT compatible with response_format json_object — textual JSON only.
  const v2Suffix =
    " Usa browser_search en al menos 2 sitios web distintos y verifica cada actividad en su fuente; no repitas la misma fuente_url. Devuelve JSON válido como texto (0-5 actividades), máx 700 tokens.";
  const userPrompt = `${userBase}${v2Suffix}`;

  const requestOnce = async (toolChoice: string) =>
    (await (client.chat.completions.create as unknown as (args: unknown) => Promise<OpenAI.Chat.Completions.ChatCompletion>)({
      model,
      temperature: 1,
      max_completion_tokens: 700,
      reasoning_effort: "low",
      stream: false,
      tools: [{ type: "browser_search" }],
      tool_choice: toolChoice,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    } as unknown)) as OpenAI.Chat.Completions.ChatCompletion;

  const parseAndValidate = (raw: string): GroqBusquedaResult => {
    const cleaned = stripJsonFences(raw);
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      throw new Error(`[groq-v2] Failed to parse JSON from model. First 800 chars: ${cleaned.slice(0, 800)} — ${(parseErr as Error).message}`);
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
      // Groq browser_search does not expose separate grounding chunks; sources stay empty.
      sources: [],
      searched: true,
    };
  };

  let rawContent: string | null | undefined;
  try {
    try {
      let completion: OpenAI.Chat.Completions.ChatCompletion;
      try {
        completion = await requestOnce("required");
      } catch (e) {
        const msg = String((e as Error)?.message ?? e);
        if (msg.includes("Tool choice is required") && msg.includes("did not call a tool")) {
          completion = await requestOnce("auto");
        } else {
          throw e;
        }
      }
      rawContent = completion.choices[0]?.message?.content;
      if (!rawContent) throw new Error("[groq-v2] Empty response content from model (no choices[0].message.content).");
      return parseAndValidate(rawContent);
    } catch (firstErr) {
      if (!isJsonValidationFailure(firstErr)) throw firstErr;
      console.warn(`[groq-v2] json_object rejected by ${model} (400 json_validate_failed) — retrying once with tool_choice auto and without strict JSON mode`);
      let retryCompletion: OpenAI.Chat.Completions.ChatCompletion;
      try {
        retryCompletion = await requestOnce("auto");
      } catch (e) {
        throw firstErr;
      }
      const retryContent = retryCompletion.choices[0]?.message?.content;
      if (!retryContent) throw firstErr;
      try {
        return parseAndValidate(retryContent);
      } catch {
        throw firstErr;
      }
    }
  } catch (error) {
    throw toFriendlyError(error);
  }
}

// Alias for handler convenience (some callers expect buscarActividadesConGroqV2)
export const buscarActividadesConGroqV2 = buscarActividadesConGroq;
