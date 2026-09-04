import OpenAI from "openai";

/**
 * Conexión Mayor — Proveedor Lovable AI (AI Gateway) para búsqueda de actividades.
 *
 * Mismo prompt/schema que el proveedor Groq (src/server/ai/groq-actividades.ts),
 * pero llamando al Lovable AI Gateway (OpenAI-compatible) con LOVABLE_API_KEY.
 * La clave se lee DENTRO de la función (Workers-safe).
 */

import {
  GroqBusquedaSchema,
  buildGroqSystemPrompt,
  buildUserPrompt,
  stripJsonFences,
  type BuscarActividadesInput,
  type GroqBusquedaRaw,
  type GroqBusquedaResult,
} from "./groq-actividades";

const LOVABLE_BASE_URL = "https://ai.gateway.lovable.dev/v1";

export const DEFAULT_LOVABLE_MODEL = "google/gemini-3.7-flash";

export type LovableModelInfo = {
  id: string;
  label: string;
  description: string;
  contextWindow: number;
  pricingIn: string | null;
  pricingOut: string | null;
  pricing: string | null;
  recommended: boolean;
  vision: boolean;
  supportsLiveSearch: boolean;
};

export const LOVABLE_MODELS: LovableModelInfo[] = [
  {
    id: "google/gemini-3.7-flash",
    label: "Gemini 3.7 Flash (recomendado)",
    description: "Rápido y económico — buen balance para búsqueda de actividades vía Lovable AI.",
    contextWindow: 1_000_000,
    pricingIn: null,
    pricingOut: null,
    pricing: "Créditos de Lovable AI",
    recommended: true,
    vision: true,
    supportsLiveSearch: false,
  },
  {
    id: "google/gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro",
    description: "Razonamiento más fuerte, algo más lento — útil para ubicaciones complejas.",
    contextWindow: 1_000_000,
    pricingIn: null,
    pricingOut: null,
    pricing: "Créditos de Lovable AI",
    recommended: false,
    vision: true,
    supportsLiveSearch: false,
  },
  {
    id: "google/gemini-3.1-flash-lite",
    label: "Gemini 3.1 Flash Lite",
    description: "El más barato y veloz — respuestas simples y de alto volumen.",
    contextWindow: 1_000_000,
    pricingIn: null,
    pricingOut: null,
    pricing: "Créditos de Lovable AI",
    recommended: false,
    vision: true,
    supportsLiveSearch: false,
  },
];

export function isValidLovableModel(model: string): boolean {
  return LOVABLE_MODELS.some((m) => m.id === model);
}

export function resolveLovableModel(override?: string): string {
  const trimmed = override?.trim();
  if (trimmed && isValidLovableModel(trimmed)) return trimmed;
  return DEFAULT_LOVABLE_MODEL;
}

function getLovableClient(): OpenAI {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) {
    throw new Error(
      "[lovable-ai] Falta LOVABLE_API_KEY en el servidor. Es una clave gestionada por Lovable AI Gateway.",
    );
  }
  return new OpenAI({
    apiKey,
    baseURL: LOVABLE_BASE_URL,
    defaultHeaders: {
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    timeout: 60_000,
    maxRetries: 1,
  });
}

function computeGlobalConfidence(raw: GroqBusquedaRaw): number {
  if (typeof raw.confidence === "number") return Math.min(1, Math.max(0, raw.confidence));
  const acts = raw.actividades ?? [];
  if (acts.length === 0) return 0.5;
  const withConf = acts.filter((a) => typeof a.confidence === "number");
  if (withConf.length === 0) return 0.5;
  const avg = withConf.reduce((acc, a) => acc + a.confidence, 0) / withConf.length;
  return Math.min(1, Math.max(0, Number(avg.toFixed(2))));
}

function toFriendlyError(error: unknown): Error {
  if (error instanceof OpenAI.APIError) {
    if (error.status === 402) {
      return new Error(
        "[lovable-ai] Sin créditos de IA disponibles. El dueño del proyecto debe agregar créditos en Lovable.",
      );
    }
    if (error.status === 403) {
      return new Error("[lovable-ai] Lovable AI está bloqueado por la configuración del workspace.");
    }
    if (error.status === 429) {
      return new Error("[lovable-ai] Demasiadas solicitudes (429). Esperá unos segundos y reintentá.");
    }
    if (error.status === 401) {
      return new Error("[lovable-ai] LOVABLE_API_KEY inválida o ausente.");
    }
    return new Error(`[lovable-ai] Error ${error.status ?? "?"}: ${error.message}`);
  }
  if (error instanceof Error) return new Error(`[lovable-ai] ${error.message}`);
  return new Error(`[lovable-ai] Error desconocido: ${String(error)}`);
}

/**
 * Busca actividades usando Lovable AI Gateway. Mismo shape de resultado que Groq.
 */
export async function buscarActividadesConLovable(
  input: BuscarActividadesInput,
): Promise<GroqBusquedaResult> {
  const ubicacion = input.ubicacion?.trim() ?? "";
  if (ubicacion.length < 3) {
    throw new Error("[lovable-ai] ubicacion debe tener al menos 3 caracteres (ej. 'Lo Prado, Santiago').");
  }
  if (ubicacion.length > 200) {
    throw new Error("[lovable-ai] ubicacion debe tener como máximo 200 caracteres.");
  }

  const client = getLovableClient();
  const model = resolveLovableModel(input.model);
  const systemPrompt = buildGroqSystemPrompt(ubicacion);
  const userPrompt = buildUserPrompt({ ...input, ubicacion });

  let rawContent: string | null | undefined;
  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });
    rawContent = completion.choices[0]?.message?.content;
  } catch (error) {
    throw toFriendlyError(error);
  }

  if (!rawContent) {
    throw new Error("[lovable-ai] El modelo no devolvió contenido.");
  }

  const cleaned = stripJsonFences(rawContent);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(
      `[lovable-ai] No se pudo parsear el JSON del modelo. Primeros 800 chars: ${cleaned.slice(0, 800)} — ${(e as Error).message}`,
    );
  }

  let validated: GroqBusquedaRaw;
  try {
    validated = GroqBusquedaSchema.parse(parsed);
  } catch (zodErr) {
    if (Array.isArray(parsed)) {
      validated = GroqBusquedaSchema.parse({ actividades: parsed });
    } else {
      throw zodErr;
    }
  }

  const actividades = validated.actividades ?? [];
  return {
    actividades,
    total: validated.total ?? actividades.length,
    confidence: computeGlobalConfidence(validated),
    usedModel: model,
    ubicacion,
    warnings: validated.warnings ?? [],
    raw: validated,
  };
}
