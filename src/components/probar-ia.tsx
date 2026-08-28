import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Braces, CheckCircle2, Clock3, Cpu, Image as ImageIcon, Loader2, Upload, Sparkles } from "lucide-react";

import { extractAficheFn, listarModelosGroqFn } from "@/lib/ai.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

type GroqModelUI = {
  id: string;
  label: string;
  description: string;
  contextWindow: number;
  maxImages: number | null;
  speed: string | null;
  pricingIn: string | null;
  pricingOut: string | null;
  recommended: boolean;
  vision: boolean;
};

const FALLBACK_MODELS: GroqModelUI[] = [
  {
    id: "meta-llama/llama-4-scout-17b-16e-instruct",
    label: "Llama 4 Scout 17B",
    description: "Recomendado — 17B MoE activo, visión nativa, rápido y económico",
    contextWindow: 131072,
    maxImages: 5,
    speed: "594 TPS",
    pricingIn: "$0.11 / 1M",
    pricingOut: "$0.34 / 1M",
    recommended: true,
    vision: true,
  },
  {
    id: "meta-llama/llama-4-maverick-17b-128e-instruct",
    label: "Llama 4 Maverick 17B (128E)",
    description: "400B total MoE — máxima calidad",
    contextWindow: 131072,
    maxImages: 5,
    speed: "~300 TPS",
    pricingIn: "$0.60 / 1M",
    pricingOut: "$3.00 / 1M",
    recommended: false,
    vision: true,
  },
  {
    id: "meta-llama/llama-3.2-90b-vision-preview",
    label: "Llama 3.2 90B Vision (preview)",
    description: "Fallback 90B — puede estar deprecado",
    contextWindow: 131072,
    maxImages: 5,
    speed: "~200 TPS",
    pricingIn: "$0.90 / 1M",
    pricingOut: "$0.90 / 1M",
    recommended: false,
    vision: true,
  },
  {
    id: "meta-llama/llama-3.2-11b-vision-preview",
    label: "Llama 3.2 11B Vision (preview)",
    description: "Ligero y rápido — ideal para pruebas",
    contextWindow: 8192,
    maxImages: 1,
    speed: "~600 TPS",
    pricingIn: "$0.18 / 1M",
    pricingOut: "$0.18 / 1M",
    recommended: false,
    vision: true,
  },
];

const DEFAULT_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

type ExtractResult = {
  status: "needs_review" | "extracted";
  extracted: Record<string, unknown>;
  needsReview: boolean;
  confidence: number;
  usedModel: string;
};

function fileToBase64(file: File): Promise<{ base64: string; mimeType: "image/jpeg" | "image/png" }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.onload = () => {
      const result = reader.result as string;
      // result is data:xxx;base64,YYY
      const comma = result.indexOf(",");
      const header = result.slice(0, comma);
      const base64 = result.slice(comma + 1);
      const isPng = header.includes("image/png");
      resolve({ base64, mimeType: isPng ? "image/png" : "image/jpeg" });
    };
    reader.readAsDataURL(file);
  });
}

export function ProbarIASection() {
  const [modelos, setModelos] = useState<GroqModelUI[]>(FALLBACK_MODELS);
  const [modeloSeleccionado, setModeloSeleccionado] = useState<string>(DEFAULT_MODEL);
  const [source, setSource] = useState<"groq" | "static">("static");
  const [hasGroqKey, setHasGroqKey] = useState<boolean | null>(null);
  const [loadingModelos, setLoadingModelos] = useState(true);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [base64, setBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<"image/jpeg" | "image/png">("image/jpeg");
  const [extracting, setExtracting] = useState(false);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const startRef = useRef<number>(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await listarModelosGroqFn();
        if (cancelled) return;
        const list = res.models as GroqModelUI[];
        setModelos(list.length > 0 ? list : FALLBACK_MODELS);
        setSource(res.source as "groq" | "static");
        setHasGroqKey(Boolean(res.hasGroqKey));
        // keep selected if still valid, else default
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
    // only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setResult(null);
    setError(null);
    setElapsedMs(null);
    if (!f) {
      setFile(null);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setBase64(null);
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      setError("La imagen es muy grande (máx 8 MB). Probá con una más chica.");
      return;
    }
    if (f.type !== "image/jpeg" && f.type !== "image/png" && f.type !== "image/jpg") {
      setError("Formato no soportado. Usá JPG o PNG.");
      return;
    }
    setFile(f);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
    try {
      const { base64: b64, mimeType: mt } = await fileToBase64(f);
      setBase64(b64);
      setMimeType(mt);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleExtract = async () => {
    if (!base64) {
      setError("Primero seleccioná una imagen JPG o PNG.");
      return;
    }
    setExtracting(true);
    setError(null);
    setResult(null);
    setElapsedMs(null);
    startRef.current = Date.now();
    try {
      const res = await extractAficheFn({
        data: { imageBase64: base64, mimeType, model: modeloSeleccionado },
      });
      setResult(res as ExtractResult);
      setElapsedMs(Date.now() - startRef.current);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Friendly missing key message
      if (msg.includes("Missing GROQ_API_KEY") || msg.includes("GROQ_API_KEY")) {
        setError("Falta GROQ_API_KEY en el servidor (.env). Conseguí una gratis en https://console.groq.com/keys");
      } else {
        setError(msg);
      }
      setElapsedMs(Date.now() - startRef.current);
    } finally {
      setExtracting(false);
    }
  };

  const selectedMeta = modelos.find((m) => m.id === modeloSeleccionado) ?? null;

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Cpu className="size-6 text-[#1E6CB4]" aria-hidden />
          Extractor IA — Probar Groq Vision
        </CardTitle>
        <CardDescription className="text-base">
          Elegí el modelo, subí un afiche (JPG/PNG) y probá la extracción directo desde esta vista pública. Sin autenticación — solo para MVP.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Model selector */}
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
                <Badge className="bg-green-600 text-white border-transparent">GROQ_API_KEY OK</Badge>
              )}
            </div>
          </div>

          {loadingModelos ? (
            <div className="flex items-center gap-2 text-base text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Cargando modelos…
            </div>
          ) : (
            <Select value={modeloSeleccionado} onValueChange={setModeloSeleccionado}>
              <SelectTrigger id="modelo-groq" className="min-h-12 w-full bg-white text-left text-base">
                <SelectValue placeholder="Elegí un modelo" />
              </SelectTrigger>
              <SelectContent>
                {modelos.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="py-2">
                    <span className="flex flex-col items-start gap-1">
                      <span className="flex flex-wrap items-center gap-2 text-sm font-bold">
                        {m.label}
                        {m.recommended && <Badge className="bg-[#1E6CB4] text-white border-transparent text-xs">Recomendado</Badge>}
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
                <span className="font-bold">Contexto:</span> {selectedMeta.contextWindow.toLocaleString("es-CL")} tokens
              </p>
              <p>
                <span className="font-bold">Máx imágenes:</span> {selectedMeta.maxImages ?? "—"}
              </p>
              <p>
                <span className="font-bold">Velocidad:</span> {selectedMeta.speed ?? "—"}
              </p>
              <p>
                <span className="font-bold">Precio:</span> {selectedMeta.pricingIn ?? "—"} in / {selectedMeta.pricingOut ?? "—"} out
              </p>
              <p className="col-span-2 font-mono text-xs text-muted-foreground">id: {selectedMeta.id}</p>
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            La selección se envía al servidor con cada extracción. Variable <code className="rounded bg-white px-1">AI_EXTRACTOR_MODEL</code>{" "}
            queda como fallback deprecado.
          </p>
        </div>

        {/* File input + preview */}
        <div className="space-y-3">
          <Label htmlFor="afiche-file" className="text-base font-bold">
            Imagen del afiche (JPG/PNG, máx 8 MB)
          </Label>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              id="afiche-file"
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/jpg"
              onChange={handleFileChange}
              className="min-h-12 max-w-sm cursor-pointer text-base file:mr-3 file:rounded-lg file:border-0 file:bg-[#1E6CB4] file:px-4 file:py-2 file:text-sm file:font-bold file:text-white hover:file:bg-[#164F8A]"
            />
            {previewUrl && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setFile(null);
                  setPreviewUrl((prev) => {
                    if (prev) URL.revokeObjectURL(prev);
                    return null;
                  });
                  setBase64(null);
                  setResult(null);
                  setError(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="min-h-10"
              >
                Quitar imagen
              </Button>
            )}
          </div>

          {previewUrl ? (
            <div className="overflow-hidden rounded-xl border-2 bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Preview afiche" className="mx-auto max-h-[420px] w-auto object-contain p-2" />
              {file && (
                <p className="border-t bg-muted/20 px-3 py-2 text-center text-sm text-muted-foreground">
                  {file.name} · {(file.size / 1024).toFixed(0)} KB · {mimeType}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed bg-muted/20 p-8 text-center">
              <ImageIcon className="size-10 text-muted-foreground" aria-hidden />
              <p className="mt-2 text-base font-bold text-muted-foreground">Sin imagen seleccionada</p>
              <p className="text-sm text-muted-foreground">Subí una foto nítida del afiche para probar el extractor.</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={handleExtract}
            disabled={!base64 || extracting || loadingModelos}
            className="min-h-12 rounded-xl bg-[#1E6CB4] px-6 text-base font-bold text-white hover:bg-[#164F8A] disabled:opacity-50"
          >
            {extracting ? (
              <>
                <Loader2 className="size-5 animate-spin" aria-hidden />
                Extrayendo…
              </>
            ) : (
              <>
                <Upload className="size-5" aria-hidden />
                Extraer con Groq
              </>
            )}
          </Button>
          {elapsedMs !== null && !extracting && (
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock3 className="size-4" aria-hidden />
              {elapsedMs} ms · modelo: <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{modeloSeleccionado}</code>
            </span>
          )}
        </div>

        {/* No key helper */}
        {hasGroqKey === false && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-snug text-amber-900">
            <p className="flex items-center gap-2 font-bold">
              <AlertTriangle className="size-4 text-amber-600" aria-hidden />
              GROQ_API_KEY no configurada en el servidor
            </p>
            <p className="mt-1">
              Configurá <code className="rounded bg-white px-1">GROQ_API_KEY</code> en <code className="rounded bg-white px-1">.env</code>{" "}
              (conseguí una gratis en <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="font-bold underline">console.groq.com/keys</a> — sin tarjeta).
              Mientras tanto el selector funciona y la lista es estática, pero la extracción dará error hasta tener la key.
            </p>
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-xl border-2 border-destructive/30 bg-destructive/10 p-4">
            <p className="flex items-center gap-2 text-base font-bold text-destructive">
              <AlertTriangle className="size-5" aria-hidden />
              Error al extraer
            </p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-snug text-destructive/90">{error}</p>
          </div>
        )}

        {result && (
          <div className="space-y-3 rounded-xl border-2 bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={result.needsReview ? "bg-amber-500 text-white border-transparent" : "bg-green-600 text-white border-transparent"}>
                {result.status === "needs_review" ? "needs_review" : "extracted"}
              </Badge>
              <Badge variant="outline" className="gap-1.5 font-mono text-xs">
                <Braces className="size-3.5" aria-hidden />
                confidence {result.confidence.toFixed(3)}
              </Badge>
              {result.needsReview ? (
                <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 gap-1">
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
              {elapsedMs !== null && <span className="text-xs text-muted-foreground">{elapsedMs} ms</span>}
            </div>

            <Separator />

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["Título", String((result.extracted as Record<string, unknown>)["titulo"] ?? "—")],
                ["Fecha", String((result.extracted as Record<string, unknown>)["fecha"] ?? "—")],
                ["Hora", String((result.extracted as Record<string, unknown>)["hora"] ?? "—")],
                ["Lugar", String((result.extracted as Record<string, unknown>)["lugar"] ?? "—")],
                ["Dirección", String((result.extracted as Record<string, unknown>)["direccion"] ?? "—")],
                ["Categoría", String((result.extracted as Record<string, unknown>)["categoria"] ?? "—")],
                ["Precio", String((result.extracted as Record<string, unknown>)["precio_texto"] ?? ((result.extracted as Record<string, unknown>)["es_gratuito"] ? "Gratuito" : "—"))],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg border bg-muted/30 px-3 py-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{k}</p>
                  <p className="text-sm font-medium leading-snug">{v || "—"}</p>
                </div>
              ))}
            </div>

            {Boolean((result.extracted as Record<string, unknown>)["descripcion"]) && (
              <div className="rounded-lg border bg-muted/30 px-3 py-2">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Descripción</p>
                <p className="text-sm leading-snug">{String((result.extracted as Record<string, unknown>)["descripcion"])}</p>
              </div>
            )}

            {Array.isArray((result.extracted as Record<string, unknown>)["warnings"]) &&
              ((result.extracted as Record<string, unknown>)["warnings"] as string[]).length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-800">
                    <AlertTriangle className="size-3.5" aria-hidden />
                    Warnings
                  </p>
                  <ul className="mt-1 list-disc pl-5 text-sm text-amber-900">
                    {((result.extracted as Record<string, unknown>)["warnings"] as string[]).map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

            <details className="rounded-lg border bg-muted/20 p-3">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-bold">
                <Sparkles className="size-4 text-[#1E6CB4]" aria-hidden />
                Ver JSON completo
              </summary>
              <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white p-3 font-mono text-xs leading-snug">
                {JSON.stringify(result.extracted, null, 2)}
              </pre>
            </details>

            <p className="text-xs text-muted-foreground">
              HITL: confidence &lt; 0.85 se guarda en <code className="rounded bg-muted px-1">extracciones_pendientes</code> para revisión humana.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
