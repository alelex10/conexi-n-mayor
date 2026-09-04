import OpenAI from "openai";
import { z } from "zod";

/**
 * Conexión Mayor — Groq actividades por ubicación with REAL live-only grounding.
 *
 * Pure logic (no createServerFn, no TanStack imports).
 * Pattern replicated from src/server/ai/extract-afiche.ts (Groq vision).
 *
 * - Uses OpenAI SDK with baseURL https://api.groq.com/openai/v1 (compatible)
 * - Env (GROQ_API_KEY) is read INSIDE getGroqClient() — Workers-safe (Cloudflare/Nitro)
 * - response_format: json_object requires the word "JSON" in the prompt
 * - Groq has no native Live Search: BEFORE calling the LLM we fetch REAL web
 *   evidence via searchLive() (Tavily primary with Bearer auth + time_range
 *   month ONLY — never combined with start_date/end_date per Tavily 400 rule —
 *   max 10 per query, 2-3 query variants fused dedup-by-URL (cap 20), basic
 *   first + advanced ONLY if basic gives 0, double attempt with
 *   include_domains then without on 0 results, Exa fallback when Tavily is
 *   empty or dateless, Serper last resort; server-only keys).
 * - The IA path uses LIVE evidence ONLY. There is NO local fallback
 *   (no Supabase/ChileCultura/mock) in this path: when searchLive() returns
 *   0 snippets we return live/0 WITHOUT calling the LLM and WITHOUT touching
 *   any DB. ChileCultura stays always-on for the TRADITIONAL path
 *   (@/lib/chilecultura), but the IA never uses it as truth.
 * - The LLM is FORBIDDEN from inventing: it may only return activities whose
 *   NOMBRE appears VERBATIM (case-insensitive, trim) inside a LIVE snippet
 *   title/content, and whose ubicación matches. fuente_url is OPTIONAL:
 *   when present it MUST be copied EXACTLY from a snippet URL (exact set
 *   membership is mandatory, hostname alone never suffices); when null the
 *   item still passes as citation-missing with a warning, provided the name
 *   is verbatim in the evidence plus a location match. A name OUTSIDE the
 *   evidence is ALWAYS dropped, even with a plausible URL.
 * - Post-validation (applyGroundingFilter) drops items whose name is not
 *   verbatim in any snippet, whose ubicación does not match, or whose
 *   fuente_url — when present — is not an exact evidence URL.
 *   Missing data (fecha/hora/lugar/direccion null) NEVER causes a drop: kept
 *   items pass as partial-verified with -0.05 confidence per missing field
 *   plus explicit warnings, so the home UI can render "no encontrado"
 *   placeholders instead of hiding the card.
 *   Confidence is RECOMPUTED server-side from citations + name-verbatim +
 *   location match, never averaged from self-reported LLM confidence:
 *   exact citation +0.15 bonus; citation-missing verbatim items clamp to
 *   0.75–0.80 with an explicit warning.
 * - Zero live evidence (0 snippets) returns empty live/0 without calling the
 *   LLM and without reading local truth. The model is never asked to
 *   simulate or guess.
 */

import { DEFAULT_GROQ_MODEL } from "./models";

// ── Schemas ──────────────────────────────────────────────────────────────────

/**
 * Flexible categoria: known values plus any string ("otro" as fallback).
 * The model must try to use a known one; otherwise use "otro".
 * z.enum with .catch normalizes unknowns without failing validation.
 */
const CATEGORIA_VALUES = [
  "taller",
  "paseo",
  "charla",
  "deporte",
  "cultura",
  "salud",
  "ejercicio",
  "recreacion",
  "aprendizaje",
  "otro",
] as const;

export const GroqActividadSchema = z.object({
  nombre: z.string().min(1).describe("Nombre de la actividad/evento"),
  descripcion: z
    .string()
    .min(1)
    .describe("Descripción breve de la actividad (qué se hace, para quién)"),
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "fecha must be ISO YYYY-MM-DD")
    .nullable()
    .describe("Fecha del evento en ISO YYYY-MM-DD, o null si no hay fecha / evento permanente"),
  hora: z.string().nullable().describe("Hora del evento como texto (ej. 10:30, 16:00), o null"),
  lugar: z.string().nullable().describe("Nombre del lugar / venue, o null"),
  direccion: z.string().nullable().describe("Dirección calle + comuna, o null"),
  categoria: z
    .enum(CATEGORIA_VALUES)
    .catch("otro")
    .describe(
      "Categoría: taller | paseo | charla | deporte | cultura | salud | ejercicio | recreacion | aprendizaje | otro",
    ),
  gratuito: z.boolean().describe("true si la actividad es gratuita / sin costo"),
  precio_texto: z.string().nullable().optional().describe("Precio como texto si no es gratuito (ej. $2.000), o null"),
  fuente_url: z.string().url().nullable().optional().describe("URL EXACTA del snippet de evidencia donde se encontró la actividad, o null cuando el nombre está verbatim en la evidencia pero sin URL informada"),
  confidence: z.number().min(0).max(1).describe("Confianza 0..1 (el servidor la RECALCULA desde citas + ubicación; el valor del modelo se ignora)"),
  warnings: z.array(z.string()).optional().describe("Advertencias / incertidumbres para esta actividad"),
});

export type GroqActividad = z.infer<typeof GroqActividadSchema>;

/**
 * Expected model response (JSON object root).
 * The model must return { actividades: [...] } with at least this shape.
 * Extra optional fields (ubicacion, warnings, confidence, etc.) are allowed.
 */
export const GroqBusquedaSchema = z.object({
  actividades: z.array(GroqActividadSchema).min(0).max(20).describe("Lista de actividades encontradas (0..20)"),
  warnings: z.array(z.string()).optional().describe("Advertencias globales de la búsqueda"),
  confidence: z.number().min(0).max(1).optional().describe("Confianza global promedio 0..1"),
  ubicacion: z.string().optional().describe("Ubicación normalizada que usó el modelo"),
  total: z.number().int().min(0).optional().describe("Total de actividades encontradas"),
});

export type GroqBusquedaRaw = z.infer<typeof GroqBusquedaSchema>;

export type BuscarActividadesInput = {
  ubicacion: string;
  radioMetros?: number | undefined;
  categoria?: string | undefined;
  fechaDesde?: string | undefined; // YYYY-MM-DD
  model?: string | undefined;
};

/** IA path evidence mode: LIVE web evidence only. No local fallback. */
export type EvidenceMode = "live";

export type GroqBusquedaResult = {
  actividades: GroqActividad[];
  total: number;
  confidence: number; // global 0..1, recomputed server-side
  usedModel: string;
  ubicacion: string;
  warnings: string[];
  raw: GroqBusquedaRaw;
  evidenceMode: EvidenceMode;
  droppedCount: number; // items discarded by grounding post-validation
};

// ── Live web evidence (server-only) ──────────────────────────────────────────

/** A single real search snippet. URLs here are the ONLY allowed fuente_url values. */
export type LiveSnippet = {
  title: string;
  url: string;
  content: string;
  /** ISO date reported by the provider, or null when the snippet carries no date. */
  publishedDate: string | null;
  source: "tavily" | "serper" | "exa";
};

/** Local truth row (Supabase / ChileCultura / mock). DB rows may have no URL. */
export type LocalTruthItem = {
  nombre: string;
  descripcion: string;
  lugar: string;
  direccion: string;
  categoria: string;
  fuente_url: string | null;
  origin: "supabase" | "chilecultura" | "mock";
};

const TAVILY_ENDPOINT = "https://api.tavily.com/search";
const SERPER_ENDPOINT = "https://google.serper.dev/search";
const EXA_ENDPOINT = "https://api.exa.ai/search";
const LIVE_TIMEOUT_MS = 8_000;
const LIVE_MAX_RESULTS = 10;
/** Cap total de snippets fusionados multi-query (3 queries × 10). */
const LIVE_FUSED_CAP = 30;
/** Trusted municipal/government domains for live grounding. */
const LIVE_INCLUDE_DOMAINS = ["muniloprado.cl", "chilecultura.gob.cl", "gob.cl"];

/** Today in America/Santiago as YYYY-MM-DD (used for start_date + fecha filters). */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** True for absolute http(s) URLs. Relative or invented strings fail. */
export function isHttpUrl(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(value.trim());
}

/** Lowercase hostname without leading www, or null when unparseable. */
export function safeHostname(rawUrl: string): string | null {
  try {
    const host = new URL(rawUrl.trim()).hostname.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return null;
  }
}

type TavilyResult = { title?: unknown; url?: unknown; content?: unknown; published_date?: unknown };
type SerperOrganic = { title?: unknown; link?: unknown; snippet?: unknown };
type ExaResult = { title?: unknown; url?: unknown; text?: unknown; snippet?: unknown; publishedDate?: unknown };

function toPublishedDate(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/**
 * Genera 2-3 query variants para ampliar recall sin perder foco en la comuna.
 * Ej. para "Lo Prado, Santiago, Chile":
 * - "actividades talleres eventos Lo Prado, Santiago, Chile Chile"
 * - "talleres adulto mayor Lo Prado, Santiago Chile"
 * - "eventos municipalidad Lo Prado, Santiago actividades gratuitas tercera edad"
 * Deduplica exactos y corta a 300 chars (límite Tavily-friendly).
 */
export function buildTavilyQueries(ubicacion: string, queryHint?: string | undefined): string[] {
  const loc = ubicacion.trim().slice(0, 120);
  const shortLoc = loc.replace(/,\s*Chile\s*$/i, "").trim() || loc;
  const hint = typeof queryHint === "string" ? queryHint.trim().slice(0, 80) : "";
  const withHint = (base: string): string =>
    `${base}${hint ? ` ${hint}` : ""}`.trim().slice(0, 300);
  const queries = [
    withHint(`actividades talleres eventos ${loc} Chile`),
    withHint(`talleres adulto mayor ${shortLoc} Chile`),
    `eventos municipalidad ${shortLoc} actividades gratuitas tercera edad`.trim().slice(0, 300),
  ];
  return [...new Set(queries.map((q) => q.trim()).filter((q) => q.length > 0))].slice(0, 3);
}

/** Fusiona snippets deduplicando por URL exacta (trim). Mantiene primer orden visto. */
export function dedupSnippetsByUrl(snippets: LiveSnippet[]): LiveSnippet[] {
  const seen = new Set<string>();
  const out: LiveSnippet[] = [];
  for (const s of snippets) {
    const key = s.url.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

export async function searchViaTavily(apiKey: string, query: string): Promise<LiveSnippet[]> {
  const fetchOnce = async (withDomains: boolean, depth: "basic" | "advanced"): Promise<LiveSnippet[]> => {
    const res = await fetch(TAVILY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        api_key: apiKey, // legacy fallback: older Tavily keys still expect api_key in body
        query,
        search_depth: depth,
        // Tavily 400 rule: time_range and start_date/end_date are mutually exclusive.
        // Use ONLY time_range month (simple), never combined with start_date/end_date.
        time_range: "month",
        ...(withDomains ? { include_domains: LIVE_INCLUDE_DOMAINS } : {}),
        max_results: LIVE_MAX_RESULTS,
        include_answer: false,
        include_raw_content: false,
      }),
      signal: AbortSignal.timeout(LIVE_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`[tavily] HTTP ${res.status}`);
    const body = (await res.json()) as { results?: TavilyResult[] };
    const results = Array.isArray(body.results) ? body.results : [];
    return results
      .map((r) => ({
        title: typeof r.title === "string" ? r.title : "",
        url: typeof r.url === "string" ? r.url : "",
        content: typeof r.content === "string" ? r.content : "",
        publishedDate: toPublishedDate(r.published_date),
        source: "tavily" as const,
      }))
      .filter((s) => s.title.length > 0 && isHttpUrl(s.url));
  };

  // Doble intento basic: con dominios → sin dominios (antes de caer a Exa/local).
  const basicWith = await fetchOnce(true, "basic");
  if (basicWith.length > 0) return basicWith;
  console.warn("[searchViaTavily] 0 resultados basic con include_domains — reintentando basic sin dominios");
  const basicWithout = await fetchOnce(false, "basic");
  if (basicWithout.length > 0) return basicWithout;
  // Solo si basic da 0 en ambos: probar advanced (con → sin dominios).
  console.warn("[searchViaTavily] 0 resultados en basic — probando search_depth advanced");
  const advWith = await fetchOnce(true, "advanced");
  if (advWith.length > 0) return advWith;
  console.warn("[searchViaTavily] 0 resultados advanced con include_domains — reintentando advanced sin dominios");
  return fetchOnce(false, "advanced");
}

/**
 * Multi-query Tavily con fusión dedup por URL.
 * Llama searchViaTavily por cada variant y fusiona hasta LIVE_FUSED_CAP.
 * Cada llamada interna ya hace basic→advanced solo-si-0 + dominios→sin-dominios.
 */
export async function searchViaTavilyMulti(apiKey: string, queries: string[]): Promise<LiveSnippet[]> {
  const fused: LiveSnippet[] = [];
  for (const q of queries.slice(0, 3)) {
    try {
      const snippets = await searchViaTavily(apiKey, q);
      fused.push(...snippets);
    } catch (e) {
      console.warn("[searchViaTavilyMulti] query falló — continuando:", q.slice(0, 60), e instanceof Error ? e.message : String(e));
    }
    if (fused.length >= LIVE_FUSED_CAP) break;
  }
  return dedupSnippetsByUrl(fused).slice(0, LIVE_FUSED_CAP);
}

/** Exa fallback — same LiveSnippet[] shape, source "exa". Used when Tavily is empty or dateless. */
export async function searchViaExa(apiKey: string, query: string): Promise<LiveSnippet[]> {
  const res = await fetch(EXA_ENDPOINT, {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      numResults: LIVE_MAX_RESULTS,
      type: "auto",
      contents: { text: true },
    }),
    signal: AbortSignal.timeout(LIVE_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`[exa] HTTP ${res.status}`);
  const body = (await res.json()) as { results?: ExaResult[] };
  const results = Array.isArray(body.results) ? body.results : [];
  return results
    .map((r) => {
      const text = typeof r.text === "string" ? r.text : typeof r.snippet === "string" ? r.snippet : "";
      return {
        title: typeof r.title === "string" ? r.title : "",
        url: typeof r.url === "string" ? r.url : "",
        content: text,
        publishedDate: toPublishedDate(r.publishedDate),
        source: "exa" as const,
      };
    })
    .filter((s) => s.title.length > 0 && isHttpUrl(s.url));
}

async function searchViaSerper(apiKey: string, query: string): Promise<LiveSnippet[]> {
  const res = await fetch(SERPER_ENDPOINT, {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, gl: "cl", hl: "es", num: LIVE_MAX_RESULTS }),
    signal: AbortSignal.timeout(LIVE_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`[serper] HTTP ${res.status}`);
  const body = (await res.json()) as { organic?: SerperOrganic[] };
  const organic = Array.isArray(body.organic) ? body.organic : [];
  return organic
    .map((r) => ({
      title: typeof r.title === "string" ? r.title : "",
      url: typeof r.link === "string" ? r.link : "",
      content: typeof r.snippet === "string" ? r.snippet : "",
      publishedDate: null as string | null, // Serper organic results carry no date
      source: "serper" as const,
    }))
    .filter((s) => s.title.length > 0 && isHttpUrl(s.url));
}

/**
 * Real live web search, server-only.
 * - Reads TAVILY_API_KEY (primary), EXA_API_KEY (fallback for empty/dateless
 *   Tavily) and SERPER_API_KEY (last resort) from process.env — never from
 *   the client, never VITE_-prefixed.
 * - Returns [] (no throw) when no key is configured or all providers fail;
 *   callers return honest live/0 (no LLM, no DB) on [].
 */
export async function searchLive(ubicacion: string, queryHint?: string | undefined): Promise<LiveSnippet[]> {
  const queries = buildTavilyQueries(ubicacion, queryHint);
  const primaryQuery = queries[0] ?? `actividades talleres eventos ${ubicacion} Chile`.trim().slice(0, 300);

  // Undated-but-real Tavily snippets are kept as last-resort fallback.
  let undatedFallback: LiveSnippet[] = [];

  const tavilyKey = process.env["TAVILY_API_KEY"];
  if (tavilyKey && tavilyKey.trim().length > 0) {
    try {
      const snippets = await searchViaTavilyMulti(tavilyKey.trim(), queries);
      const hasDated = snippets.some((s) => s.publishedDate !== null);
      if (snippets.length > 0 && hasDated) return snippets;
      if (snippets.length > 0) {
        undatedFallback = snippets;
        console.warn("[searchLive] Tavily snippets lack published_date — trying Exa fallback");
      } else {
        console.warn("[searchLive] Tavily returned 0 usable snippets — trying Exa fallback");
      }
    } catch (e) {
      console.warn("[searchLive] Tavily failed — trying Exa fallback:", e instanceof Error ? e.message : String(e));
    }
  }

  const exaKey = process.env["EXA_API_KEY"];
  if (exaKey && exaKey.trim().length > 0) {
    try {
      const exaSnippets = await searchViaExa(exaKey.trim(), primaryQuery);
      if (exaSnippets.length > 0) {
        return dedupSnippetsByUrl([...undatedFallback, ...exaSnippets]).slice(0, LIVE_FUSED_CAP);
      }
      console.warn("[searchLive] Exa returned 0 usable snippets — trying Serper fallback");
    } catch (e) {
      console.warn("[searchLive] Exa failed — trying Serper fallback:", e instanceof Error ? e.message : String(e));
    }
  }

  const serperKey = process.env["SERPER_API_KEY"];
  if (serperKey && serperKey.trim().length > 0) {
    try {
      const serperSnippets = await searchViaSerper(serperKey.trim(), primaryQuery);
      if (serperSnippets.length > 0) return serperSnippets;
    } catch (e) {
      console.warn("[searchLive] Serper failed — continuing with fallback evidence:", e instanceof Error ? e.message : String(e));
    }
  }

  // No live key configured (or every provider empty/failed): honest live/0 upstream.
  // Return undated Tavily snippets when they are the only real evidence found.
  return undatedFallback;
}

// ── Local truth (Supabase + ChileCultura + mock) ─────────────────────────────

/**
 * Snapshot of verified local data.
 * @deprecated NOT used by the IA path (live-only since 2026-09-04: zero
 * invención, solo búsquedas IA en vivo). Kept for the TRADITIONAL path and
 * backwards compat — the IA never calls it. Traditional ChileCultura feed
 * lives in @/lib/chilecultura and stays always-on there.
 * Signature accepts either getLocalTruthSnapshot(limit, ubicacion) or
 * getLocalTruthSnapshot(ubicacion) for convenience.
 */
export async function getLocalTruthSnapshot(
  limitOrUbicacion: number | string = 20,
  ubicacionMaybe?: string | undefined,
): Promise<LocalTruthItem[]> {
  let limit = 20;
  let ubicacion = "";
  if (typeof limitOrUbicacion === "string") {
    ubicacion = limitOrUbicacion;
  } else {
    limit = limitOrUbicacion;
    ubicacion = ubicacionMaybe ?? "";
  }
  const out: LocalTruthItem[] = [];
  const cap = Math.min(Math.max(limit, 1), 50);
  const today = todayISO();
  const tokens = locationTokens(ubicacion);
  const communePattern = tokens.length > 0 ? `%${tokens[0]}%` : null;

  // 1) Supabase published activities (DB provenance, no external URL).
  // Mandatory: fecha >= today + comuna ilike filter when ubicacion is known.
  try {
    const { getPublicClient } = await import("@/lib/supabase.server");
    let query = getPublicClient()
      .from("actividades")
      .select("nombre,descripcion,lugar,direccion,categoria")
      .eq("estado", "publicada")
      .gte("fecha", today);
    if (communePattern) {
      query = query.or(
        `lugar.ilike.${communePattern},direccion.ilike.${communePattern},nombre.ilike.${communePattern}`,
      );
    }
    const { data, error } = await query.limit(cap);
    if (!error && Array.isArray(data)) {
      for (const row of data as Array<Record<string, unknown>>) {
        const nombre = typeof row["nombre"] === "string" ? row["nombre"] : "";
        if (!nombre) continue;
        out.push({
          nombre,
          descripcion: typeof row["descripcion"] === "string" ? (row["descripcion"] as string) : "",
          lugar: typeof row["lugar"] === "string" ? (row["lugar"] as string) : "",
          direccion: typeof row["direccion"] === "string" ? (row["direccion"] as string) : "",
          categoria: typeof row["categoria"] === "string" ? (row["categoria"] as string) : "",
          fuente_url: null,
          origin: "supabase",
        });
      }
    }
  } catch (e) {
    console.warn("[localTruth] Supabase read failed — continuing:", e instanceof Error ? e.message : String(e));
  }

  // 2) ChileCultura RM feed (always on, carries real permalinks).
  // Mandatory: commune token match + fecha >= today when ubicacion is known.
  try {
    const cc = await import("@/lib/chilecultura");
    const externas = await cc.fetchListaCached();
    const filtered = externas.filter((a) => {
      if ((a.fecha ?? "") < today) return false;
      if (tokens.length === 0) return true;
      const haystack = normalizeName(
        [a.lugar ?? "", a.direccion ?? "", a.nombre ?? ""].join(" "),
      );
      return tokens.some((t) => haystack.includes(t));
    });
    for (const a of filtered.slice(0, cap)) {
      if (!a.nombre) continue;
      out.push({
        nombre: a.nombre,
        descripcion: a.descripcion ?? "",
        lugar: a.lugar ?? "",
        direccion: a.direccion ?? "",
        categoria: a.categoria ?? "",
        fuente_url: typeof a.url === "string" && isHttpUrl(a.url) ? a.url : null,
        origin: "chilecultura",
      });
      if (out.length >= cap) break;
    }
  } catch (e) {
    console.warn("[localTruth] ChileCultura read failed — continuing:", e instanceof Error ? e.message : String(e));
  }

  // 3) Mock fallback DEV ONLY, never in production. Empty DB means zero local truth.
  if (out.length === 0 && process.env["NODE_ENV"] !== "production") {
    try {
      const { ACTIVIDADES } = await import("@/data/actividades");
      for (const a of ACTIVIDADES.slice(0, cap)) {
        out.push({
          nombre: a.nombre,
          descripcion: a.descripcion ?? "",
          lugar: a.lugar ?? "",
          direccion: a.direccion ?? "",
          categoria: a.categoria ?? "",
          fuente_url: null,
          origin: "mock",
        });
      }
    } catch (e) {
      console.warn("[localTruth] Mock fallback failed:", e instanceof Error ? e.message : String(e));
    }
  }

  return out.slice(0, cap);
}

// ── Client & model resolution ────────────────────────────────────────────────

export { DEFAULT_GROQ_MODEL };

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

/**
 * Crea un cliente OpenAI-compatible apuntando a Groq.
 * Lee GROQ_API_KEY DENTRO de la función (Workers-safe).
 */
export function getGroqClient(): OpenAI {
  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) {
    throw new Error(
      "[groq] Missing GROQ_API_KEY. Set it in your server env (Cloudflare / Nitro / .env). " +
        "Get a free key at https://console.groq.com/keys — no credit card required.",
    );
  }
  return new OpenAI({
    apiKey,
    baseURL: GROQ_BASE_URL,
    timeout: 30_000,
    maxRetries: 2,
  });
}

/**
 * Resuelve el modelo Groq a usar.
 * Prioridad: input model > env AI_EXTRACTOR_MODEL > GROQ_MODEL_OVERRIDE > AI_EXTRACTOR_MODEL_OVERRIDE > DEFAULT_GROQ_MODEL
 * DEFAULT = openai/gpt-oss-120b (verificado 2026-09-03: único que pasa json_object con el prompt de actividades).
 * Copiado exacto del patrón de feat/ai-model-selector:src/server/ai/extract-afiche.ts resolveModel()
 */
export function resolveGroqModel(override?: string): string {
  if (override && typeof override === "string" && override.trim().length > 0) {
    const trimmed = override.trim();
    // Validate flexibly — allow known ids and any qwen/meta-llama variant
    // Import dynamically to avoid circular? Use simple check here and defer full validation to caller if needed.
    if (trimmed.includes("/") || trimmed.includes("-")) {
      // Basic shape looks like a Groq model id — accept, full validation is done via isValidGroqModel where needed
      return trimmed;
    }
    console.warn(`[groq] Received invalid model "${trimmed}" — falling back to default`);
  }
  return (
    process.env["AI_EXTRACTOR_MODEL"] ??
    process.env["GROQ_MODEL_OVERRIDE"] ??
    process.env["AI_EXTRACTOR_MODEL_OVERRIDE"] ??
    process.env["GROQ_MODEL"] ??
    DEFAULT_GROQ_MODEL
  );
}

// ── Prompt (grounded — invention forbidden) ──────────────────────────────────

export type GroundingContext = {
  snippets: LiveSnippet[];
  /** Unused by the IA path (always []). Kept so callers/tests compile; IA never reads local truth. */
  localTruth: LocalTruthItem[];
  mode: EvidenceMode;
};

function formatEvidenceBlock(ctx: GroundingContext): string {
  const lines: string[] = [];
  if (ctx.snippets.length > 0) {
    lines.push("LIVE SEARCH RESULTS (real web evidence — when fuente_url is present it MUST equal one of these urls EXACTLY; fuente_url may be null when the activity NOMBRE appears verbatim below):");
    ctx.snippets.forEach((s, i) => {
      lines.push(`[${i + 1}] title: ${s.title}`);
      lines.push(`    url: ${s.url}`);
      lines.push(`    publishedDate: ${s.publishedDate ?? "sin fecha"}`);
      lines.push(`    snippet: ${s.content.slice(0, 400)}`);
    });
  } else {
    lines.push("LIVE SEARCH RESULTS: none (no live web evidence — return empty).");
  }
  return lines.join("\n");
}

export function buildGroqSystemPrompt(ubicacion: string, ctx?: GroundingContext | undefined): string {
  // Debe contener la palabra "JSON" para response_format: json_object
  const evidence = ctx ? formatEvidenceBlock(ctx) : "EVIDENCE: none (legacy call without grounding context — return empty).";
  return [
    "You are a strict grounding assistant for community activities in Chile. You NEVER invent data.",
    "Task: return ONLY activities whose NOMBRE appears VERBATIM (exact words, case-insensitive) in the LIVE SEARCH RESULTS below, and that mention the target ubicacion. Names NOT present in LIVE RESULTS are FORBIDDEN — never output them, even if they sound plausible or you know them.",
    "Copy each activity nombre VERBATIM (exact title as written in the snippet — do not paraphrase names).",
    "Citation is OPTIONAL but never invented. Every activity you return MUST satisfy ALL of these, otherwise OMIT it:",
    "- The activity nombre MUST appear verbatim (case-insensitive) inside some LIVE SEARCH RESULTS title or snippet content, AND the activity MUST mention the target ubicacion (lugar/direccion/descripcion).",
    "- fuente_url: CITE the exact snippet url when you can (character for character, same string from the allowed list). You MAY use null when the evidence states no usable URL — a null fuente_url with a verbatim name + location match is ACCEPTED (it will be shown as citation-missing). NEVER infer, guess, shorten, or compose URLs (no municipal homepages, no google.com, no made-up slugs). A same-domain URL that is not in the evidence list is INVALID and will be DISCARDED, along with the item.",
    "fecha rule: use a YYYY-MM-DD date ONLY when the snippet states one explicitly. When the snippet has no date (publishedDate: sin fecha), fecha MUST be null — never guess a date.",
    "hora rule: hora MUST be null when the snippet does not state a time explicitly — never invent a schedule.",
    "lugar rule: lugar MUST be null when the snippet does not name a venue explicitly — never invent a place name.",
    "direccion rule: direccion MUST be null when the snippet does not state a street/comuna explicitly — never invent street numbers or addresses.",
    "Missing data is EXPECTED and CORRECT: return the activity with null fields (it will be shown as partial-verified with 'no encontrado' labels). Omitting an activity for missing fecha/hora/direccion/lugar is a FAILURE; only omit for name-outside-evidence, location mismatch, or invalid/invented fuente_url.",
    "Focus on: talleres, charlas, paseos, deporte, cultura, salud, ejercicio, recreacion, aprendizaje — suitable for older adults but also general community.",
    "Do NOT hallucinate precise street numbers, dates, times, venues, or prices — use null when the evidence does not state them.",
    "If the evidence contains ZERO usable activities for the location, return {\"actividades\":[],\"total\":0} with a warnings entry saying no verified activities were found. An empty result is CORRECT; invented results are a FAILURE.",
    "Return ONLY valid JSON (no markdown, no fences, no commentary) matching this schema. The word JSON is required here for json_object mode.",
    "{",
    '  "actividades": [',
    "    {",
    '      "nombre": string (required, exact title as in the LIVE evidence — never a name from outside it),',
    '      "descripcion": string (required, 1–2 frases, only facts stated in the evidence),',
    '      "fecha": "YYYY-MM-DD" | null (only if the evidence states a date; else null),',
    '      "hora": string | null (only if stated; else null),',
    '      "lugar": string | null (venue name from evidence; else null),',
    '      "direccion": string | null (street + comuna from evidence; else null),',
    '      "categoria": "taller" | "paseo" | "charla" | "deporte" | "cultura" | "salud" | "ejercicio" | "recreacion" | "aprendizaje" | "otro",',
    '      "gratuito": boolean (only true when the evidence says free/gratis; else false),',
    '      "precio_texto": string | null (only when stated and not free),',
    '      "fuente_url": string (EXACT evidence URL) | null (allowed when the verbatim name + location match but no URL can be cited — never an invented URL),',
    '      "confidence": number 0..1 (your estimate; the server recomputes it and ignores inflated values),',
    '      "warnings": string[] | optional',
    "    }",
    "  ],",
    '  "warnings": string[] | optional,',
    '  "confidence": number 0..1 | optional,',
    '  "ubicacion": string | optional,',
    '  "total": number | optional',
    "}",
    "Rules:",
    "- Use null cuando el dato no está en la evidencia: fecha null, hora null, direccion null, lugar null si el snippet no los trae — nunca inventes fecha/hora/dirección/lugar/precio. Los nulos se muestran como parciales verificados, no se descartan.",
    "- fuente_url: citá la URL EXACTA del snippet si podés; si no hay URL usable, usá null (se acepta con nombre verbatim + ubicación). Nunca inventes URLs.",
    "- NUNCA generes nombres fuera de LIVE SEARCH RESULTS: cada nombre debe aparecer textual en algún title/content.",
    "- categoria debe ser uno de los enum; usa 'otro' si dudas.",
    "- Devuelve entre 0 y 12 actividades relevantes, ordenadas por cercanía/relevancia.",
    "- Prioriza actividades gratuitas o de bajo costo cuando la evidencia las muestre.",
    "- Fecha/hora en zona horaria de Chile (America/Santiago) si corresponde.",
    `- Ubicación objetivo del usuario: "${ubicacion}". Solo actividades DENTRO o ALREDEDOR de esa ubicación.`,
    "- Always return valid JSON. No markdown. The word JSON appears here intentionally.",
    "--- EVIDENCE START ---",
    evidence,
    "--- EVIDENCE END ---",
  ].join("\n");
}

function buildUserPrompt(input: BuscarActividadesInput, ctx?: GroundingContext | undefined): string {
  const parts: string[] = [];
  parts.push(`Ubicación: "${input.ubicacion}"`);
  if (input.radioMetros) parts.push(`Radio aproximado: ${input.radioMetros} metros`);
  if (input.categoria) parts.push(`Categoría preferida: ${input.categoria}`);
  if (input.fechaDesde) parts.push(`Fecha desde (YYYY-MM-DD): ${input.fechaDesde} — prioriza actividades en o después de esa fecha`);
  parts.push(
    "Instrucciones: devolvé SOLO actividades cuyo NOMBRE aparezca textual (verbatim, case-insensitive) en algún title/content de LIVE SEARCH RESULTS del system prompt y que mencionen la ubicación. Citá la fuente_url EXACTA del snippet si podés; si no hay URL usable, usá null (se acepta con nombre verbatim + ubicación). No uses tu conocimiento ni inventes nombres ni URLs. Si no hay evidencia usable, devolvé {\"actividades\":[],\"total\":0}. Devolvé SOLO JSON válido según el schema. No uses markdown. Usá null donde no tengas dato. El JSON debe ser válido.",
  );
  return parts.join("\n");
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function stripJsonFences(raw: string): string {
  // Retry path: qwen sin response_format vuelca <think>...</think> en content — removerlo antes de parsear.
  const withoutThink = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/<think>[\s\S]*$/gi, "");
  const trimmed = withoutThink.trim();
  if (trimmed.startsWith("```")) {
    const withoutOpen = trimmed.replace(/^```(?:json)?\s*/i, "");
    const withoutClose = withoutOpen.replace(/\s*```\s*$/, "");
    return withoutClose.trim();
  }
  return trimmed;
}

export function isRetryableGroqError(error: unknown): boolean {
  if (error instanceof OpenAI.APIError) {
    if (error.status === 429) return true;
    if (error.status !== undefined && error.status >= 500) return true;
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("timeout") || msg.includes("timed out") || msg.includes("etimedout")) return true;
    if (msg.includes("429") || msg.includes("rate limit")) return true;
  }
  return false;
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
    const code = String((error as { code?: unknown })?.code ?? (error as { error?: { code?: unknown } })?.error?.code ?? "").toLowerCase();
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
    const fgSuffix = fg ? ` failed_generation (primeros 500 chars): ${fg}` : " failed_generation vacía (el modelo no devolvió JSON).";
    if (error.status === 400) {
      return new Error(
        `[groq] Bad request (400). ${error.message}.${fgSuffix} ` +
          `Tip: qwen/qwen3.6-27b falla con response_format json_object en este prompt (verificado 2026-09-03) — se reintentó sin formato una vez; si persiste, probá model openai/gpt-oss-120b.`,
      );
    }
    if (error.status === 429) {
      return new Error(
        `[groq] Rate limit exceeded (429). Groq free tier is 30 RPM / 1K RPD. ` +
          `Wait a moment and retry. Details: ${error.message}`,
      );
    }
    if (error.status === 401) {
      return new Error(`[groq] Unauthorized (401). Check GROQ_API_KEY is valid at https://console.groq.com/keys. Details: ${error.message}`);
    }
    if (
      error instanceof OpenAI.APIConnectionTimeoutError ||
      error.message.toLowerCase().includes("timeout")
    ) {
      return new Error(`[groq] Request timed out after 30s. Groq may be busy. Try again.`);
    }
  }
  if (error instanceof Error) {
    const lower = error.message.toLowerCase();
    if (lower.includes("timeout") || lower.includes("timed out")) {
      return new Error(`[groq] Request timed out after 30s. Try again. Cause: ${error.message}`);
    }
    if (lower.includes("429") || lower.includes("rate limit") || lower.includes("quota")) {
      return new Error(`[groq] Rate limit / quota (429) — wait and retry. Cause: ${error.message}`);
    }
    if (lower.includes("401") || lower.includes("unauthorized") || lower.includes("groq_api_key")) {
      return new Error(`[groq] Unauthorized — check GROQ_API_KEY at https://console.groq.com/keys. Cause: ${error.message}`);
    }
  }
  if (error instanceof Error) return error;
  return new Error(`[groq] Unknown error: ${String(error)}`);
}

// ── Grounding post-validation ────────────────────────────────────────────────

/** Normalized name comparison: case/accent-insensitive, punctuation-tolerant. */
function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when the item name matches a local-truth row (exact or strong containment).
 * @deprecated IA path no longer uses local truth (live-only). Kept for compat. */
function matchesLocalTruth(itemName: string, localTruth: LocalTruthItem[]): LocalTruthItem | null {
  const norm = normalizeName(itemName);
  if (norm.length < 4) return null;
  for (const row of localTruth) {
    const rowNorm = normalizeName(row.nombre);
    if (!rowNorm) continue;
    if (norm === rowNorm) return row;
    // Strong containment either way (min 8 chars overlap guard via shorter length)
    const shorter = norm.length <= rowNorm.length ? norm : rowNorm;
    const longer = norm.length <= rowNorm.length ? rowNorm : norm;
    if (shorter.length >= 8 && longer.includes(shorter)) return row;
  }
  return null;
}

/** Location tokens (commune/neighborhood words) that must appear in the item. */
function locationTokens(ubicacion: string): string[] {
  const stop = new Set(["chile", "region", "de", "del", "la", "el", "los", "las", "y", "en"]);
  return normalizeName(ubicacion)
    .split(" ")
    .filter((t) => t.length >= 4 && !stop.has(t));
}

/** True when at least one location token matches lugar/direccion/descripcion/nombre. */
function locationMatches(item: GroqActividad, ubicacion: string): boolean {
  const tokens = locationTokens(ubicacion);
  if (tokens.length === 0) return true; // nothing concrete to check against
  const haystack = normalizeName(
    [item.lugar ?? "", item.direccion ?? "", item.descripcion ?? "", item.nombre ?? ""].join(" "),
  );
  return tokens.some((t) => haystack.includes(t));
}

/**
 * True when the activity NOMBRE appears VERBATIM (case-insensitive, trim)
 * inside some snippet title/content. This is the anti-invention gate:
 * a name outside every snippet is invented, even with a plausible URL.
 */
export function nameVerbatimInSnippets(nombre: string, snippets: LiveSnippet[]): boolean {
  const needle = nombre.trim().toLowerCase();
  if (needle.length < 4) return false;
  return snippets.some(
    (s) =>
      s.title.toLowerCase().includes(needle) ||
      s.content.toLowerCase().includes(needle),
  );
}

/**
 * Server-side confidence — computed from evidence, NEVER from the LLM value:
 * - verbatim name in live evidence (+ location handled below): +0.55
 * - exact citation (fuente_url === evidence URL): +0.15 bonus
 * - location token match: +0.20
 * - concrete date present: +0.10
 * - missing-field penalty: -0.05 per null among fecha/hora/lugar/direccion
 * Base 0.10, capped at 0.95. Exact-cited items have a floor of 0.70 so
 * partial-verified items still reach the client with explicit warnings.
 * Citation-missing items (null fuente_url but verbatim name + location)
 * clamp to 0.75–0.80 with an explicit warning, so the UI can render
 * "Fuente no informada" instead of hiding the card.
 */
export function groundedItemConfidence(
  item: GroqActividad,
  ubicacion: string,
  opts: { cited: boolean; nameVerbatim: boolean; localMatch?: boolean },
): number {
  const verbatim = opts.nameVerbatim || opts.localMatch === true;
  let score = 0.1;
  if (verbatim) score += 0.55;
  if (opts.cited && verbatim) score += 0.15;
  if (locationMatches(item, ubicacion)) score += 0.2;
  if (item.fecha !== null && item.fecha.length === 10) score += 0.1;
  const missingCount = [
    item.fecha == null,
    item.hora == null,
    item.lugar == null,
    item.direccion == null,
  ].filter(Boolean).length;
  score -= 0.05 * missingCount;
  if (opts.cited && verbatim) {
    return Math.min(0.95, Math.max(0.7, Number(score.toFixed(2))));
  }
  if (verbatim) {
    return Math.min(0.8, Math.max(0.75, Number(score.toFixed(2))));
  }
  return Math.min(0.95, Math.max(0, Number(score.toFixed(2))));
}

/** Warnings for missing fields — rendered by the UI as "no encontrado" placeholders. */
export function missingFieldWarnings(item: GroqActividad): string[] {
  const warnings: string[] = [];
  if (item.fecha == null) warnings.push("Fecha no encontrada en la evidencia");
  if (item.hora == null) warnings.push("Horario no encontrado en la evidencia");
  if (item.lugar == null && item.direccion == null) {
    warnings.push("Dirección no encontrada en la evidencia");
  } else if (item.direccion == null) {
    warnings.push("Dirección no encontrada en la evidencia");
  } else if (item.lugar == null) {
    warnings.push("Lugar no encontrado en la evidencia");
  }
  return warnings;
}

/** Warning pushed when an item passes with verbatim name but without URL citation. */
export const CITATION_MISSING_MARKER =
  "cita faltante: Fuente no informada por el modelo (nombre verificado verbatim en evidencia web)";

/** @deprecated IA path no longer emits local-truth markers (live-only). Kept for compat. */
export const LOCAL_TRUTH_MARKER = "local-truth: verified against app data (Supabase/ChileCultura)";

export type GroundingOutcome = {
  kept: GroqActividad[];
  droppedCount: number;
  notes: string[];
};

/**
 * Live-only grounding. Drops every item that cannot be traced to the LIVE
 * snippets (local truth is NEVER consulted here):
 * - nombre NOT verbatim in any snippet title/content → DROP, even with URL.
 * - ubicación mismatch (no location token in lugar/direccion/descripcion/
 *   nombre) → DROP.
 * - fuente_url present but NOT an exact evidence URL → DROP (invented URL).
 * - fuente_url null + verbatim name + location match → KEEP as
 *   citation-missing (confidence clamped 0.75–0.80 + CITATION_MISSING_MARKER).
 * - fuente_url exact + verbatim name + location match → KEEP with +0.15
 *   citation bonus (floor 0.70).
 * Missing fields (fecha/hora/lugar/direccion null) NEVER cause a drop: kept
 * items carry missingFieldWarnings + penalized confidence (see
 * groundedItemConfidence).
 * Recomputes per-item confidence server-side and averages the RECOMPUTED
 * scores for the global value (model self-reported confidence is ignored,
 * never averaged).
 */
export function applyGroundingFilter(
  actividades: GroqActividad[],
  ubicacion: string,
  ctx: GroundingContext,
): GroundingOutcome {
  const allowedHosts = new Set<string>();
  const allowedUrls = new Set<string>();
  for (const s of ctx.snippets) {
    const host = safeHostname(s.url);
    if (host) allowedHosts.add(host);
    allowedUrls.add(s.url.trim());
  }

  const kept: GroqActividad[] = [];
  let droppedCount = 0;
  const notes: string[] = [];

  for (const item of actividades) {
    const nombre = typeof item.nombre === "string" ? item.nombre : "";
    const verbatim = nameVerbatimInSnippets(nombre, ctx.snippets);
    if (!verbatim || !locationMatches(item, ubicacion)) {
      droppedCount += 1;
      continue;
    }
    const fuenteRaw = typeof item.fuente_url === "string" ? item.fuente_url.trim() : "";
    if (fuenteRaw.length === 0) {
      // Citation-missing: verbatim name + location is enough to pass.
      const warnings = [...(item.warnings ?? []), ...missingFieldWarnings(item), CITATION_MISSING_MARKER];
      kept.push({
        ...item,
        fuente_url: null,
        confidence: groundedItemConfidence(item, ubicacion, { cited: false, nameVerbatim: true }),
        warnings,
      });
      continue;
    }
    // URL present: exact evidence membership is MANDATORY; hostname alone never suffices.
    const hasHttp = isHttpUrl(fuenteRaw);
    const host = hasHttp ? safeHostname(fuenteRaw) : null;
    const exactUrl = hasHttp && allowedUrls.has(fuenteRaw);
    const cited = exactUrl && host !== null && allowedHosts.has(host);
    if (!cited) {
      droppedCount += 1;
      continue;
    }
    const warnings = [...(item.warnings ?? []), ...missingFieldWarnings(item)];
    kept.push({
      ...item,
      fuente_url: fuenteRaw,
      confidence: groundedItemConfidence(item, ubicacion, { cited: true, nameVerbatim: true }),
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  }

  if (droppedCount > 0) {
    notes.push(
      `Grounding: se descartaron ${droppedCount} actividades sin respaldo verbatim en evidencia web (nombre fuera de evidencia, ubicación sin match o fuente_url inventada/ausente de la evidencia exacta).`,
    );
  }
  return { kept, droppedCount, notes };
}

function averageConfidence(items: GroqActividad[]): number {
  if (items.length === 0) return 0;
  const avg = items.reduce((acc, a) => acc + a.confidence, 0) / items.length;
  return Math.min(1, Math.max(0, Number(avg.toFixed(2))));
}

// ── Main ─────────────────────────────────────────────────────────────────────

/**
 * Busca actividades VERIFICADAS cerca de una ubicación (LIVE-ONLY).
 * 1) Fetches real live web snippets via searchLive().
 * 2) Zero live snippets → returns live/0 WITHOUT calling the LLM and
 *    WITHOUT reading any local truth (no Supabase, no ChileCultura, no mock).
 * 3) Calls Groq with live-grounded prompts (invention forbidden, citation optional).
 * 4) Post-validates grounding (verbatim name + location; exact URL when present),
 *    recomputes confidence server-side.
 * Pure function — no TanStack imports, safe for server handlers.
 */
export async function buscarActividadesConGroq(input: BuscarActividadesInput): Promise<GroqBusquedaResult> {
  const ubicacion = input.ubicacion?.trim() ?? "";
  if (ubicacion.length < 3) {
    throw new Error("[buscarActividadesConGroq] ubicacion must be at least 3 characters (ej. 'Lo Prado, Santiago').");
  }
  if (ubicacion.length > 200) {
    throw new Error("[buscarActividadesConGroq] ubicacion must be at most 200 characters.");
  }

  // 1) Real LIVE evidence first — never ask the model to guess.
  // The IA path NEVER reads local truth (no DB here by design).
  const snippets = await searchLive(ubicacion, input.categoria);
  const mode: EvidenceMode = "live";

  const ctx: GroundingContext = { snippets, localTruth: [], mode };

  // 2) Zero live snippets → honest live/0, no LLM call, no DB read.
  // This path runs BEFORE getGroqClient() so it never requires GROQ_API_KEY.
  if (snippets.length === 0) {
    const model = resolveGroqModel(input.model);
    const emptyRaw: GroqBusquedaRaw = {
      actividades: [],
      warnings: ["Sin actividades verificadas: la búsqueda web en vivo no devolvió evidencia para esta ubicación."],
      confidence: 0,
      ubicacion,
      total: 0,
    };
    return {
      actividades: [],
      total: 0,
      confidence: 0,
      usedModel: model,
      ubicacion,
      warnings: [...(emptyRaw.warnings ?? [])],
      raw: emptyRaw,
      evidenceMode: mode,
      droppedCount: 0,
    };
  }

  const client = getGroqClient();
  const model = resolveGroqModel(input.model);

  const systemPrompt = buildGroqSystemPrompt(ubicacion, ctx);
  const userPrompt = buildUserPrompt({ ...input, ubicacion }, ctx);

  let rawContent: string | null | undefined;
  const requestOnce = async (useJsonMode: boolean) => {
    return (await client.chat.completions.create({
      model,
      temperature: 0.2,
      ...(useJsonMode ? { response_format: { type: "json_object" } as const } : {}),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    })) as OpenAI.Chat.Completions.ChatCompletion;
  };
  const parseAndValidate = (raw: string): GroqBusquedaResult => {
    const cleaned = stripJsonFences(raw);
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      throw new Error(
        `[groq] Failed to parse JSON from model. Raw (first 800 chars): ${cleaned.slice(0, 800)} — ${(parseErr as Error).message}`,
      );
    }

    // Validar con Zod — si el modelo devolvió { actividades: [...] } incompleto, intentamos normalizar
    let validated: GroqBusquedaRaw;
    try {
      validated = GroqBusquedaSchema.parse(parsed);
    } catch (zodErr) {
      // Intento de recuperación: si el modelo devolvió un array directo o un objeto con otra key
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

    // 4) Grounding post-validation: shape is not enough — every item must be
    // traceable to the evidence. Model confidence is discarded and recomputed.
    const rawItems = validated.actividades ?? [];
    const { kept, droppedCount, notes } = applyGroundingFilter(rawItems, ubicacion, ctx);
    const warnings = [...(validated.warnings ?? []), ...notes];
    if (kept.length === 0) {
      warnings.push("Sin actividades verificadas: ningún resultado del modelo tenía cita válida en la evidencia.");
    }
    const confidence = averageConfidence(kept);
    const total = kept.length;

    return {
      actividades: kept,
      total,
      confidence,
      usedModel: model,
      ubicacion,
      warnings,
      raw: validated,
      evidenceMode: mode,
      droppedCount,
    };
  };
  try {
    try {
      const completion = await requestOnce(true);
      rawContent = completion.choices[0]?.message?.content;
      if (!rawContent) {
        throw new Error("[groq] Empty response content from model (no choices[0].message.content).");
      }
      return parseAndValidate(rawContent);
    } catch (firstErr) {
      // Resiliencia: ante 400 json_validate_failed (qwen + json_object), reintentar UNA vez sin response_format.
      if (!isJsonValidationFailure(firstErr)) throw firstErr;
      console.warn(`[groq] json_object rechazado por ${model} (400 json_validate_failed) — reintentando una vez sin response_format`);
      const retryCompletion = await requestOnce(false);
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

/**
 * Wrapper con fallback.
 * Intenta Groq con grounding; ante error retryable loguea warning para futuro
 * proveedor secundario. La búsqueda web viva (Tavily/Exa/Serper) ya corre dentro
 * de buscarActividadesConGroq vía searchLive().
 */
export async function buscarConFallback(input: BuscarActividadesInput): Promise<GroqBusquedaResult> {
  try {
    return await buscarActividadesConGroq(input);
  } catch (error) {
    if (isRetryableGroqError(error)) {
      console.warn("[buscarConFallback] Groq retryable error — no secondary LLM provider configured.", error);
    }
    throw error;
  }
}

// Aliases for backwards compatibility (grok → groq migration)
// TODO: remove these aliases after PR #6 is merged and old imports are gone
export const GrokActividadSchema = GroqActividadSchema;
export const GrokBusquedaSchema = GroqBusquedaSchema;
export type GrokActividad = GroqActividad;
export type GrokBusquedaRaw = GroqBusquedaRaw;
export type GrokBusquedaResult = GroqBusquedaResult;
export const DEFAULT_GROK_MODEL = DEFAULT_GROQ_MODEL;
export const getGrokClient = getGroqClient;
export const resolveGrokModel = resolveGroqModel;
export const buildGrokSystemPrompt = buildGroqSystemPrompt;
export const buscarActividadesConGrok = buscarActividadesConGroq;
export const isRetryableGrokError = isRetryableGroqError;
