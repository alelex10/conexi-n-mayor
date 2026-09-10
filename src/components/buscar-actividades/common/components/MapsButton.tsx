import { Map } from "lucide-react";

export type MapsButtonMode = "search" | "directions";

/**
 * Shared Maps button. `mode="search"` keeps byte-identical the original
 * clean IA card button (Google Maps search URL, "Ver cómo llegar").
 * `mode="directions"` reproduces the actividad detalle button
 * (directions URL, primary tone, Map icon, min-h-16 text-2xl).
 */
export function MapsButton({
  url,
  label,
  mode = "search",
}: {
  url: string;
  label?: string;
  mode?: MapsButtonMode;
}) {
  const texto = label ?? "Ver cómo llegar";
  if (mode === "directions") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 flex min-h-16 items-center justify-center gap-3 rounded-xl bg-primary px-4 text-2xl font-bold text-primary-foreground focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Map aria-hidden className="size-7" /> {texto}
      </a>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-h-14 w-full items-center justify-center rounded-xl bg-[#1E6CB4] px-4 py-2 text-xl font-bold text-white shadow-sm transition-colors hover:bg-[#164F8A] focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#1E6CB4]"
    >
      {texto}
    </a>
  );
}
