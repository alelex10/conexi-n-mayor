import { beforeEach, describe, expect, it, vi } from "vitest";

import { GoogleGenAI } from "@google/genai";

import { buscarInputSchema } from "@/lib/groq-actividades.functions";
import {
  buscarActividadesConGemini,
  DEFAULT_GEMINI_MODEL,
  extractGroundedSources,
  extractGroundingSignals,
  extractJsonObject,
  getGeminiClient,
  hasSearchedResponse,
  isValidGeminiModel,
  normalizeFechaValue,
  resolveGeminiModel,
  truncatePromptForTrace,
  UNGROUNDED_CONFIDENCE_CAP,
} from "./gemini-actividades";
import { isValidProvider } from "./providers";

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn(),
}));

describe("gemini model registry", () => {
  it("accepts the pinned default model id", () => {
    expect(DEFAULT_GEMINI_MODEL).toBe("gemini-2.5-flash");
    expect(isValidGeminiModel("gemini-2.5-flash")).toBe(true);
  });

  it("rejects unknown model ids and falls back to default", () => {
    expect(isValidGeminiModel("gpt-4")).toBe(false);
    expect(resolveGeminiModel("gpt-4")).toBe(DEFAULT_GEMINI_MODEL);
    expect(resolveGeminiModel()).toBe(DEFAULT_GEMINI_MODEL);
    expect(resolveGeminiModel("gemini-2.5-flash")).toBe("gemini-2.5-flash");
  });
});

describe("shared provider union", () => {
  it("accepts groq, lovable and gemini", () => {
    expect(isValidProvider("groq")).toBe(true);
    expect(isValidProvider("lovable")).toBe(true);
    expect(isValidProvider("gemini")).toBe(true);
    expect(isValidProvider("grok")).toBe(false);
  });

  it("buscarInputSchema accepts proveedor gemini", () => {
    const parsed = buscarInputSchema.parse({
      ubicacion: "Lo Prado, Santiago, Chile",
      proveedor: "gemini",
    });
    expect(parsed.proveedor).toBe("gemini");
  });
});

describe("gemini input validation (no network)", () => {
  it("rejects short ubicacion before touching the API", async () => {
    await expect(buscarActividadesConGemini({ ubicacion: "ab" })).rejects.toThrow(
      /at least 3 characters/,
    );
  });

  it("getGeminiClient throws a friendly missing-key error", () => {
    const saved = process.env["GEMINI_API_KEY"];
    delete process.env["GEMINI_API_KEY"];
    try {
      expect(() => getGeminiClient()).toThrow(/GEMINI_API_KEY/);
    } finally {
      if (saved !== undefined) process.env["GEMINI_API_KEY"] = saved;
    }
  });
});

describe("extractJsonObject (no-JSON-mode prefix hardening)", () => {
  it("strips a leading JSON token and trailing commentary", () => {
    expect(extractJsonObject('JSON\n{"a":1}\nHope this helps!')).toBe('{"a":1}');
    expect(extractJsonObject('Here is the JSON:\n{"a":1}')).toBe('{"a":1}');
    expect(extractJsonObject('{"a":1}')).toBe('{"a":1}');
  });

  it("returns input unchanged when no brace pair exists", () => {
    expect(extractJsonObject("no json here")).toBe("no json here");
  });
});

describe("normalizeFechaValue (tolerant Gemini dates)", () => {
  it("accepts DD/MM/YYYY and DD-MM-YYYY as ISO", () => {
    expect(normalizeFechaValue("12/09/2026")).toBe("2026-09-12");
    expect(normalizeFechaValue("05-01-2026")).toBe("2026-01-05");
  });

  it("accepts Spanish long form with and without year", () => {
    expect(normalizeFechaValue("5 de septiembre de 2026")).toBe("2026-09-05");
    const currentYear = new Date().getFullYear();
    expect(normalizeFechaValue("5 de septiembre")).toBe(`${currentYear}-09-05`);
  });

  it("maps free text to null instead of throwing", () => {
    expect(normalizeFechaValue("próximo sábado")).toBeNull();
    expect(normalizeFechaValue("")).toBeNull();
    expect(normalizeFechaValue(null)).toBeNull();
  });
});

describe("extractGroundedSources (pure helper, no network)", () => {
  it("extracts {title, url} pairs from groundingChunks[].web", () => {
    const sources = extractGroundedSources({
      candidates: [
        {
          groundingMetadata: {
            groundingChunks: [
              { web: { uri: "https://example.cl/a", title: "Example A" } },
              { web: { uri: "https://example.cl/b", title: "  " } },
            ],
          },
        },
      ],
    });
    expect(sources).toEqual([
      { title: "Example A", url: "https://example.cl/a" },
      // Blank title falls back to the URL so the UI always has link text.
      { title: "https://example.cl/b", url: "https://example.cl/b" },
    ]);
  });

  it("dedupes by url and skips chunks without a usable uri", () => {
    const sources = extractGroundedSources({
      candidates: [
        {
          groundingMetadata: {
            groundingChunks: [
              { web: { uri: "https://example.cl/a", title: "First" } },
              { web: { uri: "https://example.cl/a", title: "Duplicate" } },
              { web: { title: "No URI" } },
              { maps: { title: "Not a web chunk" } },
            ],
          },
        },
      ],
    });
    expect(sources).toEqual([{ title: "First", url: "https://example.cl/a" }]);
  });

  it("returns [] when grounding metadata is missing", () => {
    expect(extractGroundedSources({})).toEqual([]);
    expect(extractGroundedSources({ candidates: [] })).toEqual([]);
    expect(extractGroundedSources({ candidates: [{}] })).toEqual([]);
    expect(extractGroundedSources(null)).toEqual([]);
  });
});

describe("extractGroundingSignals / hasSearchedResponse (pure helpers, no network)", () => {
  it("detects search via webSearchQueries even with zero chunks", () => {
    const signals = extractGroundingSignals({
      candidates: [{ groundingMetadata: { webSearchQueries: ["talleres Lo Prado"] } }],
    });
    expect(signals.webSearchQueries).toEqual(["talleres Lo Prado"]);
    expect(signals.groundingChunkCount).toBe(0);
    expect(signals.searched).toBe(true);
    expect(hasSearchedResponse({ candidates: [{ groundingMetadata: { webSearchQueries: ["q"] } }] })).toBe(true);
  });

  it("detects search via searchEntryPoint.renderedContent", () => {
    expect(
      hasSearchedResponse({
        candidates: [
          { groundingMetadata: { searchEntryPoint: { renderedContent: "<div>search</div>" } } },
        ],
      }),
    ).toBe(true);
  });

  it("detects search via grounding chunks and reports false for memory-only", () => {
    expect(
      hasSearchedResponse({
        candidates: [{ groundingMetadata: { groundingChunks: [{ web: { uri: "https://a.cl" } }] } }],
      }),
    ).toBe(true);
    expect(hasSearchedResponse({ candidates: [{}] })).toBe(false);
    expect(hasSearchedResponse({})).toBe(false);
    expect(hasSearchedResponse(null)).toBe(false);
  });

  it("truncatePromptForTrace caps at 2000 chars", () => {
    expect(truncatePromptForTrace("a".repeat(2500)).length).toBe(2000);
    expect(truncatePromptForTrace("short")).toBe("short");
  });
});

describe("buscarActividadesConGemini grounding (mocked client)", () => {
  const generateContentMock = vi.fn();

  const validActivityJson = () =>
    JSON.stringify({
      actividades: [
        {
          nombre: "Taller de cueca",
          descripcion: "Free workshop for older adults.",
          fecha: null,
          hora: null,
          lugar: "Centro Cultural",
          direccion: "Lo Prado, Santiago",
          categoria: "taller",
          gratuito: true,
          precio_texto: null,
          fuente_url: null,
          confidence: 0.9,
        },
      ],
      confidence: 0.9,
    });

  const groundedResponse = () => ({
    text: validActivityJson(),
    candidates: [
      {
        groundingMetadata: {
          groundingChunks: [
            { web: { uri: "https://muniloprado.cl/taller", title: "Muni Lo Prado" } },
            { web: { uri: "https://cultura.gob.cl/e/1", title: "Cultura" } },
          ],
        },
      },
    ],
  });

  beforeEach(() => {
    vi.clearAllMocks();
    process.env["GEMINI_API_KEY"] = "test-key";
    vi.mocked(GoogleGenAI).mockImplementation(
      () =>
        ({
          models: { generateContent: generateContentMock },
        }) as unknown as InstanceType<typeof GoogleGenAI>,
    );
  });

  it("enables the googleSearch tool and returns grounded sources", async () => {
    generateContentMock.mockResolvedValueOnce(groundedResponse());

    const result = await buscarActividadesConGemini({ ubicacion: "Lo Prado, Santiago" });

    expect(generateContentMock).toHaveBeenCalledTimes(1);
    const config = generateContentMock.mock.calls[0]?.[0]?.config;
    expect(config?.tools).toEqual([{ googleSearch: {} }]);
    // JSON mode must stay off: it is incompatible with the search tool on gemini-2.5-flash.
    expect(config?.responseMimeType).toBeUndefined();
    expect(result.sources).toEqual([
      { title: "Muni Lo Prado", url: "https://muniloprado.cl/taller" },
      { title: "Cultura", url: "https://cultura.gob.cl/e/1" },
    ]);
    expect(result.warnings.join(" ")).not.toMatch(/no grounded sources/i);
    expect(result.confidence).toBe(0.9);
  });

  it("warns and caps confidence when grounding returns no chunks twice", async () => {
    generateContentMock.mockResolvedValue({ text: validActivityJson(), candidates: [{}] });

    const result = await buscarActividadesConGemini({ ubicacion: "Lo Prado, Santiago" });

    // First attempt ungrounded → one reground attempt → still ungrounded.
    expect(generateContentMock).toHaveBeenCalledTimes(2);
    expect(result.sources).toEqual([]);
    expect(result.warnings.join(" ")).toMatch(/no grounded sources/i);
    // Ungrounded answers must stay below the 0.85 HITL gate.
    expect(result.confidence).toBeLessThan(0.85);
    expect(result.confidence).toBeLessThanOrEqual(UNGROUNDED_CONFIDENCE_CAP);
  });

  it("regrounds on the second attempt when the first skips the search tool", async () => {
    generateContentMock.mockResolvedValueOnce({ text: validActivityJson(), candidates: [{}] });
    generateContentMock.mockResolvedValueOnce(groundedResponse());

    const result = await buscarActividadesConGemini({ ubicacion: "Lo Prado, Santiago" });

    expect(generateContentMock).toHaveBeenCalledTimes(2);
    expect(result.sources?.length).toBe(2);
    expect(result.warnings.join(" ")).not.toMatch(/no grounded sources/i);
    expect(result.confidence).toBe(0.9);
  });

  it("parses grounded answers prefixed with a bare JSON token (no JSON mode)", async () => {
    // Live-verified 2026-09-04: without responseMimeType the model sometimes
    // returns "JSON\n{...}". The parser must tolerate that prefix.
    generateContentMock.mockResolvedValueOnce({
      text: `JSON\n${validActivityJson()}`,
      candidates: [
        {
          groundingMetadata: {
            groundingChunks: [{ web: { uri: "https://example.cl/a", title: "Example A" } }],
          },
        },
      ],
    });

    const result = await buscarActividadesConGemini({ ubicacion: "Lo Prado, Santiago" });

    expect(result.total).toBe(1);
    expect(result.sources).toEqual([{ title: "Example A", url: "https://example.cl/a" }]);
    expect(result.warnings.join(" ")).not.toMatch(/no grounded sources/i);
  });

  it("retries once after a 429 and keeps the retried grounding", async () => {
    generateContentMock.mockRejectedValueOnce(new Error("429 RESOURCE_EXHAUSTED: quota hit"));
    generateContentMock.mockResolvedValueOnce(groundedResponse());

    const result = await buscarActividadesConGemini({ ubicacion: "Lo Prado, Santiago" });

    expect(generateContentMock).toHaveBeenCalledTimes(2);
    expect(result.sources?.length).toBe(2);
    expect(result.confidence).toBe(0.9);
  });

  it("keeps fuente_url null in JSON and takes long grounding redirect URLs from chunks", async () => {
    // Regression: with grounding the model pasted ~300-char vertexaisearch
    // redirect URLs into every fuente_url, blowing the output budget and
    // truncating the JSON mid-URL (Zod/parse failure). The prompt now forces
    // fuente_url null; real references come from groundingChunks → sources.
    const longUrlA = `https://vertexaisearch.cloud.google.com/grounding-api-redirect/${"A".repeat(250)}`;
    const longUrlB = `https://vertexaisearch.cloud.google.com/grounding-api-redirect/${"B".repeat(250)}`;
    expect(longUrlA.length).toBeGreaterThan(300);
    expect(longUrlB.length).toBeGreaterThan(300);
    generateContentMock.mockResolvedValueOnce({
      text: validActivityJson(),
      candidates: [
        {
          groundingMetadata: {
            groundingChunks: [
              { web: { uri: longUrlA, title: "Grounded A" } },
              { web: { uri: longUrlB, title: "Grounded B" } },
            ],
          },
        },
      ],
    });

    const result = await buscarActividadesConGemini({ ubicacion: "Lo Prado, Santiago" });

    // Parse survived (no truncation failure) with null per-activity URLs.
    expect(result.total).toBe(1);
    expect(result.actividades[0]?.fuente_url).toBeNull();
    // Long grounding URLs surface via sources, not via the JSON payload.
    expect(result.sources).toEqual([
      { title: "Grounded A", url: longUrlA },
      { title: "Grounded B", url: longUrlB },
    ]);
    // Output budget raised so grounded answers fit.
    expect(generateContentMock.mock.calls[0]?.[0]?.config?.maxOutputTokens).toBe(8192);
    // Gemini-only prompt nudge; Groq path stays untouched.
    expect(String(generateContentMock.mock.calls[0]?.[0]?.contents)).toMatch(/fuente_url to null/i);
  });

  it("normalizes DD/MM/YYYY to ISO and free-text dates to null without throwing", async () => {
    // Regression (live 2026-09-04): without responseMimeType the grounded model
    // returns "12/09/2026" / "próximo sábado" and Zod threw a raw error on
    // actividades.N.fecha. Tolerant normalization must fix that pre-validation.
    const base = JSON.parse(validActivityJson()) as {
      actividades: Array<Record<string, unknown>>;
      confidence: number;
    };
    const withDriftedDates = {
      ...base,
      actividades: [
        { ...base.actividades[0], nombre: "Actividad uno", fecha: "12/09/2026" },
        { ...base.actividades[0], nombre: "Actividad dos", fecha: "próximo sábado" },
      ],
    };
    generateContentMock.mockResolvedValueOnce({
      text: JSON.stringify(withDriftedDates),
      candidates: [
        {
          groundingMetadata: {
            groundingChunks: [{ web: { uri: "https://example.cl/a", title: "Example A" } }],
          },
        },
      ],
    });

    const result = await buscarActividadesConGemini({ ubicacion: "Lo Prado, Santiago" });

    expect(result.total).toBe(2);
    expect(result.actividades[0]?.fecha).toBe("2026-09-12");
    expect(result.actividades[1]?.fecha).toBeNull();
  });

  it("wraps residual validation failures as friendly [gemini] errors", async () => {
    // A payload that stays invalid AFTER normalization (empty nombre) must
    // reject with a [gemini] retry hint, never a raw ZodError stack.
    const base = JSON.parse(validActivityJson()) as {
      actividades: Array<Record<string, unknown>>;
      confidence: number;
    };
    const invalid = {
      ...base,
      actividades: [{ ...base.actividades[0], nombre: "", fecha: "12/09/2026" }],
    };
    generateContentMock.mockResolvedValue({
      text: JSON.stringify(invalid),
      candidates: [
        {
          groundingMetadata: {
            groundingChunks: [{ web: { uri: "https://example.cl/a", title: "Example A" } }],
          },
        },
      ],
    });

    await expect(buscarActividadesConGemini({ ubicacion: "Lo Prado, Santiago" })).rejects.toThrow(
      /\[gemini\].*retry/i,
    );
  });

  it("forces search via MUST instructions and exposes searched:true with a full trace", async () => {
    generateContentMock.mockResolvedValueOnce({
      text: validActivityJson(),
      candidates: [
        {
          finishReason: "STOP",
          groundingMetadata: {
            webSearchQueries: ["talleres adultos mayores Lo Prado"],
            searchEntryPoint: { renderedContent: "<div>search results</div>" },
            groundingChunks: [{ web: { uri: "https://example.cl/a", title: "Example A" } }],
          },
        },
      ],
      usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50, totalTokenCount: 150 },
    });

    const result = await buscarActividadesConGemini({ ubicacion: "Lo Prado, Santiago" });

    // Prompt-level forcing: no toolConfig force exists for googleSearch, so the
    // MUST instruction in the user contents is the enforcement mechanism.
    const contents = String(generateContentMock.mock.calls[0]?.[0]?.contents);
    expect(contents).toMatch(/MUST use the Google Search tool/i);
    expect(result.searched).toBe(true);
    expect(result.trace?.searched).toBe(true);
    expect(result.trace?.verdict).toBe("grounded");
    expect(result.trace?.model).toBe("gemini-2.5-flash");
    expect(result.trace?.queries).toEqual(["talleres adultos mayores Lo Prado"]);
    expect(result.trace?.attempts).toHaveLength(1);
    const attempt = result.trace?.attempts[0];
    expect(attempt?.finishReason).toBe("STOP");
    expect(attempt?.promptTokens).toBe(100);
    expect(attempt?.candidatesTokens).toBe(50);
    expect(attempt?.totalTokens).toBe(150);
    expect(attempt?.groundingChunkCount).toBe(1);
    expect(attempt?.sourceCount).toBe(1);
    expect(attempt?.searched).toBe(true);
    expect(result.trace?.totalPromptTokens).toBe(100);
    expect(result.trace?.totalTokens).toBe(150);
    expect(result.trace?.groundingChunkCount).toBe(1);
    expect(result.trace?.sourceCount).toBe(1);
    expect(result.trace?.confidence).toBe(result.confidence);
    expect(result.trace?.retries).toEqual([]);
    // Prompts travel truncated (<=2000 chars each).
    expect(attempt?.systemPrompt.length).toBeLessThanOrEqual(2000);
    expect(attempt?.userPrompt.length).toBeLessThanOrEqual(2000);
    expect(typeof result.trace?.startedAt).toBe("string");
    expect(typeof result.trace?.durationMs).toBe("number");
  });

  it("exposes searched:false with a memory verdict when the model never searches", async () => {
    generateContentMock.mockResolvedValue({ text: validActivityJson(), candidates: [{}] });

    const result = await buscarActividadesConGemini({ ubicacion: "Lo Prado, Santiago" });

    expect(generateContentMock).toHaveBeenCalledTimes(2);
    expect(result.searched).toBe(false);
    expect(result.trace?.searched).toBe(false);
    expect(result.trace?.verdict).toBe("memory");
    expect(result.trace?.queries).toEqual([]);
    expect(result.trace?.attempts).toHaveLength(2);
    expect(result.trace?.attempts.every((a) => a.searched === false)).toBe(true);
  });

  it("distinguishes searched-without-results: searched:true but memory verdict", async () => {
    generateContentMock.mockResolvedValueOnce({ text: validActivityJson(), candidates: [{}] });
    generateContentMock.mockResolvedValueOnce({
      text: validActivityJson(),
      candidates: [{ groundingMetadata: { webSearchQueries: ["actividades Lo Prado"] } }],
    });

    const result = await buscarActividadesConGemini({ ubicacion: "Lo Prado, Santiago" });

    expect(generateContentMock).toHaveBeenCalledTimes(2);
    // A search ran (queries present) but returned zero usable chunks.
    expect(result.searched).toBe(true);
    expect(result.trace?.searched).toBe(true);
    expect(result.trace?.queries).toEqual(["actividades Lo Prado"]);
    // No sources back the answer, so the verdict stays memory and the
    // confidence cap keeps it below the HITL gate.
    expect(result.trace?.verdict).toBe("memory");
    expect(result.sources).toEqual([]);
    expect(result.confidence).toBeLessThan(0.85);
  });
});
