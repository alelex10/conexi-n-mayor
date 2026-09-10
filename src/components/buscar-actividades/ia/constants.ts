import type { GroqModelUI, Proveedor } from "./types";

export const FALLBACK_MODELS: GroqModelUI[] = [
  {
    id: "openai/gpt-oss-120b",
    label: "GPT OSS 120B (recomendado)",
    description:
      "Recomendado — verificado 2026-09-03: único que pasa response_format json_object con el prompt de actividades; default para búsqueda",
    contextWindow: 131072,
    pricingIn: "$0.15 / 1M",
    pricingOut: "$0.60 / 1M",
    pricing: "$0.15 / $0.60 por 1M",
    recommended: true,
    vision: false,
    supportsLiveSearch: false,
  },
  {
    id: "qwen/qwen3.6-27b",
    label: "Qwen 3 27B",
    description:
      "Qwen 3.6 27B — NO usar con response_format json_object para búsqueda de actividades (Groq 400 json_validate_failed verificado 2026-09-03); solo con retry sin formato",
    contextWindow: 131072,
    pricingIn: "$0.60 / 1M",
    pricingOut: "$3.00 / 1M",
    pricing: "$0.60 / $3.00 por 1M",
    recommended: false,
    vision: true,
    supportsLiveSearch: false,
  },
  {
    id: "qwen/qwen3.8-27b",
    label: "Qwen 3.8 27B",
    description: "Qwen 3.8 27B — contexto largo, ideal para búsquedas complejas",
    contextWindow: 131072,
    pricingIn: "$0.80 / 1M",
    pricingOut: "$4.00 / 1M",
    pricing: "$0.80 / $4.00 por 1M",
    recommended: false,
    vision: true,
    supportsLiveSearch: false,
  },
];

export const DEFAULT_MODEL = "openai/gpt-oss-120b";

export const LOVABLE_DEFAULT_MODEL = "google/gemini-3.7-flash";

export const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash";

export const FALLBACK_GEMINI_MODELS: GroqModelUI[] = [
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash (recomendado)",
    description:
      "Rápido y económico — default para búsqueda de actividades vía Gemini (free tier con límite ~10 RPM)",
    contextWindow: 1000000,
    pricingIn: null,
    pricingOut: null,
    pricing: "Google AI Studio (free tier disponible)",
    recommended: true,
    vision: true,
    supportsLiveSearch: true,
  },
];

export const FALLBACK_OPENROUTER_MODELS: GroqModelUI[] = [
  {
    id: "meta-llama/llama-3.3-70b-instruct:free",
    label: "Llama 3.3 70B Instruct :free (OpenRouter)",
    description:
      "Free tier via OpenRouter — meta-llama/llama-3.3-70b-instruct:free, cost-optimized (700 tokens, plain JSON, no browser_search tool)",
    contextWindow: 131072,
    pricingIn: "$0 / 1M",
    pricingOut: "$0 / 1M",
    pricing: "$0 / $0 por 1M",
    recommended: true,
    vision: false,
    supportsLiveSearch: false,
  },
  {
    id: "qwen/qwen-3-32b:free",
    label: "Qwen 3 32B :free (OpenRouter)",
    description: "Free tier alternative — qwen/qwen-3-32b:free via OpenRouter",
    contextWindow: 32768,
    pricingIn: "$0 / 1M",
    pricingOut: "$0 / 1M",
    pricing: "$0 / $0 por 1M",
    recommended: false,
    vision: false,
    supportsLiveSearch: false,
  },
];

export const FALLBACK_NVIDIA_MODELS: GroqModelUI[] = [
  {
    id: "meta/llama-3.3-70b-instruct",
    label: "Llama 3.3 70B Instruct (NVIDIA)",
    description:
      "Hosted at integrate.api.nvidia.com — meta/llama-3.3-70b-instruct, cost-optimized (700 tokens, plain JSON)",
    contextWindow: 131072,
    pricingIn: null,
    pricingOut: null,
    pricing: "NVIDIA API (free tier available)",
    recommended: true,
    vision: false,
    supportsLiveSearch: false,
  },
  {
    id: "nvidia/llama-3.3-nemotron-super-49b-v1.5",
    label: "Nemotron Super 49B (NVIDIA)",
    description: "NVIDIA Nemotron — reasoning-optimized variant hosted on NVIDIA API",
    contextWindow: 131072,
    pricingIn: null,
    pricingOut: null,
    pricing: "NVIDIA API",
    recommended: false,
    vision: false,
    supportsLiveSearch: false,
  },
];

export const CATEGORIAS = [
  { value: "", label: "Todas" },
  { value: "taller", label: "Taller" },
  { value: "paseo", label: "Paseo" },
  { value: "charla", label: "Charla" },
  { value: "deporte", label: "Deporte" },
  { value: "cultura", label: "Cultura" },
  { value: "salud", label: "Salud" },
  { value: "ejercicio", label: "Ejercicio" },
  { value: "recreacion", label: "Recreación" },
  { value: "aprendizaje", label: "Aprendizaje" },
  { value: "otro", label: "Otro" },
] as const;

export const PROVIDER_ORDER: Proveedor[] = ["groq", "lovable", "gemini", "openrouter", "nvidia"];

export const PROVIDER_DESCRIPTIONS: Record<Proveedor, string> = {
  groq: "Groq usa GROQ_API_KEY configurada en el servidor.",
  lovable: "Lovable AI usa los créditos del proyecto — no requiere clave externa.",
  gemini: "Gemini usa GEMINI_API_KEY configurada en el servidor (free tier disponible).",
  openrouter:
    "OpenRouter usa OPENROUTER_API_KEY configurada en el servidor (free tier :free disponible).",
  nvidia:
    "NVIDIA usa NVIDIA_API_KEY / NVAPI_KEY configurada en el servidor (integrate.api.nvidia.com).",
};

export const CLEAN_RADIO_METROS = 2500;

export const MIN_UBICACION_LENGTH = 3;

export const UBICACION_SHORT_ERROR = "Escriba su comuna o barrio. Por ejemplo: Lo Prado, Santiago.";

export const DEFAULT_UBICACION = "Lo Prado, Santiago, Chile";
