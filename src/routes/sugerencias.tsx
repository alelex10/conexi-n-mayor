import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/sugerencias")({
  head: () => ({
    meta: [
      { title: "Enviar sugerencia — Actividad Fácil Lo Prado" },
      {
        name: "description",
        content: "Cuéntenos qué actividad falta o qué error encontró en Actividad Fácil.",
      },
      { property: "og:title", content: "Enviar sugerencia — Actividad Fácil" },
      { property: "og:description", content: "Sugerencias y reportes de la comunidad de Lo Prado." },
    ],
  }),
  component: Sugerencias,
});

function Sugerencias() {
  const [enviado, setEnviado] = useState(false);
  const [mensaje, setMensaje] = useState("");

  return (
    <AppShell>
      <h1 className="mt-6 text-4xl font-extrabold leading-tight text-foreground">
        Enviar sugerencia
      </h1>
      <p className="mt-3 text-xl text-foreground">
        Escríbanos si falta una actividad o si algo no funciona bien.
      </p>

      {enviado ? (
        <p
          role="status"
          className="mt-6 flex items-start gap-3 rounded-2xl border-4 border-foreground bg-accent p-5 text-xl font-bold text-accent-foreground"
        >
          <CheckCircle2 aria-hidden className="mt-1 size-7 shrink-0" />
          ¡Gracias! Recibimos su mensaje.
        </p>
      ) : (
        <form
          className="mt-6 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setEnviado(true);
          }}
        >
          <label htmlFor="mensaje" className="text-xl font-bold text-foreground">
            Su mensaje
          </label>
          <textarea
            id="mensaje"
            required
            rows={6}
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            placeholder="Ejemplo: falta el taller de tejido de la junta de vecinos."
            className="rounded-xl border-4 border-border bg-card p-4 text-xl text-card-foreground placeholder:text-muted-foreground"
          />
          <label htmlFor="contacto" className="text-xl font-bold text-foreground">
            Su teléfono (opcional)
          </label>
          <input
            id="contacto"
            type="tel"
            className="min-h-14 rounded-xl border-4 border-border bg-card p-4 text-xl text-card-foreground"
          />
          <button
            type="submit"
            className="min-h-16 rounded-xl bg-primary px-4 text-2xl font-bold text-primary-foreground"
          >
            Enviar
          </button>
        </form>
      )}
    </AppShell>
  );
}
