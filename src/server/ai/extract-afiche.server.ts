import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { extractAficheFromImage } from "./extract-afiche";

const HITL_THRESHOLD = 0.85;

const inputSchema = z.object({
  imageBase64: z.string().min(100, "imageBase64 must be at least 100 chars (base64 JPG/PNG)"),
  mimeType: z.enum(["image/jpeg", "image/png"]).optional().default("image/jpeg"),
});

/**
 * Server Function: extract afiche via Groq vision + HITL gate.
 * - Reads env INSIDE handler (Workers-safe)
 * - Calls pure extractor
 * - If confidence < 0.85 → needsReview = true and persists to Supabase extracciones_pendientes (graceful if table missing)
 * - Never auto-publishes; returns status for caller to branch
 */
export const extractAfiche = createServerFn({ method: "POST" })
  .validator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    // Env is read inside handler (and inside extractAficheFromImage → getGroqClient)
    const extracted = await extractAficheFromImage({
      imageBase64: data.imageBase64,
      mimeType: data.mimeType,
    });

    const confidence = extracted.confidence;
    const needsReview = confidence < HITL_THRESHOLD;
    const status = needsReview ? "needs_review" : "extracted";

    if (needsReview) {
      try {
        const { getAdminClient } = await import("@/lib/supabase.server");
        const admin = getAdminClient();
        const { error } = await admin.from("extracciones_pendientes").insert({
          raw_json: extracted as unknown as Record<string, unknown>,
          confidence,
          provider: "groq",
          status: "pendiente",
          warnings: extracted.warnings ?? null,
          // image_url intentionally null — caller can store separately if needed
        });
        if (error) throw new Error(error.message);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // Graceful degradation: table may not exist yet (feature flag) or Supabase not configured
        const isMissingTable =
          msg.includes("does not exist") ||
          msg.includes("relation") ||
          msg.includes("42P01") ||
          msg.includes("Could not find the table");
        const isMissingEnv = msg.includes("Missing required server secret");
        if (isMissingTable || isMissingEnv) {
          console.warn(
            "[extractAfiche.server] Skipping Supabase persist — table or env not ready (feature flag).",
            msg,
          );
        } else {
          // For other DB errors: log but do not hard-fail the extraction — HITL queue is best-effort
          console.warn("[extractAfiche.server] Failed to persist extracciones_pendientes — returning extraction anyway.", msg);
        }
      }
    }

    return {
      status: status as "needs_review" | "extracted",
      extracted,
      needsReview,
      confidence,
    };
  });
