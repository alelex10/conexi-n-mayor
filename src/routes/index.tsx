import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Footprints, MapPin, Clock, ArrowRight, MessageSquare } from "lucide-react";
import {
  ACTIVIDADES,
  RADIO_OPCIONES,
  formatearDistancia,
  formatearFecha,
} from "@/data/actividades";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Actividad Fácil — Actividades para adultos mayores en Lo Prado" },
      {
        name: "description",
        content:
          "Encuentre actividades gratuitas o de bajo costo cerca de su casa en Lo Prado, Santiago. Sin registro, letra grande y fácil de usar.",
      },
      { property: "og:title", content: "Actividad Fácil — Lo Prado" },
      {
        property: "og:description",
        content: "Actividades cercanas para adultos mayores en la comuna de Lo Prado.",
      },
    ],
  }),
  component: Inicio,
});

function Inicio() {
  const [radio, setRadio] = useState(2500);
  const actividades = ACTIVIDADES.filter((a) => a.distanciaMetros <= radio).sort(
    (a, b) => a.distanciaMetros - b.distanciaMetros,
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16">
      <header className="py-6">
        <h1 className="text-4xl font-extrabold leading-tight text-foreground">Actividad Fácil</h1>
        <p className="mt-2 text-xl text-foreground">
          Actividades cerca de usted en <strong>Lo Prado</strong>.
        </p>
      </header>

      <section aria-labelledby="filtro-distancia" className="rounded-2xl bg-accent p-4">
        <h2 id="filtro-distancia" className="text-xl font-bold text-accent-foreground">
          ¿Qué tan lejos puede ir?
        </h2>
        <div className="mt-3 flex flex-col gap-3">
          {RADIO_OPCIONES.map((op) => {
            const activo = op.valor === radio;
            return (
              <button
                key={op.valor}
                onClick={() => setRadio(op.valor)}
                aria-pressed={activo}
                className={`min-h-14 rounded-xl border-4 px-4 text-xl font-bold transition-colors ${
                  activo
                    ? "border-foreground bg-primary text-primary-foreground"
                    : "border-border bg-card text-card-foreground"
                }`}
              >
                {op.etiqueta}
              </button>
            );
          })}
        </div>
      </section>

      <h2 className="mt-8 text-2xl font-bold text-foreground">
        {actividades.length} actividades cercanas
      </h2>

      <ul className="mt-4 flex flex-col gap-6">
        {actividades.map((a) => (
          <li key={a.id}>
            <Link
              to="/actividad/$id"
              params={{ id: a.id }}
              className="block rounded-2xl border-4 border-border bg-card p-5 focus-visible:outline-4 focus-visible:outline-ring"
            >
              <span
                className={`inline-block rounded-lg px-3 py-1 text-lg font-bold ${
                  a.gratuito ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                }`}
              >
                {a.gratuito ? "Gratuito" : `De pago · ${a.precio}`}
              </span>
              <h3 className="mt-3 text-3xl font-extrabold leading-tight text-card-foreground">
                {a.nombre}
              </h3>
              <p className="mt-3 flex items-start gap-2 text-xl text-card-foreground">
                <Clock aria-hidden className="mt-1 size-6 shrink-0" />
                <span>
                  {formatearFecha(a.fecha)} · {a.hora} horas
                </span>
              </p>
              <p className="mt-2 flex items-start gap-2 text-xl text-card-foreground">
                <MapPin aria-hidden className="mt-1 size-6 shrink-0" />
                <span>{a.lugar}</span>
              </p>
              <p className="mt-2 flex items-start gap-2 text-xl text-card-foreground">
                <Footprints aria-hidden className="mt-1 size-6 shrink-0" />
                <span>A {formatearDistancia(a.distanciaMetros)} de su casa</span>
              </p>
              <span className="mt-4 flex min-h-14 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xl font-bold text-primary-foreground">
                Ver cómo llegar <ArrowRight aria-hidden className="size-6" />
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {actividades.length === 0 && (
        <p className="mt-6 text-xl text-foreground">
          No hay actividades en esa distancia. Pruebe con una distancia mayor.
        </p>
      )}

      <Link
        to="/sugerencias"
        className="mt-10 flex min-h-14 items-center justify-center gap-3 rounded-xl border-4 border-foreground bg-card px-4 text-xl font-bold text-card-foreground"
      >
        <MessageSquare aria-hidden className="size-6" />
        Enviar sugerencia o reportar error
      </Link>
    </div>
  );
}
