import OpenAI from "openai";
import { z } from "zod";

/**
 * Conexión Mayor — Grok (xAI) web-search actividades por ubicación
 *
 * Lógica pura (sin createServerFn, sin imports de TanStack).
 * Patrón replicado de src/server/ai/extract-afiche.ts (Groq vision) adaptado a
 * búsqueda web de actividades con xAI Live Search.
 *
 * - Usa OpenAI SDK con baseURL https://api.x.ai/v1 (compatible, sin xai-sdk extra)
 * - Env (XAI_API_KEY) se lee DENTRO de getGrokClient() — Workers-safe (Cloudflare/Nitro)
 * - response_format: json_object requiere la palabra "JSON" en el prompt
 * - Live Search: grok-4 soporta búsqueda web nativa vía `search_parameters: { mode: "auto" }`.
 *   Se envía condicionalmente (cast a any) para no romper si el tipo del SDK no lo incluye aún.
 */

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

export const GrokActividadSchema = z.object({
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

export type GrokActividad = z.infer<typeof GrokActividadSchema>;

/**
 * Respuesta esperada del modelo (JSON object root).
 * El modelo debe devolver { actividades: [...] } con al menos este shape.
 * Se permiten campos opcionales adicionales (ubicacion, warnings, confidence total, etc.).
 */
export const GrokBusquedaSchema = z.object({
  actividades: z.array(GrokActividadSchema).min(0).max(20).describe("Lista de actividades encontradas (0..20)"),
  warnings: z.array(z.string()).optional().describe("Advertencias globales de la búsqueda"),
  confidence: z.number().min(0).max(1).optional().describe("Confianza global promedio 0..1"),
  ubicacion: z.string().optional().describe("Ubicación normalizada que usó el modelo"),
  total: z.number().int().min(0).optional().describe("Total de actividades encontradas"),
});

export type GrokBusquedaRaw = z.infer<typeof GrokBusquedaSchema>;

export type BuscarActividadesInput = {
  ubicacion: string;
  radioMetros?: number | undefined;
  categoria?: string | undefined;
  fechaDesde?: string | undefined; // YYYY-MM-DD
  model?: string | undefined;
};

export type GrokBusquedaResult = {
  actividades: GrokActividad[];
  total: number;
  confidence: number; // global 0..1
  usedModel: string;
  ubicacion: string;
  warnings: string[];
  raw: GrokBusquedaRaw;
};

// ── Client & model resolution ────────────────────────────────────────────────

export const DEFAULT_GROK_MODEL = "grok-4-0709";

const GROK_BASE_URL = "https://api.x.ai/v1";

/**
 * Crea un cliente OpenAI-compatible apuntando a xAI.
 * Lee XAI_API_KEY DENTRO de la función (Workers-safe).
 * No uses GROQ_API_KEY para Grok — usa XAI_API_KEY.
 */
export function getGrokClient(): OpenAI {
  const apiKey = process.env["XAI_API_KEY"];
  if (!apiKey) {
    throw new Error(
      "[grok] Missing XAI_API_KEY. Set it in your server env (Cloudflare / Nitro / .env). " +
        "Get a key at https://console.x.ai — Docs: https://docs.x.ai/docs/overview",
    );
  }
  return new OpenAI({
    apiKey,
    baseURL: GROK_BASE_URL,
    timeout: 30_000,
    maxRetries: 2,
  });
}

/**
 * Resuelve el modelo Grok a usar.
 * Prioridad: input model > env GROK_MODEL > GROK_MODEL_OVERRIDE > XAI_MODEL > DEFAULT_GROK_MODEL
 * DEFAULT = grok-4-0709 (Live Search nativo, 131K context, $3/$15 por 1M tokens).
 * Fallback documentado: grok-3-latest (rápido, compatible) y grok-3-mini (económico).
 */
export function resolveGrokModel(override?: string): string {
  if (override && override.trim().length > 0) return override.trim();
  return (
    process.env["GROK_MODEL"] ??
    process.env["GROK_MODEL_OVERRIDE"] ??
    process.env["XAI_MODEL"] ??
    process.env["AI_GROK_MODEL"] ??
    DEFAULT_GROK_MODEL
  );
}

// ── Prompt ───────────────────────────────────────────────────────────────────

export function buildGrokSystemPrompt(ubicacion: string): string {
  // Debe contener la palabra "JSON" para response_format: json_object
  return [
    "You are a precise web-search assistant for community activities in Chile.",
    "Task: search the web for REAL current/upcoming activities near the given location.",
    'Focus on: talleres, charlas, paseos, deporte, cultura, salud, ejercicio, recreacion, aprendizaje — suitable for older adults but also general community.',
    "You have Live Search / web search available. Use it. Prefer official municipal, cultural center, library, CESFAM, and event sites.",
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
    '      "fuente_url": string (url) | null (incluir cuando exista fuente web),',
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
    "- confidence: sé calibrado; <0.85 es incierto y debería ir a revisión humana (HITL).",
    "- Incluye fuente_url cuando la tengas — ayuda a verificar.",
    "- Devuelve entre 0 y 12 actividades relevantes, ordenadas por cercanía/relevancia.",
    "- Prioriza actividades gratuitas o de bajo costo.",
    "- Fecha/hora en zona horaria de Chile (America/Santiago) si corresponde.",
    `- Ubicación objetivo del usuario: "${ubicacion}". Busca DENTRO y ALREDEDOR de esa ubicación, no en otra comuna lejana.`,
    "- Always return valid JSON. No markdown. The word JSON appears here intentionally.",
  ].join("\n");
}

function buildUserPrompt(input: BuscarActividadesInput): string {
  const parts: string[] = [];
  parts.push(`Ubicación: "${input.ubicacion}"`);
  if (input.radioMetros) parts.push(`Radio aproximado: ${input.radioMetros} metros`);
  if (input.categoria) parts.push(`Categoría preferida: ${input.categoria}`);
  if (input.fechaDesde) parts.push(`Fecha desde (YYYY-MM-DD): ${input.fechaDesde} — prioriza actividades en o después de esa fecha`);
  parts.push(
    "Instrucciones: Buscá en la web actividades REALES y actuales cerca de esa ubicación. Devolvé SOLO JSON válido según el schema del system prompt. No uses markdown. Usá null donde no tengas dato. Incluí fuente_url cuando exista.",
  );
  return parts.join("\n");
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function stripJsonFences(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("```")) {
    const withoutOpen = trimmed.replace(/^```(?:json)?\s*/i, "");
    const withoutClose = withoutOpen.replace(/\s*```\s*$/, "");
    return withoutClose.trim();
  }
  return trimmed;
}

export function isRetryableGrokError(error: unknown): boolean {
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

function toFriendlyError(error: unknown): Error {
  if (error instanceof OpenAI.APIError) {
    if (error.status === 429) {
      return new Error(
        `[grok] Rate limit / quota exceeded (429). xAI free trial has strict limits. ` +
          `Wait a moment and retry. If on free tier, check https://console.x.ai usage. Details: ${error.message}`,
      );
    }
    if (error.status === 401) {
      return new Error(`[grok] Unauthorized (401). Check XAI_API_KEY is valid at https://console.x.ai. Details: ${error.message}`);
    }
    if (
      error instanceof OpenAI.APIConnectionTimeoutError ||
      error.message.toLowerCase().includes("timeout")
    ) {
      return new Error(`[grok] Request timed out after 30s. xAI may be busy or Live Search is slow. Try again.`);
    }
  }
  if (error instanceof Error) {
    const lower = error.message.toLowerCase();
    if (lower.includes("timeout") || lower.includes("timed out")) {
      return new Error(`[grok] Request timed out after 30s. Try again. Cause: ${error.message}`);
    }
    if (lower.includes("429") || lower.includes("rate limit") || lower.includes("quota")) {
      return new Error(`[grok] Rate limit / quota (429) — wait and retry. Cause: ${error.message}`);
    }
    if (lower.includes("401") || lower.includes("unauthorized") || lower.includes("xai_api_key")) {
      return new Error(`[grok] Unauthorized — check XAI_API_KEY. Cause: ${error.message}`);
    }
  }
  if (error instanceof Error) return error;
  return new Error(`[grok] Unknown error: ${String(error)}`);
}

function computeGlobalConfidence(raw: GrokBusquedaRaw, actividades: GrokActividad[]): number {
  if (typeof raw.confidence === "number") return Math.min(1, Math.max(0, raw.confidence));
  if (actividades.length === 0) return 0.5;
  const withConf = actividades.filter((a) => typeof a.confidence === "number");
  if (withConf.length === 0) return 0.5;
  const avg = withConf.reduce((acc, a) => acc + a.confidence, 0) / withConf.length;
  return Math.min(1, Math.max(0, Number(avg.toFixed(2))));
}

// ── Main ─────────────────────────────────────────────────────────────────────

/**
 * Busca actividades reales en la web dada una ubicación usando Grok (xAI) con Live Search.
 * Función pura — sin imports de TanStack, safe para handlers server.
 */
export async function buscarActividadesConGrok(input: BuscarActividadesInput): Promise<GrokBusquedaResult> {
  const ubicacion = input.ubicacion?.trim() ?? "";
  if (ubicacion.length < 3) {
    throw new Error("[buscarActividadesConGrok] ubicacion must be at least 3 characters (ej. 'Lo Prado, Santiago').");
  }
  if (ubicacion.length > 200) {
    throw new Error("[buscarActividadesConGrok] ubicacion must be at most 200 characters.");
  }

  const client = getGrokClient();
  const model = resolveGrokModel(input.model);

  const systemPrompt = buildGrokSystemPrompt(ubicacion);
  const userPrompt = buildUserPrompt({ ...input, ubicacion });

  // xAI Live Search: grok-4 models support native web search via search_parameters: { mode: "auto" }
  // The field may not be in the OpenAI SDK types yet — we send it via any-cast / extra_body pattern.
  // Si la API no lo requiere o lo ignora, no rompe — es best-effort y se documenta.
  const extraLiveSearch: Record<string, unknown> = {};
  // Only send live search for grok-4 / grok-3 models that support it; for mini also safe to send (ignored)
  const supportsLiveSearchHint = model.includes("grok-4") || model.includes("grok-3") || model.includes("grok");
  if (supportsLiveSearchHint) {
    extraLiveSearch["search_parameters"] = { mode: "auto" };
  }

  let rawContent: string | null | undefined;
  try {
    const completion = (await client.chat.completions.create({
      model,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      // Cast to any to allow search_parameters which xAI documents but OpenAI types may not yet include.
      ...(Object.keys(extraLiveSearch).length > 0 ? (extraLiveSearch as unknown as Record<string, unknown>) : {}),
    } as unknown as Parameters<OpenAI["chat"]["completions"]["create"]>[0])) as OpenAI.Chat.Completions.ChatCompletion;

    rawContent = completion.choices[0]?.message?.content;
    if (!rawContent) {
      throw new Error("[grok] Empty response content from model (no choices[0].message.content).");
    }

    const cleaned = stripJsonFences(rawContent);
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      throw new Error(
        `[grok] Failed to parse JSON from model. Raw (first 800 chars): ${cleaned.slice(0, 800)} — ${(parseErr as Error).message}`,
      );
    }

    // Validar con Zod — si el modelo devolvió { actividades: [...] } incompleto, intentamos normalizar
    let validated: GrokBusquedaRaw;
    try {
      validated = GrokBusquedaSchema.parse(parsed);
    } catch (zodErr) {
      // Intento de recuperación: si el modelo devolvió un array directo o un objeto con otra key
      if (Array.isArray(parsed)) {
        validated = GrokBusquedaSchema.parse({ actividades: parsed });
      } else if (parsed && typeof parsed === "object" && "data" in (parsed as Record<string, unknown>)) {
        const maybe = (parsed as Record<string, unknown>)["data"];
        if (Array.isArray(maybe)) validated = GrokBusquedaSchema.parse({ actividades: maybe });
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
  } catch (error) {
    throw toFriendlyError(error);
  }
}

/**
 * Wrapper con fallback (placeholder para segundo proveedor).
 * Intenta Grok; ante error retryable loguea warning para futuro fallback.
 * TODO secundario: implementar fallback a otro provider (ej. Groq) si se configura.
 */
export async function buscarConFallback(input: BuscarActividadesInput): Promise<GrokBusquedaResult> {
  try {
    return await buscarActividadesConGrok(input);
  } catch (error) {
    if (isRetryableGrokError(error)) {
      console.warn("[buscarConFallback] Grok retryable error — would fallback if secondary provider configured.", error);
      // TODO: if (process.env.GROQ_API_KEY) return await buscarConGroqFallback(input);
    }
    throw error;
  }
}
