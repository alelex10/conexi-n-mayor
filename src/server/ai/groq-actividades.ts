import OpenAI from "openai";
import { z } from "zod";

/**
 * Conexión Mayor — Groq web-search actividades por ubicación
 *
 * Lógica pura (sin createServerFn, sin imports de TanStack).
 * Patrón replicado de src/server/ai/extract-afiche.ts (Groq vision) adaptado a
 * búsqueda simulada de actividades con Groq (no tiene Live Search nativo como xAI).
 *
 * - Usa OpenAI SDK con baseURL https://api.groq.com/openai/v1 (compatible)
 * - Env (GROQ_API_KEY) se lee DENTRO de getGroqClient() — Workers-safe (Cloudflare/Nitro)
 * - response_format: json_object requiere la palabra "JSON" en el prompt
 * - Groq no tiene búsqueda web nativa: se simula vía prompt pidiendo al LLM que actúe
 *   como buscador y genere actividades plausibles basadas en conocimiento + estructura.
 *   TODO: integrar hook para API de búsqueda externa (ej. Tavily / Serper) cuando se configure.
 */

import { DEFAULT_GROQ_MODEL } from "./models";

// ── Schemas ──────────────────────────────────────────────────────────────────

/**
 * Categoria flexible: se aceptan valores conocidos y cualquier string ("otro" como fallback).
 * El modelo debe intentar usar uno de los conocidos; si no, usar "otro".
 * Usamos z.enum con .catch para normalizar desconocidos sin fallar la validación.
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
  fuente_url: z.string().url().nullable().optional().describe("URL de la fuente donde se encontró la actividad, o null"),
  confidence: z.number().min(0).max(1).describe("Confianza 0..1 de que esta actividad sea real y correcta para la ubicación"),
  warnings: z.array(z.string()).optional().describe("Advertencias / incertidumbres para esta actividad"),
});

export type GroqActividad = z.infer<typeof GroqActividadSchema>;

/**
 * Respuesta esperada del modelo (JSON object root).
 * El modelo debe devolver { actividades: [...] } con al menos este shape.
 * Se permiten campos opcionales adicionales (ubicacion, warnings, confidence total, etc.).
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
  latitud?: number | undefined; // -90..90, device coords (ephemeral, advisory only)
  longitud?: number | undefined; // -180..180, device coords (ephemeral, advisory only)
  locationLabel?: string | undefined; // reverse-geocoded place NAME, display only
};

export type GroqBusquedaResult = {
  actividades: GroqActividad[];
  total: number;
  confidence: number; // global 0..1
  usedModel: string;
  ubicacion: string;
  warnings: string[];
  raw: GroqBusquedaRaw;
};

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

// ── Prompt ───────────────────────────────────────────────────────────────────

export function buildGroqSystemPrompt(ubicacion: string): string {
  // Debe contener la palabra "JSON" para response_format: json_object
  return [
    "You are a precise assistant for community activities in Chile that simulates web search.",
    "Task: based on your knowledge (and as if you had searched the web), list REAL plausible current/upcoming activities near the given location.",
    'Focus on: talleres, charlas, paseos, deporte, cultura, salud, ejercicio, recreacion, aprendizaje — suitable for older adults but also general community.',
    "Be helpful and grounded: prefer official municipal, cultural center, library, CESFAM, and event sites as if you had found them. Do NOT hallucinate precise street numbers if unsure — use null.",
    "Return ONLY valid JSON (no markdown, no fences, no commentary) matching this schema. The word JSON is required here for json_object mode.",
    "{",
    '  "actividades": [',
    "    {",
    '      "nombre": string (required, título de la actividad),',
    '      "descripcion": string (required, 1–2 frases),',
    '      "fecha": "YYYY-MM-DD" | null (usar null si no hay fecha o es permanente; si infiere año use el actual),',
    '      "hora": string | null (ej. "10:30"),',
    '      "lugar": string | null (nombre del recinto),',
    '      "direccion": string | null (calle, comuna, ciudad),',
    '      "categoria": "taller" | "paseo" | "charla" | "deporte" | "cultura" | "salud" | "ejercicio" | "recreacion" | "aprendizaje" | "otro",',
    '      "gratuito": boolean,',
    '      "precio_texto": string | null (ej. "$2.000" si no es gratuito),',
    '      "fuente_url": string (url) | null (incluir cuando exista fuente web inferida o conocida),',
    '      "confidence": number 0..1 (qué tan seguro estás de que existe y corresponde a la ubicación),',
    '      "warnings": string[] | optional',
    "    }",
    "  ],",
    '  "warnings": string[] | optional (advertencias globales),',
    '  "confidence": number 0..1 | optional (confianza global promedio),',
    '  "ubicacion": string | optional (ubicación normalizada),',
    '  "total": number | optional',
    "}",
    "Rules:",
    "- Use null cuando no tengas el dato (no inventes fecha/dirección).",
    "- categoria debe ser uno de los enum; usa 'otro' si dudas.",
    "- confidence: sé calibrado; <0.85 es incierto y debería ir a revisión humana (HITL). Si dudas de la existencia, baja confidence.",
    "- Incluye fuente_url cuando la tengas o puedas inferir (ej. sitio municipal). Si no hay URL conocida, usa null.",
    "- Devuelve entre 0 y 12 actividades relevantes, ordenadas por cercanía/relevancia.",
    "- Prioriza actividades gratuitas o de bajo costo.",
    "- Fecha/hora en zona horaria de Chile (America/Santiago) si corresponde.",
    `- Ubicación objetivo del usuario: "${ubicacion}". Busca DENTRO y ALREDEDOR de esa ubicación, no en otra comuna lejana.`,
    "- Always return valid JSON. No markdown. The word JSON appears here intentionally.",
    // Hook para futura búsqueda externa
    // TODO: cuando se integre Tavily/Serper/Brave Search, inyectar aquí resultados reales de búsqueda web antes de pedir JSON.
  ].join("\n");
}

export function buildUserPrompt(input: BuscarActividadesInput): string {
  const parts: string[] = [];
  parts.push(`Ubicación: "${input.ubicacion}"`);
  if (typeof input.latitud === "number" && typeof input.longitud === "number") {
    const labelSuffix =
      typeof input.locationLabel === "string" && input.locationLabel.trim().length > 0
        ? ` cerca de ${input.locationLabel.trim()}`
        : "";
    parts.push(
      `Ubicación del dispositivo (coords aproximadas, solo referencia, sin calcular distancias): ${input.latitud}, ${input.longitud}${labelSuffix} — prioriza actividades plausiblemente cercanas; nunca afirmes distancias en metros.`,
    );
  }
  if (input.radioMetros) parts.push(`Radio aproximado: ${input.radioMetros} metros`);
  if (input.categoria) parts.push(`Categoría preferida: ${input.categoria}`);
  if (input.fechaDesde) parts.push(`Fecha desde (YYYY-MM-DD): ${input.fechaDesde} — prioriza actividades en o después de esa fecha`);
  parts.push(
    "Instrucciones: Buscá actividades REALES y actuales cerca de esa ubicación (actuá como si hubieras buscado en la web con tu conocimiento). Devolvé SOLO JSON válido según el schema del system prompt. No uses markdown. Usá null donde no tengas dato. Incluí fuente_url cuando exista o sea inferible. El JSON debe ser válido.",
  );
  return parts.join("\n");
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function stripJsonFences(raw: string): string {
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

function computeGlobalConfidence(raw: GroqBusquedaRaw, actividades: GroqActividad[]): number {
  if (typeof raw.confidence === "number") return Math.min(1, Math.max(0, raw.confidence));
  if (actividades.length === 0) return 0.5;
  const withConf = actividades.filter((a) => typeof a.confidence === "number");
  if (withConf.length === 0) return 0.5;
  const avg = withConf.reduce((acc, a) => acc + a.confidence, 0) / withConf.length;
  return Math.min(1, Math.max(0, Number(avg.toFixed(2))));
}

// ── Main ─────────────────────────────────────────────────────────────────────

/**
 * Busca actividades plausibles cerca de una ubicación usando Groq (simula búsqueda web vía prompt).
 * Función pura — sin imports de TanStack, safe para handlers server.
 * TODO: integrar búsqueda web externa (Tavily/Serper) e inyectar resultados en el prompt para grounding real.
 */
export async function buscarActividadesConGroq(input: BuscarActividadesInput): Promise<GroqBusquedaResult> {
  const ubicacion = input.ubicacion?.trim() ?? "";
  if (ubicacion.length < 3) {
    throw new Error("[buscarActividadesConGroq] ubicacion must be at least 3 characters (ej. 'Lo Prado, Santiago').");
  }
  if (ubicacion.length > 200) {
    throw new Error("[buscarActividadesConGroq] ubicacion must be at most 200 characters.");
  }

  const client = getGroqClient();
  const model = resolveGroqModel(input.model);

  const systemPrompt = buildGroqSystemPrompt(ubicacion);
  const userPrompt = buildUserPrompt({ ...input, ubicacion });

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
 * Wrapper con fallback (placeholder para segundo proveedor).
 * Intenta Groq; ante error retryable loguea warning para futuro fallback.
 */
export async function buscarConFallback(input: BuscarActividadesInput): Promise<GroqBusquedaResult> {
  try {
    return await buscarActividadesConGroq(input);
  } catch (error) {
    if (isRetryableGroqError(error)) {
      console.warn("[buscarConFallback] Groq retryable error — would fallback if secondary provider configured.", error);
      // TODO: if (process.env.TAVILY_API_KEY) return await buscarConTavilyFallback(input);
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
