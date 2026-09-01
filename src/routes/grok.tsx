import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FlaskConical } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { BuscarActividadesGrok } from "@/components/buscar-actividades-grok";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/grok")({
  head: () => ({
    meta: [
      { title: "Grok — Buscar actividades por ubicación" },
      {
        name: "description",
        content:
          "Buscá actividades reales en la web cerca de una ubicación usando Grok (xAI) Live Search — Ciudad Viva Mayor.",
      },
    ],
  }),
  // No auth, no loader needing secrets — componente hace fetch client-side vía server functions
  component: GrokPage,
});

function GrokPage() {
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
            Grok web-search — actividades por ubicación
          </h1>
          <p className="text-sm leading-snug text-muted-foreground">
            Potenciado por <strong>xAI Grok</strong> con Live Search (búsqueda web nativa). Replicando el patrón de{" "}
            <code className="rounded bg-muted px-1 font-mono text-xs">feat/ai-groq-extractor</code> pero en dominio{" "}
            <em>web search</em> en vez de <em>vision</em>. Modelo por defecto{" "}
            <code className="rounded bg-muted px-1 font-mono text-xs">grok-4-0709</code> ($3/$15 por 1M).
          </p>
        </div>

        <BuscarActividadesGrok />

        <div className="rounded-xl border bg-muted/20 p-4 text-sm leading-snug">
          <p className="font-bold">Cómo probar local</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>
              <code className="rounded bg-white px-1 font-mono text-xs">
                XAI_API_KEY=xai-... bun run dev
              </code>{" "}
              y abrí <code className="rounded bg-white px-1">/grok</code>.
            </li>
            <li>
              Sin key verás &quot;Sin XAI_API_KEY&quot; y la búsqueda devolverá error claro (no rompe el build).
            </li>
            <li>
              curl (requiere key en server):{" "}
              <code className="break-all rounded bg-white px-1 font-mono text-xs">
                {"curl -X POST http://localhost:5173/api/grok --data '{\"ubicacion\":\"Lo Prado, Santiago\"}'"}
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
