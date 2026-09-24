import type { Actividad } from "@/data/actividades";

// Pure presentation rules for <ActividadCard/>.

export function etiquetaPrecio(a: Actividad): string {
  if (a.gratuito) return "Gratuito";
  return a.precio ?? "De pago";
}

// ChileCultura events carry a fixed placeholder distance (see src/lib/chilecultura.ts),
// so showing it would present an invented number as fact.
export function tieneDistanciaReal(a: Actividad): boolean {
  return a.fuente !== "chilecultura";
}

export function textoUbicacion(a: Actividad, mostrarComuna: boolean): string {
  if (!mostrarComuna || !a.commune) return a.lugar;
  if (a.lugar.toLowerCase().includes(a.commune.toLowerCase())) return a.lugar;
  return `${a.lugar}, ${a.commune}`;
}
