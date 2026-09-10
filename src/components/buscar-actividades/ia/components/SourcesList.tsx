import { ExternalLink } from "lucide-react";
import type { BuscarResult } from "../types";

export function SourcesList({ sources }: { sources: NonNullable<BuscarResult["sources"]> }) {
  if (sources.length === 0) return null;
  return (
    <div className="rounded-lg border border-green-200 bg-green-50/50 p-3">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-green-800">
        <ExternalLink className="size-3.5" aria-hidden />
        Verified web sources (Google Search grounding)
      </p>
      <ul className="mt-1 space-y-1 text-sm">
        {sources.map((s) => (
          <li key={s.url} className="break-all">
            <a
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[#1E6CB4] underline hover:text-[#164F8A]"
            >
              <ExternalLink className="size-3 shrink-0" aria-hidden />
              {s.title || s.url}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
