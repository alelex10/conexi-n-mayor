/* eslint-disable prettier/prettier */
import { COMUNAS_POR_REGION, REGIONES_CHILE } from "@/data/ubicacion-chile";

export type UbicacionDetectada = {
  regionId: number;
  /** Commune id when the label matched a commune; otherwise null (region-only). */
  communeId: number | null;
};

/** Lowercase ASCII fold so "Maipú" matches "maipu". */
export function normalizarNombre(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ñ/g, "n")
    .replace(/Ñ/g, "n")
    .toLowerCase()
    .trim();
}

/**
 * Matches a reverse-geocode label (BigDataCloud locality/city/principalSubdivision)
 * to ChileCultura ids. Commune wins over region ("Santiago" is a commune, not a region).
 * Returns null when nothing matches so the caller keeps safe defaults.
 */
export function detectarIdsDesdeEtiqueta(etiqueta: string | null | undefined): UbicacionDetectada | null {
  if (!etiqueta || etiqueta.trim().length === 0) return null;
  const buscada = normalizarNombre(etiqueta);
  if (!buscada) return null;
  for (const region of REGIONES_CHILE) {
    for (const comuna of COMUNAS_POR_REGION[region.id] ?? []) {
      if (normalizarNombre(comuna.nombre) === buscada) {
        return { regionId: region.id, communeId: comuna.id };
      }
    }
  }
  for (const region of REGIONES_CHILE) {
    if (normalizarNombre(region.nombre) === buscada) {
      return { regionId: region.id, communeId: null };
    }
  }
  return null;
}
