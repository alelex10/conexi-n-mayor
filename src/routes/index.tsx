/* eslint-disable prettier/prettier */
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Accessibility,
  Car,
  Database,
  Lightbulb,
  MapPin,
  Megaphone,
  MessageSquare,
  Phone,
  Settings,
  TrainFront,
  Users,
  Volume2,
  Home,
} from "lucide-react";
import { useState } from "react";

import { listarActividades } from "@/lib/actividades.functions";
import {
  RADIO_OPCIONES,
  formatearDistancia,
  formatearFecha,
  type Actividad,
} from "@/data/actividades";
import { AppShell } from "@/components/AppShell";
import { ActividadCard } from "@/components/actividad-card";
import { BuscarActividadesChileCultura } from "@/components/buscar-actividades-chilecultura";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ciudad Viva Mayor" },
      {
        name: "description",
        content:
          "Ciudad Viva Mayor — actividades para personas mayores cerca de tu barrio y del metro.",
      },
      { property: "og:title", content: "Ciudad Viva Mayor" },
      {
        property: "og:description",
        content: "Encuentra actividades cercanas, gratuitas o de bajo costo, pensadas para ti.",
      },
    ],
  }),
  // Loader runs on the server (SSR) via Nitro/Cloudflare — uses Supabase via server function.
  // Falls back to mock data if SB_* env is not yet configured.
  // NOTA: este loader sigue Supabase-only (Supabase hoy vacío). La vista principal
  // del home es <BuscarActividadesChileCultura/> (API-only comuna 311 + región RM 1);
  // la búsqueda Groq (IA) queda en /comparar.
  // Región RM verificada = 1 (el viejo 13 era Magallanes).
  loader: async () => {
    try {
      const actividades = await listarActividades({
        data: { radioMetros: 2500, incluirExternos: false },
      });
      return { actividades, radioInicial: 2500 as number };
    } catch (e) {
      console.error("[index loader] failed to load actividades", e);
      return { actividades: [] as Actividad[], radioInicial: 2500 as number };
    }
  },
  component: CiudadVivaMayor,
});

function CiudadVivaMayor() {
  const { actividades: iniciales, radioInicial } = Route.useLoaderData();
  const [radio, setRadio] = useState<number>(radioInicial);
  const [actividades, setActividades] = useState<Actividad[]>(iniciales);
  const [cargando, setCargando] = useState(false);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [mostrarBarrio, setMostrarBarrio] = useState(false);

  // Temporal: listado del home oculto — se evalúa en /comparar. Poner en true para restaurar.
  const MOSTRAR_LISTADO_HOME = false;

  const actividadesBarrio = [...actividades]
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .slice(0, 10);

  const handleEscuchar = (texto: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(texto);
      utter.lang = "es-CL";
      utter.rate = 0.95;
      window.speechSynthesis.speak(utter);
    }
  };

  const cambiarRadio = async (valor: number) => {
    setRadio(valor);
    setCargando(true);
    setErrorCarga(null);
    try {
      const filtradas = await listarActividades({
        data: { radioMetros: valor, incluirExternos: false },
      });
      setActividades(filtradas);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No pudimos cargar las actividades.";
      setErrorCarga(msg);
    } finally {
      setCargando(false);
    }
  };

  const verActividadesBarrio = () => {
    setMostrarBarrio(true);
    // También filtra a 800m para coherencia con Supabase
    cambiarRadio(800);
    setTimeout(() => {
      document.getElementById("actividades-barrio")?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  // Ordenadas por distancia (el servidor ya ordena por fecha, re-ordenamos por cercanía para el listado principal)
  const ordenadas = [...actividades].sort((a, b) => a.distanciaMetros - b.distanciaMetros);

  return (
    <AppShell>
      <h1 className="py-6 text-center text-2xl font-extrabold leading-tight text-[#5D4037]">
        ¡Bienvenido! ¿Qué te gustaría hacer hoy?
      </h1>

      <div className="mt-2">
        <BuscarActividadesChileCultura />
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {/* Botón 1 - Actividades en mi barrio — filtra 800m + muestra lista barrio Lovable */}
        <button
          type="button"
          onClick={verActividadesBarrio}
          aria-pressed={radio === 800}
          className={`min-h-14 w-full rounded-2xl p-5 text-left shadow-sm transition-colors focus-visible:outline-4 focus-visible:outline-offset-2 ${
            radio === 800
              ? "bg-[#1B7A3D] ring-4 ring-[#1B7A3D]/30 focus-visible:outline-[#1B7A3D]"
              : "bg-[#1B7A3D] hover:bg-[#166534] active:bg-[#145A2E] focus-visible:outline-[#1B7A3D]"
          }`}
        >
          <span className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/15">
              <MapPin className="size-6 text-white" aria-hidden />
            </span>
            <span className="text-xl font-extrabold leading-tight text-white">
              ACTIVIDADES EN MI BARRIO
            </span>
          </span>
          <span className="mt-3 flex items-start gap-2 text-base leading-snug font-medium text-white">
            <Lightbulb className="mt-0.5 size-5 shrink-0 text-white" aria-hidden />
            <span>Muestra eventos a 2 o 3 cuadras caminando de tu casa.</span>
          </span>
        </button>

        {/* Botón 2 - Actividades cerca del metro — sets radio 1500 */}
        <button
          type="button"
          onClick={() => cambiarRadio(1500)}
          aria-pressed={radio === 1500}
          className={`min-h-14 w-full rounded-2xl p-5 text-left shadow-sm transition-colors focus-visible:outline-4 focus-visible:outline-offset-2 ${
            radio === 1500
              ? "bg-[#1E5A8A] ring-4 ring-[#1E5A8A]/30 focus-visible:outline-[#1E5A8A]"
              : "bg-[#1E5A8A] hover:bg-[#164A70] active:bg-[#133D5E] focus-visible:outline-[#1E5A8A]"
          }`}
        >
          <span className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/15">
              <TrainFront className="size-6 text-white" aria-hidden />
            </span>
            <span className="text-xl font-extrabold leading-tight text-white">
              ACTIVIDADES CERCA DEL METRO
            </span>
          </span>
          <span className="mt-3 flex items-start gap-2 text-base leading-snug font-medium text-white">
            <Lightbulb className="mt-0.5 size-5 shrink-0 text-white" aria-hidden />
            <span>Eventos cerca de estaciones de tren.</span>
          </span>
        </button>
      </div>

      {/* Filtro de distancia — WCAG AAA, botones 48dp, tab vertical, letra 18sp */}
      <section
        aria-labelledby="filtro-distancia"
        className="mt-6 rounded-2xl border-4 border-border bg-card p-4"
      >
        <h2 id="filtro-distancia" className="text-xl font-bold text-card-foreground">
          ¿Qué tan lejos puede ir?
        </h2>
        <p className="mt-1 text-lg text-muted-foreground">
          Elegí la distancia máxima desde tu casa.
        </p>
        <div className="mt-3 flex flex-col gap-3" role="group" aria-label="Filtro por distancia">
          {RADIO_OPCIONES.map((op) => {
            const activo = op.valor === radio;
            return (
              <button
                key={op.valor}
                onClick={() => cambiarRadio(op.valor)}
                aria-pressed={activo}
                className={`min-h-14 rounded-xl border-4 px-4 text-xl font-bold transition-colors focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                  activo
                    ? "border-foreground bg-primary text-primary-foreground"
                    : "border-border bg-card text-card-foreground hover:bg-accent"
                }`}
              >
                {op.etiqueta}
              </button>
            );
          })}
        </div>
        {cargando && (
          <p
            role="status"
            aria-live="polite"
            className="mt-3 text-lg font-medium text-muted-foreground"
          >
            Cargando actividades…
          </p>
        )}
        {errorCarga && (
          <p
            role="alert"
            className="mt-3 rounded-xl bg-destructive/10 p-3 text-lg font-bold text-destructive"
          >
            {errorCarga}
          </p>
        )}
      </section>

      {/* Sección naranja - Lo más cercano — OCULTA temporal (MOSTRAR_LISTADO_HOME) */}
      {MOSTRAR_LISTADO_HOME && (
        <section
          className="mt-6 overflow-hidden rounded-2xl shadow-sm"
          aria-labelledby="lo-mas-cercano"
        >
          <div className="bg-[#F57C00] p-3 text-center">
            <h2
              id="lo-mas-cercano"
              className="flex items-center justify-center gap-2 text-base font-extrabold tracking-wide text-white"
            >
              <Megaphone className="size-5 shrink-0" aria-hidden />
              <span>LO MÁS CERCANO (¡Empieza pronto!)</span>
            </h2>
          </div>

          <div className="space-y-4 bg-[#FFF3E0] p-4">
            <p className="text-center text-lg font-bold text-[#5D4037]" aria-live="polite">
              {ordenadas.length}{" "}
              {ordenadas.length === 1 ? "actividad cercana" : "actividades cercanas"} a{" "}
              {formatearDistancia(radio)}
            </p>

            {ordenadas.length === 0 && !cargando && (
              <div className="rounded-2xl border border-black/[0.06] bg-white p-6 text-center shadow-sm">
                <p className="text-xl font-bold text-foreground">
                  No hay actividades en esa distancia.
                </p>
                <p className="mt-2 text-lg text-muted-foreground">Probá con una distancia mayor.</p>
                <button
                  type="button"
                  onClick={() => cambiarRadio(2500)}
                  className="mt-4 min-h-14 rounded-xl bg-primary px-6 text-xl font-bold text-primary-foreground focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Ver hasta 2,5 km
                </button>
              </div>
            )}

            <ul className="space-y-4" aria-label="Listado de actividades">
              {ordenadas.map((a) => {
                const textoEscuchar = `${a.nombre}. ${formatearFecha(a.fecha)} a las ${a.hora} horas en ${a.lugar}. ${a.descripcion} A ${formatearDistancia(a.distanciaMetros)} de su casa. ${a.gratuito ? "Es gratuito." : `Valor ${a.precio ?? "a consultar"}.`} ${a.bano === "si" ? "Tiene baño." : a.bano === "no" ? "No tiene baño." : ""} ${a.estacionamiento === "si" ? "Tiene estacionamiento." : ""}`;
                return (
                  <li key={a.id}>
                    <ActividadCard
                      actividad={a}
                      etiquetaDetalle="Ver cómo llegar"
                      extras={
                        <div className="flex flex-wrap gap-2">
                          <ChipServicio icono={Accessibility} etiqueta="Baño" valor={a.bano} />
                          <ChipServicio icono={Car} etiqueta="Estacionamiento" valor={a.estacionamiento} />
                        </div>
                      }
                      acciones={
                        <button
                            type="button"
                            onClick={() => handleEscuchar(textoEscuchar)}
                            className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#2E7D32] px-4 text-lg font-bold text-white shadow-sm transition-colors hover:bg-[#256428] active:bg-[#1E4F22] focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#2E7D32]"
                            aria-label={`Escuchar información de ${a.nombre}`}
                          >
                            <Volume2 className="size-5 shrink-0" aria-hidden />
                            Escuchar
                          </button>
                      }
                    />
                  </li>
                );
              })}
            </ul>

            <Link
              to="/sugerencias"
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border-4 border-foreground bg-card px-4 text-xl font-bold text-card-foreground transition-colors hover:bg-accent focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <MessageSquare aria-hidden className="size-6" />
              Enviar sugerencia o reportar error
            </Link>
          </div>
        </section>
      )}

      {MOSTRAR_LISTADO_HOME && mostrarBarrio && (
        <section id="actividades-barrio" aria-labelledby="titulo-barrio" className="mt-6">
          <h2
            id="titulo-barrio"
            className="py-6 text-center text-2xl font-extrabold leading-tight text-[#5D4037]"
          >
            Actividades en tu barrio (Lo Prado)
          </h2>

          <div className="space-y-4">
            {actividadesBarrio.map((a) => {
              const textoEscuchar = `${formatearFecha(a.fecha)} a las ${a.hora}, ${a.nombre} en ${a.lugar}. ${
                a.gratuito ? "Es gratis." : `De pago${a.precio ? `, ${a.precio}` : ""}.`
              } Queda a ${formatearDistancia(a.distanciaMetros)} de su casa.`;
              return (
                <ActividadCard
                  key={a.id}
                  actividad={a}
                  etiquetaDetalle="Ver más"
                  acciones={
                    <>
                      <button
                        type="button"
                        onClick={() => handleEscuchar(textoEscuchar)}
                        className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#2E7D32] px-4 text-lg font-bold text-white shadow-sm transition-colors hover:bg-[#256428] active:bg-[#1E4F22] focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#2E7D32]"
                        aria-label={`Escuchar información de ${a.nombre}`}
                      >
                        <Volume2 className="size-5 shrink-0" aria-hidden />
                        Escuchar
                      </button>
                      {a.telefono && (
                        <a
                          href={`tel:${a.telefono}`}
                          className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#1565C0] px-4 text-lg font-bold text-white shadow-sm transition-colors hover:bg-[#104F9A] active:bg-[#0D3F7A] focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#1565C0]"
                          aria-label={`Llamar para consultar por ${a.nombre}`}
                        >
                          <Phone className="size-5 shrink-0" aria-hidden />
                          Llamar
                        </a>
                      )}
                    </>
                  }
                />
              );
            })}
          </div>
        </section>
      )}
    </AppShell>
  );
}

type ValorServicio = Actividad["bano"];

function ChipServicio({
  icono: Icono,
  etiqueta,
  valor,
}: {
  icono: typeof Car;
  etiqueta: string;
  valor: ValorServicio;
}) {
  const estilo =
    valor === "si"
      ? "bg-green-100 text-green-800"
      : valor === "no"
        ? "bg-red-100 text-red-800"
        : "bg-muted text-muted-foreground";
  const texto = valor === "si" ? "Sí" : valor === "no" ? "No" : "Sin info";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${estilo}`}>
      <Icono className="size-4" aria-hidden />
      {etiqueta}: {texto}
    </span>
  );
}
