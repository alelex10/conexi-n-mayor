import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { buscarGeminiCrudoFn } from "@/lib/gemini-v2/gemini-v2-debug.functions";
import { buscarGroqCrudoFn } from "@/lib/groq-v2/groq-v2-debug.functions";

// Legacy files preserved but not called from this view:
// src/server/ai/groq/search.ts, src/server/ai/gemini/search.ts,
// src/server/ai/lovable/search.ts, src/lib/groq-actividades.functions.ts, etc.

export const Route = createFileRoute("/debug-groq")({
  component: DebugGroqPage,
});

function DebugGroqPage() {
  const [mensaje, setMensaje] = useState("puedes navegar por la web?");
  const [cargando, setCargando] = useState(false);

  const [groqSalida, setGroqSalida] = useState("");
  const [groqElapsedMs, setGroqElapsedMs] = useState<number | null>(null);
  const [groqError, setGroqError] = useState("");

  const [geminiSalida, setGeminiSalida] = useState("");
  const [geminiElapsedMs, setGeminiElapsedMs] = useState<number | null>(null);
  const [geminiError, setGeminiError] = useState("");

  async function onBuscar() {
    setCargando(true);
    setGroqError("");
    setGroqSalida("");
    setGroqElapsedMs(null);
    setGeminiError("");
    setGeminiSalida("");
    setGeminiElapsedMs(null);

    const started = Date.now();

    const [groqRes, geminiRes] = await Promise.allSettled([
      buscarGroqCrudoFn({ data: { mensaje } }),
      buscarGeminiCrudoFn({ data: { mensaje } }),
    ]);

    const elapsed = Date.now() - started;

    if (groqRes.status === "fulfilled") {
      setGroqSalida(`[${groqRes.value.model}]\n${groqRes.value.raw}`);
      setGroqElapsedMs(elapsed);
    } else {
      setGroqError(groqRes.reason instanceof Error ? groqRes.reason.message : String(groqRes.reason));
      setGroqElapsedMs(elapsed);
    }

    if (geminiRes.status === "fulfilled") {
      const sources = geminiRes.value.sources;
      const sourcesBlock =
        sources && sources.length > 0
          ? `\n\nFuentes (${sources.length}):\n` + sources.map((s) => `- ${s.title}: ${s.url}`).join("\n")
          : "";
      setGeminiSalida(`[${geminiRes.value.model}]\n${geminiRes.value.raw}${sourcesBlock}`);
      setGeminiElapsedMs(elapsed);
    } else {
      setGeminiError(geminiRes.reason instanceof Error ? geminiRes.reason.message : String(geminiRes.reason));
      setGeminiElapsedMs(elapsed);
    }

    setCargando(false);
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3 p-4">
      <h1 className="text-xl font-bold">Depuración Groq vs Gemini (v2)</h1>
      <p className="text-sm text-muted-foreground">
        Compara lado a lado Groq v2 (browser_search) y Gemini v2 (googleSearch) con la misma configuración
        costo-optimizada: Lo Prado, 700 tokens máx, al menos 2 sitios distintos.
      </p>
      <label className="text-sm font-medium" htmlFor="debug-groq-input">
        Mensaje
      </label>
      <input
        id="debug-groq-input"
        className="min-h-14 rounded border p-2"
        value={mensaje}
        onChange={(e) => setMensaje(e.target.value)}
        maxLength={2000}
      />
      <button
        type="button"
        className="min-h-14 rounded border p-2 font-bold"
        onClick={onBuscar}
        disabled={cargando}
      >
        {cargando ? "Buscando…" : "Buscar (ambos)"}
      </button>

      <h2 className="mt-2 text-base font-semibold">Groq v2</h2>
      <pre className="min-h-14 whitespace-pre-wrap rounded border p-2 text-sm">
        {groqSalida || "(sin resultado)"}
        {groqElapsedMs !== null ? `\n\n— ${groqElapsedMs} ms —` : ""}
        {groqError ? `\nError: ${groqError}` : ""}
      </pre>

      <h2 className="text-base font-semibold">Gemini v2</h2>
      <pre className="min-h-14 whitespace-pre-wrap rounded border p-2 text-sm">
        {geminiSalida || "(sin resultado)"}
        {geminiElapsedMs !== null ? `\n\n— ${geminiElapsedMs} ms —` : ""}
        {geminiError ? `\nError: ${geminiError}` : ""}
      </pre>
    </div>
  );
}
