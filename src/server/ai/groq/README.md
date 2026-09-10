# groq — canonical Groq provider

Canonical location for the Groq activity-search implementation.

- `search.ts` — activity search (schemas, prompts, Groq client, `buscarActividadesConGroq`)
- `models.ts` — Groq model registry (`GROQ_VISION_MODELS`, `DEFAULT_GROQ_MODEL`, `listarModelosDisponibles`)

Legacy shims at `src/server/ai/` keep old imports working:
- `src/server/ai/groq-actividades.ts` → `export * from "./groq/search"`
- `src/server/ai/models.ts` → `export * from "./groq/models"`
- `src/server/ai/groq-actividades-models.ts` → `export * from "./groq/models"`

Debug probe stays separate: `src/server/ai/groq-v2/search.ts` (browser_search, `/debug-groq`).
