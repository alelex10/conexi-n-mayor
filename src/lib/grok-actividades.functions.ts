import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Capa RPC client-importable para Grok web-search (xAI).
 * NO importar src/server/ai/* estáticamente — Vite bloquea **\/server/** en client bundles.
 * Usamos `await import("@/server/ai/...")` dentro del handler, igual que src/lib/ai.functions.ts
 * del PR selector (ai-model-selector).
 */

const HITL_THRESHOLD = 0.85;

/**
 * Público — sin auth para MVP. Retorna modelos Grok disponibles.
 * Intenta xAI /v1/models server-side, fallback a lista estática. Nunca expone XAI_API_KEY.
 */
export const listarModelosGrokFn = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { listarModelosGrokDisponibles, DEFAULT_GROK_MODEL } = await import("@/server/ai/grok-models");
    const result = await listarModelosGrokDisponibles();
    return {
      models: result.models,
      source: result.source,
      fetchedAt: result.fetchedAt,
      defaultModel: DEFAULT_GROK_MODEL,
      hasXaiKey: Boolean(process.env["XAI_API_KEY"]),
    };
  } catch (e) {
    console.warn("[listarModelosGrokFn] failed, returning static fallback", e instanceof Error ? e.message : String(e));
    const { GROK_MODELS, DEFAULT_GROK_MODEL } = await import("@/server/ai/grok-models");
    return {
      models: [...GROK_MODELS],
      source: "static" as const,
      fetchedAt: new Date().toISOString(),
      defaultModel: DEFAULT_GROK_MODEL,
      hasXaiKey: Boolean(process.env["XAI_API_KEY"]),
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
 * Busca actividades por ubicación usando Grok Live Search + HITL gate.
 * - model es opcional desde el cliente; validado server-side vía isValidGrokModel
 * - confidence < 0.85 persiste best-effort en busquedas_grok_pendientes (feature-flag: si tabla no existe, warn y no rompe)
 */
export const buscarActividadesPorUbicacionFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => buscarInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { buscarActividadesConGrok } = await import("@/server/ai/grok-actividades");
    const { DEFAULT_GROK_MODEL } = await import("@/server/ai/grok-models");

    const grokInput: Parameters<typeof buscarActividadesConGrok>[0] = {
      ubicacion: data.ubicacion,
    };
    if (data.radioMetros !== undefined) grokInput.radioMetros = data.radioMetros;
    if (data.categoria !== undefined) grokInput.categoria = data.categoria;
    if (data.fechaDesde !== undefined) grokInput.fechaDesde = data.fechaDesde;
    if (data.model !== undefined) grokInput.model = data.model;
    const result = await buscarActividadesConGrok(grokInput);

    const confidence = result.confidence;
    const needsReview = confidence < HITL_THRESHOLD;
    const status = needsReview ? ("needs_review" as const) : ("ok" as const);
    const usedModel = data.model?.trim() || result.usedModel || process.env["GROK_MODEL"] || DEFAULT_GROK_MODEL;

    if (needsReview) {
      try {
        const { getAdminClient } = await import("./supabase.server");
        const admin = getAdminClient();
        const { error } = await admin.from("busquedas_grok_pendientes").insert({
          ubicacion: data.ubicacion,
          radio_metros: data.radioMetros ?? null,
          raw_json: result.raw as unknown as Record<string, unknown>,
          confidence,
          provider: `xai:${usedModel}`,
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
            "[buscarActividadesPorUbicacionFn] Failed to persist busquedas_grok_pendientes — returning result anyway.",
            msg,
          );
        }
      }
    }

    return {
      status,
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
export const buscarActividadesGrok = buscarActividadesPorUbicacionFn;
