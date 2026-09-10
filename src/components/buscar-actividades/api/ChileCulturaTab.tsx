import { useEffect, useState } from "react";

import { type Actividad } from "@/data/actividades";
import { listarActividades } from "@/lib/actividades.functions";
import { ChileCulturaCard } from "./ChileCulturaCard";
import { EmptyState } from "../common/components/EmptyState";
import { FormError } from "@/components/common/FormError";
import { ResultCount } from "@/components/common/ResultCount";

export function ChileCulturaTab() {
  const [actividades, setActividades] = useState<Actividad[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listarActividades({ data: { incluirExternos: true } })
      .then((todas) => {
        if (!alive) return;
        setActividades(todas.filter((a) => a.fuente === "chilecultura"));
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "No pudimos cargar ChileCultura.");
      });
    return () => {
      alive = false;
    };
  }, []);

  if (error) {
    return <FormError message={error} className="mt-3" />;
  }

  if (actividades === null) {
    return (
      <p
        role="status"
        aria-live="polite"
        className="mt-3 text-lg font-medium text-muted-foreground"
      >
        Cargando actividades de ChileCultura…
      </p>
    );
  }

  if (actividades.length === 0) {
    return (
      <EmptyState
        tone="card"
        title="ChileCultura no devolvió actividades."
        hint="Puede estar deshabilitado (ENABLE_CHILECULTURA=false) o la API no respondió. Reintentá más tarde."
        className="mt-3"
      />
    );
  }

  return (
    <div className="mt-2 space-y-4">
      <ResultCount>
        {actividades.length} {actividades.length === 1 ? "actividad" : "actividades"} de
        ChileCultura
      </ResultCount>
      <ul className="space-y-4" aria-label="Listado de actividades ChileCultura">
        {actividades.map((a) => (
          <ChileCulturaCard key={a.id} actividad={a} />
        ))}
      </ul>
      <p className="rounded-xl bg-muted/40 p-3 text-sm leading-snug text-muted-foreground">
        Fuente: chilecultura.gob.cl (API pública). La distancia es estimada — confirmá la dirección
        en el evento original antes de salir.
      </p>
    </div>
  );
}
