import { formatearDistancia, type Actividad } from "@/data/actividades";
import type { GroqActividadUI } from "../ia/types";

/**
 * Normalized card model shared by the clean IA card and the ChileCultura
 * card. Types are NOT merged (`Actividad` vs `GroqActividadUI` stay
 * separate) — this model is only the display projection both cards need:
 * - precio/precio_texto → single `textoPago`
 * - fecha string|null normalized
 * - distancia only exists on `Actividad` (Groq → null)
 */
export type CardModel = {
  nombre: string;
  categoria: string;
  gratuito: boolean;
  textoPago: string;
  fecha: string | null;
  hora: string | null;
  lugar: string | null;
  direccion: string | null;
  descripcion: string | null;
  distanciaTexto: string | null;
  commune: string | null;
  url: string | null;
};

export function toCardModel(input: Actividad | GroqActividadUI): CardModel {
  if ("distanciaMetros" in input) {
    const a = input as Actividad;
    return {
      nombre: a.nombre,
      categoria: a.categoria,
      gratuito: a.gratuito,
      textoPago: a.gratuito ? "Gratuito" : a.precio ? `De pago · ${a.precio}` : "De pago",
      fecha: a.fecha ?? null,
      hora: a.hora ?? null,
      lugar: a.lugar ?? null,
      direccion: a.direccion ?? null,
      descripcion: a.descripcion ?? null,
      distanciaTexto: formatearDistancia(a.distanciaMetros),
      commune: a.commune ?? null,
      url: a.url ?? null,
    };
  }
  const g = input as GroqActividadUI;
  return {
    nombre: g.nombre,
    categoria: g.categoria,
    gratuito: g.gratuito,
    textoPago: g.precio_texto || "De pago",
    fecha: g.fecha ?? null,
    hora: g.hora ?? null,
    lugar: g.lugar ?? null,
    direccion: g.direccion ?? null,
    descripcion: g.descripcion ?? null,
    distanciaTexto: null,
    commune: null,
    url: null,
  };
}
