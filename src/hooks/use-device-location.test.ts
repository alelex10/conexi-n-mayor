import { describe, expect, it, vi, afterEach } from "vitest";

import {
  buildReverseGeocodeUrl,
  createAttemptRunner,
  getLocationStatusMessage,
  isGeolocationAvailable,
  mapGeolocationErrorCode,
  parseReverseGeocodeLabel,
} from "./use-device-location";

describe("mapGeolocationErrorCode", () => {
  it("maps PERMISSION_DENIED (1) to denied", () => {
    expect(mapGeolocationErrorCode(1)).toBe("denied");
  });

  it("maps TIMEOUT (3) to timeout", () => {
    expect(mapGeolocationErrorCode(3)).toBe("timeout");
  });

  it("maps POSITION_UNAVAILABLE (2) to unavailable", () => {
    expect(mapGeolocationErrorCode(2)).toBe("unavailable");
  });

  it("maps unknown codes to unavailable so manual search keeps working", () => {
    expect(mapGeolocationErrorCode(0)).toBe("unavailable");
    expect(mapGeolocationErrorCode(99)).toBe("unavailable");
  });
});

describe("isGeolocationAvailable (SSR guard)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns false in node (no geolocation API), matching SSR on Workers", () => {
    expect("geolocation" in globalThis.navigator).toBe(false);
    expect(isGeolocationAvailable()).toBe(false);
  });

  it("returns true when geolocation exists in a secure context", () => {
    vi.stubGlobal("navigator", { geolocation: {} });
    expect(isGeolocationAvailable()).toBe(true);
  });
});

describe("createAttemptRunner (single-attempt ref)", () => {
  it("allows the first claim and blocks repeats without reset", () => {
    const runner = createAttemptRunner();
    expect(runner.claim()).toBe(true);
    expect(runner.claim()).toBe(false);
    expect(runner.claim()).toBe(false);
  });

  it("allows exactly one new attempt after reset (retry path)", () => {
    const runner = createAttemptRunner();
    expect(runner.claim()).toBe(true);
    runner.reset();
    expect(runner.claim()).toBe(true);
    expect(runner.claim()).toBe(false);
  });

  it("keeps runners independent per hook instance", () => {
    const a = createAttemptRunner();
    const b = createAttemptRunner();
    expect(a.claim()).toBe(true);
    expect(b.claim()).toBe(true);
  });
});

describe("buildReverseGeocodeUrl", () => {
  it("targets BigDataCloud client endpoint with Spanish locality", () => {
    const url = buildReverseGeocodeUrl(-33.44, -70.66);
    expect(url).toContain("https://api.bigdatacloud.net/data/reverse-geocode-client");
    expect(url).toContain("latitude=-33.44");
    expect(url).toContain("longitude=-70.66");
    expect(url).toContain("localityLanguage=es");
  });
});

describe("parseReverseGeocodeLabel", () => {
  it("prefers locality as the place NAME", () => {
    expect(parseReverseGeocodeLabel({ locality: "Lo Prado", city: "Santiago" })).toBe("Lo Prado");
  });

  it("falls back to city subdivision chain when locality is empty", () => {
    expect(parseReverseGeocodeLabel({ locality: "", city: "Santiago" })).toBe("Santiago");
    expect(parseReverseGeocodeLabel({ principalSubdivision: "Región Metropolitana" })).toBe(
      "Región Metropolitana",
    );
  });

  it("returns null on failure shapes so the label hides gracefully", () => {
    expect(parseReverseGeocodeLabel(null)).toBeNull();
    expect(parseReverseGeocodeLabel(undefined)).toBeNull();
    expect(parseReverseGeocodeLabel({})).toBeNull();
    expect(parseReverseGeocodeLabel({ locality: "   " })).toBeNull();
    expect(parseReverseGeocodeLabel("oops")).toBeNull();
  });
});

describe("getLocationStatusMessage", () => {
  it("returns warm es-CL copy for failure states", () => {
    for (const status of ["denied", "timeout", "unavailable"] as const) {
      const msg = getLocationStatusMessage(status, null);
      expect(msg).toBeTruthy();
      expect(msg).toMatch(/comuna o barrio/);
    }
  });

  it("shows the detected place NAME when ok with label", () => {
    expect(getLocationStatusMessage("ok", "Lo Prado")).toBe("Ubicación detectada: Lo Prado.");
  });

  it("confirms detection without a label when reverse-geocode failed", () => {
    const msg = getLocationStatusMessage("ok", null);
    expect(msg).toMatch(/Ubicación detectada/);
    expect(msg).not.toMatch(/null|undefined/);
  });

  it("shows a locating message and nothing while idle", () => {
    expect(getLocationStatusMessage("locating", null)).toMatch(/Detectando tu ubicación/);
    expect(getLocationStatusMessage("idle", null)).toBeNull();
  });
});
