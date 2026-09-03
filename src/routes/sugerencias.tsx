import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { enviarSugerencia } from "@/lib/actividades.functions";
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
      {
        property: "og:description",
        content: "Sugerencias y reportes de la comunidad de Lo Prado.",
      },
    ],
  }),
  component: Sugerencias,
});

type TipoSugerencia = "sugerencia" | "error" | "actividad";

function Sugerencias() {
  const [enviado, setEnviado] = useState(false);
  const [tipo, setTipo] = useState<TipoSugerencia>("sugerencia");
  const [nombre, setNombre] = useState("");
  const [contacto, setContacto] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mensaje.trim().length < 5) {
      setErrorMsg("Escribí al menos 5 caracteres en tu mensaje.");
      return;
    }
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await enviarSugerencia({
        data: {
          tipo,
          nombre: nombre.trim() || undefined,
          contacto: contacto.trim() || undefined,
          mensaje: mensaje.trim(),
        },
      });
      setEnviado(true);
      toast.success("¡Gracias! Recibimos tu mensaje.");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "No pudimos enviar tu mensaje. Probá de nuevo.";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell>
      <Link
        to="/"
        className="mt-6 inline-flex min-h-14 items-center gap-2 rounded-xl border-4 border-foreground bg-card px-4 text-xl font-bold text-card-foreground focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <ArrowLeft aria-hidden className="size-6" /> Volver
      </Link>

      <h1 className="mt-6 text-4xl font-extrabold leading-tight text-foreground">
        Enviar sugerencia
      </h1>
      <p className="mt-3 text-xl text-foreground">
        Escróbanos si falta una actividad o si algo no funciona bien.
      </p>

      {enviado ? (
        <p
          role="status"
          className="mt-6 flex items-start gap-3 rounded-2xl border-4 border-foreground bg-accent p-5 text-xl font-bold text-accent-foreground"
        >
          <CheckCircle2 aria-hidden className="mt-1 size-7 shrink-0" />
          ¡Gracias! Recibimos su mensaje. Lo revisaremos pronto.
        </p>
      ) : (
        <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <label htmlFor="tipo" className="text-xl font-bold text-foreground">
            Tipo de mensaje
          </label>
          <select
            id="tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoSugerencia)}
            className="min-h-14 rounded-xl border-4 border-border bg-card p-4 text-xl text-card-foreground focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <option value="sugerencia">Sugerencia</option>
            <option value="error">Reportar error</option>
            <option value="actividad">Proponer actividad</option>
          </select>

          <label htmlFor="mensaje" className="text-xl font-bold text-foreground">
            Su mensaje{" "}
            <span aria-hidden className="text-destructive">
              *
            </span>
          </label>
          <textarea
            id="mensaje"
            required
            rows={6}
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            placeholder="Ejemplo: falta el taller de tejido de la junta de vecinos."
            aria-required="true"
            aria-describedby={errorMsg ? "form-error" : undefined}
            className="rounded-xl border-4 border-border bg-card p-4 text-xl text-card-foreground placeholder:text-muted-foreground focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />

          <label htmlFor="nombre" className="text-xl font-bold text-foreground">
            Su nombre (opcional)
          </label>
          <input
            id="nombre"
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: María González"
            autoComplete="name"
            className="min-h-14 rounded-xl border-4 border-border bg-card p-4 text-xl text-card-foreground placeholder:text-muted-foreground focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />

          <label htmlFor="contacto" className="text-xl font-bold text-foreground">
            Su teléfono (opcional)
          </label>
          <input
            id="contacto"
            type="tel"
            value={contacto}
            onChange={(e) => setContacto(e.target.value)}
            placeholder="Ej: +56 9 1234 5678"
            autoComplete="tel"
            inputMode="tel"
            className="min-h-14 rounded-xl border-4 border-border bg-card p-4 text-xl text-card-foreground placeholder:text-muted-foreground focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />

          {errorMsg && (
            <p
              id="form-error"
              role="alert"
              className="rounded-xl bg-destructive/10 p-3 text-lg font-bold text-destructive"
            >
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            aria-disabled={isSubmitting}
            className="min-h-16 rounded-xl bg-primary px-4 text-2xl font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {isSubmitting ? "Enviando…" : "Enviar"}
          </button>

          <p className="text-base text-muted-foreground">
            Usaremos tu contacto solo para responderte si es necesario.
          </p>
        </form>
      )}
    </AppShell>
  );
}
