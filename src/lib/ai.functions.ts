import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * AI extractor server functions — thin RPC layer (client-importable).
 * Pure logic lives in src/server/ai/*.ts which is never statically imported
 * from the client; we use await import() inside handlers to avoid
 * Vite import-protection (which denies **\/server/** in client bundles).
 */

const inputSchema = z.object({
  imageBase64: z.string().min(100, "imageBase64 must be at least 100 chars (base64 JPG/PNG)"),
  mimeType: z.enum(["image/jpeg", "image/png"]).optional().default("image/jpeg"),
  model: z.string().min(1).optional(),
});

/**
 * Public — no auth for MVP. Returns available Groq vision models.
 * Tries Groq /v1/models server-side, falls back to static registry. Never leaks GROQ_API_KEY.
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

const HITL_THRESHOLD = 0.85;

/**
 * Extract afiche via Groq vision + HITL gate.
 * - model is optional from client; validated server-side via isValidGroqModel
 * - confidence < 0.85 persists to extracciones_pendientes (best-effort)
 */
export const extractAficheFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const { extractAficheFromImage } = await import("@/server/ai/extract-afiche");
    const { DEFAULT_GROQ_MODEL } = await import("@/server/ai/models");
    const extracted = await extractAficheFromImage({
      imageBase64: data.imageBase64,
      mimeType: data.mimeType,
      model: data.model,
    });

    const confidence = extracted.confidence;
    const needsReview = confidence < HITL_THRESHOLD;
    const status = needsReview ? "needs_review" : "extracted";
    const usedModel = data.model?.trim() || process.env["AI_EXTRACTOR_MODEL"] || DEFAULT_GROQ_MODEL;

    if (needsReview) {
      try {
        const { getAdminClient } = await import("./supabase.server");
        const admin = getAdminClient();
        const { error } = await admin.from("extracciones_pendientes").insert({
          raw_json: extracted as unknown as Record<string, unknown>,
          confidence,
          provider: `groq:${usedModel}`,
          status: "pendiente",
          warnings: extracted.warnings ?? null,
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
          console.warn("[extractAfiche.server] Skipping Supabase persist — table or env not ready (feature flag).", msg);
        } else {
          console.warn("[extractAfiche.server] Failed to persist extracciones_pendientes — returning extraction anyway.", msg);
        }
      }
    }

    return {
      status: status as "needs_review" | "extracted",
      extracted,
      needsReview,
      confidence,
      usedModel,
    };
  });

// Backwards-compat alias
export const extractAfiche = extractAficheFn;
