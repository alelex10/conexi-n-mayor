/* eslint-disable prettier/prettier */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  stripHtml, extractHora, mapDiscipline, mapToActividad, parseDetalleHtml,
  fetchLista, fetchDetalle, fetchListaCached, fetchDetalleCached,
  clearCache, isCacheValid, getCached, setCached,
  LIST_CACHE_KEY, LIST_TTL, DETAIL_TTL, CHILECULTURA_BASE, detailCacheKey, isChileCulturaEnabled,
  type RawEvent,
} from "./chilecultura";

function makeRaw(o: Partial<RawEvent> = {}): RawEvent {
  return {
    id: 37496, name: "Festival de Museo", description: "<p>Evento a las 18:30 horas</p>",
    venue_name: "Galeria Plaza", commune: "Santiago", region: "RM",
    main_discipline: "Museo", free: true, start_date: "2026-03-24", end_date: "2026-08-31",
    url: "https://chilecultura.gob.cl/events/37496/", image: "", institution: "", ...o,
  };
}

describe("stripHtml", () => {
  it("strips tags and decodes", () => {
    expect(stripHtml("<p>Hola &amp; <b>mundo</b></p>")).toBe("Hola & mundo");
    expect(stripHtml("A&nbsp;B")).toBe("A B");
    expect(stripHtml("<script>x</script> keep")).toBe("keep");
  });
  it("collapses whitespace", () => expect(stripHtml("  <p>  foo   bar </p>  ")).toBe("foo bar"));
});

describe("extractHora", () => {
  it("extracts HH:MM", () => {
    expect(extractHora("18:30 horas")).toBe("18:30");
    expect(extractHora("a las 9:05 h")).toBe("09:05");
    expect(extractHora("10:00 h.")).toBe("10:00");
  });
  it("returns null when no time", () => {
    expect(extractHora("sin hora")).toBeNull();
    expect(extractHora("25:00 h")).toBeNull();
  });
});

describe("mapDiscipline 18→5", () => {
  it("maps buckets", () => {
    expect(mapDiscipline("Música")).toBe("Recreación");
    expect(mapDiscipline("Danza")).toBe("Recreación");
    expect(mapDiscipline("Museo")).toBe("Cultura");
    expect(mapDiscipline("Artes Visuales")).toBe("Cultura");
    expect(mapDiscipline("Literatura")).toBe("Aprendizaje");
    expect(mapDiscipline("Desconocida")).toBe("Cultura");
    expect(mapDiscipline("música")).toBe("Recreación");
  });
});

describe("mapToActividad", () => {
  it("full map", () => {
    const act = mapToActividad(makeRaw({ description: "<p>Show 18:30 horas</p>", main_discipline: "Música" }));
    expect(act.id).toBe("ccult-37496");
    expect(act.fuente).toBe("chilecultura");
    expect(act.hora).toBe("18:30");
    expect(act.descripcion).toBe("Show 18:30 horas");
    expect(act.categoria).toBe("Recreación");
    expect(act.distanciaMetros).toBe(1500);
    expect(act.bano).toBe("sin_info");
  });
  it("missing defaults", () => {
    const act = mapToActividad(makeRaw({ description: "sin hora", main_discipline: "", venue_name: "", commune: "" }));
    expect(act.hora).toBe("11:00");
    expect(act.categoria).toBe("Cultura");
    expect(act.direccion).toBe("");
  });
  it("merges detail", () => {
    const act = mapToActividad(makeRaw(), { direccion: "Av La Dehesa 1500", latitud: -33.358, longitud: -70.517, precio: "$20.000" });
    expect(act.direccion).toBe("Av La Dehesa 1500");
    expect(act.latitud).toBe(-33.358);
    expect(act.precio).toBe("$20.000");
  });
  it("truncates to 2000", () => {
    const act = mapToActividad(makeRaw({ description: "<p>" + "a".repeat(3000) + "</p>" }));
    expect(act.descripcion.length).toBe(2000);
  });
});

describe("parseDetalleHtml", () => {
  it("parses #mapDesktop lat/lon", () => {
    const p = parseDetalleHtml(`<div id="mapDesktop" data-lat="-33.358" data-lon="-70.517"></div>`);
    expect(p.latitud).toBeCloseTo(-33.358);
    expect(p.longitud).toBeCloseTo(-70.517);
  });
  it("parses alt order", () => {
    const p = parseDetalleHtml(`<div id="mapDesktop" data-lon="-70.517" data-lat="-33.358"></div>`);
    expect(p.latitud).toBeCloseTo(-33.358);
  });
  it("parses direccion and precio", () => {
    expect(parseDetalleHtml(`<div class="location">Calle Test 123</div>`).direccion).toContain("Calle");
    expect(parseDetalleHtml(`<ul><li class="payment">$20.000</li></ul>`).precio).toBe("$20.000");
  });
  it("returns empty when missing", () => {
    const p = parseDetalleHtml(`<div>no map</div>`);
    expect(p.latitud).toBeUndefined();
  });
});

describe("cache flag", () => {
  beforeEach(() => clearCache());
  afterEach(() => clearCache());
  it("isCacheValid", async () => {
    setCached("k1", { foo: 1 });
    expect(isCacheValid("k1", LIST_TTL)).toBe(true);
    const { _setCacheEntry } = await import("./chilecultura");
    _setCacheEntry("k2", Date.now() - LIST_TTL - 1000, { foo: 2 });
    expect(isCacheValid("k2", LIST_TTL)).toBe(false);
  });
  it("flag default true and false disables", () => {
    delete process.env["ENABLE_CHILECULTURA"];
    expect(isChileCulturaEnabled()).toBe(true);
    process.env["ENABLE_CHILECULTURA"] = "false";
    expect(isChileCulturaEnabled()).toBe(false);
    delete process.env["ENABLE_CHILECULTURA"];
  });
});

describe("fetchLista", () => {
  beforeEach(() => { clearCache(); vi.restoreAllMocks(); delete process.env["ENABLE_CHILECULTURA"]; });
  afterEach(() => { vi.restoreAllMocks(); clearCache(); });
  it("fetches apex with User-Agent, 8s abort, 400ms gap ≤100", async () => {
    const r1 = Array.from({ length: 50 }, (_, i) => makeRaw({ id: 1000 + i }));
    const r2 = Array.from({ length: 10 }, (_, i) => makeRaw({ id: 2000 + i }));
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      expect(url.startsWith(CHILECULTURA_BASE)).toBe(true);
      expect(url).not.toContain("www.");
      expect(url).toContain("region=13");
      const page = new URL(url).searchParams.get("page");
      return { ok: true, json: async () => ({ results: page === "2" ? r2 : r1 }) } as Response;
    });
    const res = await fetchLista({ region: 13, pageSize: 50, pages: 2 });
    expect(spy).toHaveBeenCalledTimes(2);
    expect((spy.mock.calls[0]![1] as RequestInit).headers!["User-Agent"]).toBe("CiudadVivaMayor/1.0");
    expect((spy.mock.calls[0]![1] as RequestInit).signal).toBeInstanceOf(AbortSignal);
    expect(res.length).toBe(60);
  });
  it("flag off returns empty and throws on non-ok", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, status: 500 } as Response);
    process.env["ENABLE_CHILECULTURA"] = "false";
    expect(await fetchLista()).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
    delete process.env["ENABLE_CHILECULTURA"];
    await expect(fetchLista({ pages: 1 })).rejects.toThrow();
  });
  it("fetchListaCached <50ms from cache and fallback empty", async () => {
    const cached = [mapToActividad(makeRaw({ id: 1 })), mapToActividad(makeRaw({ id: 2 }))];
    setCached(LIST_CACHE_KEY, cached);
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => { throw new Error("no fetch"); });
    const start = Date.now();
    const res = await fetchListaCached();
    expect(Date.now() - start).toBeLessThan(50);
    expect(res).toEqual(cached);
    expect(spy).not.toHaveBeenCalled();
    clearCache();
    spy.mockRestore();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("net"));
    expect(await fetchListaCached()).toEqual([]);
  });
});

describe("fetchDetalle", () => {
  beforeEach(() => { clearCache(); vi.restoreAllMocks(); delete process.env["ENABLE_CHILECULTURA"]; });
  afterEach(() => { vi.restoreAllMocks(); clearCache(); });
  it("fetches HTML and parses", async () => {
    const html = `<div id="mapDesktop" data-lat="-33.35" data-lon="-70.60"></div><div class="location">Calle Test 123</div><li class="payment">Gratis</li>`;
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, text: async () => html } as Response);
    const res = await fetchDetalle("37496");
    expect(spy.mock.calls[0]![0]).toContain(CHILECULTURA_BASE);
    expect(res!.latitud).toBeCloseTo(-33.35);
    expect(res!.direccion).toContain("Calle");
    expect(res!.precio).toBe("Gratis");
  });
  it("null for bad id and flag off", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    expect(await fetchDetalle("bad")).toBeNull();
    process.env["ENABLE_CHILECULTURA"] = "false";
    expect(await fetchDetalle("37496")).toBeNull();
    expect(spy).not.toHaveBeenCalled();
    delete process.env["ENABLE_CHILECULTURA"];
  });
  it("caches 24h and stale fallback", async () => {
    const html = `<div id="mapDesktop" data-lat="-33.0" data-lon="-70.0"></div>`;
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, text: async () => html } as Response);
    const first = await fetchDetalleCached("ccult-37496");
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockClear();
    const start = Date.now();
    const second = await fetchDetalleCached("37496");
    expect(Date.now() - start).toBeLessThan(50);
    expect(spy).not.toHaveBeenCalled();
    expect(second).toEqual(first);
    const key = detailCacheKey("37496");
    const { _setCacheEntry } = await import("./chilecultura");
    _setCacheEntry(key, Date.now() - DETAIL_TTL - 1000, { direccion: "cached", latitud: 1, longitud: 2 });
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("net"));
    expect(await fetchDetalleCached("37496")).toEqual({ direccion: "cached", latitud: 1, longitud: 2 });
  });
});
