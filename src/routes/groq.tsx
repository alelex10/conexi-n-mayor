import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FlaskConical } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { BuscarActividadesGroq } from "@/components/buscar-actividades-groq";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/groq")({
  head: () => ({
    meta: [
      { title: "Groq — Buscar actividades por ubicación" },
      {
        name: "description",
        content:
          "Buscá actividades reales en la web cerca de una ubicación usando Groq (simula búsqueda web vía LLM) — Ciudad Viva Mayor.",
      },
    ],
  }),
  // No auth, no loader needing secrets — componente hace fetch client-side vía server functions
  component: GroqPage,
});

function GroqPage() {
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
          <BadgeLab />
        </div>

        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
            <FlaskConical className="size-6 text-[#1E6CB4]" aria-hidden />
            Groq — actividades por ubicación
          </h1>
          <p className="text-sm leading-snug text-muted-foreground">
            Potenciado por <strong>Groq</strong> (simula búsqueda web vía LLM — sin Live Search nativo). Patrón copiado de{" "}
            <code className="rounded bg-muted px-1 font-mono text-xs">feat/ai-groq-extractor</code> pero en dominio{" "}
            <em>web search</em> en vez de <em>vision</em>. Modelo por defecto{" "}
            <code className="rounded bg-muted px-1 font-mono text-xs">qwen/qwen3.6-27b</code> ($0.60/$3.00 por 1M).
          </p>
        </div>

        <BuscarActividadesGroq />

        <div className="rounded-xl border bg-muted/20 p-4 text-sm leading-snug">
          <p className="font-bold">Cómo probar local</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>
              <code className="rounded bg-white px-1 font-mono text-xs">
                GROQ_API_KEY=gsk_... bun run dev
              </code>{" "}
              y abrí <code className="rounded bg-white px-1">/groq</code> (también disponible <code className="rounded bg-white px-1">/grok</code> como alias).
            </li>
            <li>
              Sin key verás &quot;Sin GROQ_API_KEY&quot; y la búsqueda devolverá error claro (no rompe el build).
            </li>
            <li>
              curl (requiere key en server):{" "}
              <code className="break-all rounded bg-white px-1 font-mono text-xs">
                {"curl concept (Groq usa createServerFn, no REST directo) --data '{\"ubicacion\":\"Lo Prado, Santiago\"}'"}
              </code>{" "}
              — en la práctica usá la UI (createServerFn).
            </li>
          </ul>
        </div>
      </div>
    </AppShell>
  );
}

function BadgeLab() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
      <FlaskConical className="size-3.5" aria-hidden />
      Lab / experimental
    </span>
  );
}
