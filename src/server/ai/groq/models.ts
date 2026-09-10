/**
 * Groq vision model registry — single source of truth for the extractor.
 * - Static fallback list (always available, no network required)
 * - Dynamic fetch from https://api.groq.com/openai/v1/models when GROQ_API_KEY is present (server-only)
 * - DEFAULT_GROQ_MODEL is the recommended default for extraction
 */

// Keep in sync with .env.example deprecation note.

export type GroqVisionModel = {
  id: string;
  label: string;
  description: string;
  contextWindow: number;
  maxImages: number | null;
  speed: string | null;
  pricingIn: string | null;
  pricingOut: string | null;
  recommended: boolean;
  vision: boolean;
};

export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";

export const GROQ_VISION_MODELS: readonly GroqVisionModel[] = [
  {
    id: "qwen/qwen3.6-27b",
    label: "Qwen 3 27B Vision",
    description: "Qwen 3.6 27B — NO usar con response_format json_object para búsqueda de actividades (Groq 400 json_validate_failed verificado 2026-09-03); solo con retry sin formato",
    contextWindow: 131072,
    maxImages: 5,
    speed: "594 TPS",
    pricingIn: "$0.60 / 1M",
    pricingOut: "$3.00 / 1M",
    recommended: false,
    vision: true,
  },
  {
    id: "qwen/qwen3.8-27b",
    label: "Qwen 3.8 27B Vision",
    description: "Qwen 3.8 27B — visión nativa, contexto largo, ideal para afiches complejos",
    contextWindow: 131072,
    maxImages: 3,
    speed: "~500 TPS",
    pricingIn: "$0.80 / 1M",
    pricingOut: "$4.00 / 1M",
    recommended: false,
    vision: true,
  },
  {
    id: "openai/gpt-oss-120b",
    label: "GPT OSS 120b (recomendado texto)",
    description: "Recomendado — verificado 2026-09-03: único que pasa response_format json_object con el prompt de actividades; default para búsqueda",
    contextWindow: 131072,
    maxImages: null,
    speed: "~400 TPS",
    pricingIn: "$0.15 / 1M",
    pricingOut: "$0.60 / 1M",
    recommended: true,
    vision: false,
  },
] as const;

const KNOWN_IDS = new Set(GROQ_VISION_MODELS.map((m) => m.id));

/**
 * Flexible validator: accepts exact registry ids, or any id that looks like
 * a Groq vision variant (qwen, meta-llama, vision).
 * Updated 2026-08-29: Llama 4 scout/maverick deprecados — validar qwen y gpt-oss también.
 */
export function isValidGroqModel(id: string): boolean {
  if (!id || typeof id !== "string") return false;
  if (KNOWN_IDS.has(id)) return true;
  const lower = id.toLowerCase();
  if (lower.startsWith("meta-llama/")) return true;
  if (lower.includes("vision")) return true;
  if (lower.includes("qwen")) return true;
  if (lower.startsWith("openai/gpt-oss")) return true;
  // Allow any groq-style model id that contains llama + instruct (future-proof)
  if (lower.includes("llama") && lower.includes("instruct")) return true;
  // Generic fallback: any id with slash looks like a Groq model id
  if (id.includes("/")) return true;
  return false;
}

export type ListarModelosResult = {
  models: GroqVisionModel[];
  source: "groq" | "static";
  fetchedAt: string;
};

/**
 * Server-only. Tries to fetch /v1/models from Groq and intersect with vision-capable ids.
 * Falls back to static GROQ_VISION_MODELS when:
 * - GROQ_API_KEY missing
 * - network/fetch fails
 * - response doesn't contain vision models
 */
export async function listarModelosDisponibles(): Promise<ListarModelosResult> {
  const fetchedAt = new Date().toISOString();
  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) {
    return { models: [...GROQ_VISION_MODELS], source: "static", fetchedAt };
  }

  try {
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      // Groq models endpoint is cheap — short timeout
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.warn(`[groq models] Groq /v1/models responded ${res.status} — falling back to static list`);
      return { models: [...GROQ_VISION_MODELS], source: "static", fetchedAt };
    }
    const body = (await res.json()) as {
      data?: Array<{ id: string; object?: string }>;
      object?: string;
    };
    const remoteIds: string[] = Array.isArray(body.data) ? body.data.map((m) => m.id) : [];
    if (remoteIds.length === 0) {
      return { models: [...GROQ_VISION_MODELS], source: "static", fetchedAt };
    }
    const remoteSet = new Set(remoteIds);
    // Keep order of GROQ_VISION_MODELS, but only those present remotely;
    // append any remote vision-ish ids not in static (as generic entries)
    const intersected: GroqVisionModel[] = GROQ_VISION_MODELS.filter((m) => remoteSet.has(m.id));
    // BUGFIX 2026-08-29: old logic returned 2 prompt-guard models (extraRemoteVision)
    // when intersect vacío (scout/maverick deprecados). Ahora: si intersect vacío → fallback a static completo.
    if (intersected.length === 0) {
      console.warn("[groq models] Intersect vacío — Groq no devolvió ninguno de GROQ_VISION_MODELS, usando static completo");
      return { models: [...GROQ_VISION_MODELS], source: "static", fetchedAt };
    }
    const extraRemoteVision = remoteIds
      .filter((id) => {
        const lower = id.toLowerCase();
        // Excluir guard/safeguard (no son extractores de afiche)
        if (lower.includes("guard") || lower.includes("safeguard") || lower.includes("prompt-guard")) return false;
        return (
          (lower.includes("vision") || lower.startsWith("meta-llama/") || lower.includes("qwen")) &&
          !KNOWN_IDS.has(id)
        );
      })
      .map<GroqVisionModel>((id) => ({
        id,
        label: id,
        description: "Detectado vía Groq API",
        contextWindow: 8192,
        maxImages: null,
        speed: null,
        pricingIn: null,
        pricingOut: null,
        recommended: false,
        vision: true,
      }));

    const models = [...intersected, ...extraRemoteVision];
    if (models.length === 0) {
      // Groq returned no vision models — return static instead of empty
      return { models: [...GROQ_VISION_MODELS], source: "static", fetchedAt };
    }
    return { models, source: "groq", fetchedAt };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[groq models] fetch failed — falling back to static list:", msg);
    return { models: [...GROQ_VISION_MODELS], source: "static", fetchedAt };
  }
}
