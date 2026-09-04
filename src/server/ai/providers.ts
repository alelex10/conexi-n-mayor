/**
 * Shared AI provider registry for activity search.
 *
 * Single source of truth for the provider union type so server handlers
 * (src/lib/groq-actividades.functions.ts) and UI
 * (src/components/buscar-actividades-groq.tsx) share exactly one definition.
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
