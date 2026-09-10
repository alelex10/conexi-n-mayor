export type GratuitoBadgeSize = "sm" | "base" | "lg";
export type GratuitoBadgeFreeTone = "verde" | "primary";

/**
 * Shared free/paid badge. The two cards are intentionally NOT forced into
 * one look: `size` + `freeTone` preserve each card's exact original
 * classes (clean IA card: base/verde; ChileCultura card: sm/primary).
 * The paid tone (`bg-secondary`) is the same in both.
 * Size "lg" preserves the actividad detalle pill (px-4 py-2 text-xl
 * font-bold); sm/base keep the cards' px-3 py-1 font-extrabold look.
 */
export function GratuitoBadge({
  gratuito,
  textoPago,
  size = "base",
  freeTone = "verde",
  className = "",
  ariaLabel,
}: {
  gratuito: boolean;
  textoPago: string;
  size?: GratuitoBadgeSize;
  freeTone?: GratuitoBadgeFreeTone;
  className?: string;
  ariaLabel?: string;
}) {
  const freeClass =
    freeTone === "verde" ? "bg-[#1B7A3D] text-white" : "bg-primary text-primary-foreground";
  const sizeClass =
    size === "lg"
      ? "px-4 py-2 text-xl font-bold"
      : `px-3 py-1 font-extrabold ${size === "base" ? "text-base" : "text-sm"}`;
  return (
    <span
      className={`inline-block rounded-lg ${sizeClass} ${
        gratuito ? freeClass : "bg-secondary text-secondary-foreground"
      }${className ? ` ${className}` : ""}`}
      {...(ariaLabel ? { "aria-label": ariaLabel } : {})}
    >
      {gratuito ? "Gratuito" : textoPago}
    </span>
  );
}
