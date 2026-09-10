/**
 * Shared AI provider registry for activity search.
 *
 * Single source of truth for the provider union type so server handlers
 * (src/lib/groq-actividades.functions.ts) and UI
 * (src/components/buscar-actividades-ia.tsx) share exactly one definition.
 * Runtime-safe: no secrets, no SDK imports — safe to `import type` from client code.
 */

export const AI_PROVIDERS = ["groq", "lovable", "gemini"] as const;

export type AIProviderName = (typeof AI_PROVIDERS)[number];

export const AI_PROVIDER_LABELS: Record<AIProviderName, string> = {
  groq: "Groq",
  lovable: "Lovable",
  gemini: "Gemini",
};

export function isValidProvider(value: unknown): value is AIProviderName {
  return (
    typeof value === "string" && (AI_PROVIDERS as readonly string[]).includes(value)
  );
}

// ── Extended v2 providers (openrouter, nvidia) — additive, non-breaking ─────
// Keep AI_PROVIDERS above unchanged so existing views (/, /groq, /comparar) and
// their tabs remain working without migration. New providers are exposed via
// the extended union below for side-by-side testing and future UI tabs.
//
// UI note: to surface openrouter/nvidia in src/components/buscar-actividades-ia.tsx,
// add TabsTrigger entries for "openrouter" and "nvidia" (grid-cols-5), extend
// FALLBACK_*_MODELS with provider-specific model lists, and wire listarModelos*
// handlers. The dispatcher in src/lib/groq-actividades.functions.ts already
// routes them (no UI change required for API-only testing).

export const AI_PROVIDERS_EXTENDED = ["groq", "lovable", "gemini", "openrouter", "nvidia"] as const;

export type AIProviderNameExtended = (typeof AI_PROVIDERS_EXTENDED)[number];

export const AI_PROVIDER_LABELS_EXTENDED: Record<AIProviderNameExtended, string> = {
  groq: "Groq",
  lovable: "Lovable",
  gemini: "Gemini",
  openrouter: "OpenRouter",
  nvidia: "NVIDIA",
};

export function isValidProviderExtended(value: unknown): value is AIProviderNameExtended {
  return (
    typeof value === "string" && (AI_PROVIDERS_EXTENDED as readonly string[]).includes(value)
  );
}
