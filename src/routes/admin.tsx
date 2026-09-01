/* eslint-disable prettier/prettier */
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Clock, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";

import { AppShell } from "@/components/AppShell";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { REGIONES_CHILE } from "@/lib/chilecultura";
import { listarChileCulturaPorRegiones } from "@/lib/actividades.functions";
import type { Actividad } from "@/data/actividades";
import { formatearFecha } from "@/data/actividades";

function parseRegionesParam(s?: string): number[] {
  if (!s || !s.trim()) return [13];
  const arr = s
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 16)
    .slice(0, 6);
  return arr.length ? arr : [13];
}

export const Route = createFileRoute("/admin")({
  validateSearch: z.object({ regiones: z.string().optional() }),
  loader: () => {
    if (typeof process !== "undefined" && process.env["ENABLE_ADMIN_PANEL"] === "false") {
      throw notFound();
    }
    return {};
  },
  head: () => ({
    meta: [
      { title: "Panel admin — Regiones ChileCultura (experimental) — Actividad Fácil" },
      { name: "robots", content: "noindex,nofollow" },
      { name: "description", content: "Panel experimental — uso interno para validar regiones ChileCultura." },
    ],
  }),
  component: AdminPanel,
});

function formatCachedAt(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Actualizado hace menos de 1 min";
  if (mins < 60) return `Actualizado hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  return `Actualizado hace ${hrs} h`;
}

type PorRegion = {
  region: number;
  regionId: number;
  nombre: string;
  regionStrEjemplo: string;
  count: number;
  actividades: Actividad[];
  cachedAt: number;
  error?: string;
};

type FetchResult = {
  porRegion: PorRegion[];
  total: number;
  actividades: Actividad[];
  resultados: Actividad[];
  latencyMs: number;
  cachedAt: number;
  cachedAges: { regionId: number; cachedAt: number }[];
};

function AdminPanel() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const parsedFromUrl = parseRegionesParam(search.regiones);
  const [selected, setSelected] = useState<number[]>(parsedFromUrl);
  const [data, setData] = useState<FetchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  // keep selected in sync with URL
  useEffect(() => {
    setSelected(parseRegionesParam(search.regiones));
  }, [search.regiones]);

  async function doFetch(regiones: number[], forceFlag: boolean) {
    setLoading(true);
    setError(null);
    try {
      const res = (await listarChileCulturaPorRegiones({
        data: { regiones, forzarRecarga: forceFlag, force: forceFlag },
      })) as unknown as FetchResult;
      setData(res);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  // auto-fetch on URL change (shareable/reload)
  useEffect(() => {
    doFetch(parsedFromUrl, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.regiones]);

  const toggleRegion = (id: number, checked: boolean) => {
    setSelected((prev) => {
      if (checked) {
        if (prev.includes(id)) return prev;
        if (prev.length >= 6) return prev;
        return [...prev, id].sort((a, b) => a - b);
      } else {
        return prev.filter((v) => v !== id);
      }
    });
  };

  const handleProbar = () => {
    const join = selected.join(",");
    // navigate will trigger useEffect fetch; also fetch directly to avoid race if same URL
    if (join === (search.regiones ?? "")) {
      doFetch(selected, false);
    } else {
      navigate({ search: { regiones: join } });
    }
  };

  const handleForzar = () => {
    doFetch(selected, true);
  };

  return (
    <AppShell>
      <Link
        to="/"
        className="mt-6 inline-flex min-h-14 items-center gap-2 rounded-xl border-4 border-foreground bg-card px-4 text-xl font-bold text-card-foreground focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <ArrowLeft aria-hidden className="size-6" /> Volver
      </Link>

      <div className="mt-4 rounded-xl border-2 border-[#F57C00] bg-[#FFF3E0] px-4 py-3 text-center">
        <p className="text-base font-extrabold text-[#E65100]">Panel experimental — uso interno</p>
        <p className="mt-1 text-sm font-medium text-[#5D4037]">
          Validación empírica de IDs de región ChileCultura (ej. 13 vs 1 para Metropolitana). No afecta flujo 60+.
        </p>
      </div>

      <h1 className="mt-6 text-3xl font-extrabold leading-tight text-foreground">Probar regiones ChileCultura</h1>
      <p className="mt-2 text-lg text-muted-foreground">
        Seleccioná hasta 6 regiones y probá en vivo. La URL con <code className="rounded bg-muted px-1">?regiones=13,5</code> es
        compartible.
      </p>

      {/* Checkbox grid */}
      <section aria-labelledby="regiones-title" className="mt-6 rounded-2xl border-4 border-border bg-card p-4">
        <h2 id="regiones-title" className="text-xl font-bold text-card-foreground">
          Regiones ({selected.length}/6)
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {REGIONES_CHILE.map((r) => {
            const checked = selected.includes(r.id);
            const disabled = !checked && selected.length >= 6;
            return (
              <label
                key={r.id}
                className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-2 transition-colors ${checked ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-accent"} ${disabled ? "opacity-50" : ""}`}
              >
                <Checkbox
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={(v) => toggleRegion(r.id, Boolean(v))}
                  aria-label={`${r.id} ${r.nombre}`}
                  id={`region-${r.id}`}
                />
                <Label htmlFor={`region-${r.id}`} className="cursor-pointer text-sm font-bold leading-tight">
                  {r.id}. {r.nombre}
                </Label>
              </label>
            );
          })}
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleProbar}
            className="inline-flex min-h-14 flex-1 items-center justify-center rounded-xl bg-primary px-6 text-xl font-extrabold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Probar
          </button>
          <button
            type="button"
            onClick={handleForzar}
            className="inline-flex min-h-14 flex-1 items-center justify-center rounded-xl border-4 border-foreground bg-card px-6 text-lg font-bold text-card-foreground focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Forzar recarga
          </button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {data ? (
            <>
              {formatCachedAt(data.cachedAt)} · {data.latencyMs} ms · total {data.total}
            </>
          ) : loading ? (
            "Cargando…"
          ) : (
            "Elegí regiones y tocá Probar"
          )}
        </p>
      </section>

      {loading && (
        <div className="mt-6 space-y-3" role="status" aria-live="polite">
          <div className="h-20 animate-pulse rounded-xl bg-muted" />
          <div className="h-40 animate-pulse rounded-xl bg-muted" />
          <p className="text-lg font-medium text-muted-foreground">Cargando actividades…</p>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-6 rounded-xl bg-destructive/10 p-4 text-lg font-bold text-destructive">
          {error}
        </p>
      )}

      {data && !loading && (
        <>
          {/* Per-region summary */}
          <section className="mt-6 overflow-hidden rounded-2xl border-4 border-border bg-card">
            <div className="bg-[#1E6CB4] px-4 py-3 text-white">
              <h2 className="text-lg font-extrabold">Resultados por región</h2>
              <p className="text-sm opacity-90">
                {data.porRegion.length} {data.porRegion.length === 1 ? "región" : "regiones"} · total {data.total} ·
                flat deduped {data.actividades.length} (≤50)
              </p>
            </div>
            <div className="divide-y divide-border">
              {data.porRegion.map((p) => (
                <div key={p.region} className="flex flex-col gap-1 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex min-h-8 items-center rounded-full bg-primary px-3 text-sm font-extrabold text-primary-foreground">
                      Región {p.region} · {p.nombre}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-accent px-3 py-1 text-sm font-bold text-accent-foreground">
                      {p.count} {p.count === 1 ? "evento" : "eventos"}
                    </span>
                    {p.error && (
                      <span className="inline-flex items-center rounded-full bg-destructive/10 px-3 py-1 text-sm font-bold text-destructive">
                        error: {p.error.slice(0, 80)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">
                    ID{p.region} → API region: {p.regionStrEjemplo} · {formatCachedAt(p.cachedAt)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Card grid reused Actividad cards slice 10 per region */}
          {data.porRegion.map((p) => (
            <section key={`cards-${p.region}`} className="mt-6">
              <h3 className="text-xl font-extrabold text-foreground">
                {p.nombre} — {p.count} eventos (mostrando {Math.min(10, p.actividades.length)})
              </h3>
              {p.actividades.length === 0 ? (
                <p className="mt-2 rounded-xl border border-border bg-muted p-4 text-lg font-medium text-muted-foreground">
                  Sin eventos para esta región en esta búsqueda.
                </p>
              ) : (
                <ul className="mt-3 space-y-4" aria-label={`Actividades ${p.nombre}`}>
                  {p.actividades.slice(0, 10).map((a) => (
                    <li key={a.id}>
                      <article className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-block rounded-lg bg-primary px-3 py-1 text-sm font-extrabold text-primary-foreground">
                            {a.gratuito ? "Gratuito" : `De pago · ${a.precio}`}
                          </span>
                          <span className="inline-block rounded-lg bg-accent px-3 py-1 text-sm font-bold text-accent-foreground">
                            {a.categoria}
                          </span>
                          <span className="inline-block rounded-lg border border-[#F57C00] bg-[#FFF3E0] px-3 py-1 text-sm font-bold text-[#EF6C00]">
                            ChileCultura
                          </span>
                        </div>
                        {a.commune && (
                          <p className="mt-2 text-sm font-semibold text-[#5D4037]">Aprox. en {a.commune}</p>
                        )}
                        <h4 className="mt-2 text-xl font-extrabold leading-tight text-[#5D4037]">
                          <Link
                            to="/actividad/$id"
                            params={{ id: a.id }}
                            className="underline-offset-4 hover:underline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary"
                          >
                            {a.nombre}
                          </Link>
                        </h4>
                        <p className="mt-2 flex items-center gap-2 text-[15px] font-medium leading-snug text-[#424242]">
                          <Clock className="size-4 shrink-0 text-[#616161]" aria-hidden />
                          <span>
                            {formatearFecha(a.fecha)} · {a.hora} horas
                          </span>
                        </p>
                        <p className="mt-1 flex items-center gap-2 text-[15px] font-medium leading-snug text-[#424242]">
                          <MapPin className="size-4 shrink-0 text-[#616161]" aria-hidden />
                          <span>{a.lugar}</span>
                        </p>
                        <p className="mt-2 line-clamp-3 text-[15px] leading-snug text-[#616161]">{a.descripcion}</p>
                      </article>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          {/* Flat deduped summary */}
          <section className="mt-6 rounded-2xl border-4 border-border bg-card p-4">
            <h3 className="text-lg font-bold text-card-foreground">Flat deduped (≤50) — {data.actividades.length}</h3>
            <p className="text-sm text-muted-foreground">Ordenado por fecha/hora ASC, deduped por id.</p>
            <ul className="mt-3 list-disc pl-5 text-sm">
              {data.actividades.slice(0, 5).map((a) => (
                <li key={a.id}>
                  {a.fecha} {a.hora} — {a.nombre}
                </li>
              ))}
            </ul>
          </section>

          {/* Raw JSON toggle */}
          <section className="mt-6">
            <button
              type="button"
              onClick={() => setShowRaw((v) => !v)}
              className="inline-flex min-h-11 items-center rounded-xl border-2 border-border bg-card px-4 text-sm font-bold text-card-foreground focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ring"
              aria-expanded={showRaw}
            >
              {showRaw ? "Ocultar JSON" : "Ver JSON crudo"}
            </button>
            {showRaw && (
              <pre className="mt-3 max-h-[32rem] overflow-auto rounded-xl border-2 border-border bg-muted p-4 text-xs">
                {JSON.stringify(data, null, 2)}
              </pre>
            )}
          </section>
        </>
      )}
    </AppShell>
  );
}
