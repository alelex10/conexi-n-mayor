import type { ReactNode } from "react";

export type CategoriaBadgeSize = "sm" | "base";

/**
 * Shared category badge (accent tone). Both cards keep their exact
 * original type scale via `size`: the clean IA card uses "base",
 * the ChileCultura card uses "sm".
 */
export function CategoriaBadge({
  children,
  size = "base",
}: {
  children: ReactNode;
  size?: CategoriaBadgeSize;
}) {
  return (
    <span
      className={`inline-block rounded-lg bg-accent px-3 py-1 font-bold text-accent-foreground ${
        size === "base" ? "text-base" : "text-sm"
      }`}
    >
      {children}
    </span>
  );
}
