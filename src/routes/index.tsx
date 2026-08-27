import { createFileRoute } from "@tanstack/react-router";
import {
  Accessibility,
  Car,
  Clock,
  DollarSign,
  Home,
  Lightbulb,
  MapPin,
  Megaphone,
  Phone,
  Settings,
  TrainFront,
  Users,
  Volume2,
} from "lucide-react";

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
  component: CiudadVivaMayor,
});

function CiudadVivaMayor() {
  const handleEscuchar = (texto: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(texto);
      utter.lang = "es-CL";
      utter.rate = 0.95;
      window.speechSynthesis.speak(utter);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Header azul */}
      <header className="sticky top-0 z-10 flex items-center justify-between bg-[#1E6CB4] px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#FFECB3] shadow-sm ring-2 ring-white/15">
            <Users className="size-6 text-[#5D4037]" aria-hidden />
          </div>
          <span className="text-xl font-extrabold leading-none tracking-tight text-white">
            Ciudad Viva Mayor
          </span>
        </div>

        <button
          type="button"
          aria-label="Ajustes"
          className="flex flex-col items-center gap-0.5 rounded-xl px-2 py-1 text-white transition-colors hover:bg-white/10 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <Settings className="size-7" aria-hidden />
          <span className="text-xs font-semibold leading-none">Ajustes</span>
        </button>
      </header>

      {/* Contenido principal beige claro */}
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-6">
        <h1 className="py-6 text-center text-2xl font-extrabold leading-tight text-[#5D4037]">
          ¡Bienvenido! ¿Qué te gustaría hacer hoy?
        </h1>

        <div className="flex flex-col gap-4">
          {/* Botón 1 - Actividades en mi barrio */}
          <button
            type="button"
            className="min-h-14 w-full rounded-2xl bg-[#1B7A3D] p-5 text-left shadow-sm transition-colors hover:bg-[#166534] active:bg-[#145A2E] focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#1B7A3D]"
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

          {/* Botón 2 - Actividades cerca del metro */}
          <button
            type="button"
            className="min-h-14 w-full rounded-2xl bg-[#1E5A8A] p-5 text-left shadow-sm transition-colors hover:bg-[#164A70] active:bg-[#133D5E] focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#1E5A8A]"
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

        {/* Sección naranja - Lo más cercano */}
        <section className="mt-6 overflow-hidden rounded-2xl shadow-sm" aria-labelledby="lo-mas-cercano">
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
            {/* Card 1 */}
            <article className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3">
                <div className="space-y-2">
                  <h3 className="flex items-center gap-2 text-lg font-extrabold leading-tight text-[#EF6C00]">
                    <Clock className="size-5 shrink-0" aria-hidden />
                    <span>Hoy 4:00 PM - Gimnasia de Oro</span>
                  </h3>
                  <p className="flex items-center gap-2 text-[15px] font-medium leading-snug text-[#424242]">
                    <MapPin className="size-4 shrink-0 text-[#616161]" aria-hidden />
                    <span>Centro Comunitario (2 cuadras)</span>
                  </p>
                  <p className="flex items-center gap-2 text-[15px] font-medium leading-snug text-[#616161]">
                    <DollarSign className="size-4 shrink-0" aria-hidden />
                    <span>¡ES GRATIS!</span>
                  </p>
                  <p className="flex items-center gap-2 text-[15px] font-medium leading-snug text-[#616161]">
                    <Accessibility className="size-4 shrink-0" aria-hidden />
                    <span>Rampa de Acceso</span>
                  </p>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() =>
                      handleEscuchar(
                        "Hoy a las 4 de la tarde, Gimnasia de Oro en el Centro Comunitario a 2 cuadras. Es gratis y tiene rampa de acceso.",
                      )
                    }
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[#2E7D32] px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#256428] active:bg-[#1E4F22] focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#2E7D32]"
                    aria-label="Escuchar información de Gimnasia de Oro"
                  >
                    <Volume2 className="size-4 shrink-0" aria-hidden />
                    Escuchar
                  </button>
                </div>
              </div>
            </article>

            {/* Card 2 */}
            <article className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3">
                <div className="space-y-2">
                  <h3 className="flex items-center gap-2 text-lg font-extrabold leading-tight text-[#1565C0]">
                    <Clock className="size-5 shrink-0" aria-hidden />
                    <span>Mañana 10:00 AM - Cine Club Mayor</span>
                  </h3>
                  <p className="flex items-center gap-2 text-[15px] font-medium leading-snug text-[#424242]">
                    <TrainFront className="size-4 shrink-0 text-[#616161]" aria-hidden />
                    <span>Junto a Estación Central</span>
                  </p>
                  <p className="flex items-center gap-2 text-[15px] font-medium leading-snug text-[#616161]">
                    <DollarSign className="size-4 shrink-0" aria-hidden />
                    <span>$1.500</span>
                  </p>
                  <p className="flex items-center gap-2 text-[15px] font-medium leading-snug text-[#616161]">
                    <Car className="size-4 shrink-0" aria-hidden />
                    <span>Estacionamiento</span>
                  </p>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() =>
                      handleEscuchar(
                        "Mañana a las 10 de la mañana, Cine Club Mayor junto a Estación Central. Valor mil quinientos pesos. Tiene estacionamiento.",
                      )
                    }
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[#1565C0] px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#104F9A] active:bg-[#0D3F7A] focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#1565C0]"
                    aria-label="Escuchar información de Cine Club Mayor"
                  >
                    <Volume2 className="size-4 shrink-0" aria-hidden />
                    Escuchar
                  </button>
                </div>
              </div>
            </article>
          </div>
        </section>
      </main>

      {/* Footer gris oscuro */}
      <footer className="bg-[#263238] px-4 py-4">
        <div className="mx-auto flex max-w-2xl justify-center gap-3">
          <button
            type="button"
            className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-[#EF6C00] px-6 py-3 text-sm font-extrabold leading-tight text-white shadow-sm transition-colors hover:bg-[#E65100] active:bg-[#BF360C] focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <Home className="size-5 shrink-0" aria-hidden />
            <span>VOLVER A INICIO</span>
          </button>
          <button
            type="button"
            className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-[#C62828] px-6 py-3 text-sm font-extrabold leading-tight text-white shadow-sm transition-colors hover:bg-[#B71C1C] active:bg-[#8E1A1A] focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <Phone className="size-5 shrink-0" aria-hidden />
            <span>AYUDA DIRECTA</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
