---
title: "04 — Integración de Transporte"
description: "Alcance a alto nivel de las opciones para llegar a una actividad. Detalles de implementación pendientes."
---

# 04 — Integración de Transporte

> Cómo el usuario resuelve “¿cómo llego?” sin fricción. Este documento describe solo el alcance a alto nivel; los detalles de implementación quedan pendientes.

**Estado:** ⏳ Pendiente detalle implementación

## Contenido

- [Objetivo](#objetivo)
- [Alcance actual: dos niveles](#alcance-actual-dos-niveles)
- [Nivel 1 — Llamada directa a radio taxi](#nivel-1--llamada-directa-a-radio-taxi)
- [Nivel 2 — Deep-link a apps de transporte](#nivel-2--deep-link-a-apps-de-transporte)
- [Módulo “Cómo llegar” en la ficha](#módulo-cómo-llegar-en-la-ficha)
- [Qué queda explícitamente pendiente](#qué-queda-explícitamente-pendiente)
- [Documentos relacionados](#documentos-relacionados)

## Objetivo

Para el público 60+ de Lo Prado, la integración de transporte no debe exigir aprender una nueva aplicación. El MVP ofrece **texto claro + accesos directos** para resolver el traslado con lo que el usuario ya sabe usar: micro, taxi telefónico o app de transporte si ya la tiene instalada.

> [!IMPORTANT]
> Este documento no define números telefónicos finales, URLs de deep-link ni lógica de detección de apps instaladas. Solo fija la dirección a alto nivel para que el diseño y la ficha de actividad reserven el espacio correcto.

## Alcance actual: dos niveles

| Nivel | Mecanismo | Fricción para el usuario | Estado |
|-------|-----------|--------------------------|--------|
| **1** | Llamada directa a radio taxis locales | Baja — un toque inicia la llamada | ⏳ Pendiente detalle implementación |
| **2** | Deep-link a apps de transporte (Uber / Cabify / DiDi) | Media — abre la app con destino precargado | ⏳ Pendiente detalle implementación |
| — | Texto “Cómo llegar” + botón Google Maps | Baja — siempre disponible | ✅ Definido (ver [03-nucleo-descubrimiento-actividades.md](./03-nucleo-descubrimiento-actividades.md)) |

Los dos niveles son **complementarios**, no excluyentes. El usuario elige el que le resulte más familiar.

## Nivel 1 — Llamada directa a radio taxi

**Idea:** un botón grande que inicia una llamada telefónica a una central de radio taxi que opere en Lo Prado o comunas adyacentes (Pudahuel, Estación Central).

Características previstas:

- Botón con etiqueta clara (ej. “Llamar radio taxi”) y área de toque 48×48 dp.
- `tel:` link estándar; el sistema operativo resuelve la llamada.
- Lista corta de centrales sugeridas (no un directorio exhaustivo).

Datos de referencia en código (solo a modo de ejemplo, no son definitivos):

> Los valores actuales en [`src/data/actividades.ts`](../src/data/actividades.ts) (`RADIO_TAXIS`) son **datos de ejemplo** usados durante el desarrollo del MVP. No deben interpretarse como el directorio final.

> [!CAUTION]
> **A DECIDIR — PENDIENTE DEFINIR DETALLES DE IMPLEMENTACIÓN:**
> Directorio final de centrales (nombres, teléfonos validados, cobertura real en Lo Prado), orden de presentación, validación con la Oficina del Adulto Mayor, y si se muestra uno o varios contactos. No se publicarán teléfonos sin verificación.

## Nivel 2 — Deep-link a apps de transporte

**Idea:** un botón “Pedir auto a esta actividad” que abre la app de transporte con el destino ya ingresado, evitando que el usuario escriba la dirección.

Características previstas:

- Deep-link o universal link hacia Uber / Cabify / DiDi con `direccion` y/o `latitud`/`longitud` de la actividad como destino.
- Si la app no está instalada, fallback a versión web o a Google Maps.
- No se gestiona pago ni seguimiento del viaje dentro del producto.

> [!CAUTION]
> **A DECIDIR — PENDIENTE DEFINIR DETALLES DE IMPLEMENTACIÓN:**
> Esquemas de deep-link por proveedor, manejo de apps no instaladas, formato de destino (dirección textual vs. coordenadas), y validación de que el flujo no confunda a usuarios que nunca han usado estas apps. Requiere pruebas con usuarios reales antes de definir copy y orden de botones.

## Módulo “Cómo llegar” en la ficha

Independiente de los dos niveles anteriores, cada ficha de actividad incluye:

| Elemento | Fuente | Estado |
|----------|--------|--------|
| Texto natural de indicaciones | `como_llegar` (ej. “Llegar en micro J10, bajarse en San Pablo con Las Rejas…”) | ✅ Definido |
| Dirección textual | `direccion` | ✅ Definido |
| Botón Google Maps | URL con dirección/coordenadas | ✅ Definido |
| Bloque de transporte (radio taxi + apps) | Ver niveles 1 y 2 | ⏳ Pendiente detalle implementación |

Ver detalle de la ficha en [03-nucleo-descubrimiento-actividades.md](./03-nucleo-descubrimiento-actividades.md#ficha-de-detalle) y radios en [05-concepto-cerca-radio-distancia.md](./05-concepto-cerca-radio-distancia.md).

## Qué queda explícitamente pendiente

> [!CAUTION]
> **PENDIENTE DEFINIR DETALLES DE IMPLEMENTACIÓN — No profundizar hasta acordar:**
>
> - Directorio validado de radio taxis (nombres y teléfonos finales).
> - Esquemas y parámetros exactos de deep-link por app (Uber / Cabify / DiDi).
> - Detección de app instalada vs. fallback web.
> - Copy final de botones y orden visual en la ficha.
> - Validación con usuarios 60+ y con la contraparte municipal.
> - Cualquier integración que requiera API key o acuerdo comercial.

Hasta que estos puntos se definan, la ficha de actividad debe reservar el espacio visual para el bloque de transporte sin implementar lógica telefónica o de deep-link definitiva.

## Documentos relacionados

- [03-nucleo-descubrimiento-actividades.md](./03-nucleo-descubrimiento-actividades.md) — ficha de detalle donde vive el módulo “Cómo llegar”.
- [05-concepto-cerca-radio-distancia.md](./05-concepto-cerca-radio-distancia.md) — umbrales que determinan qué actividades se muestran.
- [06-requisitos-producto.md](./06-requisitos-producto.md) — requisito funcional de transporte.
- [07-arquitectura-y-stack.md](./07-arquitectura-y-stack.md) — dónde encajaría esta integración en el stack.
- [08-roadmap.md](./08-roadmap.md) — cuándo se aborda el detalle de transporte.
