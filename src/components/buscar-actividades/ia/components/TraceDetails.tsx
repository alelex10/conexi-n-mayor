import { ChevronDown, Cpu } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { BuscarResultTrace } from "../types";

export function TraceDetails({ trace }: { trace: BuscarResultTrace }) {
  return (
    <Collapsible className="rounded-lg border bg-muted/20 p-3">
      <CollapsibleTrigger className="flex w-full cursor-pointer list-none items-center gap-2 text-left text-sm font-bold">
        <Cpu className="size-4 text-[#1E6CB4]" aria-hidden />
        Ver proceso interno
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge
            className={
              trace.verdict === "grounded"
                ? "bg-green-600 text-white border-transparent"
                : "bg-amber-500 text-white border-transparent"
            }
          >
            {trace.verdict === "grounded"
              ? "grounded (verificado en web)"
              : "memory (sin fuentes web)"}
          </Badge>
          <Badge variant="outline" className="text-xs">
            searched: {trace.searched ? "sí" : "no"}
          </Badge>
          <Badge variant="outline" className="font-mono text-xs">
            {trace.model}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {trace.durationMs} ms · confidence {trace.confidence.toFixed(2)}
          </span>
        </div>
        <ol className="space-y-2">
          {trace.attempts.map((a) => (
            <li key={a.attempt} className="rounded-lg bg-white p-3 text-sm">
              <p className="font-bold">
                Intento {a.attempt} · {a.durationMs} ms
                {a.finishReason ? ` · finish: ${a.finishReason}` : ""}
                {a.backoffMs ? ` · backoff previo: ${a.backoffMs} ms` : ""}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                tokens in/out/total: {a.promptTokens ?? "—"}/{a.candidatesTokens ?? "—"}/
                {a.totalTokens ?? "—"} · chunks: {a.groundingChunkCount} · fuentes: {a.sourceCount}{" "}
                · buscó: {a.searched ? "sí" : "no"}
              </p>
              {a.webSearchQueries.length > 0 ? (
                <ul className="mt-1 list-disc pl-5 text-xs">
                  {a.webSearchQueries.map((q) => (
                    <li key={q} className="break-words">
                      “{q}”
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-amber-700">
                  Sin queries de búsqueda en este intento.
                </p>
              )}
            </li>
          ))}
        </ol>
        {trace.retries.length > 0 && (
          <div className="rounded-lg bg-white p-3 text-sm">
            <p className="font-bold">Reintentos / backoffs</p>
            <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
              {trace.retries.map((r, i) => (
                <li key={i}>
                  intento {r.attempt} · backoff {r.backoffMs} ms · {r.reason}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="rounded-lg bg-white p-3 text-sm">
          <p className="font-bold">
            Tokens totales: in {trace.totalPromptTokens ?? "—"} · out{" "}
            {trace.totalCandidatesTokens ?? "—"} · total {trace.totalTokens ?? "—"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Queries totales: {trace.queries.length} · chunks finales: {trace.groundingChunkCount} ·
            fuentes: {trace.sourceCount} · {trace.startedAt} → {trace.endedAt}
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
