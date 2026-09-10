import { Separator } from "@/components/ui/separator";
import { EmptyState } from "../../common/components/EmptyState";
import { Warnings } from "../../common/components/Warnings";
import type { BuscarResult, Proveedor } from "../types";
import { ActividadCard } from "./ActividadCard";
import { RawJson } from "./RawJson";
import { ResultadoBadges } from "./ResultadoBadges";
import { SourcesList } from "./SourcesList";
import { TraceDetails } from "./TraceDetails";

export function ResultadosActividades({
  result,
  elapsedMs,
  proveedor,
  supportsLiveSearch,
}: {
  result: BuscarResult;
  elapsedMs: number | null;
  proveedor: Proveedor;
  supportsLiveSearch: boolean;
}) {
  return (
    <div className="space-y-4 rounded-xl border-2 bg-card p-4">
      <ResultadoBadges result={result} elapsedMs={elapsedMs} />

      {result.warnings.length > 0 && <Warnings warnings={result.warnings} />}

      <Separator />

      {result.actividades.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-3">
          {result.actividades.map((a, idx) => (
            <ActividadCard key={`${a.nombre}-${idx}`} actividad={a} />
          ))}
        </div>
      )}

      {proveedor === "gemini" &&
        supportsLiveSearch &&
        result.sources &&
        result.sources.length > 0 && <SourcesList sources={result.sources} />}

      <RawJson raw={result.raw} />

      {proveedor === "gemini" && result.trace && <TraceDetails trace={result.trace} />}

      <p className="text-xs text-muted-foreground">
        HITL: confidence &lt; 0.85 se guarda best-effort en{" "}
        <code className="rounded bg-muted px-1">busquedas_groq_pendientes</code> para revisión
        humana (si la tabla existe).
      </p>
    </div>
  );
}
