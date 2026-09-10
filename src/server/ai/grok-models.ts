// Deprecated alias: Grok (xAI) → Groq migration
// Canonical module is now ./groq/models.ts (re-exported via ./models.ts shim).
export {
  GROQ_VISION_MODELS as GROK_MODELS,
  DEFAULT_GROQ_MODEL as DEFAULT_GROK_MODEL,
  isValidGroqModel as isValidGrokModel,
  listarModelosDisponibles as listarModelosGrokDisponibles,
} from "./groq/models";
export type { GroqVisionModel as GrokModel } from "./groq/models";
export * from "./groq/models";
