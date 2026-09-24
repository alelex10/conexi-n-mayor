import { Link } from "@tanstack/react-router";
import { CalendarDays, ExternalLink, Footprints, MapPin } from "lucide-react";
import type { ReactNode } from "react";

import { formatearDistancia, formatearFecha, type Actividad } from "@/data/actividades";
import { etiquetaPrecio, textoUbicacion, tieneDistanciaReal } from "@/lib/actividad-card";

// Shared activity card. Hierarchy: image → title → when/where/distance → description
// → price + category → one primary action. Context already shown by the list
// (source, searched region) is intentionally left out of the card.

type Props = {
  actividad: Actividad;
  /** Append the commune to the venue (useful when the list spans a whole region). */
  mostrarComuna?: boolean;
  /** Extra info rendered below the description (e.g. amenities). */
  extras?: ReactNode;
  /** Secondary actions rendered next to the primary one. */
  acciones?: ReactNode;
  /** Label for the primary action when it links to the internal detail page. */
  etiquetaDetalle?: string;
};

const accionPrincipalClass =
  "inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#1E6CB4] px-4 text-lg font-bold text-white shadow-sm transition-colors hover:bg-[#164F8A] focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#1E6CB4]";

export function ActividadCard({
  actividad: a,
  mostrarComuna = false,
  extras,
  acciones,
  etiquetaDetalle = "Ver detalles",
}: Props) {
  return (
    <article className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-sm">
      {a.imagenUrl && (
        <img src={a.imagenUrl} alt="" loading="lazy" className="aspect-video w-full object-cover" />
      )}
      <div className="flex flex-col gap-3 p-4">
        <h3 className="text-xl font-extrabold leading-tight text-[#5D4037]">{a.nombre}</h3>

        <ul className="space-y-1.5 text-lg font-medium leading-snug text-[#424242]">
          <li className="flex items-start gap-2">
            <CalendarDays className="mt-1 size-5 shrink-0 text-[#8D6E63]" aria-hidden />
            <span>
              {formatearFecha(a.fecha)} · {a.hora} horas
            </span>
          </li>
          <li className="flex items-start gap-2">
            <MapPin className="mt-1 size-5 shrink-0 text-[#8D6E63]" aria-hidden />
            <span>{textoUbicacion(a, mostrarComuna)}</span>
          </li>
          {tieneDistanciaReal(a) && (
            <li className="flex items-start gap-2">
              <Footprints className="mt-1 size-5 shrink-0 text-[#8D6E63]" aria-hidden />
              <span>A {formatearDistancia(a.distanciaMetros)} de su casa</span>
            </li>
          )}
        </ul>

        {a.descripcion && (
          <p className="line-clamp-2 text-base leading-relaxed text-[#616161]">{a.descripcion}</p>
        )}

        {extras}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span
            className={`rounded-lg px-3 py-1 text-base font-extrabold ${
              a.gratuito
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground"
            }`}
          >
            {etiquetaPrecio(a)}
          </span>
          <span className="text-base font-semibold text-[#8D6E63]">{a.categoria}</span>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {a.url ? (
            <a href={a.url} target="_blank" rel="noreferrer" className={accionPrincipalClass}>
              Ver en ChileCultura
              <ExternalLink className="size-5 shrink-0" aria-hidden />
              <span className="sr-only">(se abre en una pestaña nueva)</span>
            </a>
          ) : (
            <Link to="/actividad/$id" params={{ id: a.id }} className={accionPrincipalClass}>
              {etiquetaDetalle}
            </Link>
          )}
          {acciones}
        </div>
      </div>
    </article>
  );
}
