import { AlertTriangle } from "lucide-react";

/**
 * Shared form/search error. Canonical simple style is the `<p role="alert">`
 * used in CleanSearchView / ChileCulturaTab / index / sugerencias
 * (`rounded-xl bg-destructive/10 p-3 text-lg font-bold text-destructive`).
 * When `title` or `hint` is present it renders the richer FullSearchView
 * card (border-2, title row with icon, message, tip) with identical copy.
 */
export function FormError({
  message,
  title,
  hint,
  className = "",
  id,
}: {
  message: string;
  title?: string;
  hint?: string;
  className?: string;
  id?: string;
}) {
  if (title || hint) {
    return (
      <div
        role="alert"
        className={`rounded-xl border-2 border-destructive/30 bg-destructive/10 p-4${className ? ` ${className}` : ""}`}
      >
        <p className="flex items-center gap-2 text-base font-bold text-destructive">
          <AlertTriangle className="size-5" aria-hidden />
          {title ?? "Error"}
        </p>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-snug text-destructive/90">
          {message}
        </p>
        {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
      </div>
    );
  }
  return (
    <p
      {...(id ? { id } : {})}
      role="alert"
      className={`rounded-xl bg-destructive/10 p-3 text-lg font-bold text-destructive${className ? ` ${className}` : ""}`}
    >
      {message}
    </p>
  );
}
