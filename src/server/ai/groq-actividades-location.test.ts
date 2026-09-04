import { describe, expect, it } from "vitest";

import { buscarInputSchema } from "@/lib/groq-actividades.functions";
import { buildUserPrompt } from "./groq-actividades";

const BASE_INPUT = {
  ubicacion: "Lo Prado, Santiago, Chile",
  radioMetros: 2500,
} as const;

const BASELINE_PROMPT =
  'Ubicación: "Lo Prado, Santiago, Chile"\n' +
  "Radio aproximado: 2500 metros\n" +
  "Instrucciones: Buscá actividades REALES y actuales cerca de esa ubicación (actuá como si hubieras buscado en la web con tu conocimiento). Devolvé SOLO JSON válido según el schema del system prompt. No uses markdown. Usá null donde no tengas dato. Incluí fuente_url cuando exista o sea inferible. El JSON debe ser válido.";

describe("buscarInputSchema device coords (optional ranges)", () => {
  it("accepts absent coords (manual search unchanged)", () => {
    const parsed = buscarInputSchema.parse({ ubicacion: "Lo Prado, Santiago, Chile" });
    expect(parsed.latitud).toBeUndefined();
    expect(parsed.longitud).toBeUndefined();
    expect(parsed.locationLabel).toBeUndefined();
  });

  it("accepts valid coords plus label and forwards all three", () => {
    const parsed = buscarInputSchema.parse({
      ubicacion: "Lo Prado, Santiago, Chile",
      latitud: -33.44,
      longitud: -70.66,
      locationLabel: "Lo Prado",
    });
    expect(parsed.latitud).toBe(-33.44);
    expect(parsed.longitud).toBe(-70.66);
    expect(parsed.locationLabel).toBe("Lo Prado");
  });

  it("rejects out-of-range coords while typed search still validates", () => {
    expect(() =>
      buscarInputSchema.parse({ ubicacion: "Lo Prado", latitud: 120, longitud: -70.66 }),
    ).toThrow();
    expect(() =>
      buscarInputSchema.parse({ ubicacion: "Lo Prado", latitud: -33.44, longitud: 200 }),
    ).toThrow();
    expect(() => buscarInputSchema.parse({ ubicacion: "Lo Prado" })).not.toThrow();
  });

  it("rejects an overlong label", () => {
    expect(() =>
      buscarInputSchema.parse({ ubicacion: "Lo Prado", locationLabel: "x".repeat(201) }),
    ).toThrow();
  });
});

describe("buildUserPrompt device grounding", () => {
  it("is byte-identical to the pre-change prompt when coords are absent", () => {
    expect(buildUserPrompt({ ...BASE_INPUT })).toBe(BASELINE_PROMPT);
  });

  it("inserts exactly one coord line after the Ubicación line when present", () => {
    const grounded = buildUserPrompt({
      ...BASE_INPUT,
      latitud: -33.44,
      longitud: -70.66,
      locationLabel: "Lo Prado",
    });
    const lines = grounded.split("\n");
    expect(lines).toHaveLength(BASELINE_PROMPT.split("\n").length + 1);
    expect(lines[0]).toBe('Ubicación: "Lo Prado, Santiago, Chile"');
    expect(lines[1]).toBe(
      "Ubicación del dispositivo (coords aproximadas, solo referencia, sin calcular distancias): -33.44, -70.66 cerca de Lo Prado — prioriza actividades plausiblemente cercanas; nunca afirmes distancias en metros.",
    );
    expect(grounded).toContain(BASELINE_PROMPT.split("\n").slice(1).join("\n"));
  });

  it("omits the label suffix when reverse-geocode failed, coords still ground", () => {
    const grounded = buildUserPrompt({ ...BASE_INPUT, latitud: -33.44, longitud: -70.66 });
    const coordLine = grounded.split("\n")[1] ?? "";
    expect(coordLine).toContain("-33.44, -70.66 — prioriza");
    expect(coordLine).not.toContain("cerca de");
  });

  it("never emits distance claims", () => {
    const grounded = buildUserPrompt({
      ...BASE_INPUT,
      latitud: -33.44,
      longitud: -70.66,
      locationLabel: "Lo Prado",
    });
    expect(grounded).not.toMatch(/a \d+ metros de usted/i);
    expect(grounded).not.toMatch(/distancia (exacta|calculada|es)/i);
  });

  it("keeps the typed ubicacion line intact alongside coords", () => {
    const grounded = buildUserPrompt({
      ubicacion: "Providencia, Santiago",
      latitud: -33.43,
      longitud: -70.61,
    });
    expect(grounded).toContain('Ubicación: "Providencia, Santiago"');
  });
});
