import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

export type UseLocationButtonSize = "sm" | "lg";

/**
 * Shared "Usar mi ubicación" block (button + optional status line).
 * Preserves each caller's exact look via `size`:
 * - CleanSearchView: "lg" (button text-xl, icon size-6, message text-lg)
 * - FiltrosUbicacion: "sm" (button text-base, icon size-5, message text-base)
 * The `getLocationStatusMessage` logic stays in the hook/facade — this
 * component only receives the already-computed `message`.
 */
export function UseLocationButton({
  onClick,
  message,
  size = "lg",
}: {
  onClick: () => void;
  message: string | null;
  size?: UseLocationButtonSize;
}) {
  const isLg = size === "lg";
  return (
    <div className="space-y-2 rounded-xl border bg-white p-3">
      <Button
        type="button"
        variant="outline"
        onClick={onClick}
        className={`min-h-14 w-full rounded-xl px-6 font-bold ${isLg ? "text-xl" : "text-base"}`}
      >
        <MapPin className={isLg ? "size-6" : "size-5"} aria-hidden />
        Usar mi ubicación
      </Button>
      {message && (
        <p
          role="status"
          className={`font-medium text-muted-foreground ${isLg ? "text-lg" : "text-base"}`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
