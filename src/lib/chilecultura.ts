/* eslint-disable prettier/prettier */
/** ChileCultura adapter — pure mapper + fetch + SWR cache. Server-only. Apex https://chilecultura.gob.cl (www cert expired). */
import type { Actividad } from "@/data/actividades";

export const CHILECULTURA_BASE = "https://chilecultura.gob.cl";
/** Region IDs are internal sequential PKs (north→south), NOT official codes. Verified 2026-09-24 by probing region=1..20. */
export const RM_REGION_ID = 1; // Región Metropolitana de Santiago (207 eventos)
export const LO_PRADO_COMMUNE_ID = 311; // 0 eventos hoy; Santiago=295 (113 eventos)
/** Verified region id map (probe 2026-09-24). No province level exists in the API. */
export const REGION_IDS: Record<string, number> = {
  metropolitana: 1, tarapaca: 2, antofagasta: 3, atacama: 4, coquimbo: 5, valparaiso: 6,
  ohiggins: 7, maule: 8, biobio: 9, araucania: 10, lagos: 11, aysen: 12,
  magallanes: 13, rios: 14, arica: 15, nuble: 16,
};
export const CHILECULTURA_USER_AGENT = "CiudadVivaMayor/1.0";
export const LIST_TTL = 6 * 3600 * 1000;
export const DETAIL_TTL = 24 * 3600 * 1000;
export function listCacheKey(commune?: number, region?: number): string {
  return `cc:list:c${commune ?? "-"}:r${region ?? "-"}`;
}
export const LIST_CACHE_KEY = listCacheKey(undefined, RM_REGION_ID);
export function detailCacheKey(id: string): string { return `cc:detail:${id}`; }

export type RawEvent = {
  id: number; name: string; description: string; venue_name: string; commune: string;
  region: string; main_discipline: string; free: boolean; start_date: string; end_date: string;
  url: string; image: string; institution: string;
};
export type DetailParsed = { direccion?: string; precio?: string; latitud?: number; longitud?: number };
export type CacheEntry<T> = { at: number; data: T };

declare global { var __ccCache: Map<string, CacheEntry<unknown>> | undefined; }
function getCache(): Map<string, CacheEntry<unknown>> {
  if (!globalThis.__ccCache) globalThis.__ccCache = new Map();
  return globalThis.__ccCache;
}

export function isChileCulturaEnabled(): boolean {
  const v = typeof process !== "undefined" ? process.env["ENABLE_CHILECULTURA"] : undefined;
  return v !== "false";
}

export function stripHtml(html: string): string {
  if (!html) return "";
  let t = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  t = t.replace(/<[^>]+>/g, " ");
  t = t.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&apos;/gi, "'")
    .replace(/&([a-zA-Z]+);/g, (m, name: string) => NAMED_ENTITIES[name] ?? m)
    .replace(/&#(\d+);/g, (_m, d: string) => { const n = parseInt(d, 10); return Number.isFinite(n) ? String.fromCharCode(n) : _m; })
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, h: string) => { const n = parseInt(h, 16); return Number.isFinite(n) ? String.fromCharCode(n) : _m; });
  return t.replace(/\s+/g, " ").trim();
}

/** Named HTML entities beyond the basic five (Spanish + common punctuation). */
const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú",
  ntilde: "ñ", Ntilde: "Ñ", uuml: "ü", Uuml: "Ü", ccedil: "ç",
  iquest: "¿", iexcl: "¡", laquo: "«", raquo: "»",
  ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’",
  ndash: "–", mdash: "—", hellip: "…", deg: "°", ordf: "ª", ordm: "º",
};

export function extractHora(desc: string): string | null {
  if (!desc) return null;
  const m = desc.match(/\b(\d{1,2}):(\d{2})\s*h/i);
  if (!m) return null;
  const hh = (m[1] ?? "").padStart(2, "0");
  const mm = m[2] ?? "00";
  const h = Number(hh), mn = Number(mm);
  if (h < 0 || h > 23 || mn < 0 || mn > 59) return null;
  return `${hh}:${mm}`;
}

const DISCIPLINE_MAP: Record<string, Actividad["categoria"]> = {
  "música": "Recreación", musica: "Recreación", danza: "Recreación", teatro: "Recreación", cine: "Recreación", circo: "Recreación", audiovisual: "Recreación", "gastronomía": "Recreación", gastronomia: "Recreación",
  museo: "Cultura", patrimonio: "Cultura", "artes visuales": "Cultura", artesania: "Cultura", "artesanía": "Cultura", "fotografía": "Cultura", fotografia: "Cultura", arquitectura: "Cultura", "diseño": "Cultura", diseno: "Cultura",
  literatura: "Aprendizaje", "libro y lectura": "Aprendizaje", libro: "Aprendizaje", "educación": "Aprendizaje", educacion: "Aprendizaje", ciencia: "Aprendizaje", "ciencia y tecnología": "Aprendizaje", multidisciplinario: "Cultura", multidisciplina: "Cultura", interdisciplina: "Cultura",
};

export function mapDiscipline(raw: string): Actividad["categoria"] {
  if (!raw) return "Cultura";
  const k = raw.trim().toLowerCase();
  if (DISCIPLINE_MAP[k]) return DISCIPLINE_MAP[k]!;
  for (const [key, v] of Object.entries(DISCIPLINE_MAP)) if (k.includes(key) || key.includes(k)) return v;
  return "Cultura";
}

export function mapToActividad(raw: RawEvent, detail?: DetailParsed): Actividad {
  const descripcion = stripHtml(raw.description ?? "").slice(0, 2000);
  const hora = extractHora(raw.description ?? "") ?? extractHora(descripcion) ?? "11:00";
  const categoria = mapDiscipline(raw.main_discipline ?? "");
  const direccion = detail?.direccion ?? (raw.venue_name && raw.commune ? `${raw.venue_name}, ${raw.commune}` : raw.venue_name || raw.commune || "");
  const imagenUrl = (raw.image ?? "").trim();
  return {
    id: `ccult-${raw.id}`, nombre: raw.name ?? `Evento ${raw.id}`, fecha: raw.start_date ?? new Date().toISOString().slice(0, 10),
    hora, lugar: raw.venue_name ?? "", direccion, gratuito: Boolean(raw.free),
    ...(detail?.precio ? { precio: detail.precio } : {}), distanciaMetros: 1500,
    bano: "sin_info", estacionamiento: "sin_info", comoLlegar: "", categoria, descripcion,
    fuente: "chilecultura", url: raw.url ?? `${CHILECULTURA_BASE}/events/${raw.id}/`,
    ...(imagenUrl ? { imagenUrl } : {}),
    ...(typeof detail?.latitud === "number" ? { latitud: detail.latitud } : {}),
    ...(typeof detail?.longitud === "number" ? { longitud: detail.longitud } : {}),
    commune: raw.commune ?? undefined,
  };
}

export function isCacheValid(key: string, ttl: number): boolean {
  const e = getCache().get(key);
  return !!e && Date.now() - e.at < ttl;
}
export function getCached<T>(key: string): T | undefined { return (getCache().get(key) as CacheEntry<T> | undefined)?.data; }
export function findCachedActividad(id: string): Actividad | undefined {
  for (const key of [listCacheKey(LO_PRADO_COMMUNE_ID, undefined), listCacheKey(undefined, RM_REGION_ID), LIST_CACHE_KEY]) {
    const hit = getCached<Actividad[]>(key)?.find((a) => a.id === id);
    if (hit) return hit;
  }
  return undefined;
}
export function setCached<T>(key: string, data: T): void { getCache().set(key, { at: Date.now(), data }); }
export function clearCache(): void { getCache().clear(); }
export function _setCacheEntry<T>(key: string, at: number, data: T): void { getCache().set(key, { at, data } as CacheEntry<unknown>); }

function assertApexHost(url: string): void {
  const u = new URL(url);
  if (u.hostname !== "chilecultura.gob.cl") throw new Error(`[chilecultura] Apex host assertion failed: got ${u.hostname}`);
}
function sleep(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }

async function fetchPaged(params: { commune?: number; region?: number }, pageSize: number, pages: number): Promise<RawEvent[]> {
  const qs = params.commune != null ? `commune=${params.commune}` : `region=${params.region}`;
  const results: RawEvent[] = [];
  for (let page = 1; page <= pages; page++) {
    const url = `${CHILECULTURA_BASE}/api/v1.0/eventos/search?${qs}&page_size=${pageSize}&page=${page}`;
    assertApexHost(url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(url, { headers: { "User-Agent": CHILECULTURA_USER_AGENT }, signal: controller.signal });
      if (!res.ok) throw new Error(`[chilecultura] fetchLista ${page} HTTP ${res.status}`);
      const json = (await res.json()) as { results?: RawEvent[] };
      const pageResults = Array.isArray(json.results) ? json.results : [];
      results.push(...pageResults);
      if (pageResults.length < pageSize) break;
    } finally { clearTimeout(timeout); }
    if (page < pages) await sleep(400);
  }
  return results;
}

/**
 * Lista eventos: primero comuna (micro) y después región (macro), sin duplicados.
 * La API no soporta texto (search se ignora), nombres de comuna (500) ni provincia.
 */
export async function fetchLista(opts?: { region?: number; commune?: number; pageSize?: number; pages?: number }): Promise<RawEvent[]> {
  if (!isChileCulturaEnabled()) return [];
  const pageSize = opts?.pageSize ?? 50, pages = opts?.pages ?? 2;
  const commune = opts?.commune;
  const region = opts?.region ?? (commune == null ? RM_REGION_ID : undefined);
  const seen = new Set<number>();
  const out: RawEvent[] = [];
  const push = (arr: RawEvent[]) => {
    for (const r of arr) if (!seen.has(r.id)) { seen.add(r.id); out.push(r); }
  };
  if (commune != null) push(await fetchPaged({ commune }, pageSize, pages));
  if (region != null) push(await fetchPaged({ region }, pageSize, pages));
  return out.slice(0, 150);
}

export async function fetchListaCached(opts?: { commune?: number; region?: number; pageSize?: number; pages?: number }): Promise<Actividad[]> {
  if (!isChileCulturaEnabled()) return [];
  const commune = opts?.commune;
  const region = opts?.region ?? (commune == null ? RM_REGION_ID : undefined);
  const key = listCacheKey(commune, region);
  if (isCacheValid(key, LIST_TTL)) {
    const c = getCached<Actividad[]>(key);
    if (c) return c;
  }
  try {
    const raw = await fetchLista({
      ...(commune != null ? { commune } : {}),
      ...(region != null ? { region } : {}),
      ...(opts?.pageSize != null ? { pageSize: opts.pageSize } : {}),
      ...(opts?.pages != null ? { pages: opts.pages } : {}),
    });
    const acts = raw.map((r) => mapToActividad(r));
    setCached(key, acts);
    return acts;
  } catch (e) {
    console.warn("[chilecultura] fetchListaCached failed — returning cached or empty", e);
    return getCached<Actividad[]>(key) ?? [];
  }
}

export async function fetchDetalle(id: string): Promise<DetailParsed | null> {
  if (!isChileCulturaEnabled()) return null;
  const rawId = id.replace(/^ccult-/, "");
  if (!/^\d+$/.test(rawId)) return null;
  const url = `${CHILECULTURA_BASE}/events/${rawId}/`;
  assertApexHost(url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { headers: { "User-Agent": CHILECULTURA_USER_AGENT }, signal: controller.signal });
    if (!res.ok) throw new Error(`[chilecultura] fetchDetalle ${rawId} HTTP ${res.status}`);
    return parseDetalleHtml(await res.text());
  } finally { clearTimeout(timeout); }
}

export function parseDetalleHtml(html: string): DetailParsed {
  const out: DetailParsed = {};
  if (!html) return out;
  const mapRe = /id=["']mapDesktop["'][^>]*data-lat=["'](-?\d+(?:\.\d+)?)["'][^>]*data-lon=["'](-?\d+(?:\.\d+)?)["']/i;
  const mapReAlt = /id=["']mapDesktop["'][^>]*data-lon=["'](-?\d+(?:\.\d+)?)["'][^>]*data-lat=["'](-?\d+(?:\.\d+)?)["']/i;
  let m = html.match(mapRe);
  if (m) {
    const lat = parseFloat(m[1] ?? ""), lon = parseFloat(m[2] ?? "");
    if (Number.isFinite(lat)) out.latitud = lat;
    if (Number.isFinite(lon)) out.longitud = lon;
  } else if ((m = html.match(mapReAlt))) {
    const lon = parseFloat(m[1] ?? ""), lat = parseFloat(m[2] ?? "");
    if (Number.isFinite(lat)) out.latitud = lat;
    if (Number.isFinite(lon)) out.longitud = lon;
  } else if (html.includes("mapDesktop")) {
    const latM = html.match(/data-lat=["'](-?\d+(?:\.\d+)?)["']/i);
    const lonM = html.match(/data-lon=["'](-?\d+(?:\.\d+)?)["']/i);
    if (latM) { const v = parseFloat(latM[1] ?? ""); if (Number.isFinite(v)) out.latitud = v; }
    if (lonM) { const v = parseFloat(lonM[1] ?? ""); if (Number.isFinite(v)) out.longitud = v; }
  }
  try {
    const locRe = /class=["'][^"']*\blocation\b[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i;
    const locM = html.match(locRe);
    if (locM) { const r = stripHtml(locM[1] ?? ""); if (r && r.length > 5) out.direccion = r.slice(0, 300); }
    if (!out.direccion) {
      const liRe = /class=["'][^"']*list-icons[^"']*["'][\s\S]*?<li[^>]*>([\s\S]*?)<\/li>/i;
      const liM = html.match(liRe);
      if (liM) { const r = stripHtml(liM[1] ?? ""); if (r && r.length > 5) out.direccion = r.slice(0, 300); }
    }
    if (!out.direccion) {
      const fb = html.match(/(?:Avenida|Av\.|Calle|Pasaje)[^<]{5,80}/i);
      if (fb) out.direccion = stripHtml(fb[0]).slice(0, 300);
    }
  } catch { /* keep */ }
  try {
    const payRe = /<li[^>]*class=["'][^"']*payment[^"']*["'][^>]*>([\s\S]*?)<\/li>/i;
    const payM = html.match(payRe);
    if (payM) { const r = stripHtml(payM[1] ?? ""); if (r) out.precio = r.slice(0, 200); }
  } catch { /* keep */ }
  return out;
}

export async function fetchDetalleCached(id: string): Promise<DetailParsed | null> {
  if (!isChileCulturaEnabled()) return null;
  const key = detailCacheKey(id.replace(/^ccult-/, ""));
  if (isCacheValid(key, DETAIL_TTL)) {
    const c = getCached<DetailParsed>(key);
    if (c !== undefined) return c;
  }
  try {
    const p = await fetchDetalle(id);
    if (p) setCached(key, p);
    return p;
  } catch (e) {
    console.warn(`[chilecultura] fetchDetalleCached ${id} failed`, e);
    return getCached<DetailParsed>(key) ?? null;
  }
}
