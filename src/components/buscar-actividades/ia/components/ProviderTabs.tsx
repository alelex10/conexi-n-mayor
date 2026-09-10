import { AI_PROVIDER_LABELS_EXTENDED } from "@/lib/ai/providers";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PROVIDER_DESCRIPTIONS, PROVIDER_ORDER } from "../constants";
import type { Proveedor } from "../types";

export function ProviderTabs({
  proveedor,
  onProveedorChange,
}: {
  proveedor: Proveedor;
  onProveedorChange: (p: Proveedor) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-base font-bold">Proveedor de IA</Label>
      <Tabs
        value={proveedor}
        onValueChange={(v) => onProveedorChange(v as Proveedor)}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-5">
          {PROVIDER_ORDER.map((p) => (
            <TabsTrigger key={p} value={p}>
              {AI_PROVIDER_LABELS_EXTENDED[p] ?? p}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <p className="text-sm text-muted-foreground">{PROVIDER_DESCRIPTIONS[proveedor]}</p>
    </div>
  );
}
