import { buildGroqSystemPrompt } from "@/server/ai/common/prompts";
import { getGeminiClient } from "@/server/ai/common/client";
import {
  GroqBusquedaSchema,
  buildUserPrompt,
  stripJsonFences,
  type BuscarActividadesInput,
  type GroqBusquedaResult,
  type GroqBusquedaRaw,
  type ActivitySearchTrace,
  type ActivitySearchAttemptTrace,
} from "@/server/ai/groq/search";

const DEFAULT_GEMINI_DEBUG_MODEL = "gemini-2.0-flash";
const DEFAULT_GEMINI_MODEL_V2 = "gemini-2.0-flash";

function resolveGeminiDebugModel(): string {
  const override = process.env["GEMINI_MODEL"]?.trim() || process.env["GEMINI_MODEL_OVERRIDE"]?.trim();
  if (override && override.length > 0) return override;
  return DEFAULT_GEMINI_DEBUG_MODEL;
}

function resolveGeminiModelV2(override?: string): string {
  const trimmed = override?.trim();
  if (trimmed && trimmed.length > 0) return trimmed;
  return (
    process.env["GEMINI_MODEL_OVERRIDE"]?.trim() ||
    process.env["GEMINI_MODEL"]?.trim() ||
    DEFAULT_GEMINI_MODEL_V2
  )!;
}

export type GroundedSource = { title: string; url: string };

function extractGroundedSources(response: unknown): GroundedSource[] {
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

export async function buscarGeminiCrudo(
  mensaje: string,
): Promise<{ raw: string; model: string; sources: GroundedSource[] }> {
  const client = getGeminiClient();
  const model = resolveGeminiDebugModel();

  // Mirrors groq-v2 cost philosophy: low reasoning, 700 tokens max.
  const ubicacion = "Lo Prado, Santiago, Chile";
  const system = buildGroqSystemPrompt(ubicacion);
  const userContent =
    `${mensaje}\n\nUsa googleSearch en al menos 2 sitios web distintos y verifica cada actividad en su fuente; ` +
    `no repitas la misma fuente_url. Devuelve JSON válido como texto (0-5 actividades), máx 700 tokens, solo dentro de ${ubicacion}.`;

  const config: Record<string, unknown> = {
    // Static system first — prompt caching friendly.
    systemInstruction: system,
    temperature: 1,
    maxOutputTokens: 700,
    tools: [{ googleSearch: {} }],
  };
  // Low reasoning only on 2.5 family (2.0-flash ignores thinkingConfig).
  if (model.includes("2.5")) {
    config["thinkingConfig"] = { thinkingBudget: 1024 };
  }

  const response = await (client.models.generateContent as unknown as (args: unknown) => Promise<unknown>)({
    model,
    contents: userContent,
    config,
  } as unknown as never);

  const raw = (response as { text?: string | null })?.text ?? "";
  const sources = extractGroundedSources(response);
  return { raw: typeof raw === "string" ? raw : String(raw ?? ""), model, sources };
}

// ── v2 full search (pretty UI) — cost-optimized mirror of groq-v2 ──────────

export const DEFAULT_GEMINI_MODEL = DEFAULT_GEMINI_MODEL_V2;
export type { ActivitySearchTrace, ActivitySearchAttemptTrace };
export type GeminiAttemptTrace = ActivitySearchAttemptTrace;
export type GeminiSearchTrace = ActivitySearchTrace;

export const UNGROUNDED_CONFIDENCE_CAP = 0.5;
export const NO_GROUNDED_SOURCES_WARNING =
  "[gemini-v2] No grounded sources: Google Search returned no grounding chunks for this query, so these results are ungrounded (model memory) — verify before publishing.";

function computeGlobalConfidenceV2(raw: GroqBusquedaRaw): number {
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
    if (msg.includes("429") || msg.includes("rate limit") || msg.includes("resource_exhausted")) return true;
    if (msg.includes("quota") || msg.includes("exceed")) return true;
  }
  const status = (error as { status?: unknown })?.status;
  if (status === 429) return true;
  return false;
}

function toFriendlyErrorV2(error: unknown): Error {
  if (error instanceof Error && error.message.startsWith("[gemini")) return error;
  if (isRateLimitError(error)) {
    return new Error(
      "[gemini-v2] Rate limit exceeded (429). Gemini free tier is ~10 RPM. Wait a minute and retry. " +
        `Details: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (error instanceof Error) {
    const lower = error.message.toLowerCase();
    if (error.name === "ZodError" || lower.includes("fecha must be iso")) {
      const issues = (error as { issues?: Array<{ path?: unknown; message?: unknown }> })?.issues;
      const detail = Array.isArray(issues)
        ? issues
            .slice(0, 3)
            .map((i) => `${Array.isArray(i.path) ? i.path.join(".") : ""}: ${String(i.message ?? "")}`)
            .join("; ")
        : error.message.slice(0, 300);
      return new Error(`[gemini-v2] Model output failed validation — please retry. Details: ${detail}`);
    }
    if (lower.includes("401") || lower.includes("unauthorized") || lower.includes("api key")) {
      return new Error(`[gemini-v2] Unauthorized — check GEMINI_API_KEY at https://aistudio.google.com/apikey. Cause: ${error.message}`);
    }
    return new Error(`[gemini-v2] ${error.message}`);
  }
  return new Error(`[gemini-v2] Unknown error: ${String(error)}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function extractJsonObject(cleaned: string): string {
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return cleaned;
  return cleaned.slice(start, end + 1);
}

export type GroundingSignals = {
  webSearchQueries: string[];
  groundingChunkCount: number;
  hasSearchEntryPoint: boolean;
  searched: boolean;
};

export function extractGroundingSignals(response: unknown): GroundingSignals {
  const candidates = (response as { candidates?: unknown })?.candidates;
  const first = (
    Array.isArray(candidates) ? candidates[0] : undefined
  ) as
    | {
        groundingMetadata?: {
          groundingChunks?: unknown;
          webSearchQueries?: unknown;
          searchEntryPoint?: { renderedContent?: unknown };
        };
      }
    | undefined;
  const gm = first?.groundingMetadata;
  const chunks = gm?.groundingChunks;
  const groundingChunkCount = Array.isArray(chunks) ? chunks.length : 0;
  const rawQueries = gm?.webSearchQueries;
  const webSearchQueries = Array.isArray(rawQueries)
    ? rawQueries.filter((q): q is string => typeof q === "string" && q.trim().length > 0)
    : [];
  const rendered = gm?.searchEntryPoint?.renderedContent;
  const hasSearchEntryPoint = typeof rendered === "string" && rendered.trim().length > 0;
  const searched = webSearchQueries.length > 0 || hasSearchEntryPoint || groundingChunkCount > 0;
  return { webSearchQueries, groundingChunkCount, hasSearchEntryPoint, searched };
}

export function hasSearchedResponse(response: unknown): boolean {
  return extractGroundingSignals(response).searched;
}

export function truncatePromptForTrace(prompt: string, maxChars = 2000): string {
  if (prompt.length <= maxChars) return prompt;
  return prompt.slice(0, maxChars);
}

const MESES_ES: Record<string, string> = {
  enero: "01",
  febrero: "02",
  marzo: "03",
  abril: "04",
  mayo: "05",
  junio: "06",
  julio: "07",
  agosto: "08",
  septiembre: "09",
  setiembre: "09",
  octubre: "10",
  noviembre: "11",
  diciembre: "12",
};

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function normalizeFechaValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const y = Number(iso[1]);
    const mo = Number(iso[2]);
    const d = Number(iso[3]);
    return isValidCalendarDate(y, mo, d) ? trimmed : null;
  }
  const numeric = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (numeric) {
    const d = Number(numeric[1]);
    const mo = Number(numeric[2]);
    const y = Number(numeric[3]);
    if (!isValidCalendarDate(y, mo, d)) return null;
    return `${y}-${pad2(mo)}-${pad2(d)}`;
  }
  const longForm = trimmed.match(/^(\d{1,2})\s+de\s+([a-záéíóúñü]+)(?:\s+de\s+(\d{4}))?$/i);
  if (longForm) {
    const d = Number(longForm[1]);
    const mesKey = (longForm[2] ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const moStr = MESES_ES[mesKey];
    if (!moStr) return null;
    const mo = Number(moStr);
    const y = longForm[3] ? Number(longForm[3]) : new Date().getFullYear();
    if (!isValidCalendarDate(y, mo, d)) return null;
    return `${y}-${pad2(mo)}-${pad2(d)}`;
  }
  return null;
}

function normalizeFechasBeforeValidation(parsed: unknown): unknown {
  const list = Array.isArray(parsed)
    ? parsed
    : (parsed as { actividades?: unknown })?.actividades;
  if (!Array.isArray(list)) return parsed;
  for (const act of list) {
    if (act && typeof act === "object" && "fecha" in (act as Record<string, unknown>)) {
      (act as Record<string, unknown>)["fecha"] = normalizeFechaValue(
        (act as Record<string, unknown>)["fecha"],
      );
    }
  }
  return parsed;
}

/**
 * v2 activity search for pretty UI — cost-optimized (700 tokens, low reasoning,
 * general prompt, 2 distinct domains via googleSearch). Same result shape as
 * legacy gemini/search so the existing UI needs zero changes, but with v2 token
 * budget (700 vs 8192) and mirror suffix of groq-v2.
 */
export async function buscarActividadesConGemini(input: BuscarActividadesInput): Promise<GroqBusquedaResult> {
  const ubicacion = input.ubicacion?.trim() ?? "";
  if (ubicacion.length < 3) throw new Error("[gemini-v2] ubicacion must be at least 3 characters (e.g. 'Lo Prado, Santiago').");
  if (ubicacion.length > 200) throw new Error("[gemini-v2] ubicacion must be at most 200 characters.");

  const client = getGeminiClient();
  const model = resolveGeminiModelV2(input.model);
  const traceStart = new Date();
  const attempts: ActivitySearchAttemptTrace[] = [];
  const retries: { attempt: number; backoffMs: number; reason: string }[] = [];

  const systemPrompt =
    buildGroqSystemPrompt(ubicacion) +
    [
      "",
      "GEMINI GROUNDING OVERRIDE (this request — takes precedence over the lines above):",
      "- The Google Search tool is enabled. You MUST use it: run web searches for the target location BEFORE writing the answer — never answer from memory.",
      "- Every activity MUST come from a page retrieved in this request via Google Search.",
      "- If the searches return nothing usable, return {\"actividades\": []} with a warnings entry instead of inventing activities.",
    ].join("\n");
  const userPromptBase = buildUserPrompt({ ...input, ubicacion }, { omitSourceUrls: true });
  const GROUNDING_SUFFIX =
    "\nMANDATORY GROUNDING: you MUST use the Google Search tool before answering — run at least one web search " +
    "for the target location, then answer only with what you retrieved. Never answer from memory. " +
    "Usa googleSearch en al menos 2 sitios web distintos y verifica cada actividad en su fuente; no repitas la misma fuente_url. Máx 700 tokens.";
  const REGROUND_SUFFIX =
    "\nMANDATORY REGROUND: the previous answer was REJECTED because it used no web search " +
    "(no groundingMetadata.webSearchQueries). You MUST call the Google Search tool now — run web searches " +
    "for the target location BEFORE answering. A memory-only answer will be rejected again. Never answer from memory.";

  const buildRequest = (contents: string) => ({
    model,
    contents,
    config: {
      systemInstruction: systemPrompt,
      temperature: 1,
      maxOutputTokens: 700,
      tools: [{ googleSearch: {} }],
    } as Record<string, unknown>,
  });

  // Add thinkingConfig only for 2.5 family (2.0-flash ignores it)
  const addThinking = (req: ReturnType<typeof buildRequest>) => {
    if (model.includes("2.5")) {
      (req.config as Record<string, unknown>)["thinkingConfig"] = { thinkingBudget: 1024 };
    }
    return req;
  };

  const requestWithBackoff = async (contents: string, attemptNo: number) => {
    try {
      return await (client.models.generateContent as unknown as (args: unknown) => Promise<unknown>)(addThinking(buildRequest(contents)) as unknown as never);
    } catch (firstErr) {
      if (!isRateLimitError(firstErr)) throw firstErr;
      const backoffMs = 2000;
      const reason = firstErr instanceof Error ? firstErr.message.slice(0, 200) : String(firstErr).slice(0, 200);
      retries.push({ attempt: attemptNo, backoffMs, reason: `429 rate limit: ${reason}` });
      console.warn(`[gemini-v2] rate limited on ${model} (429) — retrying once after 2s backoff`);
      await sleep(backoffMs);
      return await (client.models.generateContent as unknown as (args: unknown) => Promise<unknown>)(addThinking(buildRequest(contents)) as unknown as never);
    }
  };

  const describeAttempt = (
    response: unknown,
    attemptNo: number,
    contents: string,
    startedAt: Date,
    endedAt: Date,
    backoffMs: number | null,
  ): ActivitySearchAttemptTrace => {
    const signals = extractGroundingSignals(response);
    const chunkSources = extractGroundedSources(response);
    const first = (
      Array.isArray((response as { candidates?: unknown })?.candidates)
        ? (response as { candidates: unknown[] }).candidates[0]
        : undefined
    ) as { finishReason?: unknown } | undefined;
    const finishReason = typeof first?.finishReason === "string" ? first.finishReason : null;
    const usage = (response as { usageMetadata?: { promptTokenCount?: unknown; candidatesTokenCount?: unknown; totalTokenCount?: unknown } })?.usageMetadata;
    const numOrNull = (v: unknown): number | null => (typeof v === "number" ? v : null);
    return {
      attempt: attemptNo,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      durationMs: endedAt.getTime() - startedAt.getTime(),
      systemPrompt: truncatePromptForTrace(systemPrompt),
      userPrompt: truncatePromptForTrace(contents),
      finishReason,
      promptTokens: numOrNull(usage?.promptTokenCount),
      candidatesTokens: numOrNull(usage?.candidatesTokenCount),
      totalTokens: numOrNull(usage?.totalTokenCount),
      webSearchQueries: signals.webSearchQueries,
      groundingChunkCount: signals.groundingChunkCount,
      sourceCount: chunkSources.length,
      searched: signals.searched,
      backoffMs,
    };
  };

  const runAttempt = async (contents: string, attemptNo: number) => {
    const startedAt = new Date();
    const backoffBefore = retries.filter((r) => r.attempt === attemptNo).reduce((acc, r) => acc + r.backoffMs, 0);
    const response = await requestWithBackoff(contents, attemptNo);
    const endedAt = new Date();
    const backoffAfter = retries.filter((r) => r.attempt === attemptNo).reduce((acc, r) => acc + r.backoffMs, 0);
    attempts.push(describeAttempt(response, attemptNo, contents, startedAt, endedAt, backoffAfter > backoffBefore ? backoffAfter : null));
    return response;
  };

  const parseResponse = (raw: string | null | undefined) => {
    if (!raw) throw new Error("[gemini-v2] The model returned no content.");
    const cleaned = extractJsonObject(stripJsonFences(raw));
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      throw new Error(`[gemini-v2] Could not parse model JSON. First 800 chars: ${cleaned.slice(0, 800)} — ${(e as Error).message}`);
    }
    let validated: GroqBusquedaRaw;
    const normalized = normalizeFechasBeforeValidation(parsed);
    try {
      validated = GroqBusquedaSchema.parse(normalized);
    } catch (zodErr) {
      if (Array.isArray(normalized)) validated = GroqBusquedaSchema.parse({ actividades: normalized });
      else throw zodErr;
    }
    return validated;
  };

  let lastResponse: Awaited<ReturnType<typeof requestWithBackoff>>;
  try {
    const firstResponse = await runAttempt(userPromptBase + GROUNDING_SUFFIX, 1);
    if (extractGroundedSources(firstResponse).length > 0) {
      lastResponse = firstResponse;
    } else {
      console.warn("[gemini-v2] first attempt returned no grounding chunks — retrying once with reground nudge");
      lastResponse = await runAttempt(userPromptBase + REGROUND_SUFFIX, 2);
    }
  } catch (error) {
    console.warn("[gemini-v2] trace (failed before a usable response)", JSON.stringify({ model, ubicacion, attempts, retries }));
    throw toFriendlyErrorV2(error);
  }

  let validated: GroqBusquedaRaw;
  try {
    validated = parseResponse((lastResponse as { text?: string | null })?.text ?? "");
  } catch (error) {
    throw toFriendlyErrorV2(error);
  }

  const actividades = validated.actividades ?? [];
  const sources = extractGroundedSources(lastResponse);
  const lastSignals = extractGroundingSignals(lastResponse);
  const searched = lastSignals.searched;
  const warnings = [...(validated.warnings ?? [])];
  let confidence = computeGlobalConfidenceV2(validated);
  if (sources.length === 0) {
    warnings.push(NO_GROUNDED_SOURCES_WARNING);
    confidence = Math.min(confidence, UNGROUNDED_CONFIDENCE_CAP);
  }
  const verdict: "grounded" | "memory" = sources.length > 0 ? "grounded" : "memory";
  const traceEnd = new Date();
  const sumOrNull = (values: (number | null)[]): number | null => {
    const known = values.filter((v): v is number => typeof v === "number");
    return known.length > 0 ? known.reduce((acc, v) => acc + v, 0) : null;
  };
  const queries: string[] = [];
  for (const a of attempts) for (const q of a.webSearchQueries) if (!queries.includes(q)) queries.push(q);
  const trace: ActivitySearchTrace = {
    model,
    startedAt: traceStart.toISOString(),
    endedAt: traceEnd.toISOString(),
    durationMs: traceEnd.getTime() - traceStart.getTime(),
    attempts,
    retries,
    totalPromptTokens: sumOrNull(attempts.map((a) => a.promptTokens)),
    totalCandidatesTokens: sumOrNull(attempts.map((a) => a.candidatesTokens)),
    totalTokens: sumOrNull(attempts.map((a) => a.totalTokens)),
    queries,
    groundingChunkCount: lastSignals.groundingChunkCount,
    sourceCount: sources.length,
    searched,
    confidence,
    verdict,
  };
  console.log(`[gemini-v2] trace model=${model} searched=${searched} verdict=${verdict} attempts=${attempts.length} queries=${queries.length} chunks=${lastSignals.groundingChunkCount} sources=${sources.length} confidence=${confidence} durationMs=${trace.durationMs}`);
  console.log(`[gemini-v2] trace detail ${JSON.stringify(trace)}`);
  return {
    actividades,
    total: validated.total ?? actividades.length,
    confidence,
    usedModel: model,
    ubicacion,
    warnings,
    raw: validated,
    sources,
    searched,
    trace,
  };
}

export const buscarActividadesConGeminiV2 = buscarActividadesConGemini;
