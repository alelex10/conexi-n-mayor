/**
 * Mock fallback dataset — used only when Supabase env (SB_URL / keys) is not configured.
 * Production data now lives in Supabase (supabase/schema.sql) and is fetched via
 * src/lib/actividades.functions.ts (listarActividades / obtenerActividad).
 * Keep RADIO_OPCIONES / RADIO_TAXIS / formateadores — they are still used by the UI.
 * @deprecated for data — keep for types, formatters and offline fallback.
 */
export type Actividad = {
  id: string;
  nombre: string;
  fecha: string; // ISO date
  hora: string;
  lugar: string;
  direccion: string;
  gratuito: boolean;
  precio?: string;
  distanciaMetros: number;
  bano: "si" | "no" | "sin_info";
  estacionamiento: "si" | "no" | "sin_info";
  comoLlegar: string;
  categoria: string;
  descripcion: string;
  estado?: "borrador" | "publicada" | "archivada";
};

export const RADIO_OPCIONES = [
  { valor: 800, etiqueta: "Caminando (800 m)" },
  { valor: 1500, etiqueta: "Cerca (1,5 km)" },
  { valor: 2500, etiqueta: "En micro (2,5 km)" },
];

export const RADIO_TAXIS = [
  { nombre: "Radio Taxi Lo Prado", telefono: "+56227741234" },
  { nombre: "Radio Taxi Las Rejas", telefono: "+56227765432" },
  { nombre: "Radio Taxi Pudahuel", telefono: "+56227789900" },
];

export const ACTIVIDADES: Actividad[] = [
  {
    id: "taller-memoria",
    nombre: "Taller de memoria y juegos",
    fecha: "2026-08-25",
    hora: "10:30",
    lugar: "Centro Cultural Lo Prado",
    direccion: "San Pablo 5850, Lo Prado, Santiago",
    gratuito: true,
    distanciaMetros: 550,
    bano: "si",
    estacionamiento: "si",
    comoLlegar: "Llegar en micro J10, bajarse en San Pablo con Las Rejas. Camine media cuadra hacia el poniente.",
    categoria: "Salud y mente",
    descripcion:
      "Ejercicios entretenidos de memoria, lectura y juegos de mesa. Se entrega café y galletas. No necesita inscribirse.",
    estado: "publicada",
  },
  {
    id: "gimnasia-entretenida",
    nombre: "Gimnasia entretenida al aire libre",
    fecha: "2026-08-26",
    hora: "09:00",
    lugar: "Plaza Buzeta",
    direccion: "Buzeta 1500, Lo Prado, Santiago",
    gratuito: true,
    distanciaMetros: 780,
    bano: "sin_info",
    estacionamiento: "no",
    comoLlegar: "A 8 cuadras caminando desde la Municipalidad. También pasa la micro 405 por Buzeta.",
    categoria: "Ejercicio",
    descripcion:
      "Clase suave de 45 minutos con monitora del programa Adulto Mayor. Traiga agua y ropa cómoda.",
    estado: "publicada",
  },
  {
    id: "baile-entretenido",
    nombre: "Tarde de baile y cueca",
    fecha: "2026-08-27",
    hora: "16:00",
    lugar: "Sede Junta de Vecinos N°12",
    direccion: "Las Rejas Norte 1200, Lo Prado, Santiago",
    gratuito: false,
    precio: "$1.000 por persona",
    distanciaMetros: 1400,
    bano: "si",
    estacionamiento: "sin_info",
    comoLlegar: "Micro I09 hasta Las Rejas Norte con Mapocho. La sede está frente al almacén.",
    categoria: "Recreación",
    descripcion: "Música en vivo, baile y once compartida. Aporte voluntario para la once.",
    estado: "publicada",
  },
  {
    id: "control-salud",
    nombre: "Control de presión y azúcar",
    fecha: "2026-08-28",
    hora: "09:30",
    lugar: "CESFAM Lo Prado",
    direccion: "Av. San Pablo 6550, Lo Prado, Santiago",
    gratuito: true,
    distanciaMetros: 2100,
    bano: "si",
    estacionamiento: "si",
    comoLlegar: "Micro J10 o 405 por San Pablo. Bajarse en el paradero del CESFAM, sin transbordos.",
    categoria: "Salud",
    descripcion: "Toma de presión, medición de azúcar y orientación de enfermería. Lleve su cédula de identidad.",
    estado: "publicada",
  },
  {
    id: "taller-celular",
    nombre: "Aprenda a usar su celular",
    fecha: "2026-08-29",
    hora: "11:00",
    lugar: "Biblioteca Municipal de Lo Prado",
    direccion: "San Pablo 5960, Lo Prado, Santiago",
    gratuito: true,
    distanciaMetros: 620,
    bano: "si",
    estacionamiento: "no",
    comoLlegar: "A 6 cuadras caminando por San Pablo hacia el oriente. Vereda plana y con semáforos.",
    categoria: "Aprendizaje",
    descripcion: "Taller paso a paso: llamadas, WhatsApp y fotos. Traiga su celular cargado.",
    estado: "publicada",
  },
];

export function formatearFecha(fechaISO: string) {
  const partes = fechaISO.split("-").map(Number);
  const fecha = new Date(partes[0] ?? 2026, (partes[1] ?? 1) - 1, partes[2] ?? 1);
  const texto = fecha.toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function formatearDistancia(metros: number) {
  return metros < 1000 ? `${metros} metros` : `${(metros / 1000).toFixed(1).replace(".", ",")} km`;
}
