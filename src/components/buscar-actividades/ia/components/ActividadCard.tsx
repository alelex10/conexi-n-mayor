import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { GroqActividadUI } from "../types";

export function ActividadCard({ actividad: a }: { actividad: GroqActividadUI }) {
  return (
    <div className="rounded-xl border-2 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-base font-extrabold leading-tight">{a.nombre}</h3>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="text-xs capitalize">
            {a.categoria}
          </Badge>
          <Badge
            variant="outline"
            className={
              a.confidence >= 0.85
                ? "border-green-300 bg-green-50 text-green-700"
                : "border-amber-300 bg-amber-50 text-amber-700"
            }
          >
            {(a.confidence * 100).toFixed(0)}%
          </Badge>
          {a.gratuito ? (
            <Badge className="bg-[#1B7A3D] text-white border-transparent text-xs">Gratuito</Badge>
          ) : (
            <Badge variant="outline" className="text-xs">
              {a.precio_texto || "De pago"}
            </Badge>
          )}
        </div>
      </div>
      <p className="mt-1 text-sm leading-snug text-muted-foreground">{a.descripcion}</p>
      <div className="mt-2 grid gap-1 text-sm">
        {a.fecha && (
          <p>
            <span className="font-bold">Fecha:</span> {a.fecha} {a.hora ? `· ${a.hora}` : ""}
          </p>
        )}
        {!a.fecha && a.hora && (
          <p>
            <span className="font-bold">Hora:</span> {a.hora}
          </p>
        )}
        {a.lugar && (
          <p className="flex gap-1.5">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span>
              {a.lugar}
              {a.direccion ? ` — ${a.direccion}` : ""}
            </span>
          </p>
        )}
        {!a.lugar && a.direccion && (
          <p>
            <span className="font-bold">Dirección:</span> {a.direccion}
          </p>
        )}
        {a.fuente_url && (
          <p className="break-all">
            <span className="font-bold">Fuente:</span>{" "}
            <a
              href={a.fuente_url}
              target="_blank"
              rel="noreferrer"
              className="text-[#1E6CB4] underline hover:text-[#164F8A]"
            >
              {a.fuente_url}
            </a>
          </p>
        )}
        {a.warnings && a.warnings.length > 0 && (
          <ul className="mt-1 list-disc pl-5 text-xs text-amber-700">
            {a.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
