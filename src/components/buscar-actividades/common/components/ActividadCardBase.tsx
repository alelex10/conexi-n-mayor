import type { ReactNode } from "react";

export type ActividadCardVariant = "clean" | "chilecultura";

/**
 * Shared card shell (`li > article > div`) with slots for
 * titulo/badges/meta/descripcion/footer. Each variant preserves its card's
 * exact original shell classes:
 * - clean: `border-black/[0.06]`, inner `gap-3`
 * - chilecultura: `border-black/6`, inner `gap-2`
 * Slot nodes are rendered verbatim in badges → titulo → meta →
 * descripcion → footer order (callers keep their original node markup).
 */
export function ActividadCardBase({
  badges,
  titulo,
  meta,
  descripcion,
  footer,
  variant,
}: {
  badges: ReactNode;
  titulo: ReactNode;
  meta?: ReactNode;
  descripcion?: ReactNode;
  footer?: ReactNode;
  variant: ActividadCardVariant;
}) {
  const isClean = variant === "clean";
  return (
    <li>
      <article
        className={`rounded-2xl border bg-white p-4 shadow-sm ${
          isClean ? "border-black/[0.06]" : "border-black/6"
        }`}
      >
        <div className={`flex flex-col ${isClean ? "gap-3" : "gap-2"}`}>
          {badges}
          {titulo}
          {meta}
          {descripcion}
          {footer}
        </div>
      </article>
    </li>
  );
}
