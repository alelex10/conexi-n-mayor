/* eslint-disable prettier/prettier */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { describe, it, expect } from "vitest";
import { detectarIdsDesdeEtiqueta, normalizarNombre } from "./ubicacion-match";

describe("normalizarNombre", () => {
  it("folds accents and case", () => {
    expect(normalizarNombre("Maipú")).toBe("maipu");
    expect(normalizarNombre("  O'Higgins ")).toBe("o'higgins");
    expect(normalizarNombre("Aysén")).toBe("aysen");
  });
});

describe("detectarIdsDesdeEtiqueta", () => {
  it("matches Lo Prado commune first", () => {
    expect(detectarIdsDesdeEtiqueta("Lo Prado")).toEqual({ regionId: 1, communeId: 311 });
  });
  it("matches Santiago commune (not a region)", () => {
    expect(detectarIdsDesdeEtiqueta("Santiago")).toEqual({ regionId: 1, communeId: 295 });
  });
  it("matches accent-insensitive labels", () => {
    expect(detectarIdsDesdeEtiqueta("maipu")).toEqual({ regionId: 1, communeId: 313 });
    expect(detectarIdsDesdeEtiqueta("Coyhaique")?.regionId).toBe(12);
  });
  it("matches region when no commune matches", () => {
    expect(detectarIdsDesdeEtiqueta("Magallanes")).toEqual({ regionId: 13, communeId: null });
    expect(detectarIdsDesdeEtiqueta("Metropolitana de Santiago")).toEqual({ regionId: 1, communeId: null });
  });
  it("returns null for empty or unknown labels", () => {
    expect(detectarIdsDesdeEtiqueta(null)).toBeNull();
    expect(detectarIdsDesdeEtiqueta("")).toBeNull();
    expect(detectarIdsDesdeEtiqueta("Springfield")).toBeNull();
  });
});
