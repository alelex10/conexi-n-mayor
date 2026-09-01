// Deprecated alias: Grok (xAI) → Groq migration
// Este archivo es alias backwards compat. La implementación real está en ./models.ts (y ./groq-actividades-models.ts)
export {
  GROQ_VISION_MODELS as GROK_MODELS,
  DEFAULT_GROQ_MODEL as DEFAULT_GROK_MODEL,
  isValidGroqModel as isValidGrokModel,
  listarModelosDisponibles as listarModelosGrokDisponibles,
} from "./models";
export type { GroqVisionModel as GrokModel } from "./models";
export * from "./models";
