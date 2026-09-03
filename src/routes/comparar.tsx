import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FlaskConical } from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { BuscarActividadesGroq } from "@/components/buscar-actividades-groq";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatearDistancia, formatearFecha, type Actividad } from "@/data/actividades";
import { listarActividades } from "@/lib/actividades.functions";

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

function ChileCulturaTab() {
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
    return (
      <p role="alert" className="mt-3 rounded-xl bg-destructive/10 p-3 text-lg font-bold text-destructive">
        {error}
      </p>
    );
  }

  if (actividades === null) {
    return (
      <p role="status" aria-live="polite" className="mt-3 text-lg font-medium text-muted-foreground">
        Cargando actividades de ChileCultura…
      </p>
    );
  }

  if (actividades.length === 0) {
    return (
      <div className="mt-3 rounded-2xl border border-black/[0.06] bg-white p-6 text-center shadow-sm">
        <p className="text-xl font-bold text-foreground">ChileCultura no devolvió actividades.</p>
        <p className="mt-2 text-lg text-muted-foreground">
          Puede estar deshabilitado (ENABLE_CHILECULTURA=false) o la API no respondió. Reintentá más tarde.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-4">
      <p className="text-center text-lg font-bold text-[#5D4037]" aria-live="polite">
        {actividades.length} {actividades.length === 1 ? "actividad" : "actividades"} de ChileCultura
      </p>
      <ul className="space-y-4" aria-label="Listado de actividades ChileCultura">
        {actividades.map((a) => (
          <li key={a.id}>
            <article className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-block rounded-lg border border-[#F57C00] bg-[#FFF3E0] px-3 py-1 text-sm font-bold text-[#EF6C00]">
                    ChileCultura
                  </span>
                  <span
                    className={`inline-block rounded-lg px-3 py-1 text-sm font-extrabold ${
                      a.gratuito ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {a.gratuito ? "Gratuito" : `De pago · ${a.precio}`}
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
