import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { GroqModelUI, Proveedor, ProviderKeyStatus } from "../types";
import { ModeloMeta } from "./ModeloMeta";
import { ProviderBadges } from "./ProviderBadges";

export function ModeloSelector({
  proveedor,
  nombreProveedor,
  modelosActuales,
  modeloActual,
  onModeloChange,
  loadingModelos,
  keyStatus,
  selectedMeta,
}: {
  proveedor: Proveedor;
  nombreProveedor: string;
  modelosActuales: GroqModelUI[];
  modeloActual: string;
  onModeloChange: (id: string) => void;
  loadingModelos: boolean;
  keyStatus: ProviderKeyStatus;
  selectedMeta: GroqModelUI | null;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor="modelo-groq" className="text-base font-bold">
          Modelo {nombreProveedor}
        </Label>
        <div className="flex flex-wrap items-center gap-2">
          <ProviderBadges proveedor={proveedor} status={keyStatus} />
        </div>
      </div>

      {loadingModelos && proveedor === "groq" ? (
        <div className="flex items-center gap-2 text-base text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Cargando modelos…
        </div>
      ) : (
        <Select value={modeloActual} onValueChange={onModeloChange}>
          <SelectTrigger id="modelo-groq" className="min-h-12 w-full bg-white text-left text-base">
            <SelectValue placeholder="Elegí un modelo" />
          </SelectTrigger>
          <SelectContent>
            {modelosActuales.map((m) => (
              <SelectItem key={m.id} value={m.id} className="py-2">
                <span className="flex flex-col items-start gap-1">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-bold">
                    {m.label}
                    {m.recommended && (
                      <Badge className="bg-[#1E6CB4] text-white border-transparent text-xs">
                        Recomendado
                      </Badge>
                    )}
                    {m.vision && (
                      <Badge
                        variant="outline"
                        className="border-green-300 bg-green-50 text-green-700 text-xs"
                      >
                        Visión
                      </Badge>
                    )}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">{m.id}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {selectedMeta && <ModeloMeta meta={selectedMeta} />}

      <p className="text-sm text-muted-foreground">
        La selección se envía al servidor con cada búsqueda. Variables{" "}
        <code className="rounded bg-white px-1">AI_EXTRACTOR_MODEL</code> /{" "}
        <code className="rounded bg-white px-1">GROQ_MODEL_OVERRIDE</code> /{" "}
        <code className="rounded bg-white px-1">GROQ_MODEL</code> quedan como fallback.
      </p>
    </>
  );
}
