export type SourceBadgeSize = "sm" | "xs";

/**
 * Shared "ChileCultura" source pill (orange tone). Preserves the exact
 * original look per usage via `size` + `commune` + `showFuentePrefix`:
 * - ChileCulturaCard + home "Lo más cercano": plain "ChileCultura" (sm)
 * - home "barrio" card: "ChileCultura · Aprox. en {commune}" (xs)
 * - detalle: "Fuente: ChileCultura · Aprox. en {commune}" (sm, as <p>)
 */
export function SourceBadge({
  commune,
  showFuentePrefix = false,
  size = "sm",
  as: Tag = "span",
  className = "",
}: {
  commune?: string | null | undefined;
  showFuentePrefix?: boolean;
  size?: SourceBadgeSize;
  as?: "span" | "p";
  className?: string;
}) {
  const texto = `${showFuentePrefix ? "Fuente: " : ""}ChileCultura${commune ? ` · Aprox. en ${commune}` : ""}`;
  return (
    <Tag
      className={`inline-block rounded-lg border border-[#F57C00] bg-[#FFF3E0] px-3 py-1 font-bold text-[#EF6C00] ${
        size === "sm" ? "text-sm" : "text-xs"
      }${className ? ` ${className}` : ""}`}
    >
      {texto}
    </Tag>
  );
}
