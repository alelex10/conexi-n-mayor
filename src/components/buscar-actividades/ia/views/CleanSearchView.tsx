import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UseLocationButton } from "@/components/common/UseLocationButton";
import { FormError } from "@/components/common/FormError";
import { ResultCount } from "@/components/common/ResultCount";
import type { BuscarResult } from "../types";
import { isUbicacionValid } from "../utils";
import { CleanActividadCard } from "../components/CleanActividadCard";

export function CleanSearchView({
  ubicacion,
  onUbicacionChange,
  locationMessage,
  onUseDeviceLocation,
  buscando,
  error,
  result,
  onSearch,
}: {
  ubicacion: string;
  onUbicacionChange: (v: string) => void;
  locationMessage: string | null;
  onUseDeviceLocation: () => void;
  buscando: boolean;
  error: string | null;
  result: BuscarResult | null;
  onSearch: () => void;
}) {
  return (
    <section
      aria-labelledby="buscar-ia-titulo"
      className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5"
    >
      <h2 id="buscar-ia-titulo" className="text-xl font-bold text-card-foreground">
        Buscar actividades cerca de usted
      </h2>
      <div className="mt-3 space-y-3">
        <div className="space-y-2">
          <Label htmlFor="ubicacion-clean" className="text-xl font-bold text-card-foreground">
            ¿Dónde busca actividades?
          </Label>
          <Input
            id="ubicacion-clean"
            value={ubicacion}
            onChange={(e) => onUbicacionChange(e.target.value)}
            placeholder="Lo Prado, Santiago, Chile"
            autoComplete="address-level2"
            className="min-h-14 bg-white text-lg"
          />
          <p className="text-lg text-muted-foreground">Escriba su comuna o barrio.</p>
          <UseLocationButton onClick={onUseDeviceLocation} message={locationMessage} size="lg" />
        </div>
        <Button
          type="button"
          onClick={onSearch}
          disabled={buscando || !isUbicacionValid(ubicacion)}
          className="min-h-14 w-full rounded-xl bg-[#1E6CB4] px-6 text-xl font-bold text-white hover:bg-[#164F8A] disabled:opacity-50"
        >
          {buscando ? (
            <>
              <Loader2 className="size-6 animate-spin" aria-hidden />
              Buscando…
            </>
          ) : (
            <>
              <Search className="size-6" aria-hidden />
              Buscar actividades
            </>
          )}
        </Button>
        {buscando && (
          <p role="status" aria-live="polite" className="text-lg font-medium text-muted-foreground">
            Buscando actividades cerca de usted…
          </p>
        )}
        {error && <FormError message={error} />}
      </div>

      {result && (
        <div className="mt-4 space-y-4">
          <ResultCount>
            {result.total === 0
              ? "No encontramos actividades. Pruebe con otra comuna cercana."
              : `${result.total} ${result.total === 1 ? "actividad encontrada" : "actividades encontradas"}`}
          </ResultCount>
          {result.actividades.length > 0 && (
            <ul className="space-y-4" aria-label="Actividades encontradas">
              {result.actividades.map((a, idx) => (
                <CleanActividadCard key={`${a.nombre}-${idx}`} actividad={a} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
