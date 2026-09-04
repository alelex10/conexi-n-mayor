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
  type ActivitySearchAttemptTrace,
  type ActivitySearchTrace,
  type BuscarActividadesInput,
  type GroqBusquedaRaw,
  type GroqBusquedaResult,
  type GroundedSource,
} from "./groq-actividades";

export type { GroundedSource };
export type { ActivitySearchAttemptTrace, ActivitySearchTrace };
export type GeminiAttemptTrace = ActivitySearchAttemptTrace;
export type GeminiSearchTrace = ActivitySearchTrace;

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
  if (error instanceof Error && error.message.startsWith("[gemini]")) return error;
  if (isRateLimitError(error)) {
    return new Error(
      "[gemini] Rate limit exceeded (429). Gemini free tier is ~10 RPM with a daily cap. " +
        "Wait a minute and retry. " +
        `Details: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (error instanceof Error) {
    const lower = error.message.toLowerCase();
    // Zod validation failures (no responseMimeType JSON mode: the grounded
    // model drifts date formats). Never leak the raw ZodError stack — wrap it
    // with a retry hint instead.
    if (error.name === "ZodError" || lower.includes("fecha must be iso")) {
      const issues = (error as { issues?: Array<{ path?: unknown; message?: unknown }> })?.issues;
      const detail = Array.isArray(issues)
        ? issues
            .slice(0, 3)
            .map((i) => `${Array.isArray(i.path) ? i.path.join(".") : ""}: ${String(i.message ?? "")}`)
            .join("; ")
        : error.message.slice(0, 300);
      return new Error(
        `[gemini] Model output failed validation (the model response format varied) — please retry. Details: ${detail}`,
      );
    }
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
 * Real API signals that a web search actually ran in this request.
 * - webSearchQueries: queries the model issued (present even with zero chunks —
 *   this is what distinguishes "searched without results" from "never searched").
 * - searchEntryPoint.renderedContent: HTML snippet returned when search ran.
 * - groundingChunks: retrieved web pages (implies a search ran).
 */
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

/**
 * True when the response carries the real API signal of an executed web
 * search (webSearchQueries or searchEntryPoint.renderedContent in
 * groundingMetadata, or retrieved grounding chunks). False = memory-only.
 */
export function hasSearchedResponse(response: unknown): boolean {
  return extractGroundingSignals(response).searched;
}

/** Truncates a prompt to 2000 chars for trace payloads. */
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

/**
 * Tolerant date normalization for Gemini grounded output (no JSON mode, so the
 * model drifts from ISO). Accepts DD/MM/YYYY, DD-MM-YYYY and Spanish long form
 * "D de MMMM [de YYYY]" (year defaults to the current year). ISO YYYY-MM-DD
 * passes through when it is a real calendar date. Anything else → null (the
 * schema allows null), so validation never throws a raw ZodError at the user.
 */
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

/** Applies normalizeFechaValue to every actividad.fecha before Zod validation. */
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
/**
 * Searches activities using Gemini with Google Search grounding ALWAYS on.
 * Same result shape as Groq/Lovable, plus `sources` (real web references),
 * `searched` (real API signal that a search ran) and `trace` (full internal
 * trace: attempts, prompts, tokens, grounding, verdict).
 *
 * Grounding notes (verified against @google/genai 2.21.0 + Gemini docs):
 * - config.tools [{ googleSearch: {} }] enables live web search; the used
 *   URLs come back in response.candidates[0].groundingMetadata.groundingChunks[].web {uri, title}.
 * - There is NO API-level forced tool use for googleSearch: ToolConfig only
 *   carries functionCallingConfig (mode ANY applies to FunctionDeclarations,
 *   not to the built-in grounding tool) and the GoogleSearch type exposes no
 *   force/required flag — so the strongest available enforcement is
 *   prompt-level MUST instructions (GROUNDING_SUFFIX / REGROUND_SUFFIX).
 * - responseMimeType "application/json" is NOT combined with the search tool on
 *   gemini-2.5-flash via generateContent (silent de-grounding / 400s reported) —
 *   so we request JSON through the prompt and parse response.text with the
 *   shared stripJsonFences helper, keeping the Zod validation.
 * - `searched` is the real API signal (groundingMetadata.webSearchQueries or
 *   searchEntryPoint.renderedContent, or retrieved chunks): true means a search
 *   ran even when it returned zero usable chunks ("searched without results"),
 *   false means the answer came from model memory.
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
  const traceStart = new Date();
  const attempts: ActivitySearchAttemptTrace[] = [];
  const retries: { attempt: number; backoffMs: number; reason: string }[] = [];
  // Shared harness prompts, plus a Gemini-only override appended at the end
  // (the shared text says "simulates web search" for the Groq path — for
  // Gemini that framing is superseded: real tool calls are mandatory).
  // NOTE: no toolConfig force exists for googleSearch (see docblock above),
  // so these MUST instructions are the strongest available enforcement.
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
    "for the target location, then answer only with what you retrieved. Never answer from memory.";
  // Second-attempt nudge when the first attempt skipped the search tool.
  const REGROUND_SUFFIX =
    "\nMANDATORY REGROUND: the previous answer was REJECTED because it used no web search " +
    "(no groundingMetadata.webSearchQueries). You MUST call the Google Search tool now — run web searches " +
    "for the target location BEFORE answering. A memory-only answer will be rejected again. Never answer from memory.";

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
      // NOTE: no toolConfig either — functionCallingConfig.mode ANY only
      // forces FunctionDeclarations, not the built-in googleSearch tool.
      tools: [{ googleSearch: {} }],
    },
  });

  // Single attempt with free-tier 429 backoff (retry ONCE before surfacing).
  const requestWithBackoff = async (contents: string, attemptNo: number) => {
    try {
      return await client.models.generateContent(buildRequest(contents));
    } catch (firstErr) {
      if (!isRateLimitError(firstErr)) throw firstErr;
      const backoffMs = 2000;
      const reason = firstErr instanceof Error ? firstErr.message.slice(0, 200) : String(firstErr).slice(0, 200);
      retries.push({ attempt: attemptNo, backoffMs, reason: `429 rate limit: ${reason}` });
      console.warn(`[gemini] rate limited on ${model} (429) — retrying once after 2s backoff`);
      await sleep(backoffMs);
      return await client.models.generateContent(buildRequest(contents));
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
    const usage = (response as {
      usageMetadata?: {
        promptTokenCount?: unknown;
        candidatesTokenCount?: unknown;
        totalTokenCount?: unknown;
      };
    })?.usageMetadata;
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
    attempts.push(
      describeAttempt(response, attemptNo, contents, startedAt, endedAt, backoffAfter > backoffBefore ? backoffAfter : null),
    );
    return response;
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
    const normalized = normalizeFechasBeforeValidation(parsed);
    try {
      validated = GroqBusquedaSchema.parse(normalized);
    } catch (zodErr) {
      if (Array.isArray(normalized)) {
        validated = GroqBusquedaSchema.parse({ actividades: normalized });
      } else {
        throw zodErr;
      }
    }
    return validated;
  };

  let lastResponse: Awaited<ReturnType<typeof requestWithBackoff>>;
  try {
    const firstResponse = await runAttempt(userPromptBase + GROUNDING_SUFFIX, 1);
    if (extractGroundedSources(firstResponse).length > 0) {
      lastResponse = firstResponse;
    } else {
      // The model skipped the search tool (or searched without usable
      // chunks): ONE reground attempt with an explicit nudge before
      // accepting an ungrounded answer.
      console.warn("[gemini] first attempt returned no grounding chunks — retrying once with reground nudge");
      lastResponse = await runAttempt(userPromptBase + REGROUND_SUFFIX, 2);
    }
  } catch (error) {
    console.warn(
      "[gemini] trace (failed before a usable response)",
      JSON.stringify({ model, ubicacion, attempts, retries }),
    );
    throw toFriendlyError(error);
  }

  // Parsing/validation errors surface as friendly [gemini] errors with a
  // retry hint — never a raw ZodError stack.
  let validated: GroqBusquedaRaw;
  try {
    validated = parseResponse(lastResponse.text);
  } catch (error) {
    throw toFriendlyError(error);
  }

  const actividades = validated.actividades ?? [];
  const sources = extractGroundedSources(lastResponse);
  const lastSignals = extractGroundingSignals(lastResponse);
  const searched = lastSignals.searched;
  const warnings = [...(validated.warnings ?? [])];
  let confidence = computeGlobalConfidence(validated);
  if (sources.length === 0) {
    // Unverified memory answer: flag it and force it below the HITL gate.
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
  for (const a of attempts) {
    for (const q of a.webSearchQueries) {
      if (!queries.includes(q)) queries.push(q);
    }
  }
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
  console.log(
    `[gemini] trace model=${model} searched=${searched} verdict=${verdict} ` +
      `attempts=${attempts.length} queries=${queries.length} chunks=${lastSignals.groundingChunkCount} ` +
      `sources=${sources.length} confidence=${confidence} durationMs=${trace.durationMs}`,
  );
  console.log(`[gemini] trace detail ${JSON.stringify(trace)}`);
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
