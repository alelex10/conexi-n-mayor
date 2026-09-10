import { useEffect, useState } from "react";
import { AI_PROVIDER_LABELS_EXTENDED } from "@/lib/ai/providers";
import {
  listarModelosGeminiFn,
  listarModelosGroqFn,
  listarModelosLovableFn,
  listarModelosNvidiaFn,
  listarModelosOpenRouterFn,
} from "@/lib/groq-actividades.functions";
import {
  DEFAULT_MODEL,
  FALLBACK_GEMINI_MODELS,
  FALLBACK_MODELS,
  FALLBACK_NVIDIA_MODELS,
  FALLBACK_OPENROUTER_MODELS,
  GEMINI_DEFAULT_MODEL,
  LOVABLE_DEFAULT_MODEL,
} from "../constants";
import type { GroqModelUI, Proveedor, ProviderKeyStatus } from "../types";

type RawModelsResponse = {
  models: GroqModelUI[];
  defaultModel: string;
  hasKey: boolean;
  source: unknown;
};

async function resolveProviderModels(
  listFn: () => Promise<unknown>,
  hasKeyField: string,
): Promise<RawModelsResponse> {
  const res = (await listFn()) as Record<string, unknown>;
  return {
    models: (res["models"] as unknown as GroqModelUI[]) ?? [],
    defaultModel: res["defaultModel"] as string,
    hasKey: Boolean(res[hasKeyField]),
    source: res["source"],
  };
}

type LoadOneArgs = {
  listFn: () => Promise<unknown>;
  hasKeyField: string;
  /** Fallback list when the server returns an empty list. Ignored when allowEmpty is true. */
  fallback: GroqModelUI[];
  /** When true the (possibly empty) server list is kept as-is. Only Lovable uses this. */
  allowEmpty: boolean;
  getCurrentModel: () => string;
  setModels: (models: GroqModelUI[]) => void;
  setModel: (id: string) => void;
  setHasKey: (value: boolean) => void;
  onResolve?: (res: RawModelsResponse) => void;
  onFailure?: () => void;
  isCancelled: () => boolean;
};

/**
 * Generic loader shared by the 5 providers. Preserves each provider's
 * original nuance (empty-list handling, key flag, failure fallback)
 * while keeping a single cancellation-aware flow.
 */
async function loadProviderModels(args: LoadOneArgs): Promise<void> {
  try {
    const res = await resolveProviderModels(args.listFn, args.hasKeyField);
    if (args.isCancelled()) return;
    const list = res.models;
    args.setModels(list.length > 0 || args.allowEmpty ? list : args.fallback);
    args.setHasKey(res.hasKey);
    args.onResolve?.(res);
    if (list.length > 0 && !list.some((m) => m.id === args.getCurrentModel())) {
      args.setModel(res.defaultModel || list[0]!.id);
    }
  } catch {
    if (args.isCancelled()) return;
    args.setHasKey(false);
    args.onFailure?.();
  }
}

export type AiProvidersState = {
  proveedor: Proveedor;
  setProveedor: (p: Proveedor) => void;
  modelosActuales: GroqModelUI[];
  modeloActual: string;
  setModeloActual: (id: string) => void;
  selectedMeta: GroqModelUI | null;
  nombreProveedor: string;
  loadingModelos: boolean;
} & ProviderKeyStatus;

/**
 * Owns the 5 provider model lists, the selected provider/model and the
 * API-key flags. When `enabled` is false (clean variant) no fetch runs
 * and loading resolves immediately, mirroring the original early return.
 */
export function useAiProviders({ enabled }: { enabled: boolean }): AiProvidersState {
  const [proveedor, setProveedor] = useState<Proveedor>("groq");
  const [modelos, setModelos] = useState<GroqModelUI[]>(FALLBACK_MODELS);
  const [modeloSeleccionado, setModeloSeleccionado] = useState<string>(DEFAULT_MODEL);
  const [modelosLovable, setModelosLovable] = useState<GroqModelUI[]>([]);
  const [modeloLovable, setModeloLovable] = useState<string>(LOVABLE_DEFAULT_MODEL);
  const [hasLovableKey, setHasLovableKey] = useState<boolean | null>(null);
  const [modelosGemini, setModelosGemini] = useState<GroqModelUI[]>(FALLBACK_GEMINI_MODELS);
  const [modeloGemini, setModeloGemini] = useState<string>(GEMINI_DEFAULT_MODEL);
  const [hasGeminiKey, setHasGeminiKey] = useState<boolean | null>(null);
  const [modelosOpenRouter, setModelosOpenRouter] = useState<GroqModelUI[]>(
    FALLBACK_OPENROUTER_MODELS,
  );
  const [modeloOpenRouter, setModeloOpenRouter] = useState<string>(
    FALLBACK_OPENROUTER_MODELS[0]!.id,
  );
  const [hasOpenRouterKey, setHasOpenRouterKey] = useState<boolean | null>(null);
  const [modelosNvidia, setModelosNvidia] = useState<GroqModelUI[]>(FALLBACK_NVIDIA_MODELS);
  const [modeloNvidia, setModeloNvidia] = useState<string>(FALLBACK_NVIDIA_MODELS[0]!.id);
  const [hasNvidiaKey, setHasNvidiaKey] = useState<boolean | null>(null);
  const [source, setSource] = useState<"groq" | "static">("static");
  const [hasGroqKey, setHasGroqKey] = useState<boolean | null>(null);
  const [loadingModelos, setLoadingModelos] = useState(true);

  useEffect(() => {
    if (!enabled) {
      setLoadingModelos(false);
      return;
    }
    let cancelled = false;
    const isCancelled = () => cancelled;

    void (async () => {
      try {
        await loadProviderModels({
          listFn: listarModelosGroqFn,
          hasKeyField: "hasGroqKey",
          fallback: FALLBACK_MODELS,
          allowEmpty: false,
          getCurrentModel: () => modeloSeleccionado,
          setModels: setModelos,
          setModel: setModeloSeleccionado,
          setHasKey: setHasGroqKey,
          onResolve: (res) => {
            setSource(res.source as "groq" | "static");
          },
          onFailure: () => {
            setModelos(FALLBACK_MODELS);
            setSource("static");
          },
          isCancelled,
        });
      } finally {
        if (!cancelled) setLoadingModelos(false);
      }
    })();
    void loadProviderModels({
      listFn: listarModelosLovableFn,
      hasKeyField: "hasLovableKey",
      fallback: [],
      allowEmpty: true,
      getCurrentModel: () => modeloLovable,
      setModels: setModelosLovable,
      setModel: setModeloLovable,
      setHasKey: setHasLovableKey,
      isCancelled,
    });
    void loadProviderModels({
      listFn: listarModelosGeminiFn,
      hasKeyField: "hasGeminiKey",
      fallback: FALLBACK_GEMINI_MODELS,
      allowEmpty: false,
      getCurrentModel: () => modeloGemini,
      setModels: setModelosGemini,
      setModel: setModeloGemini,
      setHasKey: setHasGeminiKey,
      onFailure: () => {
        setModelosGemini(FALLBACK_GEMINI_MODELS);
      },
      isCancelled,
    });
    void loadProviderModels({
      listFn: listarModelosOpenRouterFn,
      hasKeyField: "hasOpenRouterKey",
      fallback: FALLBACK_OPENROUTER_MODELS,
      allowEmpty: false,
      getCurrentModel: () => modeloOpenRouter,
      setModels: setModelosOpenRouter,
      setModel: setModeloOpenRouter,
      setHasKey: setHasOpenRouterKey,
      onFailure: () => {
        setModelosOpenRouter(FALLBACK_OPENROUTER_MODELS);
      },
      isCancelled,
    });
    void loadProviderModels({
      listFn: listarModelosNvidiaFn,
      hasKeyField: "hasNvidiaKey",
      fallback: FALLBACK_NVIDIA_MODELS,
      allowEmpty: false,
      getCurrentModel: () => modeloNvidia,
      setModels: setModelosNvidia,
      setModel: setModeloNvidia,
      setHasKey: setHasNvidiaKey,
      onFailure: () => {
        setModelosNvidia(FALLBACK_NVIDIA_MODELS);
      },
      isCancelled,
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const modelStateByProvider: Record<
    Proveedor,
    { models: GroqModelUI[]; selected: string; setSelected: (id: string) => void }
  > = {
    groq: { models: modelos, selected: modeloSeleccionado, setSelected: setModeloSeleccionado },
    lovable: { models: modelosLovable, selected: modeloLovable, setSelected: setModeloLovable },
    gemini: { models: modelosGemini, selected: modeloGemini, setSelected: setModeloGemini },
    openrouter: {
      models: modelosOpenRouter,
      selected: modeloOpenRouter,
      setSelected: setModeloOpenRouter,
    },
    nvidia: { models: modelosNvidia, selected: modeloNvidia, setSelected: setModeloNvidia },
  };
  const active = modelStateByProvider[proveedor];
  const modelosActuales = active.models;
  const modeloActual = active.selected;
  const setModeloActual = active.setSelected;
  const nombreProveedor = AI_PROVIDER_LABELS_EXTENDED[proveedor] ?? "Groq";
  const selectedMeta = modelosActuales.find((m) => m.id === modeloActual) ?? null;

  return {
    proveedor,
    setProveedor,
    modelosActuales,
    modeloActual,
    setModeloActual,
    selectedMeta,
    nombreProveedor,
    loadingModelos,
    hasGroqKey,
    hasLovableKey,
    hasGeminiKey,
    hasOpenRouterKey,
    hasNvidiaKey,
    source,
  };
}
