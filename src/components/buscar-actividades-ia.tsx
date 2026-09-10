import { useState } from "react";
import { getLocationStatusMessage, useDeviceLocation } from "@/hooks/use-device-location";
import { DEFAULT_UBICACION } from "./buscar-actividades/ia/constants";
import { useAiProviders } from "./buscar-actividades/ia/hooks/use-ai-providers";
import { useBuscarActividades } from "./buscar-actividades/ia/hooks/use-buscar-actividades";
import type { BuscarActividadesVariant, DevicePayload } from "./buscar-actividades/ia/types";
import { CleanSearchView } from "./buscar-actividades/ia/views/CleanSearchView";
import { FullSearchView } from "./buscar-actividades/ia/views/FullSearchView";

/**
 * Thin facade: owns the shared filter/device state plus the two hooks,
 * and delegates rendering to the clean/full views.
 */
export function BuscarActividadesIA({ variant = "full" }: { variant?: BuscarActividadesVariant }) {
  const isClean = variant === "clean";
  const ai = useAiProviders({ enabled: !isClean });
  const search = useBuscarActividades();
  const device = useDeviceLocation();
  const locationMessage = getLocationStatusMessage(device.status, device.locationLabel);
  const devicePayload: DevicePayload =
    device.status === "ok" && device.coords
      ? {
          latitud: device.coords.latitud,
          longitud: device.coords.longitud,
          ...(device.locationLabel ? { locationLabel: device.locationLabel } : {}),
        }
      : {};

  const [ubicacion, setUbicacion] = useState(DEFAULT_UBICACION);
  const [radioMetros, setRadioMetros] = useState<string>("");
  const [categoria, setCategoria] = useState<string>("");
  const [fechaDesde, setFechaDesde] = useState<string>("");

  const handleBuscar = () => {
    if (isClean) {
      void search.handleBuscar({ mode: "clean", ubicacion, devicePayload });
      return;
    }
    void search.handleBuscar({
      mode: "full",
      ubicacion,
      radioMetros,
      categoria,
      fechaDesde,
      modeloActual: ai.modeloActual,
      proveedor: ai.proveedor,
      devicePayload,
    });
  };

  if (isClean) {
    return (
      <CleanSearchView
        ubicacion={ubicacion}
        onUbicacionChange={setUbicacion}
        locationMessage={locationMessage}
        onUseDeviceLocation={device.retry}
        buscando={search.buscando}
        error={search.error}
        result={search.result}
        onSearch={handleBuscar}
      />
    );
  }

  return (
    <FullSearchView
      proveedor={ai.proveedor}
      onProveedorChange={ai.setProveedor}
      nombreProveedor={ai.nombreProveedor}
      modelosActuales={ai.modelosActuales}
      modeloActual={ai.modeloActual}
      onModeloChange={ai.setModeloActual}
      loadingModelos={ai.loadingModelos}
      keyStatus={{
        hasGroqKey: ai.hasGroqKey,
        hasLovableKey: ai.hasLovableKey,
        hasGeminiKey: ai.hasGeminiKey,
        hasOpenRouterKey: ai.hasOpenRouterKey,
        hasNvidiaKey: ai.hasNvidiaKey,
        source: ai.source,
      }}
      selectedMeta={ai.selectedMeta}
      ubicacion={ubicacion}
      onUbicacionChange={setUbicacion}
      radioMetros={radioMetros}
      onRadioMetrosChange={setRadioMetros}
      categoria={categoria}
      onCategoriaChange={setCategoria}
      fechaDesde={fechaDesde}
      onFechaDesdeChange={setFechaDesde}
      locationMessage={locationMessage}
      onUseDeviceLocation={device.retry}
      buscando={search.buscando}
      elapsedMs={search.elapsedMs}
      result={search.result}
      error={search.error}
      onSearch={handleBuscar}
    />
  );
}
