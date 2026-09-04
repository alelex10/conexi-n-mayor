import { describe, expect, it } from "vitest";

import { buscarInputSchema } from "@/lib/groq-actividades.functions";
import {
  buscarActividadesConGemini,
  DEFAULT_GEMINI_MODEL,
  getGeminiClient,
  isValidGeminiModel,
  resolveGeminiModel,
} from "./gemini-actividades";
import { isValidProvider } from "./providers";

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
