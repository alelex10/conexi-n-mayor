import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Bath, Car, Map, Phone, Bus } from "lucide-react";
import {
  ACTIVIDADES,
  RADIO_TAXIS,
  formatearDistancia,
  formatearFecha,
} from "@/data/actividades";

export const Route = createFileRoute("/actividad/$id")({
  loader: ({ params }) => {
    const actividad = ACTIVIDADES.find((a) => a.id === params.id);
    if (!actividad) throw notFound();
    return { actividad };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Actividad no encontrada — Actividad Fácil" }, { name: "robots", content: "noindex" }],
      };
    }
    const { actividad } = loaderData;
    const titulo = `${actividad.nombre} — Actividad Fácil Lo Prado`;
    const desc = `${actividad.lugar}, ${formatearFecha(actividad.fecha)} a las ${actividad.hora} horas.`;
    return {
      meta: [
        { title: titulo },
        { name: "description", content: desc },
        { property: "og:title", content: titulo },
        { property: "og:description", content: desc },
      ],
    };
  },
  component: Detalle,
  errorComponent: ({ error }) => (
    <p role="alert" className="p-6 text-xl text-foreground">
      {error.message}
    </p>
  ),
  notFoundComponent: () => (
    <div className="p-6">
      <p className="text-2xl font-bold text-foreground">No encontramos esta actividad.</p>
      <Link to="/" className="mt-4 inline-block text-xl font-bold underline">
        Volver al inicio
      </Link>
    </div>
  ),
});

function Dato({
  icono,
  titulo,
  valor,
}: {
  icono: React.ReactNode;
  titulo: string;
  valor: "si" | "no" | "sin_info";
}) {
  const texto = valor === "si" ? "Sí hay" : valor === "no" ? "No hay" : "Sin información";
  return (
    <div className="flex items-center gap-3 rounded-xl border-4 border-border bg-card p-4">
      <span aria-hidden className="text-card-foreground">
        {icono}
      </span>
      <p className="text-xl font-bold text-card-foreground">
        {titulo}: <span className="font-normal">{texto}</span>
      </p>
    </div>
  );
}

function Detalle() {
  const { actividad } = Route.useLoaderData();
  const destino = encodeURIComponent(actividad.direccion);
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destino}`;
  const uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=${destino}`;
  const cabifyUrl = `https://cabify.com/es-CL?destination=${destino}`;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16">
      <Link
        to="/"
        className="mt-6 inline-flex min-h-14 items-center gap-2 rounded-xl border-4 border-foreground bg-card px-4 text-xl font-bold text-card-foreground"
      >
        <ArrowLeft aria-hidden className="size-6" /> Volver
      </Link>

      <h1 className="mt-6 text-4xl font-extrabold leading-tight text-foreground">
        {actividad.nombre}
      </h1>

      <p
        className={`mt-4 inline-block rounded-lg px-4 py-2 text-xl font-bold ${
          actividad.gratuito
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-secondary-foreground"
        }`}
      >
        {actividad.gratuito ? "Gratuito" : `De pago · ${actividad.precio}`}
      </p>

      <div className="mt-6 rounded-2xl border-4 border-border bg-card p-5 text-xl text-card-foreground">
        <p>
          <strong>Cuándo:</strong> {formatearFecha(actividad.fecha)} a las {actividad.hora} horas
        </p>
        <p className="mt-3">
          <strong>Dónde:</strong> {actividad.lugar}
        </p>
        <p className="mt-1">{actividad.direccion}</p>
        <p className="mt-3">
          <strong>Distancia:</strong> a {formatearDistancia(actividad.distanciaMetros)} de su casa
        </p>
        <p className="mt-3">{actividad.descripcion}</p>
      </div>

      <h2 className="mt-8 text-2xl font-bold text-foreground">Servicios del lugar</h2>
      <div className="mt-3 flex flex-col gap-3">
        <Dato icono={<Bath className="size-8" />} titulo="Baño" valor={actividad.bano} />
        <Dato icono={<Car className="size-8" />} titulo="Estacionamiento" valor={actividad.estacionamiento} />
      </div>

      <h2 className="mt-8 text-2xl font-bold text-foreground">Cómo llegar</h2>
      <p className="mt-3 flex items-start gap-3 rounded-2xl border-4 border-border bg-card p-5 text-xl text-card-foreground">
        <Bus aria-hidden className="mt-1 size-7 shrink-0" />
        <span>{actividad.comoLlegar}</span>
      </p>

      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 flex min-h-16 items-center justify-center gap-3 rounded-xl bg-primary px-4 text-2xl font-bold text-primary-foreground"
      >
        <Map aria-hidden className="size-7" /> Abrir en Google Maps
      </a>

      <h2 className="mt-8 text-2xl font-bold text-foreground">Pedir un auto</h2>
      <div className="mt-3 flex flex-col gap-3">
        {RADIO_TAXIS.map((t) => (
          <a
            key={t.telefono}
            href={`tel:${t.telefono}`}
            className="flex min-h-16 items-center justify-center gap-3 rounded-xl bg-accent px-4 text-2xl font-bold text-accent-foreground"
          >
            <Phone aria-hidden className="size-7" /> Llamar a {t.nombre}
          </a>
        ))}
        <a
          href={uberUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-16 items-center justify-center rounded-xl border-4 border-foreground bg-card px-4 text-xl font-bold text-card-foreground"
        >
          Pedir Uber a esta actividad
        </a>
        <a
          href={cabifyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-16 items-center justify-center rounded-xl border-4 border-foreground bg-card px-4 text-xl font-bold text-card-foreground"
        >
          Pedir Cabify a esta actividad
        </a>
      </div>
    </div>
  );
}
