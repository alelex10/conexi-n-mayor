import { AlertTriangle } from "lucide-react";

export function Warnings({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-800">
        <AlertTriangle className="size-3.5" aria-hidden />
        Warnings
      </p>
      <ul className="mt-1 list-disc pl-5 text-sm text-amber-900">
        {warnings.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ul>
    </div>
  );
}
