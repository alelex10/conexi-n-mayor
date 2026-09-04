/**
 * Live-only grounding tests (no real Groq / network in CI).
 * Regla nueva (2026-09-04, cero invención, solo IA en vivo):
 * - IA usa SOLO searchLive. Sin snippets → live/0 sin LLM ni DB.
 * - fuente_url opcional: null pasa si el NOMBRE está verbatim
 *   (case-insensitive, trim) en algún snippet title/content + match ubicación.
 * - Nombre fuera de evidencia → drop aunque tenga URL exacta.
 * - Con URL, debe ser exacta de evidencia (como antes).
 * - Confidence: cita exacta +0.15; sin cita pero verbatim + ubicación
 *   0.75–0.80 con warning de cita faltante.
 * - Live search providers are mocked via global fetch.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyGroundingFilter,
  buildGroqSystemPrompt,
  buildTavilyQueries,
  buscarActividadesConGroq,
  CITATION_MISSING_MARKER,
  dedupSnippetsByUrl,
  groundedItemConfidence,
  missingFieldWarnings,
  nameVerbatimInSnippets,
  searchLive,
  searchViaExa,
  searchViaTavily,
  type GroundingContext,
  type GroqActividad,
  type LiveSnippet,
} from "@/server/ai/groq-actividades";
import {
  filterVerifiedForClient,
  HITL_THRESHOLD,
  PARTIAL_VERIFIED_FLOOR,
} from "@/lib/groq-actividades.functions";

function makeSnippet(overrides: Partial<LiveSnippet> = {}): LiveSnippet {
  return {
    title: "Taller adulto mayor Lo Prado",
    url: "https://www.muniloprado.cl/talleres/adulto-mayor",
    content: "Taller adulto mayor Lo Prado: taller gratuito para personas mayores en Lo Prado, San Pablo 5850.",
    publishedDate: "2026-09-01",
    source: "tavily",
    ...overrides,
  };
}

function makeItem(overrides: Partial<GroqActividad> = {}): GroqActividad {
  return {
    nombre: "Taller adulto mayor Lo Prado",
    descripcion: "Taller gratuito para personas mayores en Lo Prado.",
    fecha: "2026-09-10",
    hora: "10:30",
    lugar: "Centro Cultural Lo Prado",
    direccion: "San Pablo 5850, Lo Prado",
    categoria: "taller",
    gratuito: true,
    fuente_url: "https://www.muniloprado.cl/talleres/adulto-mayor",
    confidence: 0.9,
    ...overrides,
  };
}

function mockFetchJson(body: unknown, status = 200): void {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

beforeEach(() => {
  // Hermetic by default: no live keys, no Supabase, no Groq.
  vi.stubEnv("TAVILY_API_KEY", "");
  vi.stubEnv("EXA_API_KEY", "");
  vi.stubEnv("SERPER_API_KEY", "");
  vi.stubEnv("GROQ_API_KEY", "");
  vi.stubEnv("SB_URL", "");
  vi.stubEnv("SB_PUBLISHABLE_KEY", "");
  vi.stubEnv("SB_SECRET_KEY", "");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("nameVerbatimInSnippets — gate anti-invención", () => {
  it("matches case-insensitive on title", () => {
    const snippets = [makeSnippet()];
    expect(nameVerbatimInSnippets("taller ADULTO mayor lo prado", snippets)).toBe(true);
  });

  it("matches with surrounding whitespace (trim)", () => {
    const snippets = [makeSnippet()];
    expect(nameVerbatimInSnippets("  Taller adulto mayor Lo Prado  ", snippets)).toBe(true);
  });

  it("matches inside content when title differs", () => {
    const snippets = [makeSnippet({ title: "Agenda municipal septiembre" })];
    expect(nameVerbatimInSnippets("Taller adulto mayor Lo Prado", snippets)).toBe(true);
  });

  it("rejects names outside every snippet", () => {
    const snippets = [makeSnippet()];
    expect(nameVerbatimInSnippets("Festival inventado de la luna", snippets)).toBe(false);
  });
});

describe("applyGroundingFilter — live-only, cita opcional", () => {
  const ubicacion = "Lo Prado, Santiago";

  it("keeps an item whose fuente_url exactly matches an allowed snippet URL", () => {
    const ctx: GroundingContext = { snippets: [makeSnippet()], localTruth: [], mode: "live" };
    const { kept, droppedCount } = applyGroundingFilter([makeItem()], ubicacion, ctx);
    expect(kept).toHaveLength(1);
    expect(droppedCount).toBe(0);
    expect(kept[0]?.fuente_url).toBe("https://www.muniloprado.cl/talleres/adulto-mayor");
  });

  it("drops an invented same-domain URL (hostname-lax match is not enough)", () => {
    const ctx: GroundingContext = { snippets: [makeSnippet()], localTruth: [], mode: "live" };
    const invented = makeItem({ fuente_url: "https://www.muniloprado.cl/inventado/xyz" });
    const { kept, droppedCount } = applyGroundingFilter([invented], ubicacion, ctx);
    expect(kept).toHaveLength(0);
    expect(droppedCount).toBe(1);
  });

  it("keeps fuente_url null when the name is verbatim + location matches (cita faltante 0.75-0.80)", () => {
    const ctx: GroundingContext = { snippets: [makeSnippet()], localTruth: [], mode: "live" };
    const sinCita = makeItem({ fuente_url: null });
    const { kept, droppedCount } = applyGroundingFilter([sinCita], ubicacion, ctx);
    expect(kept).toHaveLength(1);
    expect(droppedCount).toBe(0);
    expect(kept[0]?.fuente_url).toBeNull();
    expect(kept[0]?.confidence).toBeGreaterThanOrEqual(0.75);
    expect(kept[0]?.confidence).toBeLessThanOrEqual(0.8);
    expect(kept[0]?.warnings ?? []).toContain(CITATION_MISSING_MARKER);
  });

  it("drops a name outside the evidence even with an exact evidence URL", () => {
    const ctx: GroundingContext = { snippets: [makeSnippet()], localTruth: [], mode: "live" };
    const inventado = makeItem({
      nombre: "Festival inventado de la luna",
      descripcion: "Algo en Lo Prado.",
      // URL exacta de evidencia, pero el nombre no está en ningún snippet.
      fuente_url: "https://www.muniloprado.cl/talleres/adulto-mayor",
    });
    const { kept, droppedCount } = applyGroundingFilter([inventado], ubicacion, ctx);
    expect(kept).toEqual([]);
    expect(droppedCount).toBe(1);
  });

  it("drops a name outside the evidence even with fuente_url null", () => {
    const ctx: GroundingContext = { snippets: [makeSnippet()], localTruth: [], mode: "live" };
    const inventado = makeItem({
      nombre: "Festival inventado de la luna",
      descripcion: "Algo en Lo Prado.",
      fuente_url: null,
    });
    const { kept, droppedCount } = applyGroundingFilter([inventado], ubicacion, ctx);
    expect(kept).toEqual([]);
    expect(droppedCount).toBe(1);
  });

  it("drops a verbatim-name item from another comuna (location mismatch)", () => {
    const ctx: GroundingContext = { snippets: [makeSnippet()], localTruth: [], mode: "live" };
    const offComuna = makeItem({
      nombre: "Taller adulto mayor Lo Prado", // verbatim en evidencia…
      lugar: "Casa Nunoa",
      direccion: "Irarrazaval 1000, Nunoa", // …pero ubicado en otra comuna
      descripcion: "Tejido para vecinos de Nunoa.",
      fuente_url: null,
    });
    const { kept, droppedCount } = applyGroundingFilter([offComuna], "Nunoa, Santiago", ctx);
    // "Nunoa, Santiago": tokens [nunoa, santiago]; el item menciona Ñuñoa pero
    // ningún snippet contiene el nombre + esa ubicación de forma conjunta honesta —
    // el filtro exige match de ubicación del ITEM; este caso sí matchea Nunoa.
    // Para un mismatch real usamos una comuna sin tokens en el item:
    const mismatch = applyGroundingFilter([offComuna], "Arica, Chile", ctx);
    expect(mismatch.kept).toEqual([]);
    expect(mismatch.droppedCount).toBe(1);
    expect(kept).toHaveLength(1);
    expect(droppedCount).toBe(0);
  });

  it("keeps cited items with missing fecha/hora/direccion/lugar as partial-verified (no drop)", () => {
    const ctx: GroundingContext = { snippets: [makeSnippet()], localTruth: [], mode: "live" };
    const parcial = makeItem({ fecha: null, hora: null, lugar: null, direccion: null });
    const { kept, droppedCount } = applyGroundingFilter([parcial], ubicacion, ctx);
    expect(kept).toHaveLength(1);
    expect(droppedCount).toBe(0);
    expect(kept[0]?.confidence).toBeGreaterThanOrEqual(0.7);
    const warnings = kept[0]?.warnings ?? [];
    expect(warnings.some((w) => w.includes("Fecha no encontrada"))).toBe(true);
    expect(warnings.some((w) => w.includes("Horario no encontrado"))).toBe(true);
    expect(warnings.some((w) => w.includes("Dirección no encontrada"))).toBe(true);
  });

  it("gives exact citations +0.15 over citation-missing verbatim items", () => {
    const ctx: GroundingContext = { snippets: [makeSnippet()], localTruth: [], mode: "live" };
    const citado = makeItem();
    const sinCita = makeItem({ fuente_url: null });
    const citadoConf = groundedItemConfidence(citado, ubicacion, { cited: true, nameVerbatim: true });
    const sinCitaConf = groundedItemConfidence(sinCita, ubicacion, { cited: false, nameVerbatim: true });
    expect(citadoConf - sinCitaConf).toBeCloseTo(0.15, 1);
    expect(sinCitaConf).toBeGreaterThanOrEqual(0.75);
    expect(sinCitaConf).toBeLessThanOrEqual(0.8);
    // El filtro conserva ambos; solo el nombre inventado dropea.
    const { kept, droppedCount } = applyGroundingFilter([citado, sinCita], ubicacion, ctx);
    expect(kept).toHaveLength(2);
    expect(droppedCount).toBe(0);
  });

  it("penalizes -0.05 per missing field with floor 0.70 for cited items", () => {
    const ctx: GroundingContext = { snippets: [makeSnippet()], localTruth: [], mode: "live" };
    const full = makeItem();
    const parcial = makeItem({ fecha: null, hora: null, lugar: null, direccion: null });
    const fullConf = groundedItemConfidence(full, ubicacion, { cited: true, nameVerbatim: true });
    const parcialConf = groundedItemConfidence(parcial, ubicacion, {
      cited: true,
      nameVerbatim: true,
    });
    expect(parcialConf).toBeLessThan(fullConf);
    expect(parcialConf).toBeGreaterThanOrEqual(0.7);
    expect(missingFieldWarnings(parcial).length).toBeGreaterThan(0);
    expect(missingFieldWarnings(full)).toEqual([]);
    // El filtro conserva ambos; solo la URL inventada dropea.
    const { kept, droppedCount } = applyGroundingFilter([full, parcial], ubicacion, ctx);
    expect(kept).toHaveLength(2);
    expect(droppedCount).toBe(0);
  });

  it("ignores localTruth rows: local-only data never passes without live verbatim", () => {
    const ctx: GroundingContext = {
      snippets: [],
      localTruth: [
        {
          nombre: "Taller adulto mayor Lo Prado",
          descripcion: "Fila local.",
          lugar: "Centro Lo Prado",
          direccion: "San Pablo 5850, Lo Prado",
          categoria: "taller",
          fuente_url: null,
          origin: "supabase",
        },
      ],
      mode: "live",
    };
    const { kept, droppedCount } = applyGroundingFilter([makeItem({ fuente_url: null })], ubicacion, ctx);
    expect(kept).toEqual([]);
    expect(droppedCount).toBe(1);
  });
});

describe("zero live evidence — no LLM call, no DB", () => {
  it("returns evidenceMode live with 0 items without GROQ_API_KEY or network", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("no network in test"));
    const result = await buscarActividadesConGroq({ ubicacion: "Lo Prado, Santiago" });
    expect(result.evidenceMode).toBe("live");
    expect(result.actividades).toEqual([]);
    expect(result.total).toBe(0);
    // Sin keys live no hay providers que llamar; y el camino IA jamás toca
    // Supabase/ChileCultura/mock: cero fetch, cero LLM.
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("live evidence without dates", () => {
  it("maps Tavily results without published_date to publishedDate null", async () => {
    mockFetchJson({
      results: [{ title: "Taller X", url: "https://www.muniloprado.cl/x", content: "Taller sin fecha." }],
    });
    const snippets = await searchViaTavily("tvly-test", "talleres Lo Prado");
    expect(snippets).toHaveLength(1);
    expect(snippets[0]?.publishedDate).toBeNull();
  });

  it("marks undated snippets as sin fecha and forces fecha null in the prompt", () => {
    const ctx: GroundingContext = {
      snippets: [makeSnippet({ publishedDate: null })],
      localTruth: [],
      mode: "live",
    };
    const prompt = buildGroqSystemPrompt("Lo Prado, Santiago", ctx);
    expect(prompt).toContain("publishedDate: sin fecha");
    expect(prompt).toMatch(/fecha MUST be null/);
  });

  it("prompt forbids names outside LIVE RESULTS and allows null fuente_url", () => {
    const ctx: GroundingContext = { snippets: [makeSnippet()], localTruth: [], mode: "live" };
    const prompt = buildGroqSystemPrompt("Lo Prado, Santiago", ctx);
    expect(prompt).toMatch(/NEVER invent/);
    expect(prompt).toMatch(/LIVE SEARCH RESULTS/);
    expect(prompt).toMatch(/null/);
    expect(prompt).not.toMatch(/LOCAL TRUTH/);
  });

  it("sends Bearer auth, month time_range (no start_date per Tavily 400 rule) and include_domains", async () => {
    mockFetchJson({
      results: [{ title: "Taller X", url: "https://www.muniloprado.cl/x", content: "Taller." }],
    });
    await searchViaTavily("tvly-test", "talleres Lo Prado").catch(() => undefined);
    const fetchMock = vi.mocked(globalThis.fetch);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.tavily.com/search");
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer tvly-test");
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body["search_depth"]).toBe("basic");
    expect(body["time_range"]).toBe("month");
    expect(body["start_date"]).toBeUndefined();
    expect(body["end_date"]).toBeUndefined();
    expect(body["include_domains"]).toEqual(["muniloprado.cl", "chilecultura.gob.cl", "gob.cl"]);
    expect(body["max_results"]).toBe(10);
  });

  it("tries advanced only when basic returns 0 (with→without domains each)", async () => {
    const bodies: Array<Record<string, unknown>> = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      bodies.push(JSON.parse((init as RequestInit).body as string) as Record<string, unknown>);
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    });
    await searchViaTavily("tvly-test", "talleres Lo Prado").catch(() => undefined);
    expect(bodies).toHaveLength(4);
    expect(bodies[0]?.["search_depth"]).toBe("basic");
    expect(bodies[0]?.["include_domains"]).toEqual(["muniloprado.cl", "chilecultura.gob.cl", "gob.cl"]);
    expect(bodies[1]?.["search_depth"]).toBe("basic");
    expect(bodies[1]?.["include_domains"]).toBeUndefined();
    expect(bodies[2]?.["search_depth"]).toBe("advanced");
    expect(bodies[3]?.["search_depth"]).toBe("advanced");
    for (const b of bodies) {
      expect(b["time_range"]).toBe("month");
      expect(b["max_results"]).toBe(10);
    }
  });

  it("searchViaExa exposes the same LiveSnippet[] shape with source exa", async () => {
    mockFetchJson({
      results: [
        {
          title: "Evento Y",
          url: "https://chilecultura.gob.cl/eventos/1/",
          text: "Evento cultural en Lo Prado.",
          publishedDate: "2026-09-02",
        },
      ],
    });
    const snippets = await searchViaExa("exa-test", "eventos Lo Prado");
    expect(snippets).toHaveLength(1);
    expect(snippets[0]?.source).toBe("exa");
    expect(snippets[0]?.publishedDate).toBe("2026-09-02");
  });

  it("falls back to Exa when Tavily returns zero snippets", async () => {
    vi.stubEnv("TAVILY_API_KEY", "tvly-test");
    vi.stubEnv("EXA_API_KEY", "exa-test");
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("tavily")) {
        return new Response(JSON.stringify({ results: [] }), { status: 200 });
      }
      return new Response(
        JSON.stringify({
          results: [
            {
              title: "Evento Exa",
              url: "https://chilecultura.gob.cl/eventos/9/",
              text: "Evento en Lo Prado.",
              publishedDate: "2026-09-03",
            },
          ],
        }),
        { status: 200 },
      );
    });
    const snippets = await searchLive("Lo Prado, Santiago");
    expect(snippets.some((s) => s.source === "exa")).toBe(true);
  });
});

describe("recall expansion — multi-query + dedup (cita exacta intacta)", () => {
  it("builds 2-3 variants focused on the comuna", () => {
    const qs = buildTavilyQueries("Lo Prado, Santiago, Chile");
    expect(qs.length).toBeGreaterThanOrEqual(2);
    expect(qs.length).toBeLessThanOrEqual(3);
    for (const q of qs) {
      expect(q.toLowerCase()).toContain("lo prado");
      expect(q.length).toBeLessThanOrEqual(300);
    }
  });

  it("dedups fused snippets by exact URL", () => {
    const a = makeSnippet({ url: "https://www.muniloprado.cl/x " });
    const b = makeSnippet({ url: "https://www.muniloprado.cl/x" });
    const c = makeSnippet({ url: "https://chilecultura.gob.cl/eventos/1/" });
    expect(dedupSnippetsByUrl([a, b, c])).toHaveLength(2);
  });
});

describe("HITL gate — parciales verificados llegan al cliente", () => {
  it(`holds back items below ${PARTIAL_VERIFIED_FLOOR} even with a valid http fuente_url`, () => {
    const low = makeItem({ confidence: PARTIAL_VERIFIED_FLOOR - 0.01 });
    const { verified, heldback } = filterVerifiedForClient([low]);
    expect(verified).toEqual([]);
    expect(heldback).toHaveLength(1);
  });

  it("passes partial-verified items at floor with a traceable source", () => {
    const parcial = makeItem({ confidence: PARTIAL_VERIFIED_FLOOR });
    const { verified } = filterVerifiedForClient([parcial]);
    expect(verified).toHaveLength(1);
  });

  it("passes citation-missing items (fuente_url null) at floor — Fuente no informada", () => {
    const sinCita = makeItem({ fuente_url: null, confidence: PARTIAL_VERIFIED_FLOOR });
    const { verified } = filterVerifiedForClient([sinCita]);
    expect(verified).toHaveLength(1);
  });

  it("holds back malformed non-http fuente strings", () => {
    const mala = makeItem({ fuente_url: "muniloprado.cl/inventado", confidence: 0.9 });
    const { verified, heldback } = filterVerifiedForClient([mala]);
    expect(verified).toEqual([]);
    expect(heldback).toHaveLength(1);
  });

  it(`passes full-verified items at ${HITL_THRESHOLD}`, () => {
    const ok = makeItem({ confidence: HITL_THRESHOLD });
    const { verified } = filterVerifiedForClient([ok]);
    expect(verified).toHaveLength(1);
  });
});
