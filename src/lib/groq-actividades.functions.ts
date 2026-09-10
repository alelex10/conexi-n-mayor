import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { AIProviderName, AIProviderNameExtended } from "@/lib/ai/providers";

/**
 * Capa RPC client-importable para Groq búsqueda actividades por ubicación.
 * NO importar src/server/ai/* estáticamente — Vite bloquea **\/server/** en client bundles.
 * Usamos `await import("@/server/ai/...")` dentro del handler, igual que src/lib/ai.functions.ts
 * del PR selector (ai-model-selector).
 */

const HITL_THRESHOLD = 0.85;

/**
 * Público — sin auth para MVP. Retorna modelos Groq disponibles.
 * Intenta Groq /v1/models server-side, fallback a lista estática. Nunca expone GROQ_API_KEY.
 */
export const listarModelosGroqFn = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { listarModelosDisponibles, DEFAULT_GROQ_MODEL } = await import("@/server/ai/models");
    const result = await listarModelosDisponibles();
    return {
      models: result.models,
      source: result.source,
      fetchedAt: result.fetchedAt,
      defaultModel: DEFAULT_GROQ_MODEL,
      hasGroqKey: Boolean(process.env["GROQ_API_KEY"]),
    };
  } catch (e) {
    console.warn("[listarModelosGroqFn] failed, returning static fallback", e instanceof Error ? e.message : String(e));
    const { GROQ_VISION_MODELS, DEFAULT_GROQ_MODEL } = await import("@/server/ai/models");
    return {
      models: [...GROQ_VISION_MODELS],
      source: "static" as const,
      fetchedAt: new Date().toISOString(),
      defaultModel: DEFAULT_GROQ_MODEL,
      hasGroqKey: Boolean(process.env["GROQ_API_KEY"]),
    };
  }
});

/**
 * Público — modelos disponibles del proveedor Lovable AI (lista estática curada).
 */
export const listarModelosLovableFn = createServerFn({ method: "GET" }).handler(async () => {
  const { LOVABLE_MODELS, DEFAULT_LOVABLE_MODEL } = await import("@/server/ai/lovable-actividades");
  return {
    models: [...LOVABLE_MODELS],
    source: "static" as const,
    fetchedAt: new Date().toISOString(),
    defaultModel: DEFAULT_LOVABLE_MODEL,
    hasLovableKey: Boolean(process.env["LOVABLE_API_KEY"]),
  };
});

/**
 * Público — modelos disponibles del proveedor Gemini (lista estática curada).
 */
export const listarModelosGeminiFn = createServerFn({ method: "GET" }).handler(async () => {
  const { GEMINI_MODELS, DEFAULT_GEMINI_MODEL } = await import("@/server/ai/gemini-actividades");
  return {
    models: [...GEMINI_MODELS],
    source: "static" as const,
    fetchedAt: new Date().toISOString(),
    defaultModel: DEFAULT_GEMINI_MODEL,
    hasGeminiKey: Boolean(process.env["GEMINI_API_KEY"]),
  };
});

/**
 * Público — modelos disponibles del proveedor OpenRouter (lista estática curada, v2 cost-optimized).
 * No intenta fetch remoto — OpenRouter /v1/models requiere auth y varía mucho.
 */
export const listarModelosOpenRouterFn = createServerFn({ method: "GET" }).handler(async () => {
  const { DEFAULT_OPENROUTER_MODEL } = await import("@/server/ai/openrouter-v2/search");
  return {
    models: [
      {
        id: DEFAULT_OPENROUTER_MODEL,
        label: "Llama 3.3 70B Instruct :free (OpenRouter)",
        description: "Free tier via OpenRouter — meta-llama/llama-3.3-70b-instruct:free, cost-optimized (700 tokens, plain JSON, no browser_search tool)",
        contextWindow: 131072,
        maxImages: null,
        speed: null,
        pricingIn: "$0 / 1M",
        pricingOut: "$0 / 1M",
        recommended: true,
        vision: false,
      },
      {
        id: "qwen/qwen-3-32b:free",
        label: "Qwen 3 32B :free (OpenRouter)",
        description: "Free tier alternative — qwen/qwen-3-32b:free via OpenRouter",
        contextWindow: 32768,
        maxImages: null,
        speed: null,
        pricingIn: "$0 / 1M",
        pricingOut: "$0 / 1M",
        recommended: false,
        vision: false,
      },
    ],
    source: "static" as const,
    fetchedAt: new Date().toISOString(),
    defaultModel: DEFAULT_OPENROUTER_MODEL,
    hasOpenRouterKey: Boolean(process.env["OPENROUTER_API_KEY"]),
  };
});

/**
 * Público — modelos disponibles del proveedor NVIDIA (lista estática curada, v2 cost-optimized).
 */
export const listarModelosNvidiaFn = createServerFn({ method: "GET" }).handler(async () => {
  const { DEFAULT_NVIDIA_MODEL } = await import("@/server/ai/nvidia-v2/search");
  return {
    models: [
      {
        id: DEFAULT_NVIDIA_MODEL,
        label: "Llama 3.3 70B Instruct (NVIDIA)",
        description: "Hosted at integrate.api.nvidia.com — meta/llama-3.3-70b-instruct, cost-optimized (700 tokens, plain JSON)",
        contextWindow: 131072,
        maxImages: null,
        speed: null,
        pricingIn: null,
        pricingOut: null,
        recommended: true,
        vision: false,
      },
      {
        id: "nvidia/llama-3.3-nemotron-super-49b-v1.5",
        label: "Nemotron Super 49B (NVIDIA)",
        description: "NVIDIA Nemotron — reasoning-optimized variant hosted on NVIDIA API",
        contextWindow: 131072,
        maxImages: null,
        speed: null,
        pricingIn: null,
        pricingOut: null,
        recommended: false,
        vision: false,
      },
    ],
    source: "static" as const,
    fetchedAt: new Date().toISOString(),
    defaultModel: DEFAULT_NVIDIA_MODEL,
    hasNvidiaKey: Boolean(process.env["NVIDIA_API_KEY"] ?? process.env["NVAPI_KEY"]),
  };
});

export const buscarInputSchema = z.object({
  ubicacion: z.string().trim().min(3, "ubicacion debe tener al menos 3 caracteres").max(200),
  radioMetros: z.number().int().positive().optional(),
  categoria: z.string().trim().min(1).max(50).optional(),
  fechaDesde: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "fechaDesde debe ser YYYY-MM-DD")
    .optional(),
  model: z.string().trim().min(1).optional(),
  // Extended for side-by-side testing: groq/lovable/gemini remain primary UI tabs;
  // openrouter/nvidia are API-only via direct RPC or future tab extension (see providers.ts note).
  proveedor: z.enum(["groq", "lovable", "gemini", "openrouter", "nvidia"]).optional(),
  latitud: z.number().min(-90).max(90).optional(),
  longitud: z.number().min(-180).max(180).optional(),
  locationLabel: z.string().trim().max(200).optional(),
});

/**
 * Busca actividades por ubicación usando Groq v2 / Gemini v2 / Lovable (según `proveedor`) + HITL gate.
 * - Pretty views (/, /groq, /comparar) call this RPC unchanged; wiring now targets v2 impls internally
 *   (groq -> groq-v2/search with browser_search low+700, 2 domains; gemini -> gemini-v2/search mirror).
 *   Legacy src/server/ai/groq/search and gemini/search remain as shims but are no longer called from views.
 * - Lovable keeps legacy lovable/search (fallback; could map to groq-v2 if desired — see note below).
 * - model es opcional desde el cliente; validado server-side
 * - confidence < 0.85 persiste best-effort en busquedas_groq_pendientes (feature-flag: si tabla no existe, warn y no rompe)
 */
export const buscarActividadesPorUbicacionFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => buscarInputSchema.parse(data))
  .handler(async ({ data }) => {
    const proveedor: AIProviderNameExtended = (data.proveedor as AIProviderNameExtended | undefined) ?? "groq";
    const { DEFAULT_GROQ_MODEL } = await import("@/server/ai/models");

    const groqInput: {
      ubicacion: string;
      radioMetros?: number;
      categoria?: string;
      fechaDesde?: string;
      model?: string;
      latitud?: number;
      longitud?: number;
      locationLabel?: string;
    } = {
      ubicacion: data.ubicacion,
    };
    if (data.radioMetros !== undefined) groqInput.radioMetros = data.radioMetros;
    if (data.categoria !== undefined) groqInput.categoria = data.categoria;
    if (data.fechaDesde !== undefined) groqInput.fechaDesde = data.fechaDesde;
    if (data.model !== undefined) groqInput.model = data.model;
    if (data.latitud !== undefined) groqInput.latitud = data.latitud;
    if (data.longitud !== undefined) groqInput.longitud = data.longitud;
    if (data.locationLabel !== undefined) groqInput.locationLabel = data.locationLabel;

    let result;
    let defaultModel = DEFAULT_GROQ_MODEL;
    if (proveedor === "lovable") {
      // Lovable keeps legacy path (stable). To map to v2, replace with:
      // const { buscarActividadesConGroq } = await import("@/server/ai/groq-v2/search");
      // result = await buscarActividadesConGroq(groqInput);
      const { buscarActividadesConLovable } = await import("@/server/ai/lovable/search");
      result = await buscarActividadesConLovable(groqInput);
    } else if (proveedor === "gemini") {
      // Pretty views now target gemini-v2 (googleSearch, low+700, 2 domains, 700 tokens)
      // Legacy src/server/ai/gemini/search remains as shim but is no longer called from views.
      const { buscarActividadesConGemini, DEFAULT_GEMINI_MODEL } = await import(
        "@/server/ai/gemini-v2/search"
      );
      result = await buscarActividadesConGemini(groqInput);
      defaultModel = DEFAULT_GEMINI_MODEL;
    } else if (proveedor === "openrouter") {
      // OpenRouter v2 — OpenAI-compatible via https://openrouter.ai/api/v1, cost-optimized (700 tokens, plain JSON, no browser_search tool)
      const { buscarActividadesConOpenRouter, DEFAULT_OPENROUTER_MODEL } = await import(
        "@/server/ai/openrouter-v2/search"
      );
      result = await buscarActividadesConOpenRouter(groqInput);
      defaultModel = DEFAULT_OPENROUTER_MODEL;
    } else if (proveedor === "nvidia") {
      // NVIDIA v2 — OpenAI-compatible via https://integrate.api.nvidia.com/v1, cost-optimized (700 tokens, plain JSON)
      const { buscarActividadesConNvidia, DEFAULT_NVIDIA_MODEL } = await import(
        "@/server/ai/nvidia-v2/search"
      );
      result = await buscarActividadesConNvidia(groqInput);
      defaultModel = DEFAULT_NVIDIA_MODEL;
    } else {
      // Pretty views now target groq-v2 (browser_search, low+700, 2 domains, textual JSON only)
      // Legacy src/server/ai/groq/search remains as shim but is no longer called from views.
      const { buscarActividadesConGroq } = await import("@/server/ai/groq-v2/search");
      result = await buscarActividadesConGroq(groqInput);
    }


    const confidence = result.confidence;
    const needsReview = confidence < HITL_THRESHOLD;
    const status = needsReview ? ("needs_review" as const) : ("ok" as const);
    const envFallback =
      proveedor === "gemini"
        ? process.env["GEMINI_MODEL"]
        : proveedor === "lovable"
          ? undefined
          : proveedor === "openrouter"
            ? process.env["OPENROUTER_MODEL"] ?? process.env["OPENROUTER_MODEL_OVERRIDE"]
            : proveedor === "nvidia"
              ? process.env["NVIDIA_MODEL"] ?? process.env["NVAPI_MODEL_OVERRIDE"] ?? process.env["NVIDIA_MODEL_OVERRIDE"]
              : process.env["GROQ_MODEL"];
    const usedModel = result.usedModel || data.model?.trim() || envFallback || defaultModel;


    if (needsReview) {
      try {
        const { getAdminClient } = await import("./supabase.server");
        const admin = getAdminClient();
        const { error } = await admin.from("busquedas_groq_pendientes").insert({
          ubicacion: data.ubicacion,
          radio_metros: data.radioMetros ?? null,
          raw_json: result.raw as unknown as Record<string, unknown>,
          confidence,
          provider: `${proveedor}:${usedModel}`,
          status: "pendiente",
        });
        if (error) throw new Error(error.message);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const isMissingTable =
          msg.includes("does not exist") ||
          msg.includes("relation") ||
          msg.includes("42P01") ||
          msg.includes("Could not find the table");
        const isMissingEnv = msg.includes("Missing required server secret");
        if (isMissingTable || isMissingEnv) {
          console.warn(
            "[buscarActividadesPorUbicacionFn] Skipping Supabase persist — table or env not ready (feature flag).",
            msg,
          );
        } else {
          console.warn(
            "[buscarActividadesPorUbicacionFn] Failed to persist busquedas_groq_pendientes — returning result anyway.",
            msg,
          );
        }
      }
    }

    return {
      status,
      proveedor,

      actividades: result.actividades,
      total: result.total,
      confidence,
      usedModel,
      ubicacion: result.ubicacion,
      warnings: result.warnings,
      needsReview,
      raw: result.raw,
      // Grounding references (Gemini live search). Always an array so the UI
      // can render links without null checks; empty for Groq/Lovable.
      sources: result.sources ?? [],
      // Real search-executed signal + full internal trace (Gemini only;
      // undefined for Groq/Lovable). Passed through untouched: the HITL gate
      // above and the Supabase persistence still key off `confidence` only.
      searched: result.searched,
      trace: result.trace,
    };
  });
