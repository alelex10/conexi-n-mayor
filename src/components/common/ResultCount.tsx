import type { ReactNode } from "react";

/**
 * Shared result-count line. Wraps the caller's exact copy (children) in the
 * canonical centered brown style used by the 3 count lines
 * (CleanSearchView, ChileCulturaTab, home listado).
 */
export function ResultCount({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`text-center text-lg font-bold text-[#5D4037]${className ? ` ${className}` : ""}`}
      aria-live="polite"
    >
      {children}
    </p>
  );
}
