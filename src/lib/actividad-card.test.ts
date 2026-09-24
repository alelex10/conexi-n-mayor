import { describe, expect, it } from "vitest";

import type { Actividad } from "@/data/actividades";
import { etiquetaPrecio, textoUbicacion, tieneDistanciaReal } from "./actividad-card";

const base: Actividad = {
  id: "1",
  nombre: "Concierto",
  fecha: "2026-09-28",
  hora: "18:00",
  lugar: "Centro Cultural",
  direccion: "",
  gratuito: true,
  distanciaMetros: 800,
  bano: "sin_info",
  estacionamiento: "sin_info",
  comoLlegar: "",
  categoria: "Música",
  descripcion: "",
};

describe("etiquetaPrecio", () => {
  it("returns Gratuito for free activities", () => {
    expect(etiquetaPrecio(base)).toBe("Gratuito");
  });

  it("returns the price when paid and known", () => {
    expect(etiquetaPrecio({ ...base, gratuito: false, precio: "$2.000" })).toBe("$2.000");
  });

  it("falls back to De pago when paid without price", () => {
    expect(etiquetaPrecio({ ...base, gratuito: false })).toBe("De pago");
  });
});

describe("tieneDistanciaReal", () => {
  it("is false for ChileCultura (distance is a placeholder)", () => {
    expect(tieneDistanciaReal({ ...base, fuente: "chilecultura" })).toBe(false);
  });

  it("is true for local activities", () => {
    expect(tieneDistanciaReal(base)).toBe(true);
  });
});

describe("textoUbicacion", () => {
  it("returns only the venue when commune is hidden", () => {
    expect(textoUbicacion({ ...base, commune: "Lo Prado" }, false)).toBe("Centro Cultural");
  });

  it("appends the commune when requested", () => {
    expect(textoUbicacion({ ...base, commune: "Lo Prado" }, true)).toBe(
      "Centro Cultural, Lo Prado",
    );
  });

  it("does not repeat the commune when the venue already names it", () => {
    expect(
      textoUbicacion({ ...base, lugar: "Biblioteca de Lo Prado", commune: "Lo Prado" }, true),
    ).toBe("Biblioteca de Lo Prado");
  });

  it("returns the venue when there is no commune", () => {
    expect(textoUbicacion(base, true)).toBe("Centro Cultural");
  });
});
