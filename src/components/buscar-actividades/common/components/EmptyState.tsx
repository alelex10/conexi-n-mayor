import type { ReactNode } from "react";

export type EmptyStateTone = "dashed" | "card";

/**
 * Shared empty state. Default `tone="dashed"` keeps byte-identical the
 * original IA empty box. `tone="card"` reproduces the white-card empty
 * boxes (ChileCulturaTab, home listado) with their exact title/hint scale;
 * the caller's action node (e.g. home "Ver hasta 2,5 km" button) is
 * rendered verbatim via `action`.
 */
export function EmptyState({
  title,
  hint,
  action,
  tone = "dashed",
  className = "",
}: {
  title?: string;
  hint?: string;
  action?: ReactNode;
  tone?: EmptyStateTone;
  className?: string;
}) {
  if (tone === "card") {
    return (
      <div
        className={`rounded-2xl border border-black/[0.06] bg-white p-6 text-center shadow-sm${className ? ` ${className}` : ""}`}
      >
        <p className="text-xl font-bold text-foreground">
          {title ?? "Sin actividades encontradas"}
        </p>
        {hint && <p className="mt-2 text-lg text-muted-foreground">{hint}</p>}
        {action}
      </div>
    );
  }
  return (
    <div
      className={`rounded-lg border-2 border-dashed bg-muted/20 p-6 text-center${className ? ` ${className}` : ""}`}
    >
      <p className="text-base font-bold text-muted-foreground">
        {title ?? "Sin actividades encontradas"}
      </p>
      <p className="text-sm text-muted-foreground">
        {hint ?? "Probá con otra ubicación, ampliá el radio o sacá el filtro de categoría."}
      </p>
      {action}
    </div>
  );
}
