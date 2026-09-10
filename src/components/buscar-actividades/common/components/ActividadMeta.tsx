import { MapPin } from "lucide-react";

import type { CardModel } from "../actividad-adapters";
import { buildDestino, formatCleanDate } from "../utils";

export type ActividadMetaVariant = "clean" | "chilecultura";

/**
 * Shared meta block (fecha/hora/lugar/distancia/descripción). Uses the
 * existing common utils (`formatCleanDate`, `buildDestino`). Each variant
 * keeps its card's exact original markup/classes:
 * - clean: fecha/hora line (text-lg) + destino line with MapPin (text-lg).
 *   No distancia, no descripción (the clean card never showed them).
 * - chilecultura: fecha·hora—lugar line + distancia line with the
 *   "Distancia estimada" disclosure + line-clamp-3 descripción (text-[15px]).
 */
export function ActividadMeta({
  model,
  variant,
}: {
  model: CardModel;
  variant: ActividadMetaVariant;
}) {
  if (variant === "clean") {
    const fechaTexto = formatCleanDate(model.fecha);
    const destino = buildDestino(model.lugar, model.direccion);
    return (
      <>
        {(fechaTexto || model.hora) && (
          <p className="text-lg font-medium leading-snug text-[#424242]">
            {fechaTexto}
            {fechaTexto && model.hora
              ? ` · ${model.hora} horas`
              : model.hora
                ? `${model.hora} horas`
                : ""}
          </p>
        )}
        {destino && (
          <p className="flex items-start gap-2 text-lg font-medium leading-snug text-[#424242]">
            <MapPin className="mt-1 size-5 shrink-0 text-[#616161]" aria-hidden />
            <span>{destino}</span>
          </p>
        )}
      </>
    );
  }

  const fechaTexto = formatCleanDate(model.fecha);
  return (
    <>
      <p className="text-[15px] font-medium leading-snug text-[#424242]">
        {fechaTexto} · {model.hora} horas — {model.lugar}
      </p>
      {model.distanciaTexto && (
        <p className="text-[15px] font-medium leading-snug text-[#424242]">
          A {model.distanciaTexto} de su casa{" "}
          <span className="text-xs font-semibold text-[#8D6E63]">
            — Distancia estimada — confirmar dirección
          </span>
        </p>
      )}
      {model.descripcion && (
        <p className="line-clamp-3 text-[15px] leading-snug text-[#616161]">{model.descripcion}</p>
      )}
    </>
  );
}
