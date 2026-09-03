// Backwards-compat shim: Groq actividades web-search migration.
// Single source of truth is ./models.ts — this file only re-exports it
// so any lingering `groq-actividades-models` imports keep working.
export * from "./models";
