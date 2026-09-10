import { useRef, useState } from "react";
import { buscarActividadesPorUbicacionFn } from "@/lib/groq-actividades.functions";
import { DEFAULT_MODEL, UBICACION_SHORT_ERROR } from "../constants";
import type { BuscarResult, DevicePayload, Proveedor } from "../types";
import {
  buildCleanSearchPayload,
  buildFullSearchPayload,
  isUbicacionValid,
  mapSearchError,
} from "../utils";

export type CleanSearchRequest = {
  mode: "clean";
  ubicacion: string;
  devicePayload: DevicePayload;
};

export type FullSearchRequest = {
  mode: "full";
  ubicacion: string;
  radioMetros: string;
  categoria: string;
  fechaDesde: string;
  modeloActual: string;
  proveedor: Proveedor;
  devicePayload: DevicePayload;
};

export type SearchRequest = CleanSearchRequest | FullSearchRequest;

export type BuscarActividadesState = {
  buscando: boolean;
  result: BuscarResult | null;
  error: string | null;
  elapsedMs: number | null;
  handleBuscar: (request: SearchRequest) => Promise<void>;
};

/**
 * Owns the search lifecycle (buscando/result/error/elapsedMs). The clean
 * variant always searches with radio 2500 + DEFAULT_MODEL, mirroring the
 * original inline branch.
 */
export function useBuscarActividades(): BuscarActividadesState {
  const [buscando, setBuscando] = useState(false);
  const [result, setResult] = useState<BuscarResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const startRef = useRef<number>(0);

  const handleBuscar = async (request: SearchRequest) => {
    if (!isUbicacionValid(request.ubicacion)) {
      setError(UBICACION_SHORT_ERROR);
      return;
    }
    setBuscando(true);
    setError(null);
    setResult(null);
    setElapsedMs(null);
    startRef.current = Date.now();
    try {
      const payload =
        request.mode === "clean"
          ? buildCleanSearchPayload(request.ubicacion, request.devicePayload, DEFAULT_MODEL)
          : buildFullSearchPayload({
              ubicacion: request.ubicacion,
              radioMetros: request.radioMetros,
              categoria: request.categoria,
              fechaDesde: request.fechaDesde,
              modeloActual: request.modeloActual,
              proveedor: request.proveedor,
              devicePayload: request.devicePayload,
            });
      const res = await buscarActividadesPorUbicacionFn({ data: payload });
      setResult(res as BuscarResult);
      setElapsedMs(Date.now() - startRef.current);
    } catch (e) {
      setError(mapSearchError(e));
      setElapsedMs(Date.now() - startRef.current);
    } finally {
      setBuscando(false);
    }
  };

  return { buscando, result, error, elapsedMs, handleBuscar };
}
