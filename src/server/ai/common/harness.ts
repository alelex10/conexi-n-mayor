/**
 * Common AI harness — shared, provider-agnostic helpers.
 *
 * Additive scaffold only. No legacy file has been modified to import from here
 * yet; harvesting is opt-in. See TODOs below for the duplication sites that
 * will eventually collapse into this file.
 */

// ── JSON fence stripping ───────────────────────────────────────────────────

/**
 * Removes markdown fences and <think> blocks some models emit (e.g. qwen
 * without response_format). Canonical implementation — currently duplicated in
 * src/server/ai/groq-actividades.ts#stripJsonFences and reused by
 * gemini-actividades.ts / lovable-actividades.ts via import from groq-actividades.
 *
 * TODO(harvest): point groq-actividades.ts, gemini-actividades.ts,
 * lovable-actividades.ts at this export and delete their local copies.
 */
export function stripJsonFences(raw: string): string {
  const withoutThink = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/<think>[\s\S]*$/gi, "");
  const trimmed = withoutThink.trim();
  if (trimmed.startsWith("```")) {
    const withoutOpen = trimmed.replace(/^```(?:json)?\s*/i, "");
    const withoutClose = withoutOpen.replace(/\s*```\s*$/, "");
    return withoutClose.trim();
  }
  return trimmed;
}

// ── Global confidence ──────────────────────────────────────────────────────

/**
 * Shared confidence aggregation.
 *
 * Computes a global 0..1 confidence from a raw payload that may already carry
 * a top-level `confidence`, or otherwise averages per-activity confidences.
 * Clamped to [0,1] and rounded to 2 decimals for the average path.
 *
 * Currently triplicated:
 *   - src/server/ai/groq-actividades.ts#computeGlobalConfidence (private)
 *   - src/server/ai/gemini-actividades.ts#computeGlobalConfidence (private)
 *   - src/server/ai/lovable-actividades.ts#computeGlobalConfidence (private)
 *
 * TODO(harvest): export the canonical GroqBusquedaRaw / GroqActividad types
 * here (or re-export from groq-actividades) and make all three providers
 * import this function instead of maintaining private copies.
 */
export function computeGlobalConfidence(
  raw: { confidence?: number | undefined; actividades?: Array<{ confidence: number }> | undefined },
  actividades?: Array<{ confidence: number }>,
): number {
  if (typeof raw.confidence === "number") return Math.min(1, Math.max(0, raw.confidence));
  const list = actividades ?? raw.actividades ?? [];
  if (list.length === 0) return 0.5;
  const withConf = list.filter((a) => typeof a.confidence === "number");
  if (withConf.length === 0) return 0.5;
  const avg = withConf.reduce((acc, a) => acc + a.confidence, 0) / withConf.length;
  return Math.min(1, Math.max(0, Number(avg.toFixed(2))));
}

// ── TODO — future harvest (no code yet, pointers only) ────────────────────

/**
 * TODO(harvest) Zod schemas:
 *   GroqActividadSchema, GroqBusquedaSchema, GroundedSource, BuscarActividadesInput,
 *   GroqBusquedaResult, ActivitySearchTrace — all defined in
 *   src/server/ai/groq-actividades.ts and imported by gemini/lovable.
 *   When moving, keep `common` free of provider-specific defaults (model ids)
 *   and only host the truly shared shapes. Validate tsc after the move; the
 *   schemas bring a `zod` dependency so add `import { z } from "zod"` then.
 *
 * TODO(harvest) Prompt helpers:
 *   buildGroqSystemPrompt(ubicacion), buildUserPrompt(input, opts)
 *   — currently in groq-actividades.ts, patched by gemini-actividades.ts with
 *   a grounding override suffix and by lovable with no override. A common
 *   version should accept a `mode: "grounded" | "simulated"` flag.
 *
 * TODO(harvest) Error helpers:
 *   isRetryableGroqError / toFriendlyError differ per provider (status codes,
 *   messages). Consider a small `isRetryable(status)` + `friendly(prefix, err)`
 *   factory rather than copy-pasting.
 */
