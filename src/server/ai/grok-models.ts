/**
 * Grok (xAI) model registry — single source of truth for búsqueda web de actividades.
 * - Lista estática (siempre disponible, sin red)
 * - Fetch dinámico desde https://api.x.ai/v1/models cuando XAI_API_KEY está presente (server-only)
 * - DEFAULT_GROK_MODEL es el recomendado para web-search
 */

export type GrokModel = {
  id: string;
  label: string;
  description: string;
  contextWindow: number;
  pricingIn: string | null;
  pricingOut: string | null;
  /** Pricing human-readable, ej. "$3 / $15 por 1M tokens" */
  pricing: string | null;
  recommended: boolean;
  supportsLiveSearch: boolean;
};

export const DEFAULT_GROK_MODEL = "grok-4-0709";

export const GROK_MODELS: readonly GrokModel[] = [
  {
    id: "grok-4-0709",
    label: "Grok 4 — 0709",
    description: "Recomendado — Live Search nativo, 131K context, ideal para buscar actividades actuales en la web",
    contextWindow: 131072,
    pricingIn: "$3.00 / 1M",
    pricingOut: "$15.00 / 1M",
    pricing: "$3 / $15 por 1M tokens",
    recommended: true,
    supportsLiveSearch: true,
  },
  {
    id: "grok-3-latest",
    label: "Grok 3 Latest",
    description: "Rápido — Grok 3 con búsqueda web, bueno para iterar y para fallback de grok-4",
    contextWindow: 131072,
    pricingIn: "$3.00 / 1M",
    pricingOut: "$15.00 / 1M",
    pricing: "$3 / $15 por 1M tokens",
    recommended: false,
    supportsLiveSearch: true,
  },
  {
    id: "grok-3",
    label: "Grok 3",
    description: "Grok 3 estable — Live Search, 131K, alias de grok-3-latest",
    contextWindow: 131072,
    pricingIn: "$3.00 / 1M",
    pricingOut: "$15.00 / 1M",
    pricing: "$3 / $15 por 1M tokens",
    recommended: false,
    supportsLiveSearch: true,
  },
  {
    id: "grok-3-mini",
    label: "Grok 3 Mini",
    description: "Económico — rápido y barato, sin visión, útil para tests y búsquedas simples (beta)",
    contextWindow: 32768,
    pricingIn: "$0.30 / 1M",
    pricingOut: "$0.50 / 1M",
    pricing: "$0.30 / $0.50 por 1M tokens",
    recommended: false,
    supportsLiveSearch: false,
  },
] as const;

const KNOWN_IDS = new Set(GROK_MODELS.map((m) => m.id));

export function isValidGrokModel(id: string): boolean {
  if (!id || typeof id !== "string") return false;
  if (KNOWN_IDS.has(id)) return true;
  const lower = id.toLowerCase();
  if (lower.startsWith("grok-")) return true;
  if (lower.includes("grok")) return true;
  // Generic fallback: id con slash (openai-style) o guion
  if (id.includes("/") || id.includes("-")) return true;
  return false;
}

export type ListarModelosGrokResult = {
  models: GrokModel[];
  source: "xai" | "static";
  fetchedAt: string;
};

/**
 * Server-only. Intenta GET https://api.x.ai/v1/models con XAI_API_KEY.
 * Hace fallback a GROK_MODELS si:
 * - falta la key
 * - fetch falla / timeout
 * - respuesta no contiene ids útiles
 */
export async function listarModelosGrokDisponibles(): Promise<ListarModelosGrokResult> {
  const fetchedAt = new Date().toISOString();
  const apiKey = process.env["XAI_API_KEY"];
  if (!apiKey) {
    return { models: [...GROK_MODELS], source: "static", fetchedAt };
  }

  try {
    const res = await fetch("https://api.x.ai/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.warn(`[grok models] xAI /v1/models responded ${res.status} — falling back to static list`);
      return { models: [...GROK_MODELS], source: "static", fetchedAt };
    }
    const body = (await res.json()) as {
      data?: Array<{ id: string; object?: string }>;
      object?: string;
    };
    const remoteIds: string[] = Array.isArray(body.data) ? body.data.map((m) => m.id) : [];
    if (remoteIds.length === 0) {
      return { models: [...GROK_MODELS], source: "static", fetchedAt };
    }
    const remoteSet = new Set(remoteIds);
    const intersected: GrokModel[] = GROK_MODELS.filter((m) => remoteSet.has(m.id));
    if (intersected.length === 0) {
      console.warn("[grok models] Intersect vacío — xAI no devolvió ninguno de GROK_MODELS, usando static completo");
      return { models: [...GROK_MODELS], source: "static", fetchedAt };
    }
    const extraRemote = remoteIds
      .filter((id) => {
        const lower = id.toLowerCase();
        // grok ids son los relevantes; excluir embeddings si aparecen
        if (lower.includes("embed")) return false;
        return lower.includes("grok") && !KNOWN_IDS.has(id);
      })
      .map<GrokModel>((id) => ({
        id,
        label: id,
        description: "Detectado vía xAI API",
        contextWindow: 131072,
        pricingIn: null,
        pricingOut: null,
        pricing: null,
        recommended: false,
        supportsLiveSearch: id.includes("grok-4") || id.includes("grok-3"),
      }));

    const models = [...intersected, ...extraRemote];
    if (models.length === 0) {
      return { models: [...GROK_MODELS], source: "static", fetchedAt };
    }
    return { models, source: "xai", fetchedAt };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[grok models] fetch failed — falling back to static list:", msg);
    return { models: [...GROK_MODELS], source: "static", fetchedAt };
  }
}
