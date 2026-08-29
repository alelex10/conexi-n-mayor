import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { Actividad } from "@/data/actividades";

type FilaActividad = {
  id: string;
  nombre: string;
  fecha: string;
  hora: string;
  lugar: string;
  direccion: string;
  gratuito: boolean;
  precio: string | null;
  distancia_metros: number;
  bano: "si" | "no" | "sin_info";
  estacionamiento: "si" | "no" | "sin_info";
  como_llegar: string;
  categoria: string;
  descripcion: string;
  estado?: "borrador" | "publicada" | "archivada" | null;
};

function aActividad(fila: FilaActividad): Actividad {
  return {
    id: fila.id,
    nombre: fila.nombre,
    fecha: fila.fecha,
    hora: fila.hora?.slice(0, 5) ?? "",
    lugar: fila.lugar,
    direccion: fila.direccion,
    gratuito: fila.gratuito,
    ...(fila.precio ? { precio: fila.precio } : {}),
    distanciaMetros: fila.distancia_metros,
    bano: fila.bano,
    estacionamiento: fila.estacionamiento,
    comoLlegar: fila.como_llegar,
    categoria: fila.categoria,
    descripcion: fila.descripcion,
    ...(fila.estado ? { estado: fila.estado } : { estado: "publicada" as const }),
  };
}

const COLUMNAS =
  "id, nombre, fecha, hora, lugar, direccion, gratuito, precio, distancia_metros, bano, estacionamiento, como_llegar, categoria, descripcion, estado";

/** Returns true if the error is due to missing SB_* env (build without secrets). */
function isMissingEnvError(e: unknown): boolean {
  return e instanceof Error && e.message.includes("Missing required server secret");
}

/** Lista las actividades publicadas, opcionalmente filtradas por radio en metros. */
export const listarActividades = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z.object({ radioMetros: z.number().int().positive().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data }): Promise<Actividad[]> => {
    try {
      const { getPublicClient } = await import("./supabase.server");
      let consulta = getPublicClient()
        .from("actividades")
        .select(COLUMNAS)
        .eq("estado", "publicada")
        .order("fecha", { ascending: true })
        .order("hora", { ascending: true });

      if (data.radioMetros) consulta = consulta.lte("distancia_metros", data.radioMetros);

      const { data: filas, error } = await consulta;
      if (error) throw new Error(error.message);
      return ((filas ?? []) as FilaActividad[]).map(aActividad);
    } catch (e) {
      if (isMissingEnvError(e)) {
        // Fallback to mock data when Supabase env is not configured (local build / preview without secrets).
        // This keeps the UI functional before the human runs schema.sql + sets secrets.
        console.warn("[actividades.functions] Supabase not configured — falling back to mock data.", e);
        const { ACTIVIDADES } = await import("@/data/actividades");
        const limite = data.radioMetros;
        const filtradas = limite ? ACTIVIDADES.filter((a) => a.distanciaMetros <= limite) : ACTIVIDADES;
        return [...filtradas].sort((a, b) => a.distanciaMetros - b.distanciaMetros);
      }
      throw e;
    }
  });

/** Obtiene una actividad publicada por su id. */
export const obtenerActividad = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ id: z.string().min(1) }).parse(input))
  .handler(async ({ data }): Promise<Actividad | null> => {
    try {
      const { getPublicClient } = await import("./supabase.server");
      const { data: fila, error } = await getPublicClient()
        .from("actividades")
        .select(COLUMNAS)
        .eq("estado", "publicada")
        .eq("id", data.id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return fila ? aActividad(fila as FilaActividad) : null;
    } catch (e) {
      if (isMissingEnvError(e)) {
        console.warn("[actividades.functions] Supabase not configured — falling back to mock for obtenerActividad.", e);
        const { ACTIVIDADES } = await import("@/data/actividades");
        return ACTIVIDADES.find((a) => a.id === data.id) ?? null;
      }
      throw e;
    }
  });

const sugerenciaSchema = z.object({
  tipo: z.enum(["sugerencia", "error", "actividad"]).default("sugerencia"),
  nombre: z.string().trim().max(120).optional(),
  contacto: z.string().trim().max(160).optional(),
  mensaje: z.string().trim().min(5).max(2000),
});

/** Guarda una sugerencia, reporte de error o propuesta de actividad. */
export const enviarSugerencia = createServerFn({ method: "POST" })
  .validator((input: unknown) => sugerenciaSchema.parse(input))
  .handler(async ({ data }) => {
    const { getAdminClient } = await import("./supabase.server");
    const { error } = await getAdminClient().from("sugerencias").insert({
      tipo: data.tipo,
      nombre: data.nombre ?? null,
      contacto: data.contacto ?? null,
      mensaje: data.mensaje,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
