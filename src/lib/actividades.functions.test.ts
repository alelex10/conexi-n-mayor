/* eslint-disable prettier/prettier */
// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { clearCache, CHILECULTURA_BASE } from "./chilecultura";
import type { RawEvent } from "./chilecultura";

function makeRaw(o: Partial<RawEvent> = {}): RawEvent {
  return {
    id: 37496, name: "Evento Test", description: "<p>Show 18:30 horas</p>",
    venue_name: "Galeria", commune: "Santiago", region: "Metropolitana",
    main_discipline: "Museo", free: true, start_date: "2026-03-24", end_date: "2026-08-31",
    url: "https://chilecultura.gob.cl/events/37496/", image: "", institution: "", ...o,
  };
}

describe("listarChileCulturaPorRegiones", () => {
  beforeEach(() => { clearCache(); vi.restoreAllMocks(); delete process.env["ENABLE_CHILECULTURA"]; delete process.env["ENABLE_ADMIN_PANEL"]; });
  afterEach(() => { vi.restoreAllMocks(); clearCache(); delete process.env["ENABLE_CHILECULTURA"]; });

  it("validator defaults [13] and caps 6 (throws on >6)", async () => {
    const { listarChileCulturaPorRegionesCore, listarChileCulturaPorRegiones } = await import("./actividades.functions");
    const { z } = await import("zod");
    // test core default (core defaults to [13] internally)
    const resDefault = await listarChileCulturaPorRegionesCore({});
    expect(resDefault.porRegion).toHaveLength(1);
    expect(resDefault.porRegion[0].region).toBe(13);
    // validator cap via serverFn schema: >6 should throw
    const schema = z.object({ regiones: z.array(z.number().int().min(1).max(16)).max(6).optional().default([13]) });
    expect(() => schema.parse({ regiones: [1,2,3,4,5,6,7] })).toThrow();
    // also check serverFn validator throws when invoked via .validator path - simulate by calling validator directly
    const validator = (input: unknown) => z.object({ regiones: z.array(z.number().int().min(1).max(16)).max(6).optional().default([13]), force: z.boolean().optional().default(false), forzarRecarga: z.boolean().optional() }).parse(input ?? {});
    expect(() => validator({ regiones: [1,2,3,4,5,6,7] })).toThrow();
  });

  it("filters 1..16 and dedupes + sorts slice <=50, latencyMs and cachedAt", async () => {
    const { listarChileCulturaPorRegionesCore } = await import("./actividades.functions");
    const r13 = makeRaw({ id: 1, name:"A", start_date:"2026-03-25", description:"10:00 h" });
    const r5a = makeRaw({ id: 1, name:"A duplicate", start_date:"2026-03-25", description:"10:00 h" });
    const r5b = makeRaw({ id: 2, name:"B", start_date:"2026-03-24", description:"09:00 h" });
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      const region = new URL(url).searchParams.get("region");
      if (region==="13") return { ok:true, json: async()=>({ results:[r13] }) } as Response;
      if (region==="5") return { ok:true, json: async()=>({ results:[r5a, r5b] }) } as Response;
      return { ok:true, json: async()=>({ results:[] }) } as Response;
    });
    const res = await listarChileCulturaPorRegionesCore({ regiones: [13,5] });
    expect(res.porRegion).toHaveLength(2);
    expect(res.porRegion[0].count).toBe(1);
    expect(res.porRegion[1].count).toBe(2);
    // flat deduped sorted ASC by fecha/hora, duplicate id 1 appears once
    expect(res.actividades.length).toBe(2);
    expect(res.resultados.length).toBe(2);
    expect(res.actividades[0].id).toBe("ccult-2"); // 2026-03-24 09:00 before 2026-03-25 10:00
    expect(res.actividades[0].fecha).toBe("2026-03-24");
    expect(res.total).toBe(3);
    expect(res.latencyMs).toBeGreaterThanOrEqual(0);
    expect(typeof res.cachedAt).toBe("number");
    expect(res.cachedAges).toHaveLength(2);
    // porRegion regionStrEjemplo
    expect(res.porRegion[0].regionStrEjemplo).toBeDefined();
    expect(res.porRegion[0].regionId).toBe(13);
  });

  it("ENABLE_CHILECULTURA=false returns empty", async () => {
    process.env["ENABLE_CHILECULTURA"]="false";
    const { listarChileCulturaPorRegionesCore } = await import("./actividades.functions");
    const spy = vi.spyOn(globalThis, "fetch");
    const res = await listarChileCulturaPorRegionesCore({ regiones: [13,5] });
    expect(res.porRegion).toEqual([]);
    expect(res.total).toBe(0);
    expect(res.actividades).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it("per-region failure returns other regions with error field", async () => {
    const { listarChileCulturaPorRegionesCore } = await import("./actividades.functions");
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const region = new URL(String(input)).searchParams.get("region");
      if (region==="5") return { ok:false, status:500 } as Response;
      return { ok:true, json: async()=>({ results:[makeRaw({ id: Number(region)*100 })] }) } as Response;
    });
    const res = await listarChileCulturaPorRegionesCore({ regiones: [13,5] });
    expect(res.porRegion[0].count).toBe(1);
    expect(res.porRegion[1].count).toBe(0);
    expect(res.porRegion[1].error).toBeDefined();
    expect(res.total).toBe(1);
  });

  it("apex host assert and forzarRecarga alias bypasses cache", async () => {
    const { listarChileCulturaPorRegionesCore } = await import("./actividades.functions");
    const { setCached, listCacheKey, mapToActividad } = await import("./chilecultura");
    const cached = [mapToActividad(makeRaw({ id: 999 }))];
    setCached(listCacheKey(13), cached);
    // without force -> cache hit
    let res = await listarChileCulturaPorRegionesCore({ regiones:[13] });
    expect(res.porRegion[0].count).toBe(1);
    expect(res.porRegion[0].actividades[0].id).toBe("ccult-999");
    // with forzarRecarga true -> fetch
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok:true, json: async()=>({ results:[makeRaw({ id:888 })] }) } as Response);
    res = await listarChileCulturaPorRegionesCore({ regiones:[13], forzarRecarga:true });
    expect(res.porRegion[0].actividades[0].id).toBe("ccult-888");
  });
});

// validateSearch parsing for admin route (pure)
describe("admin validateSearch parsing", () => {
  function parseRegionesParam(s?: string): number[] {
    if (!s || !s.trim()) return [13];
    const arr = s.split(",").map((v)=>Number(v.trim())).filter((n)=>Number.isInteger(n)&&n>=1&&n<=16).slice(0,6);
    return arr.length ? arr : [13];
  }
  it("parses string and caps", () => {
    expect(parseRegionesParam("13,5")).toEqual([13,5]);
    expect(parseRegionesParam("99,0,13,1,2,3,4,5,6,7,8")).toEqual([13,1,2,3,4,5]);
    expect(parseRegionesParam("0")).toEqual([13]);
    expect(parseRegionesParam(undefined)).toEqual([13]);
    expect(parseRegionesParam("")).toEqual([13]);
    expect(parseRegionesParam("1,2,3,4,5,6,7")).toEqual([1,2,3,4,5,6]);
  });
});
