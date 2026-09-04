import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Braces,
  CheckCircle2,
  Clock3,
  Cpu,
  Loader2,
  MapPin,
  Search,
  Sparkles,
} from "lucide-react";

import {
  buscarActividadesPorUbicacionFn,
  listarModelosGroqFn,
} from "@/lib/groq-actividades.functions";
import { formatearFecha } from "@/data/actividades";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

type GroqModelUI = {
  id: string;
  label: string;
  description: string;
  contextWindow: number;
  pricingIn: string | null;
  pricingOut: string | null;
  pricing?: string | null;
  recommended: boolean;
  vision?: boolean;
  supportsLiveSearch?: boolean;
  maxImages?: number | null;
  speed?: string | null;
};

const FALLBACK_MODELS: GroqModelUI[] = [
  {
    id: "openai/gpt-oss-120b",
    label: "GPT OSS 120B (recomendado)",
    description:
      "Recomendado — verificado 2026-09-03: único que pasa response_format json_object con el prompt de actividades; default para búsqueda",
    contextWindow: 131072,
    pricingIn: "$0.15 / 1M",
    pricingOut: "$0.60 / 1M",
    pricing: "$0.15 / $0.60 por 1M",
    recommended: true,
    vision: false,
    supportsLiveSearch: false,
  },
  {
    id: "qwen/qwen3.6-27b",
    label: "Qwen 3 27B",
    description:
      "Qwen 3.6 27B — NO usar con response_format json_object para búsqueda de actividades (Groq 400 json_validate_failed verificado 2026-09-03); solo con retry sin formato",
    contextWindow: 131072,
    pricingIn: "$0.60 / 1M",
    pricingOut: "$3.00 / 1M",
    pricing: "$0.60 / $3.00 por 1M",
    recommended: false,
    vision: true,
    supportsLiveSearch: false,
  },
  {
    id: "qwen/qwen3.8-27b",
    label: "Qwen 3.8 27B",
    description: "Qwen 3.8 27B — contexto largo, ideal para búsquedas complejas",
    contextWindow: 131072,
    pricingIn: "$0.80 / 1M",
    pricingOut: "$4.00 / 1M",
    pricing: "$0.80 / $4.00 por 1M",
    recommended: false,
    vision: true,
    supportsLiveSearch: false,
  },
];

const DEFAULT_MODEL = "openai/gpt-oss-120b";

const CATEGORIAS = [
  { value: "", label: "Todas" },
  { value: "taller", label: "Taller" },
  { value: "paseo", label: "Paseo" },
  { value: "charla", label: "Charla" },
  { value: "deporte", label: "Deporte" },
  { value: "cultura", label: "Cultura" },
  { value: "salud", label: "Salud" },
  { value: "ejercicio", label: "Ejercicio" },
  { value: "recreacion", label: "Recreación" },
  { value: "aprendizaje", label: "Aprendizaje" },
  { value: "otro", label: "Otro" },
] as const;

type GroqActividadUI = {
  nombre: string;
  descripcion: string;
  fecha: string | null;
  hora: string | null;
  lugar: string | null;
  direccion: string | null;
  categoria: string;
  gratuito: boolean;
  precio_texto?: string | null;
  fuente_url?: string | null;
  confidence: number;
  warnings?: string[];
};

type BuscarResult = {
  status: "needs_review" | "ok";
  actividades: GroqActividadUI[];
  total: number;
  confidence: number;
  usedModel: string;
  ubicacion: string;
  warnings: string[];
  needsReview: boolean;
  evidenceMode?: "live";
  raw: unknown;
};

export function BuscarActividadesGroq({ variant = "full" }: { variant?: "full" | "clean" }) {
  const isClean = variant === "clean";
  const [modelos, setModelos] = useState<GroqModelUI[]>(FALLBACK_MODELS);
  const [modeloSeleccionado, setModeloSeleccionado] = useState<string>(DEFAULT_MODEL);
  const [source, setSource] = useState<"groq" | "static">("static");
  const [hasGroqKey, setHasGroqKey] = useState<boolean | null>(null);
  const [loadingModelos, setLoadingModelos] = useState(true);

  const [ubicacion, setUbicacion] = useState("Lo Prado, Santiago, Chile");
  const [radioMetros, setRadioMetros] = useState<string>("");
  const [categoria, setCategoria] = useState<string>("");
  const [fechaDesde, setFechaDesde] = useState<string>("");

  const [buscando, setBuscando] = useState(false);
  const [result, setResult] = useState<BuscarResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const startRef = useRef<number>(0);

  useEffect(() => {
    if (isClean) {
      setLoadingModelos(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await listarModelosGroqFn();
        if (cancelled) return;
        const list = res.models as unknown as GroqModelUI[];
        setModelos(list.length > 0 ? list : FALLBACK_MODELS);
        setSource(res.source as "groq" | "static");
        setHasGroqKey(Boolean(res.hasGroqKey));
        const ids = new Set(list.map((m) => m.id));
        if (!ids.has(modeloSeleccionado)) {
          setModeloSeleccionado(res.defaultModel || DEFAULT_MODEL);
        }
      } catch {
        if (!cancelled) {
          setModelos(FALLBACK_MODELS);
          setSource("static");
          setHasGroqKey(false);
        }
      } finally {
        if (!cancelled) setLoadingModelos(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBuscar = async () => {
    if (ubicacion.trim().length < 3) {
      setError("Escriba su comuna o barrio. Por ejemplo: Lo Prado, Santiago.");
      return;
    }
    setBuscando(true);
    setError(null);
    setResult(null);
    setElapsedMs(null);
    startRef.current = Date.now();
    try {
      if (isClean) {
        const res = await buscarActividadesPorUbicacionFn({
          data: { ubicacion: ubicacion.trim(), radioMetros: 2500, model: DEFAULT_MODEL },
        });
        setResult(res as BuscarResult);
        setElapsedMs(Date.now() - startRef.current);
        return;
      }
      const payload: {
        ubicacion: string;
        radioMetros?: number;
        categoria?: string;
        fechaDesde?: string;
        model?: string;
      } = {
        ubicacion: ubicacion.trim(),
        model: modeloSeleccionado,
      };
      if (radioMetros.trim()) {
        const n = Number(radioMetros);
        if (!Number.isNaN(n) && n > 0) payload.radioMetros = Math.round(n);
      }
      if (categoria.trim() && categoria !== "todas") payload.categoria = categoria.trim();
      if (fechaDesde.trim()) payload.fechaDesde = fechaDesde.trim();

      const res = await buscarActividadesPorUbicacionFn({ data: payload });
      setResult(res as BuscarResult);
      setElapsedMs(Date.now() - startRef.current);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Missing GROQ_API_KEY") || msg.includes("GROQ_API_KEY")) {
        setError(
          "Falta GROQ_API_KEY en el servidor (.env). Conseguí una en https://console.groq.com/keys",
        );
      } else {
        setError(msg);
      }
      setElapsedMs(Date.now() - startRef.current);
    } finally {
      setBuscando(false);
    }
  };

  const selectedMeta = modelos.find((m) => m.id === modeloSeleccionado) ?? null;

  if (isClean) {
    const fechaLimpia = (fecha: string | null): string | null => {
      if (!fecha) return null;
      const iso = fecha.slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
        try {
          return formatearFecha(iso);
        } catch {
          return fecha;
        }
      }
      return fecha;
    };
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
              onChange={(e) => setUbicacion(e.target.value)}
              placeholder="Lo Prado, Santiago, Chile"
              autoComplete="address-level2"
              className="min-h-14 bg-white text-lg"
            />
            <p className="text-lg text-muted-foreground">Escriba su comuna o barrio.</p>
          </div>
          <Button
            type="button"
            onClick={handleBuscar}
            disabled={buscando || ubicacion.trim().length < 3}
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
            <p
              role="status"
              aria-live="polite"
              className="text-lg font-medium text-muted-foreground"
            >
              Buscando actividades cerca de usted…
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="rounded-xl bg-destructive/10 p-3 text-lg font-bold text-destructive"
            >
              {error}
            </p>
          )}
        </div>

        {result && (
          <div className="mt-4 space-y-4">
            <p className="text-center text-lg font-bold text-[#5D4037]" aria-live="polite">
              {result.total === 0
                ? "No encontramos actividades. Pruebe con otra comuna cercana."
                : `${result.total} ${result.total === 1 ? "actividad encontrada" : "actividades encontradas"}`}
            </p>
            {result.evidenceMode === "live" && result.total > 0 && (
              <p className="text-center">
                <span className="inline-flex items-center gap-1 rounded-lg bg-[#1B7A3D]/10 px-3 py-1 text-base font-bold text-[#1B7A3D]">
                  <CheckCircle2 className="size-4" aria-hidden />
                  Verificado en la web
                </span>
              </p>
            )}
            {result.actividades.length > 0 && (
              <ul className="space-y-4" aria-label="Actividades encontradas">
                {result.actividades.map((a, idx) => {
                  const destino = [a.lugar, a.direccion].filter(Boolean).join(", ");
                  const mapsUrl = destino
                    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destino)}`
                    : null;
                  const fechaTexto = fechaLimpia(a.fecha);
                  return (
                    <li key={`${a.nombre}-${idx}`}>
                      <article className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-sm">
                        <div className="flex flex-col gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-block rounded-lg bg-accent px-3 py-1 text-base font-bold text-accent-foreground">
                              {a.categoria}
                            </span>
                            <span
                              className={`inline-block rounded-lg px-3 py-1 text-base font-extrabold ${
                                a.gratuito
                                  ? "bg-[#1B7A3D] text-white"
                                  : "bg-secondary text-secondary-foreground"
                              }`}
                            >
                              {a.gratuito ? "Gratuito" : a.precio_texto || "De pago"}
                            </span>
                            {a.fuente_url ? (
                              <span className="inline-flex items-center gap-1 rounded-lg bg-[#1B7A3D]/10 px-3 py-1 text-base font-bold text-[#1B7A3D]">
                                <CheckCircle2 className="size-4" aria-hidden />
                                Verificado en la web
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-3 py-1 text-base font-bold text-muted-foreground">
                                Fuente no informada
                              </span>
                            )}
                          </div>
                          <h3 className="text-xl font-extrabold leading-tight text-[#5D4037]">
                            {a.nombre}
                          </h3>
                          <p className="text-lg font-medium leading-snug text-[#424242]">
                            {fechaTexto ? (
                              <span>{fechaTexto}</span>
                            ) : (
                              <span className="italic text-[#9E9E9E]">
                                Fecha no encontrada
                              </span>
                            )}
                            {" · "}
                            {a.hora ? (
                              <span>{a.hora} horas</span>
                            ) : (
                              <span className="italic text-[#9E9E9E]">
                                Horario no encontrado
                              </span>
                            )}
                          </p>
                          {destino ? (
                            <p className="flex items-start gap-2 text-lg font-medium leading-snug text-[#424242]">
                              <MapPin className="mt-1 size-5 shrink-0 text-[#616161]" aria-hidden />
                              <span>{destino}</span>
                            </p>
                          ) : (
                            <p className="flex items-start gap-2 text-lg font-medium leading-snug">
                              <MapPin className="mt-1 size-5 shrink-0 text-[#616161]" aria-hidden />
                              <span className="italic text-[#9E9E9E]">
                                Dirección no encontrada
                              </span>
                            </p>
                          )}
                          {mapsUrl && (
                            <a
                              href={mapsUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex min-h-14 w-full items-center justify-center rounded-xl bg-[#1E6CB4] px-4 py-2 text-xl font-bold text-white shadow-sm transition-colors hover:bg-[#164F8A] focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#1E6CB4]"
                            >
                              Ver cómo llegar
                            </a>
                          )}
                          {a.fuente_url ? (
                            <a
                              href={a.fuente_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border-2 border-[#1E6CB4] px-4 py-2 text-lg font-bold text-[#1E6CB4] transition-colors hover:bg-[#1E6CB4]/10 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#1E6CB4]"
                            >
                              Ver fuente exacta
                            </a>
                          ) : (
                            <p className="text-center text-base font-medium text-muted-foreground">
                              Fuente no informada
                            </p>
                          )}
                        </div>
                      </article>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </section>
    );
  }

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Cpu className="size-6 text-[#1E6CB4]" aria-hidden />
          Buscar actividades — Groq (búsqueda por ubicación)
        </CardTitle>
        <CardDescription className="text-base">
          Buscá actividades reales en la web cerca de una ubicación usando <strong>Groq</strong>{" "}
          (simula búsqueda web vía LLM — sin Live Search nativo). Sin autenticación — solo para MVP.
          Patrón replicado de Groq vision (afiches) pero en dominio <em>búsqueda por ubicación</em>{" "}
          (simulada vía prompt).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Modelo */}
        <div className="space-y-3 rounded-xl border-2 border-border bg-muted/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="modelo-groq" className="text-base font-bold">
              Modelo Groq
            </Label>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={source === "groq" ? "default" : "secondary"} className="text-xs">
                {source === "groq" ? "vía Groq API" : "lista local"}
              </Badge>
              {hasGroqKey === false && (
                <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
                  Sin GROQ_API_KEY — lista estática
                </Badge>
              )}
              {hasGroqKey === true && (
                <Badge className="bg-green-600 text-white border-transparent">
                  GROQ_API_KEY OK
                </Badge>
              )}
            </div>
          </div>

          {loadingModelos ? (
            <div className="flex items-center gap-2 text-base text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Cargando modelos…
            </div>
          ) : (
            <Select value={modeloSeleccionado} onValueChange={setModeloSeleccionado}>
              <SelectTrigger
                id="modelo-groq"
                className="min-h-12 w-full bg-white text-left text-base"
              >
                <SelectValue placeholder="Elegí un modelo" />
              </SelectTrigger>
              <SelectContent>
                {modelos.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="py-2">
                    <span className="flex flex-col items-start gap-1">
                      <span className="flex flex-wrap items-center gap-2 text-sm font-bold">
                        {m.label}
                        {m.recommended && (
                          <Badge className="bg-[#1E6CB4] text-white border-transparent text-xs">
                            Recomendado
                          </Badge>
                        )}
                        {m.vision && (
                          <Badge
                            variant="outline"
                            className="border-green-300 bg-green-50 text-green-700 text-xs"
                          >
                            Visión
                          </Badge>
                        )}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">{m.id}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {selectedMeta && (
            <div className="grid gap-2 rounded-lg bg-white p-3 text-sm leading-snug sm:grid-cols-2">
              <p className="col-span-2 text-sm text-muted-foreground">{selectedMeta.description}</p>
              <p>
                <span className="font-bold">Contexto:</span>{" "}
                {selectedMeta.contextWindow.toLocaleString("es-CL")} tokens
              </p>
              <p>
                <span className="font-bold">Visión:</span> {selectedMeta.vision ? "Sí" : "No"}
              </p>
              <p>
                <span className="font-bold">Precio:</span>{" "}
                {selectedMeta.pricing ??
                  `${selectedMeta.pricingIn ?? "—"} in / ${selectedMeta.pricingOut ?? "—"} out`}
              </p>
              <p className="col-span-2 font-mono text-xs text-muted-foreground">
                id: {selectedMeta.id}
              </p>
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            La selección se envía al servidor con cada búsqueda. Variables{" "}
            <code className="rounded bg-white px-1">AI_EXTRACTOR_MODEL</code> /{" "}
            <code className="rounded bg-white px-1">GROQ_MODEL_OVERRIDE</code> /{" "}
            <code className="rounded bg-white px-1">GROQ_MODEL</code> quedan como fallback.
          </p>
        </div>

        {/* Ubicación + filtros */}
        <div className="space-y-4 rounded-xl border-2 border-border bg-muted/30 p-4">
          <div className="space-y-2">
            <Label htmlFor="ubicacion" className="text-base font-bold">
              Ubicación <span className="text-destructive">*</span>
            </Label>
            <div className="flex gap-2">
              <Input
                id="ubicacion"
                value={ubicacion}
                onChange={(e) => setUbicacion(e.target.value)}
                placeholder="Ej: Lo Prado, Santiago, Chile"
                className="min-h-12 flex-1 bg-white text-base"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Podés usar barrio, comuna o dirección (ej. &quot;Providencia, Santiago&quot;,
              &quot;San Pablo 5850, Lo Prado&quot;).
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="radio" className="text-sm font-bold">
                Radio (metros)
              </Label>
              <Input
                id="radio"
                type="number"
                inputMode="numeric"
                placeholder="Ej: 2500"
                value={radioMetros}
                onChange={(e) => setRadioMetros(e.target.value)}
                className="min-h-10 bg-white"
                min={100}
                max={20000}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoria" className="text-sm font-bold">
                Categoría
              </Label>
              <Select
                value={categoria || "todas"}
                onValueChange={(v) => setCategoria(v === "todas" ? "" : v)}
              >
                <SelectTrigger id="categoria" className="min-h-10 bg-white">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c.value || "todas"} value={c.value || "todas"}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fechaDesde" className="text-sm font-bold">
                Desde (YYYY-MM-DD)
              </Label>
              <Input
                id="fechaDesde"
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="min-h-10 bg-white"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={handleBuscar}
            disabled={buscando || loadingModelos || ubicacion.trim().length < 3}
            className="min-h-12 rounded-xl bg-[#1E6CB4] px-6 text-base font-bold text-white hover:bg-[#164F8A] disabled:opacity-50"
          >
            {buscando ? (
              <>
                <Loader2 className="size-5 animate-spin" aria-hidden />
                Buscando en la web…
              </>
            ) : (
              <>
                <Search className="size-5" aria-hidden />
                Buscar actividades
              </>
            )}
          </Button>
          {elapsedMs !== null && !buscando && (
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock3 className="size-4" aria-hidden />
              {elapsedMs} ms · modelo:{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                {modeloSeleccionado}
              </code>
            </span>
          )}
          {result && (
            <Badge variant="secondary" className="text-xs">
              {result.total} resultado{result.total === 1 ? "" : "s"} · confidence{" "}
              {result.confidence.toFixed(2)}
            </Badge>
          )}
        </div>

        {hasGroqKey === false && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-snug text-amber-900">
            <p className="flex items-center gap-2 font-bold">
              <AlertTriangle className="size-4 text-amber-600" aria-hidden />
              GROQ_API_KEY no configurada en el servidor
            </p>
            <p className="mt-1">
              Configurá <code className="rounded bg-white px-1">GROQ_API_KEY</code> en{" "}
              <code className="rounded bg-white px-1">.env</code> (conseguí una en{" "}
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noreferrer"
                className="font-bold underline"
              >
                console.groq.com/keys
              </a>
              ). Mientras tanto el selector funciona y la lista es estática, pero la búsqueda dará
              error hasta tener la key.
            </p>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-xl border-2 border-destructive/30 bg-destructive/10 p-4"
          >
            <p className="flex items-center gap-2 text-base font-bold text-destructive">
              <AlertTriangle className="size-5" aria-hidden />
              Error al buscar
            </p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-snug text-destructive/90">
              {error}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Tip: si es 401 revisá GROQ_API_KEY; si es 429 esperá un minuto (Groq trial tiene quota
              estricta).
            </p>
          </div>
        )}

        {result && (
          <div className="space-y-4 rounded-xl border-2 bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                className={
                  result.needsReview
                    ? "bg-amber-500 text-white border-transparent"
                    : "bg-green-600 text-white border-transparent"
                }
              >
                {result.status === "needs_review" ? "needs_review" : "ok"}
              </Badge>
              <Badge variant="outline" className="gap-1.5 font-mono text-xs">
                <Braces className="size-3.5" aria-hidden />
                confidence {result.confidence.toFixed(3)}
              </Badge>
              {result.needsReview ? (
                <Badge
                  variant="outline"
                  className="border-amber-300 bg-amber-50 text-amber-800 gap-1"
                >
                  <AlertTriangle className="size-3.5" aria-hidden />
                  Requiere revisión (HITL &lt; 0.85)
                </Badge>
              ) : (
                <Badge className="bg-[#1B7A3D] text-white border-transparent gap-1">
                  <CheckCircle2 className="size-3.5" aria-hidden />
                  Alta confianza
                </Badge>
              )}
              <Badge variant="secondary" className="font-mono text-xs">
                {result.usedModel}
              </Badge>
              <Badge variant="outline" className="gap-1 text-xs">
                <MapPin className="size-3.5" aria-hidden />
                {result.ubicacion}
              </Badge>
              {elapsedMs !== null && (
                <span className="text-xs text-muted-foreground">{elapsedMs} ms</span>
              )}
            </div>

            {result.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-800">
                  <AlertTriangle className="size-3.5" aria-hidden />
                  Warnings
                </p>
                <ul className="mt-1 list-disc pl-5 text-sm text-amber-900">
                  {result.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <Separator />

            {result.actividades.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed bg-muted/20 p-6 text-center">
                <p className="text-base font-bold text-muted-foreground">
                  Sin actividades encontradas
                </p>
                <p className="text-sm text-muted-foreground">
                  Probá con otra ubicación, ampliá el radio o sacá el filtro de categoría.
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                {result.actividades.map((a, idx) => (
                  <div
                    key={`${a.nombre}-${idx}`}
                    className="rounded-xl border-2 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                  >
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
                          <Badge className="bg-[#1B7A3D] text-white border-transparent text-xs">
                            Gratuito
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            {a.precio_texto || "De pago"}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="mt-1 text-sm leading-snug text-muted-foreground">
                      {a.descripcion}
                    </p>
                    <div className="mt-2 grid gap-1 text-sm">
                      {a.fecha && (
                        <p>
                          <span className="font-bold">Fecha:</span> {a.fecha}{" "}
                          {a.hora ? `· ${a.hora}` : ""}
                        </p>
                      )}
                      {!a.fecha && a.hora && (
                        <p>
                          <span className="font-bold">Hora:</span> {a.hora}
                        </p>
                      )}
                      {a.lugar && (
                        <p className="flex gap-1.5">
                          <MapPin
                            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                            aria-hidden
                          />
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
                ))}
              </div>
            )}

            <details className="rounded-lg border bg-muted/20 p-3">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-bold">
                <Sparkles className="size-4 text-[#1E6CB4]" aria-hidden />
                Ver JSON completo
              </summary>
              <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white p-3 font-mono text-xs leading-snug">
                {JSON.stringify(result.raw, null, 2)}
              </pre>
            </details>

            <p className="text-xs text-muted-foreground">
              HITL: confidence &lt; 0.85 se guarda best-effort en{" "}
              <code className="rounded bg-muted px-1">busquedas_groq_pendientes</code> para revisión
              humana (si la tabla existe).
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Alias for backwards compatibility (grok → groq)
export const BuscarActividadesGrok = BuscarActividadesGroq;
