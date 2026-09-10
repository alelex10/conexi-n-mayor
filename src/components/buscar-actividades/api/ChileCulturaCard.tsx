import { Link } from "@tanstack/react-router";

import type { Actividad } from "@/data/actividades";
import { toCardModel } from "../common/actividad-adapters";
import { ActividadCardBase } from "../common/components/ActividadCardBase";
import { ActividadMeta } from "../common/components/ActividadMeta";
import { CategoriaBadge } from "../common/components/CategoriaBadge";
import { GratuitoBadge } from "../common/components/GratuitoBadge";
import { SourceBadge } from "../common/components/SourceBadge";

/**
 * Card for one ChileCultura API result. Shares `CategoriaBadge`/
 * `GratuitoBadge`/`SourceBadge` with the clean IA card (size="sm",
 * freeTone="primary" preserve this card's exact original look) and the
 * shared `ActividadCardBase` shell + `ActividadMeta` block.
 * Copy, classes and a11y attrs are unchanged.
 */
export function ChileCulturaCard({ actividad: a }: { actividad: Actividad }) {
  const model = toCardModel(a);
  return (
    <ActividadCardBase
      variant="chilecultura"
      badges={
        <>
          <div className="flex flex-wrap items-center gap-2">
            <SourceBadge />
            <GratuitoBadge
              gratuito={model.gratuito}
              textoPago={model.textoPago}
              size="sm"
              freeTone="primary"
            />
            <CategoriaBadge size="sm">{model.categoria}</CategoriaBadge>
          </div>
          {model.commune && (
            <p className="text-sm font-semibold text-[#5D4037]">Aprox. en {model.commune}</p>
          )}
        </>
      }
      titulo={
        <h3 className="text-xl font-extrabold leading-tight text-[#5D4037]">
          {model.url ? (
            <a
              href={model.url}
              target="_blank"
              rel="noreferrer"
              className="underline-offset-4 hover:underline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {model.nombre}
            </a>
          ) : (
            <Link
              to="/actividad/$id"
              params={{ id: a.id }}
              className="underline-offset-4 hover:underline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {model.nombre}
            </Link>
          )}
        </h3>
      }
      meta={<ActividadMeta model={model} variant="chilecultura" />}
      footer={
        model.url ? (
          <a
            href={model.url}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-bold text-[#1E6CB4] underline-offset-4 hover:underline"
          >
            Ver evento original en chilecultura.gob.cl
          </a>
        ) : undefined
      }
    />
  );
}
