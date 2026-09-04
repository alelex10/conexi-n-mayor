import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Client-only device location detection for AI search variants.
 *
 * Single `getCurrentPosition` attempt per mount inside `useEffect`
 * (SSR-safe: no `navigator` access during render). Reverse-geocodes to a
 * Spanish place-name label only when coords resolve; any failure hides the
 * label while manual search keeps working.
 */

export type LocationStatus = "idle" | "locating" | "ok" | "denied" | "timeout" | "unavailable";

export type DeviceCoords = {
  latitud: number;
  longitud: number;
};

export type UseDeviceLocation = {
  status: LocationStatus;
  coords: DeviceCoords | null;
  locationLabel: string | null;
  retry: () => void;
};

export const GEOLOCATION_OPTIONS = {
  timeout: 10_000,
  maximumAge: 300_000,
  enableHighAccuracy: false,
} as const;

/**
 * Maps GeolocationPositionError codes to hook status.
 * 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT.
 * Unknown codes fall back to `unavailable` (manual search stays usable).
 */
export function mapGeolocationErrorCode(code: number): LocationStatus {
  if (code === 1) return "denied";
  if (code === 3) return "timeout";
  return "unavailable";
}

/**
 * Render-safe availability check. Returns false on SSR (no `navigator`),
 * when the Geolocation API is missing, or in non-secure contexts
 * (localhost counts as secure per spec, so it stays allowed).
 */
export function isGeolocationAvailable(): boolean {
  if (typeof navigator === "undefined") return false;
  if (!("geolocation" in navigator) || !navigator.geolocation) return false;
  if (
    typeof window !== "undefined" &&
    "isSecureContext" in window &&
    window.isSecureContext === false
  ) {
    return false;
  }
  return true;
}

export function buildReverseGeocodeUrl(latitud: number, longitud: number): string {
  return (
    "https://api.bigdatacloud.net/data/reverse-geocode-client" +
    `?latitude=${latitud}&longitude=${longitud}&localityLanguage=es`
  );
}

/**
 * Extracts a human-readable place NAME from a BigDataCloud response.
 * Returns null on any unexpected shape so the caller hides the label.
 */
export function parseReverseGeocodeLabel(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const obj = json as Record<string, unknown>;
  for (const key of ["locality", "city", "principalSubdivision", "countryName"]) {
    const value = obj[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return null;
}

/**
 * Single-attempt guard backing `attemptedRef`. `claim()` returns true only
 * for the first call after construction/`reset()` — this is the mechanism
 * that prevents automatic re-prompt loops. `retry` calls `reset()` first.
 */
export function createAttemptRunner(): { claim: () => boolean; reset: () => void } {
  let claimed = false;
  return {
    claim() {
      if (claimed) return false;
      claimed = true;
      return true;
    },
    reset() {
      claimed = false;
    },
  };
}

const STATUS_MESSAGES: Record<LocationStatus, string | null> = {
  idle: null,
  locating: "Detectando tu ubicación…",
  ok: null,
  denied:
    "No pudimos acceder a tu ubicación. Podés buscar escribiendo tu comuna o barrio, o reintentar con “Usar mi ubicación”.",
  timeout:
    "Detectar tu ubicación tardó demasiado. Podés buscar escribiendo tu comuna o barrio, o reintentar con “Usar mi ubicación”.",
  unavailable:
    "No pudimos detectar tu ubicación en este dispositivo. Podés buscar escribiendo tu comuna o barrio.",
};

/** Warm es-CL copy for the `role="status"` line; null when nothing should show. */
export function getLocationStatusMessage(
  status: LocationStatus,
  locationLabel: string | null,
): string | null {
  if (status === "ok") {
    if (locationLabel) return `Ubicación detectada: ${locationLabel}.`;
    return "Ubicación detectada. Usaremos tu posición aproximada como referencia.";
  }
  return STATUS_MESSAGES[status];
}

export function useDeviceLocation(): UseDeviceLocation {
  const [status, setStatus] = useState<LocationStatus>("idle");
  const [coords, setCoords] = useState<DeviceCoords | null>(null);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const runnerRef = useRef<{ claim: () => boolean; reset: () => void } | null>(null);
  if (runnerRef.current === null) {
    runnerRef.current = createAttemptRunner();
  }

  const attempt = useCallback(() => {
    const runner = runnerRef.current;
    if (!runner || !runner.claim()) return;
    if (!isGeolocationAvailable()) {
      setStatus("unavailable");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          latitud: position.coords.latitude,
          longitud: position.coords.longitude,
        });
        setStatus("ok");
      },
      (error) => {
        setStatus(mapGeolocationErrorCode(error.code));
      },
      { ...GEOLOCATION_OPTIONS },
    );
  }, []);

  const retry = useCallback(() => {
    runnerRef.current?.reset();
    setLocationLabel(null);
    attempt();
  }, [attempt]);

  // Single auto-attempt per mount. Empty deps on purpose: re-renders and
  // permission denials must never re-prompt automatically.
  useEffect(() => {
    attempt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reverse-geocode only when coords resolved; any failure hides the label.
  useEffect(() => {
    if (status !== "ok" || coords === null) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(buildReverseGeocodeUrl(coords.latitud, coords.longitud));
        if (!response.ok) return;
        const json: unknown = await response.json();
        if (cancelled) return;
        setLocationLabel(parseReverseGeocodeLabel(json));
      } catch {
        if (!cancelled) setLocationLabel(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, coords]);

  return { status, coords, locationLabel, retry };
}
