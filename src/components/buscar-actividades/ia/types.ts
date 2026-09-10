import type { AIProviderNameExtended } from "@/lib/ai/providers";

export type Proveedor = AIProviderNameExtended;

export type BuscarActividadesVariant = "full" | "clean";

export type GroqModelUI = {
  id: string;
  label: string;
  description: string;
  contextWindow: number;
  pricingIn: string | null;
  pricingOut: string | null;
  pricing?: string | null;
  recommended: boolean;
  vision?: boolean;
  supportsLiveSearch?: boolean;
  maxImages?: number | null;
  speed?: string | null;
};

export type GroqActividadUI = {
  nombre: string;
  descripcion: string;
  fecha: string | null;
  hora: string | null;
  lugar: string | null;
  direccion: string | null;
  categoria: string;
  gratuito: boolean;
  precio_texto?: string | null;
  fuente_url?: string | null;
  confidence: number;
  warnings?: string[];
};

export type BuscarResultTraceAttempt = {
  attempt: number;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  systemPrompt: string;
  userPrompt: string;
  finishReason: string | null;
  promptTokens: number | null;
  candidatesTokens: number | null;
  totalTokens: number | null;
  webSearchQueries: string[];
  groundingChunkCount: number;
  sourceCount: number;
  searched: boolean;
  backoffMs: number | null;
  error?: string;
};

export type BuscarResultTrace = {
  model: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  attempts: BuscarResultTraceAttempt[];
  retries: { attempt: number; backoffMs: number; reason: string }[];
  totalPromptTokens: number | null;
  totalCandidatesTokens: number | null;
  totalTokens: number | null;
  queries: string[];
  groundingChunkCount: number;
  sourceCount: number;
  searched: boolean;
  confidence: number;
  verdict: "grounded" | "memory";
};

export type BuscarResult = {
  status: "needs_review" | "ok";
  actividades: GroqActividadUI[];
  total: number;
  confidence: number;
  usedModel: string;
  ubicacion: string;
  warnings: string[];
  needsReview: boolean;
  raw: unknown;
  sources?: { title: string; url: string }[];
  searched?: boolean;
  trace?: BuscarResultTrace;
};

export type DevicePayload = {
  latitud?: number;
  longitud?: number;
  locationLabel?: string;
};

export type SearchPayload = {
  ubicacion: string;
  radioMetros?: number;
  categoria?: string;
  fechaDesde?: string;
  model?: string;
  proveedor?: Proveedor;
  latitud?: number;
  longitud?: number;
  locationLabel?: string;
};

export type ProviderKeyStatus = {
  hasGroqKey: boolean | null;
  hasLovableKey: boolean | null;
  hasGeminiKey: boolean | null;
  hasOpenRouterKey: boolean | null;
  hasNvidiaKey: boolean | null;
  source: "groq" | "static";
};
