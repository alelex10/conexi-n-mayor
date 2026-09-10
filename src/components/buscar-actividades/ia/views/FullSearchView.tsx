import { Cpu } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/common/FormError";
import type { BuscarResult, GroqModelUI, Proveedor, ProviderKeyStatus } from "../types";
import { isUbicacionValid } from "../utils";
import { ApiKeyWarning } from "../components/ApiKeyWarning";
import { FiltrosUbicacion } from "../components/FiltrosUbicacion";
import { ModeloSelector } from "../components/ModeloSelector";
import { ProviderTabs } from "../components/ProviderTabs";
import { ResultadosActividades } from "../components/ResultadosActividades";
import { SearchActions } from "../components/SearchActions";

export type FullSearchViewProps = {
  proveedor: Proveedor;
  onProveedorChange: (p: Proveedor) => void;
  nombreProveedor: string;
  modelosActuales: GroqModelUI[];
  modeloActual: string;
  onModeloChange: (id: string) => void;
  loadingModelos: boolean;
  keyStatus: ProviderKeyStatus;
  selectedMeta: GroqModelUI | null;
  ubicacion: string;
  onUbicacionChange: (v: string) => void;
  radioMetros: string;
  onRadioMetrosChange: (v: string) => void;
  categoria: string;
  onCategoriaChange: (v: string) => void;
  fechaDesde: string;
  onFechaDesdeChange: (v: string) => void;
  locationMessage: string | null;
  onUseDeviceLocation: () => void;
  buscando: boolean;
  elapsedMs: number | null;
  result: BuscarResult | null;
  error: string | null;
  onSearch: () => void;
};

export function FullSearchView(props: FullSearchViewProps) {
  const {
    proveedor,
    onProveedorChange,
    nombreProveedor,
    modelosActuales,
    modeloActual,
    onModeloChange,
    loadingModelos,
    keyStatus,
    selectedMeta,
    ubicacion,
    onUbicacionChange,
    radioMetros,
    onRadioMetrosChange,
    categoria,
    onCategoriaChange,
    fechaDesde,
    onFechaDesdeChange,
    locationMessage,
    onUseDeviceLocation,
    buscando,
    elapsedMs,
    result,
    error,
    onSearch,
  } = props;

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Cpu className="size-6 text-[#1E6CB4]" aria-hidden />
          Buscar actividades — {nombreProveedor} (búsqueda por ubicación)
        </CardTitle>
        <CardDescription className="text-base">
          Buscá actividades cerca de una ubicación con el proveedor que elijas:{" "}
          <strong>Groq</strong>, <strong>Lovable</strong>, <strong>Gemini</strong>,{" "}
          <strong>OpenRouter</strong> o <strong>NVIDIA</strong> (simulan búsqueda web vía LLM). Sin
          autenticación — solo para MVP.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Proveedor + modelo */}
        <div className="space-y-3 rounded-xl border-2 border-border bg-muted/30 p-4">
          <ProviderTabs proveedor={proveedor} onProveedorChange={onProveedorChange} />
          <ModeloSelector
            proveedor={proveedor}
            nombreProveedor={nombreProveedor}
            modelosActuales={modelosActuales}
            modeloActual={modeloActual}
            onModeloChange={onModeloChange}
            loadingModelos={loadingModelos}
            keyStatus={keyStatus}
            selectedMeta={selectedMeta}
          />
        </div>

        {/* Ubicación + filtros */}
        <FiltrosUbicacion
          ubicacion={ubicacion}
          onUbicacionChange={onUbicacionChange}
          radioMetros={radioMetros}
          onRadioMetrosChange={onRadioMetrosChange}
          categoria={categoria}
          onCategoriaChange={onCategoriaChange}
          fechaDesde={fechaDesde}
          onFechaDesdeChange={onFechaDesdeChange}
          locationMessage={locationMessage}
          onUseDeviceLocation={onUseDeviceLocation}
        />

        <SearchActions
          buscando={buscando}
          disabled={buscando || loadingModelos || !isUbicacionValid(ubicacion)}
          onSearch={onSearch}
          searchText="Buscar actividades"
          searchingText="Buscando en la web…"
          buttonClassName="min-h-12 rounded-xl bg-[#1E6CB4] px-6 text-base font-bold text-white hover:bg-[#164F8A] disabled:opacity-50"
          iconClassName="size-5"
          showMeta
          elapsedMs={elapsedMs}
          modeloActual={modeloActual}
          result={result}
        />

        <ApiKeyWarning proveedor={proveedor} keyStatus={keyStatus} />

        {error && (
          <FormError
            message={error}
            title="Error al buscar"
            hint={`Tip: si es 401 revisá la API key del proveedor (${nombreProveedor}); si es 429 esperá un minuto (los free tiers tienen quota estricta).`}
          />
        )}

        {result && (
          <ResultadosActividades
            result={result}
            elapsedMs={elapsedMs}
            proveedor={proveedor}
            supportsLiveSearch={selectedMeta?.supportsLiveSearch ?? false}
          />
        )}
      </CardContent>
    </Card>
  );
}
