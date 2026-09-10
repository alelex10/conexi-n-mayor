import { CLEAN_RADIO_METROS, MIN_UBICACION_LENGTH, UBICACION_SHORT_ERROR } from "./constants";
import type { DevicePayload, Proveedor, SearchPayload } from "./types";

export { UBICACION_SHORT_ERROR };

export function isUbicacionValid(ubicacion: string): boolean {
  return ubicacion.trim().length >= MIN_UBICACION_LENGTH;
}

export function buildCleanSearchPayload(
  ubicacion: string,
  devicePayload: DevicePayload,
  model: string,
): SearchPayload {
  return {
    ubicacion: ubicacion.trim(),
    radioMetros: CLEAN_RADIO_METROS,
    model,
    ...devicePayload,
  };
}

export function buildFullSearchPayload(args: {
  ubicacion: string;
  radioMetros: string;
  categoria: string;
  fechaDesde: string;
  modeloActual: string;
  proveedor: Proveedor;
  devicePayload: DevicePayload;
}): SearchPayload {
  const payload: SearchPayload = {
    ubicacion: args.ubicacion.trim(),
    model: args.modeloActual,
    proveedor: args.proveedor,
    ...args.devicePayload,
  };
  if (args.radioMetros.trim()) {
    const n = Number(args.radioMetros);
    if (!Number.isNaN(n) && n > 0) payload.radioMetros = Math.round(n);
  }
  if (args.categoria.trim() && args.categoria !== "todas")
    payload.categoria = args.categoria.trim();
  if (args.fechaDesde.trim()) payload.fechaDesde = args.fechaDesde.trim();
  return payload;
}

export function mapSearchError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes("Missing GROQ_API_KEY") || msg.includes("GROQ_API_KEY")) {
    return "Falta GROQ_API_KEY en el servidor (.env). Conseguí una en https://console.groq.com/keys";
  }
  if (msg.includes("GEMINI_API_KEY")) {
    return "Falta GEMINI_API_KEY en el servidor (.env). Conseguí una en https://aistudio.google.com/apikey";
  }
  if (msg.includes("LOVABLE_API_KEY")) {
    return "Falta LOVABLE_API_KEY en el servidor (.env). Es una clave gestionada por Lovable AI Gateway.";
  }
  if (msg.includes("OPENROUTER_API_KEY")) {
    return "Falta OPENROUTER_API_KEY en el servidor (.env). Conseguí una en https://openrouter.ai/keys";
  }
  if (msg.includes("NVIDIA_API_KEY") || msg.includes("NVAPI_KEY")) {
    return "Falta NVIDIA_API_KEY (o NVAPI_KEY) en el servidor (.env). Conseguí una en https://build.nvidia.com/explore/discover";
  }
  return msg;
}
