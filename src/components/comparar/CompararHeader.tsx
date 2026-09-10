import { Link } from "@tanstack/react-router";
import { ArrowLeft, FlaskConical } from "lucide-react";

import { Button } from "@/components/ui/button";

export function CompararHeader() {
  return (
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
    </div>
  );
}
