import { AlertTriangle } from "lucide-react";
import type { Proveedor, ProviderKeyStatus } from "../types";

type ApiKeyWarningConfig = {
  title: string;
  envVar: string;
  extraEnvVar?: string;
  docHref: string;
  docLabel: string;
};

const API_KEY_WARNING_CONFIG: Record<Exclude<Proveedor, "lovable">, ApiKeyWarningConfig> = {
  groq: {
    title: "GROQ_API_KEY no configurada en el servidor",
    envVar: "GROQ_API_KEY",
    docHref: "https://console.groq.com/keys",
    docLabel: "console.groq.com/keys",
  },
  gemini: {
    title: "GEMINI_API_KEY no configurada en el servidor",
    envVar: "GEMINI_API_KEY",
    docHref: "https://aistudio.google.com/apikey",
    docLabel: "aistudio.google.com/apikey",
  },
  openrouter: {
    title: "OPENROUTER_API_KEY no configurada en el servidor",
    envVar: "OPENROUTER_API_KEY",
    docHref: "https://openrouter.ai/keys",
    docLabel: "openrouter.ai/keys",
  },
  nvidia: {
    title: "NVIDIA_API_KEY no configurada en el servidor",
    envVar: "NVIDIA_API_KEY",
    extraEnvVar: "NVAPI_KEY",
    docHref: "https://build.nvidia.com/explore/discover",
    docLabel: "build.nvidia.com/explore/discover",
  },
};

const KEY_FLAG_BY_PROVIDER: Record<Exclude<Proveedor, "lovable">, keyof ProviderKeyStatus> = {
  groq: "hasGroqKey",
  gemini: "hasGeminiKey",
  openrouter: "hasOpenRouterKey",
  nvidia: "hasNvidiaKey",
};

/**
 * Amber "missing API key" callout. Lovable has no warning by design
 * (it uses project credits), matching the original view.
 */
export function ApiKeyWarning({
  proveedor,
  keyStatus,
}: {
  proveedor: Proveedor;
  keyStatus: ProviderKeyStatus;
}) {
  if (proveedor === "lovable") return null;
  const config = API_KEY_WARNING_CONFIG[proveedor];
  if (keyStatus[KEY_FLAG_BY_PROVIDER[proveedor]] !== false) return null;
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-snug text-amber-900">
      <p className="flex items-center gap-2 font-bold">
        <AlertTriangle className="size-4 text-amber-600" aria-hidden />
        {config.title}
      </p>
      <p className="mt-1">
        Configurá <code className="rounded bg-white px-1">{config.envVar}</code>
        {config.extraEnvVar ? (
          <>
            {" "}
            (o <code className="rounded bg-white px-1">{config.extraEnvVar}</code>)
          </>
        ) : null}{" "}
        en <code className="rounded bg-white px-1">.env</code> (conseguí una en{" "}
        <a href={config.docHref} target="_blank" rel="noreferrer" className="font-bold underline">
          {config.docLabel}
        </a>
        ). Mientras tanto el selector funciona y la lista es estática, pero la búsqueda dará error
        hasta tener la key.
      </p>
    </div>
  );
}
