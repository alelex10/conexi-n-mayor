import { formatearFecha } from "@/data/actividades";

/**
 * Shared maps/date helpers. Moved verbatim from the old IA `utils.ts`
 * (only the signatures were generalized so `common/` never imports
 * from `ia/`): `buildDestino` takes the two parts directly instead of
 * a `GroqActividadUI` pick. Behavior is identical.
 */
export function formatCleanDate(fecha: string | null): string | null {
  if (!fecha) return null;
  const iso = fecha.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    try {
      return formatearFecha(iso);
    } catch {
      return fecha;
    }
  }
  return fecha;
}

export function buildDestino(lugar: string | null, direccion: string | null): string {
  return [lugar, direccion].filter(Boolean).join(", ");
}

export function buildMapsUrl(lugar: string | null, direccion: string | null): string | null {
  const destino = buildDestino(lugar, direccion);
  if (!destino) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destino)}`;
}
