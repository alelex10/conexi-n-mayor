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

export const DEFAULT_GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

export const GROQ_VISION_MODELS: readonly GroqVisionModel[] = [
  {
    id: "meta-llama/llama-4-scout-17b-16e-instruct",
    label: "Llama 4 Scout 17B",
    description: "Recomendado — 17B MoE activo, visión nativa, rápido y económico para afiches",
    contextWindow: 131072,
    maxImages: 5,
    speed: "594 TPS",
    pricingIn: "$0.11 / 1M",
    pricingOut: "$0.34 / 1M",
    recommended: true,
    vision: true,
  },
  {
    id: "meta-llama/llama-4-maverick-17b-128e-instruct",
    label: "Llama 4 Maverick 17B (128E)",
    description: "400B total MoE — máxima calidad, mayor costo y latencia",
    contextWindow: 131072,
    maxImages: 5,
    speed: "~300 TPS",
    pricingIn: "$0.60 / 1M",
    pricingOut: "$3.00 / 1M",
    recommended: false,
    vision: true,
  },
  {
    id: "meta-llama/llama-3.2-90b-vision-preview",
    label: "Llama 3.2 90B Vision (preview)",
    description: "Fallback 90B — puede estar deprecado en Groq, útil para compatibilidad",
    contextWindow: 131072,
    maxImages: 5,
    speed: "~200 TPS",
    pricingIn: "$0.90 / 1M",
    pricingOut: "$0.90 / 1M",
    recommended: false,
    vision: true,
  },
  {
    id: "meta-llama/llama-3.2-11b-vision-preview",
    label: "Llama 3.2 11B Vision (preview)",
    description: "Ligero y rápido — ideal para pruebas o dispositivos limitados",
    contextWindow: 8192,
    maxImages: 1,
    speed: "~600 TPS",
    pricingIn: "$0.18 / 1M",
    pricingOut: "$0.18 / 1M",
    recommended: false,
    vision: true,
  },
] as const;

const KNOWN_IDS = new Set(GROQ_VISION_MODELS.map((m) => m.id));

/**
 * Flexible validator: accepts exact registry ids, or any id that looks like
 * a Llama vision variant (starts with meta-llama/ or contains "vision").
 */
export function isValidGroqModel(id: string): boolean {
  if (!id || typeof id !== "string") return false;
  if (KNOWN_IDS.has(id)) return true;
  const lower = id.toLowerCase();
  if (lower.startsWith("meta-llama/")) return true;
  if (lower.includes("vision")) return true;
  // Allow any groq-style model id that contains llama + instruct (future-proof)
  if (lower.includes("llama") && lower.includes("instruct")) return true;
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
    const extraRemoteVision = remoteIds
      .filter((id) => {
        const lower = id.toLowerCase();
        return (lower.includes("vision") || lower.startsWith("meta-llama/")) && !KNOWN_IDS.has(id);
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
