// Backward-compat shim — canonical module moved to ./gemini/search.ts
// Keep this file so existing imports (`@/server/ai/gemini-actividades`) keep working.
// New code should import from "@/server/ai/gemini/search".
export * from "./gemini/search";
