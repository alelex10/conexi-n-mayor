// Backward-compat shim — canonical module moved to ./groq/search.ts
// Keep this file so existing imports (`@/server/ai/groq-actividades`) keep working.
// New code should import from "@/server/ai/groq/search".
export * from "./groq/search";
