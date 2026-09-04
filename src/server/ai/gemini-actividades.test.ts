import { beforeEach, describe, expect, it, vi } from "vitest";

import { GoogleGenAI } from "@google/genai";

import { buscarInputSchema } from "@/lib/groq-actividades.functions";
import {
  buscarActividadesConGemini,
  DEFAULT_GEMINI_MODEL,
  extractGroundedSources,
  extractJsonObject,
  getGeminiClient,
  isValidGeminiModel,
  resolveGeminiModel,
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
});
