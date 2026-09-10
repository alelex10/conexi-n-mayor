import { Sparkles } from "lucide-react";

export function RawJson({ raw }: { raw: unknown }) {
  return (
    <details className="rounded-lg border bg-muted/20 p-3">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-bold">
        <Sparkles className="size-4 text-[#1E6CB4]" aria-hidden />
        Ver JSON completo
      </summary>
      <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white p-3 font-mono text-xs leading-snug">
        {JSON.stringify(raw, null, 2)}
      </pre>
    </details>
  );
}
