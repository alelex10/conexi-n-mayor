import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FlaskConical, MapPin, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { BuscarActividadesGroq } from "@/components/buscar-actividades-groq";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatearDistancia, formatearFecha, type Actividad } from "@/data/actividades";
import { COMUNAS_POR_REGION, REGIONES_CHILE } from "@/data/ubicacion-chile";
import { listarActividades } from "@/lib/actividades.functions";
import { detectarIdsDesdeEtiqueta } from "@/lib/ubicacion-match";
import { getLocationStatusMessage, useDeviceLocation } from "@/hooks/use-device-location";

// Lab page (direct URL, no header nav link — same pattern as /groq):
// side-by-side comparison of the two search implementations.
// Tab 1 mounts <BuscarActividadesGroq/> as-is; Tab 2 lists ChileCultura
// results isolated. Both tabs fully independent.
export const Route = createFileRoute("/comparar")({
  head: () => ({
    meta: [
      { title: "Comparar — Groq (IA) vs ChileCultura (API)" },
      {
        name: "description",
        content:
          "Página Lab para comparar calidad y funcionamiento: búsqueda Groq por ubicación vs API ChileCultura — Ciudad Viva Mayor.",
      },
    ],
  }),
  component: CompararPage,
});

function CompararPage() {
  return (
    <AppShell>
      <div className="flex flex-col gap-4 py-4">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link to="/">
              <ArrowLeft className="size-4" aria-hidden />
              Volver
            </Link>
          </Button>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
            <FlaskConical className="size-3.5" aria-hidden />
            Lab / experimental
          </span>
        </div>

        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
            <FlaskConical className="size-6 text-[#1E6CB4]" aria-hidden />
            Comparar búsquedas
          </h1>
          <p className="text-sm leading-snug text-muted-foreground">
            Dos implementaciones, una al lado de la otra. Probá la misma ubicación en ambas pestañas y
            compará calidad y funcionamiento. Las pestañas son independientes.
          </p>
        </div>

        <Tabs defaultValue="groq" className="w-full">
          <TabsList className="grid w-full grid-cols-2" aria-label="Fuente de búsqueda a comparar">
            <TabsTrigger value="groq">Groq (IA)</TabsTrigger>
            <TabsTrigger value="chilecultura">ChileCultura (API)</TabsTrigger>
          </TabsList>
          <TabsContent value="groq">
            <BuscarActividadesGroq />
          </TabsContent>
          <TabsContent value="chilecultura">
            <ChileCulturaTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

// Defaults visibles: Lo Prado 311 + RM 1 (ver src/lib/chilecultura.ts).
const REGION_INICIAL = 1;
const COMUNA_INICIAL = 311;

function nombreComuna(regionId: number, communeId: number | ""): string {
  if (communeId === "") return "Toda la región";
  return COMUNAS_POR_REGION[regionId]?.find((c) => c.id === communeId)?.nombre ?? "Toda la región";
}

function ChileCulturaTab() {
  const [actividades, setActividades] = useState<Actividad[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [regionId, setRegionId] = useState<number>(REGION_INICIAL);
  const [communeId, setCommuneId] = useState<number | "">(COMUNA_INICIAL);
  const vivasRef = useRef(true);
  const tocadoRef = useRef(false);
  const autoAplicadoRef = useRef(false);
  const ubicacion = useDeviceLocation();

  const buscar = useCallback(async (region: number, comuna: number | "") => {
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
      if (!vivasRef.current) return;
      setActividades(todas.filter((a) => a.fuente === "chilecultura"));
    } catch (e: unknown) {
      if (!vivasRef.current) return;
      setError(e instanceof Error ? e.message : "No pudimos cargar ChileCultura.");
    } finally {
      if (vivasRef.current) setBuscando(false);
    }
  }, []);

  // Búsqueda inicial con defaults (comportamiento previo).
  useEffect(() => {
    vivasRef.current = true;
    void buscar(REGION_INICIAL, COMUNA_INICIAL);
    return () => {
      vivasRef.current = false;
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
  }, [ubicacion.status, ubicacion.locationLabel, buscar, ubicacion]);

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

  const regionNombre = REGIONES_CHILE.find((r) => r.id === regionId)?.nombre ?? "";

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
          onClick={() => ubicacion.retry()}
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
        {communeId === "" ? `${regionNombre} (toda la región)` : `${nombreComuna(regionId, communeId)}, ${regionNombre}`}
      </p>
      <ul className="space-y-4" aria-label="Listado de actividades ChileCultura">
        {actividades.map((a) => (
          <li key={a.id}>
            <article className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-2">
                {a.imagenUrl && (
                  <img
                    src={a.imagenUrl}
                    alt={`Imagen de ${a.nombre}`}
                    loading="lazy"
                    className="aspect-video w-full rounded-xl object-cover"
                  />
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-block rounded-lg border border-[#F57C00] bg-[#FFF3E0] px-3 py-1 text-sm font-bold text-[#EF6C00]">
                    ChileCultura
                  </span>
                  <span
                    className={`inline-block rounded-lg px-3 py-1 text-sm font-extrabold ${
                      a.gratuito ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {a.gratuito ? "Gratuito" : (a.precio ?? "De pago")}
                  </span>
                  <span className="inline-block rounded-lg bg-accent px-3 py-1 text-sm font-bold text-accent-foreground">
                    {a.categoria}
                  </span>
                </div>
                {a.commune && <p className="text-sm font-semibold text-[#5D4037]">Aprox. en {a.commune}</p>}
                <h3 className="text-xl font-extrabold leading-tight text-[#5D4037]">
                  {a.url ? (
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline-offset-4 hover:underline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      {a.nombre}
                    </a>
                  ) : (
                    <Link
                      to="/actividad/$id"
                      params={{ id: a.id }}
                      className="underline-offset-4 hover:underline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      {a.nombre}
                    </Link>
                  )}
                </h3>
                <p className="text-[15px] font-medium leading-snug text-[#424242]">
                  {formatearFecha(a.fecha)} · {a.hora} horas — {a.lugar}
                </p>
                <p className="text-[15px] font-medium leading-snug text-[#424242]">
                  A {formatearDistancia(a.distanciaMetros)} de su casa{" "}
                  <span className="text-xs font-semibold text-[#8D6E63]">
                    — Distancia estimada — confirmar dirección
                  </span>
                </p>
                <p className="line-clamp-3 text-[15px] leading-snug text-[#616161]">{a.descripcion}</p>
                {a.url && (
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-bold text-[#1E6CB4] underline-offset-4 hover:underline"
                  >
                    Ver evento original en chilecultura.gob.cl
                  </a>
                )}
              </div>
            </article>
          </li>
        ))}
      </ul>
      <p className="rounded-xl bg-muted/40 p-3 text-sm leading-snug text-muted-foreground">
        Fuente: chilecultura.gob.cl (API pública). La distancia es estimada — confirmá la dirección en el
        evento original antes de salir.
      </p>
    </div>
  );
}
