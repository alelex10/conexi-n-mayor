import type { GroqModelUI } from "../types";

export function ModeloMeta({ meta }: { meta: GroqModelUI }) {
  return (
    <div className="grid gap-2 rounded-lg bg-white p-3 text-sm leading-snug sm:grid-cols-2">
      <p className="col-span-2 text-sm text-muted-foreground">{meta.description}</p>
      <p>
        <span className="font-bold">Contexto:</span> {meta.contextWindow.toLocaleString("es-CL")}{" "}
        tokens
      </p>
      <p>
        <span className="font-bold">Visión:</span> {meta.vision ? "Sí" : "No"}
      </p>
      <p>
        <span className="font-bold">Precio:</span>{" "}
        {meta.pricing ?? `${meta.pricingIn ?? "—"} in / ${meta.pricingOut ?? "—"} out`}
      </p>
      <p className="col-span-2 font-mono text-xs text-muted-foreground">id: {meta.id}</p>
    </div>
  );
}
