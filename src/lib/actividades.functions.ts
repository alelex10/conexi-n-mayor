/* eslint-disable prettier/prettier */
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
  fuente?: string | null;
  latitud?: number | null;
  longitud?: number | null;
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
    ...(fila.fuente ? { fuente: fila.fuente } : {}),
    ...(typeof fila.latitud === "number" ? { latitud: fila.latitud } : {}),
    ...(typeof fila.longitud === "number" ? { longitud: fila.longitud } : {}),
  };
}

const COLUMNAS =
  "id, nombre, fecha, hora, lugar, direccion, gratuito, precio, distancia_metros, bano, estacionamiento, como_llegar, categoria, descripcion, fuente, latitud, longitud";

/** Returns true if the error is due to missing SB_* env (build without secrets). */
function isMissingEnvError(e: unknown): boolean {
  return e instanceof Error && e.message.includes("Missing required server secret");
}

/** Lista las actividades publicadas, opcionalmente filtradas por radio en metros. */
export const listarActividades = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z
      .object({
        radioMetros: z.number().int().positive().optional(),
        incluirExternos: z.boolean().optional().default(true),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }): Promise<Actividad[]> => {
    // 1) Fetch Supabase (or mock fallback) first
    let base: Actividad[];
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
      base = ((filas ?? []) as FilaActividad[]).map(aActividad);
    } catch (e) {
      if (isMissingEnvError(e)) {
        // Fallback to mock data when Supabase env is not configured (local build / preview without secrets).
        console.warn("[actividades.functions] Supabase not configured — falling back to mock data.", e);
        const { ACTIVIDADES } = await import("@/data/actividades");
        const limite = data.radioMetros;
        const filtradas = limite ? ACTIVIDADES.filter((a) => a.distanciaMetros <= limite) : ACTIVIDADES;
        base = [...filtradas].sort((a, b) => a.distanciaMetros - b.distanciaMetros);
      } else {
        throw e;
      }
    }

    // 2) Merge ChileCultura external when enabled
    if (!data.incluirExternos) return dedupeSortSlice(base);

    try {
      const { isChileCulturaEnabled, fetchListaCached } = await import("./chilecultura");
      if (!isChileCulturaEnabled()) return dedupeSortSlice(base);
      const externas = await fetchListaCached();
      // fetchListaCached already maps to Actividad with fuente=chilecultura and synthetic distanciaMetros=1500
      // Graceful fallback: if fetch returns empty, just return base
      if (!externas.length) return dedupeSortSlice(base);
      const merged = [...base, ...externas];
      return dedupeSortSlice(merged);
    } catch (e) {
      console.warn("[actividades.functions] ChileCultura fetch failed — returning Supabase-only", e);
      return dedupeSortSlice(base);
    }
  });

function dedupeSortSlice(list: Actividad[]): Actividad[] {
  const seen = new Set<string>();
  const deduped: Actividad[] = [];
  for (const a of list) {
    if (!seen.has(a.id)) {
      seen.add(a.id);
      deduped.push(a);
    }
  }
  // Sort by fecha/hora ASC as per spec, then slice 0..50
  deduped.sort((a, b) => {
    const d = a.fecha.localeCompare(b.fecha);
    if (d !== 0) return d;
    return a.hora.localeCompare(b.hora);
  });
  return deduped.slice(0, 50);
}

export type PorRegionResult = {
  region: number;
  regionId: number;
  nombre: string;
  regionStrEjemplo: string;
  count: number;
  actividades: Actividad[];
  cachedAt: number;
  error?: string;
};
export type ListarPorRegionesResult = {
  porRegion: PorRegionResult[];
  total: number;
  actividades: Actividad[];
  resultados: Actividad[];
  latencyMs: number;
  cachedAt: number;
  cachedAges: { regionId: number; cachedAt: number }[];
};

export async function listarChileCulturaPorRegionesCore(input: {
  regiones?: number[] | undefined;
  force?: boolean | undefined;
  forzarRecarga?: boolean | undefined;
}): Promise<ListarPorRegionesResult> {
  const t0 = Date.now();
  const force = input.forzarRecarga ?? input.force ?? false;
  const inputRegiones = (input.regiones ?? [13]).filter((n) => Number.isInteger(n) && n >= 1 && n <= 16).slice(0, 6);
  const regiones = inputRegiones.length ? inputRegiones : [13];
  const { isChileCulturaEnabled } = await import("./chilecultura");
  if (!isChileCulturaEnabled()) {
    const now = Date.now();
    return { porRegion: [], total: 0, actividades: [], resultados: [], latencyMs: 0, cachedAt: now, cachedAges: [] };
  }
  const { fetchListaMultiRegion, REGIONES_CHILE } = await import("./chilecultura");
  const multi = await fetchListaMultiRegion(regiones, { force, pages: 1 });
  const porRegion: PorRegionResult[] = [];
  for (const r of regiones) {
    const entry = multi.get(r);
    const nombre = (REGIONES_CHILE as readonly { id: number; nombre: string }[]).find((x) => x.id === r)?.nombre ?? `Región ${r}`;
    const regionStrEjemplo = entry?.raw?.[0]?.region ?? nombre;
    const actividades = entry?.actividades ?? [];
    const cachedAt = entry?.cachedAt ?? Date.now();
    const error = entry?.error;
    porRegion.push({
      region: r,
      regionId: r,
      nombre,
      regionStrEjemplo,
      count: actividades.length,
      actividades: actividades.slice(0, 50),
      cachedAt,
      ...(error ? { error } : {}),
    });
  }
  const flat = dedupeSortSlice(porRegion.flatMap((p) => p.actividades));
  const total = porRegion.reduce((s, p) => s + p.count, 0);
  const now = Date.now();
  return {
    porRegion,
    total,
    actividades: flat,
    resultados: flat,
    latencyMs: Date.now() - t0,
    cachedAt: now,
    cachedAges: porRegion.map((p) => ({ regionId: p.region, cachedAt: p.cachedAt })),
  };
}

/** Experimental multi-region ChileCultura fetch — isolated from listarActividades. No Supabase. */
export const listarChileCulturaPorRegiones = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z
      .object({
        regiones: z.array(z.number().int().min(1).max(16)).max(6).optional().default([13]),
        force: z.boolean().optional().default(false),
        forzarRecarga: z.boolean().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }): Promise<ListarPorRegionesResult> => listarChileCulturaPorRegionesCore(data));

/** Obtiene una actividad publicada por su id. */
export const obtenerActividad = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ id: z.string().min(1) }).parse(input))
  .handler(async ({ data }): Promise<Actividad | null> => {
    // 1) Try Supabase first (or mock)
    try {
      const { getPublicClient } = await import("./supabase.server");
      const { data: fila, error } = await getPublicClient()
        .from("actividades")
        .select(COLUMNAS)
        .eq("estado", "publicada")
        .eq("id", data.id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (fila) return aActividad(fila as FilaActividad);
    } catch (e) {
      if (isMissingEnvError(e)) {
        console.warn("[actividades.functions] Supabase not configured — falling back to mock for obtenerActividad.", e);
        const { ACTIVIDADES } = await import("@/data/actividades");
        const found = ACTIVIDADES.find((a) => a.id === data.id);
        if (found) return found;
        // If not found in mock and is ccult-, continue to ChileCultura fallback below
        if (!data.id.startsWith("ccult-")) return null;
      } else {
        throw e;
      }
    }

    // 2) Fallback to ChileCultura for ccult-* ids
    if (!data.id.startsWith("ccult-")) return null;

    try {
      const { isChileCulturaEnabled, fetchDetalleCached, fetchLista, mapToActividad, getCached } = await import("./chilecultura");

      if (!isChileCulturaEnabled()) return null;

      // Try to find in cached lista first (fast path — avoids extra fetch)
      const cachedLista = getCached<Actividad[]>("cc:list:13");
      if (cachedLista) {
        const hit = cachedLista.find((a) => a.id === data.id);
        if (hit) {
          // Enrich with detail if available
          const detail = await fetchDetalleCached(data.id).catch(() => null);
          if (detail && (detail.direccion || detail.precio || detail.latitud || detail.longitud)) {
            return {
              ...hit,
              ...(detail.direccion ? { direccion: detail.direccion } : {}),
              ...(detail.precio ? { precio: detail.precio } : {}),
              ...(typeof detail.latitud === "number" ? { latitud: detail.latitud } : {}),
              ...(typeof detail.longitud === "number" ? { longitud: detail.longitud } : {}),
            };
          }
          return hit;
        }
      }

      // Otherwise fetch raw list and find matching id
      const rawList = await fetchLista().catch(() => []);
      const rawId = data.id.replace(/^ccult-/, "");
      const raw = rawList.find((r) => String(r.id) === rawId);
      if (!raw) return null;

      const detail = await fetchDetalleCached(data.id).catch(() => null);
      return mapToActividad(raw, detail ?? undefined);
    } catch (e) {
      console.warn(`[actividades.functions] ChileCultura detail fetch failed for ${data.id}`, e);
      return null;
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
