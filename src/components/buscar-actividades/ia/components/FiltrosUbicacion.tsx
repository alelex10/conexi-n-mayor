import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UseLocationButton } from "@/components/common/UseLocationButton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIAS } from "../constants";

export function FiltrosUbicacion({
  ubicacion,
  onUbicacionChange,
  radioMetros,
  onRadioMetrosChange,
  categoria,
  onCategoriaChange,
  fechaDesde,
  onFechaDesdeChange,
  locationMessage,
  onUseDeviceLocation,
}: {
  ubicacion: string;
  onUbicacionChange: (v: string) => void;
  radioMetros: string;
  onRadioMetrosChange: (v: string) => void;
  categoria: string;
  onCategoriaChange: (v: string) => void;
  fechaDesde: string;
  onFechaDesdeChange: (v: string) => void;
  locationMessage: string | null;
  onUseDeviceLocation: () => void;
}) {
  return (
    <div className="space-y-4 rounded-xl border-2 border-border bg-muted/30 p-4">
      <div className="space-y-2">
        <Label htmlFor="ubicacion" className="text-base font-bold">
          Ubicación <span className="text-destructive">*</span>
        </Label>
        <div className="flex gap-2">
          <Input
            id="ubicacion"
            value={ubicacion}
            onChange={(e) => onUbicacionChange(e.target.value)}
            placeholder="Ej: Lo Prado, Santiago, Chile"
            className="min-h-12 flex-1 bg-white text-base"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Podés usar barrio, comuna o dirección (ej. &quot;Providencia, Santiago&quot;, &quot;San
          Pablo 5850, Lo Prado&quot;).
        </p>
        <UseLocationButton onClick={onUseDeviceLocation} message={locationMessage} size="sm" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="radio" className="text-sm font-bold">
            Radio (metros)
          </Label>
          <Input
            id="radio"
            type="number"
            inputMode="numeric"
            placeholder="Ej: 2500"
            value={radioMetros}
            onChange={(e) => onRadioMetrosChange(e.target.value)}
            className="min-h-10 bg-white"
            min={100}
            max={20000}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="categoria" className="text-sm font-bold">
            Categoría
          </Label>
          <Select
            value={categoria || "todas"}
            onValueChange={(v) => onCategoriaChange(v === "todas" ? "" : v)}
          >
            <SelectTrigger id="categoria" className="min-h-10 bg-white">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIAS.map((c) => (
                <SelectItem key={c.value || "todas"} value={c.value || "todas"}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fechaDesde" className="text-sm font-bold">
            Desde (YYYY-MM-DD)
          </Label>
          <Input
            id="fechaDesde"
            type="date"
            value={fechaDesde}
            onChange={(e) => onFechaDesdeChange(e.target.value)}
            className="min-h-10 bg-white"
          />
        </div>
      </div>
    </div>
  );
}
