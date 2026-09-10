import { ActividadCardBase } from "../../common/components/ActividadCardBase";
import { ActividadMeta } from "../../common/components/ActividadMeta";
import { CategoriaBadge } from "../../common/components/CategoriaBadge";
import { GratuitoBadge } from "../../common/components/GratuitoBadge";
import { MapsButton } from "../../common/components/MapsButton";
import { toCardModel } from "../../common/actividad-adapters";
import { buildMapsUrl } from "../../common/utils";
import type { GroqActividadUI } from "../types";

export function CleanActividadCard({ actividad: a }: { actividad: GroqActividadUI }) {
  const model = toCardModel(a);
  const mapsUrl = buildMapsUrl(a.lugar, a.direccion);
  return (
    <ActividadCardBase
      variant="clean"
      badges={
        <div className="flex flex-wrap items-center gap-2">
          <CategoriaBadge>{model.categoria}</CategoriaBadge>
          <GratuitoBadge gratuito={model.gratuito} textoPago={model.textoPago} />
        </div>
      }
      titulo={
        <h3 className="text-xl font-extrabold leading-tight text-[#5D4037]">{model.nombre}</h3>
      }
      meta={<ActividadMeta model={model} variant="clean" />}
      footer={mapsUrl ? <MapsButton url={mapsUrl} /> : undefined}
    />
  );
}
