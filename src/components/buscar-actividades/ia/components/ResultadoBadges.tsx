import { AlertTriangle, Braces, CheckCircle2, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { BuscarResult } from "../types";

export function ResultadoBadges({
  result,
  elapsedMs,
}: {
  result: BuscarResult;
  elapsedMs: number | null;
}) {
  return (
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
      <Badge variant="outline" className="gap-1 text-xs">
        <MapPin className="size-3.5" aria-hidden />
        {result.ubicacion}
      </Badge>
      {elapsedMs !== null && <span className="text-xs text-muted-foreground">{elapsedMs} ms</span>}
    </div>
  );
}
