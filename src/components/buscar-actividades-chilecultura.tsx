import { MapPin, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ActividadCard } from "@/components/actividad-card";
import { Button } from "@/components/ui/button";
import type { Actividad } from "@/data/actividades";
import { COMUNAS_POR_REGION, REGIONES_CHILE } from "@/data/ubicacion-chile";
import { getLocationStatusMessage, useDeviceLocation } from "@/hooks/use-device-location";
import { listarActividades } from "@/lib/actividades.functions";
import { detectarIdsDesdeEtiqueta } from "@/lib/ubicacion-match";

// API-only ChileCultura search: region/commune selects, device-location default, result cards.
// Used as the main view on the home page and as the "ChileCultura (API)" tab in /comparar.

// Defaults visibles: Lo Prado 311 + RM 1 (ver src/lib/chilecultura.ts).
const REGION_INICIAL = 1;
const COMUNA_INICIAL = 311;

function nombreComuna(regionId: number, communeId: number | ""): string {
  if (communeId === "") return "Toda la región";
  return COMUNAS_POR_REGION[regionId]?.find((c) => c.id === communeId)?.nombre ?? "Toda la región";
}

export function BuscarActividadesChileCultura() {
  const [actividades, setActividades] = useState<Actividad[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [regionId, setRegionId] = useState<number>(REGION_INICIAL);
  const [communeId, setCommuneId] = useState<number | "">(COMUNA_INICIAL);
  // Parámetros de la búsqueda que produjo `actividades` (no el estado vivo de los selects).
  const [buscado, setBuscado] = useState<{ regionId: number; communeId: number | "" }>({
    regionId: REGION_INICIAL,
    communeId: COMUNA_INICIAL,
  });
  // Id de la última búsqueda lanzada: las respuestas de búsquedas anteriores se descartan.
  const busquedaIdRef = useRef(0);
  const tocadoRef = useRef(false);
  const autoAplicadoRef = useRef(false);
  const ubicacion = useDeviceLocation();

  const buscar = useCallback(async (region: number, comuna: number | "") => {
    const id = ++busquedaIdRef.current;
    const vigente = () => id === busquedaIdRef.current;
    setBuscando(true);
    setError(null);
    try {
      const todas = await listarActividades({
        // API-only (Supabase vacío): comuna 311 primero, luego región 1.
        // IDs en src/lib/chilecultura.ts (LO_PRADO_COMMUNE_ID, RM_REGION_ID) — no se importan acá por ser módulo server-only.
        data: {
          incluirExternos: true,
          soloExternos: true,
          ...(comuna === "" ? {} : { communeId: comuna }),
          regionId: region,
          paginas: 5,
        },
      });
      if (!vigente()) return;
      setActividades(todas.filter((a) => a.fuente === "chilecultura"));
      setBuscado({ regionId: region, communeId: comuna });
    } catch (e: unknown) {
      if (!vigente()) return;
      setError(e instanceof Error ? e.message : "No pudimos cargar ChileCultura.");
    } finally {
      if (vigente()) setBuscando(false);
    }
  }, []);

  // Búsqueda inicial con defaults (comportamiento previo).
  useEffect(() => {
    void buscar(REGION_INICIAL, COMUNA_INICIAL);
    return () => {
      // Invalida cualquier búsqueda en curso al desmontar. Es un contador, no un nodo:
      // leer el valor actual en el cleanup es justamente lo que se quiere.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      busquedaIdRef.current++;
    };
  }, [buscar]);

  // Autodetección: cuando el dispositivo resuelve ubicación y el usuario
  // no tocó los selects, se adopta la comuna/región detectada y se rebusca.
  useEffect(() => {
    if (ubicacion.status !== "ok" || !ubicacion.locationLabel) return;
    if (tocadoRef.current || autoAplicadoRef.current) return;
    const detectada = detectarIdsDesdeEtiqueta(ubicacion.locationLabel);
    if (!detectada) return;
    autoAplicadoRef.current = true;
    setRegionId(detectada.regionId);
    setCommuneId(detectada.communeId ?? "");
    void buscar(detectada.regionId, detectada.communeId ?? "");
  }, [ubicacion.status, ubicacion.locationLabel, buscar]);

  // Pedido explícito: la próxima ubicación detectada se aplica aunque el
  // usuario haya tocado los selects o ya se haya autoaplicado una vez.
  const usarMiUbicacion = () => {
    tocadoRef.current = false;
    autoAplicadoRef.current = false;
    ubicacion.retry();
  };

  const comunas = COMUNAS_POR_REGION[regionId] ?? [];
  const mensajeUbicacion = getLocationStatusMessage(ubicacion.status, ubicacion.locationLabel);

  const cambiarRegion = (nueva: number) => {
    tocadoRef.current = true;
    setRegionId(nueva);
    const sigueValida = typeof communeId === "number" && (COMUNAS_POR_REGION[nueva] ?? []).some((c) => c.id === communeId);
    if (!sigueValida) setCommuneId("");
  };

  const cambiarComuna = (nueva: number | "") => {
    tocadoRef.current = true;
    setCommuneId(nueva);
  };

  const regionNombre = REGIONES_CHILE.find((r) => r.id === buscado.regionId)?.nombre ?? "";

  const panelBusqueda = (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cc-region" className="text-lg font-extrabold text-[#5D4037]">
            Región
          </label>
          <select
            id="cc-region"
            value={regionId}
            onChange={(e) => cambiarRegion(Number(e.target.value))}
            className="min-h-14 w-full rounded-xl border-2 border-input bg-background px-3 text-lg font-medium focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {REGIONES_CHILE.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cc-comuna" className="text-lg font-extrabold text-[#5D4037]">
            Comuna
          </label>
          <select
            id="cc-comuna"
            value={communeId}
            onChange={(e) => cambiarComuna(e.target.value === "" ? "" : Number(e.target.value))}
            className="min-h-14 w-full rounded-xl border-2 border-input bg-background px-3 text-lg font-medium focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <option value="">Toda la región</option>
            {comunas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        <Button
          type="button"
          onClick={() => void buscar(regionId, communeId)}
          disabled={buscando}
          className="min-h-14 w-full gap-2 rounded-xl text-lg font-bold"
        >
          <Search className="size-5" aria-hidden />
          {buscando ? "Buscando…" : "Buscar actividades"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={usarMiUbicacion}
          disabled={ubicacion.status === "locating"}
          className="min-h-12 w-full gap-2 rounded-xl text-base font-bold"
        >
          <MapPin className="size-5" aria-hidden />
          Usar mi ubicación
        </Button>
        {mensajeUbicacion && (
          <p role="status" aria-live="polite" className="text-base font-medium text-muted-foreground">
            {mensajeUbicacion}
          </p>
        )}
      </div>
    </div>
  );

  if (error) {
    return (
      <div className="mt-2 space-y-4">
        {panelBusqueda}
        <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-lg font-bold text-destructive">
          {error}
        </p>
      </div>
    );
  }

  if (actividades === null) {
    return (
      <div className="mt-2 space-y-4">
        {panelBusqueda}
        <p role="status" aria-live="polite" className="text-lg font-medium text-muted-foreground">
          Cargando actividades de ChileCultura…
        </p>
      </div>
    );
  }

  if (actividades.length === 0) {
    return (
      <div className="mt-2 space-y-4">
        {panelBusqueda}
        <div className="rounded-2xl border border-black/[0.06] bg-white p-6 text-center shadow-sm">
          <p className="text-xl font-bold text-foreground">ChileCultura no devolvió actividades.</p>
          <p className="mt-2 text-lg text-muted-foreground">
            Probá con otra comuna o con toda la región {regionNombre}. Puede estar deshabilitado
            (ENABLE_CHILECULTURA=false) o la API no respondió. Reintentá más tarde.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-4">
      {panelBusqueda}
      <p className="text-center text-lg font-bold text-[#5D4037]" aria-live="polite">
        {actividades.length} {actividades.length === 1 ? "actividad" : "actividades"} de ChileCultura
        {" — "}
        {buscado.communeId === ""
          ? `${regionNombre} (toda la región)`
          : `${nombreComuna(buscado.regionId, buscado.communeId)}, ${regionNombre}`}
      </p>
      <ul className="space-y-4" aria-label="Listado de actividades ChileCultura">
        {actividades.map((a) => (
          <li key={a.id}>
            <ActividadCard actividad={a} mostrarComuna={buscado.communeId === ""} />
          </li>
        ))}
      </ul>
      <p className="rounded-xl bg-muted/40 p-3 text-sm leading-snug text-muted-foreground">
        Fuente: chilecultura.gob.cl (API pública). Confirmá fecha, hora y dirección en el evento original
        antes de salir.
      </p>
    </div>
  );
}
