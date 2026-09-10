import { Clock3, Loader2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BuscarResult } from "../types";

export function SearchActions({
  buscando,
  disabled,
  onSearch,
  searchText,
  searchingText,
  buttonClassName,
  iconClassName,
  showMeta,
  elapsedMs,
  modeloActual,
  result,
}: {
  buscando: boolean;
  disabled: boolean;
  onSearch: () => void;
  searchText: string;
  searchingText: string;
  buttonClassName: string;
  iconClassName: string;
  showMeta: boolean;
  elapsedMs: number | null;
  modeloActual: string;
  result: BuscarResult | null;
}) {
  return (
    <div className={showMeta ? "flex flex-wrap items-center gap-3" : undefined}>
      <Button type="button" onClick={onSearch} disabled={disabled} className={buttonClassName}>
        {buscando ? (
          <>
            <Loader2 className={`${iconClassName} animate-spin`} aria-hidden />
            {searchingText}
          </>
        ) : (
          <>
            <Search className={iconClassName} aria-hidden />
            {searchText}
          </>
        )}
      </Button>
      {showMeta && elapsedMs !== null && !buscando && (
        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock3 className="size-4" aria-hidden />
          {elapsedMs} ms · modelo:{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{modeloActual}</code>
        </span>
      )}
      {showMeta && result && (
        <Badge variant="secondary" className="text-xs">
          {result.total} resultado{result.total === 1 ? "" : "s"} · confidence{" "}
          {result.confidence.toFixed(2)}
        </Badge>
      )}
    </div>
  );
}
