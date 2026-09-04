import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Capa RPC client-importable para Groq búsqueda actividades por ubicación.
 * NO importar src/server/ai/* estáticamente — Vite bloquea **\/server/** en client bundles.
 * Usamos `await import("@/server/ai/...")` dentro del handler, igual que src/lib/ai.functions.ts
 * del PR selector (ai-model-selector).
 */

export const HITL_THRESHOLD = 0.85;

/**
 * Piso para verificados parciales: items con cita exacta pero con campos
 * faltantes (fecha/hora/lugar/direccion null) llegan con confidence 0.70-0.84
 * y DEBEN mostrarse en home con etiquetas "no encontrado" en vez de ocultarse.
 */
export const PARTIAL_VERIFIED_FLOOR = 0.7;

type GateItem = {
  confidence: number;
  fuente_url?: string | null | undefined;
  warnings?: string[] | undefined;
};

/**
 * HITL gate (pure, exported for tests): the server already dropped every
 * item whose name is not verbatim in live web evidence (live-only, zero
 * invención). Items reach the client when confidence >= PARTIAL_VERIFIED_FLOOR
 * (0.70) AND the fuente is honest: either an http fuente_url (exact evidence
 * URL, verified server-side) or null (citation-missing verbatim match, shown
 * as "Fuente no informada"). Malformed non-http fuente strings are held back.
 * Full-verified (>= 0.85) and partial-verified (0.70-0.84, missing
 * fecha/hora/direccion/lugar or missing citation) are both shown — partials
 * render "no encontrado" placeholders in the UI.
 * Items below 0.70, or with a dishonest fuente, are held back for human
 * review and persisted best-effort in busquedas_groq_pendientes.
 */
export function filterVerifiedForClient<T extends GateItem>(actividades: T[]): {
  verified: T[];
  heldback: T[];
} {
  const isHttpFuente = (url: unknown): boolean =>
    typeof url === "string" && /^https?:\/\//i.test(url.trim());
  const verified = actividades.filter((a) => {
    if (typeof a.confidence !== "number" || a.confidence < PARTIAL_VERIFIED_FLOOR) return false;
    if (a.fuente_url == null) return true; // cita opcional: nombre verbatim ya verificado en servidor
    return isHttpFuente(a.fuente_url);
  });
  const heldback = actividades.filter((a) => !verified.includes(a));
  return { verified, heldback };
}

/**
 * Público — sin auth para MVP. Retorna modelos Groq disponibles.
 * Intenta Groq /v1/models server-side, fallback a lista estática. Nunca expone GROQ_API_KEY.
 */
export const listarModelosGroqFn = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { listarModelosDisponibles, DEFAULT_GROQ_MODEL } = await import("@/server/ai/models");
    const result = await listarModelosDisponibles();
    return {
      models: result.models,
      source: result.source,
      fetchedAt: result.fetchedAt,
      defaultModel: DEFAULT_GROQ_MODEL,
      hasGroqKey: Boolean(process.env["GROQ_API_KEY"]),
    };
  } catch (e) {
    console.warn("[listarModelosGroqFn] failed, returning static fallback", e instanceof Error ? e.message : String(e));
    const { GROQ_VISION_MODELS, DEFAULT_GROQ_MODEL } = await import("@/server/ai/models");
    return {
      models: [...GROQ_VISION_MODELS],
      source: "static" as const,
      fetchedAt: new Date().toISOString(),
      defaultModel: DEFAULT_GROQ_MODEL,
      hasGroqKey: Boolean(process.env["GROQ_API_KEY"]),
    };
  }
});

const buscarInputSchema = z.object({
  ubicacion: z.string().trim().min(3, "ubicacion debe tener al menos 3 caracteres").max(200),
  radioMetros: z.number().int().positive().optional(),
  categoria: z.string().trim().min(1).max(50).optional(),
  fechaDesde: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "fechaDesde debe ser YYYY-MM-DD")
    .optional(),
  model: z.string().trim().min(1).optional(),
});

/**
 * Busca actividades VERIFICADAS por ubicación usando Groq con grounding
 * live-only + HITL gate.
 * - model es opcional desde el cliente; validado server-side vía isValidGroqModel (flexible)
 * - El servidor (src/server/ai/groq-actividades.ts) ya descarta ítems cuyo
 *   nombre no está verbatim en la evidencia web en vivo o cuya URL —cuando
 *   está presente— no es exacta, y recalcula confidence desde evidencia
 *   (cita exacta +0.15; sin cita pero verbatim + ubicación 0.75-0.80 con
 *   warning; faltantes penalizan -0.05, piso 0.70). Aquí se aplica el gate
 *   final: se retornan ítems con confidence >= 0.70 Y fuente honesta
 *   (fuente_url http exacta o null = "Fuente no informada"), incluyendo
 *   parciales con "no encontrado".
 *   El resto se persiste best-effort en busquedas_groq_pendientes y NO se
 *   retorna al cliente.
 */
export const buscarActividadesPorUbicacionFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => buscarInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { buscarActividadesConGroq } = await import("@/server/ai/groq-actividades");
    const { DEFAULT_GROQ_MODEL } = await import("@/server/ai/models");

    const groqInput: Parameters<typeof buscarActividadesConGroq>[0] = {
      ubicacion: data.ubicacion,
    };
    if (data.radioMetros !== undefined) groqInput.radioMetros = data.radioMetros;
    if (data.categoria !== undefined) groqInput.categoria = data.categoria;
    if (data.fechaDesde !== undefined) groqInput.fechaDesde = data.fechaDesde;
    if (data.model !== undefined) groqInput.model = data.model;
    const result = await buscarActividadesConGroq(groqInput);

    // Final HITL gate: only verified items reach the client (pure helper above).
    const { verified, heldback } = filterVerifiedForClient(result.actividades);

    const confidence =
      verified.length > 0
        ? Number(
            (verified.reduce((acc, a) => acc + a.confidence, 0) / verified.length).toFixed(2),
          )
        : 0;
    const needsReview = heldback.length > 0 || verified.length === 0;
    const status = needsReview ? ("needs_review" as const) : ("ok" as const);
    const usedModel = data.model?.trim() || result.usedModel || process.env["GROQ_MODEL"] || DEFAULT_GROQ_MODEL;
    const warnings = [...result.warnings];
    if (heldback.length > 0) {
      warnings.push(
        `Se retuvieron ${heldback.length} resultados sin verificación suficiente para revisión humana; solo se muestran actividades verificadas.`,
      );
    }

    if (needsReview) {
      try {
        const { getAdminClient } = await import("./supabase.server");
        const admin = getAdminClient();
        const { error } = await admin.from("busquedas_groq_pendientes").insert({
          ubicacion: data.ubicacion,
          radio_metros: data.radioMetros ?? null,
          raw_json: {
            raw: result.raw as unknown as Record<string, unknown>,
            heldback: heldback as unknown as Record<string, unknown>,
            evidenceMode: result.evidenceMode,
            droppedCount: result.droppedCount,
          } as unknown as Record<string, unknown>,
          confidence,
          provider: `groq:${usedModel}`,
          status: "pendiente",
        });
        if (error) throw new Error(error.message);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const isMissingTable =
          msg.includes("does not exist") ||
          msg.includes("relation") ||
          msg.includes("42P01") ||
          msg.includes("Could not find the table");
        const isMissingEnv = msg.includes("Missing required server secret");
        if (isMissingTable || isMissingEnv) {
          console.warn(
            "[buscarActividadesPorUbicacionFn] Skipping Supabase persist — table or env not ready (feature flag).",
            msg,
          );
        } else {
          console.warn(
            "[buscarActividadesPorUbicacionFn] Failed to persist busquedas_groq_pendientes — returning result anyway.",
            msg,
          );
        }
      }
    }

    return {
      status,
      actividades: verified,
      total: verified.length,
      confidence,
      usedModel,
      ubicacion: result.ubicacion,
      warnings,
      needsReview,
      evidenceMode: result.evidenceMode,
      raw: result.raw,
    };
  });

// Alias for convenience (optional)
export const buscarActividadesGroq = buscarActividadesPorUbicacionFn;

// Backwards compat aliases (grok → groq)
export const listarModelosGrokFn = listarModelosGroqFn;
export const buscarActividadesGrok = buscarActividadesPorUbicacionFn;
export const buscarActividadesPorUbicacionGrokFn = buscarActividadesPorUbicacionFn;
