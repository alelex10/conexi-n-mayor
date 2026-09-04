import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Capa RPC client-importable para Groq búsqueda actividades por ubicación.
 * NO importar src/server/ai/* estáticamente — Vite bloquea **\/server/** en client bundles.
 * Usamos `await import("@/server/ai/...")` dentro del handler, igual que src/lib/ai.functions.ts
 * del PR selector (ai-model-selector).
 */

const HITL_THRESHOLD = 0.85;

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

/**
 * Público — modelos disponibles del proveedor Lovable AI (lista estática curada).
 */
export const listarModelosLovableFn = createServerFn({ method: "GET" }).handler(async () => {
  const { LOVABLE_MODELS, DEFAULT_LOVABLE_MODEL } = await import("@/server/ai/lovable-actividades");
  return {
    models: [...LOVABLE_MODELS],
    source: "static" as const,
    fetchedAt: new Date().toISOString(),
    defaultModel: DEFAULT_LOVABLE_MODEL,
    hasLovableKey: Boolean(process.env["LOVABLE_API_KEY"]),
  };
});

export const buscarInputSchema = z.object({
  ubicacion: z.string().trim().min(3, "ubicacion debe tener al menos 3 caracteres").max(200),
  radioMetros: z.number().int().positive().optional(),
  categoria: z.string().trim().min(1).max(50).optional(),
  fechaDesde: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "fechaDesde debe ser YYYY-MM-DD")
    .optional(),
  model: z.string().trim().min(1).optional(),
  proveedor: z.enum(["groq", "lovable"]).optional(),
  latitud: z.number().min(-90).max(90).optional(),
  longitud: z.number().min(-180).max(180).optional(),
  locationLabel: z.string().trim().max(200).optional(),
});

/**
 * Busca actividades por ubicación usando Groq o Lovable AI (según `proveedor`) + HITL gate.
 * - model es opcional desde el cliente; validado server-side
 * - confidence < 0.85 persiste best-effort en busquedas_groq_pendientes (feature-flag: si tabla no existe, warn y no rompe)
 */
export const buscarActividadesPorUbicacionFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => buscarInputSchema.parse(data))
  .handler(async ({ data }) => {
    const proveedor = data.proveedor ?? "groq";
    const { DEFAULT_GROQ_MODEL } = await import("@/server/ai/models");

    const groqInput: {
      ubicacion: string;
      radioMetros?: number;
      categoria?: string;
      fechaDesde?: string;
      model?: string;
      latitud?: number;
      longitud?: number;
      locationLabel?: string;
    } = {
      ubicacion: data.ubicacion,
    };
    if (data.radioMetros !== undefined) groqInput.radioMetros = data.radioMetros;
    if (data.categoria !== undefined) groqInput.categoria = data.categoria;
    if (data.fechaDesde !== undefined) groqInput.fechaDesde = data.fechaDesde;
    if (data.model !== undefined) groqInput.model = data.model;
    if (data.latitud !== undefined) groqInput.latitud = data.latitud;
    if (data.longitud !== undefined) groqInput.longitud = data.longitud;
    if (data.locationLabel !== undefined) groqInput.locationLabel = data.locationLabel;

    let result;
    if (proveedor === "lovable") {
      const { buscarActividadesConLovable } = await import("@/server/ai/lovable-actividades");
      result = await buscarActividadesConLovable(groqInput);
    } else {
      const { buscarActividadesConGroq } = await import("@/server/ai/groq-actividades");
      result = await buscarActividadesConGroq(groqInput);
    }


    const confidence = result.confidence;
    const needsReview = confidence < HITL_THRESHOLD;
    const status = needsReview ? ("needs_review" as const) : ("ok" as const);
    const usedModel =
      result.usedModel || data.model?.trim() || process.env["GROQ_MODEL"] || DEFAULT_GROQ_MODEL;


    if (needsReview) {
      try {
        const { getAdminClient } = await import("./supabase.server");
        const admin = getAdminClient();
        const { error } = await admin.from("busquedas_groq_pendientes").insert({
          ubicacion: data.ubicacion,
          radio_metros: data.radioMetros ?? null,
          raw_json: result.raw as unknown as Record<string, unknown>,
          confidence,
          provider: `${proveedor}:${usedModel}`,
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
      proveedor,

      actividades: result.actividades,
      total: result.total,
      confidence,
      usedModel,
      ubicacion: result.ubicacion,
      warnings: result.warnings,
      needsReview,
      raw: result.raw,
    };
  });

// Alias for convenience (optional)
export const buscarActividadesGroq = buscarActividadesPorUbicacionFn;

// Backwards compat aliases (grok → groq)
export const listarModelosGrokFn = listarModelosGroqFn;
export const buscarActividadesGrok = buscarActividadesPorUbicacionFn;
export const buscarActividadesPorUbicacionGrokFn = buscarActividadesPorUbicacionFn;
