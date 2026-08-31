---
title: "05 — Concepto de 'Cerca' y Radio de Distancia"
description: "Qué significa 'cerca' para adultos mayores en Lo Prado y cómo se traduce a filtros en la interfaz."
---

# 05 — Concepto de “Cerca” y Radio de Distancia

> “Cerca” no es un número arbitrario. Es lo que una persona de 60+ puede recorrer con comodidad y sin transbordos.

**Estado:** ✅ Definido

## Contenido

- [Definición](#definición)
- [Umbrales de distancia](#umbrales-de-distancia)
- [Traducción a la interfaz](#traducción-a-la-interfaz)
- [Lenguaje para el usuario](#lenguaje-para-el-usuario)
- [Datos y cálculo](#datos-y-cálculo)
- [Documentos relacionados](#documentos-relacionados)

## Definición

En el contexto de Lo Prado, “cerca” se define por **esfuerzo y autonomía**, no solo por metros:

- **Caminable:** trayecto que una persona con movilidad reducida leve puede hacer a pie, a paso pausado, sin depender de transporte.
- **En micro directa:** trayecto que requiere como máximo **una micro sin transbordo ni combinación de Metro**.

Esta definición evita proponer actividades que, aunque estén a 2 km en línea recta, exijan dos micros o un tramo a pie excesivo.

## Umbrales de distancia

| Umbral | Distancia | Tiempo estimado | Contexto | Uso en producto |
|--------|-----------|-----------------|----------|-----------------|
| **Caminable (paso pausado)** | **500–800 m** | 10–15 min | ~5 a 8 cuadras. Límite recomendado para movilidad reducida leve. | Filtro por defecto |
| **Intermedio** | **hasta 1,5 km** | ~18–25 min a pie / corto en micro | Actividades aún cercanas, posiblemente a pie o micro corta | Segunda opción de radio |
| **Micro directa sin transbordo** | **hasta 2,5 km** | Variable según tránsito | Requiere solo 1 micro directa (ej. J10, 405 por San Pablo) | Radio máximo del MVP |

> [!NOTE]
> Los valores provienen de la investigación de campo del PRD original y de la realidad de la red de movilidad de Lo Prado (ejes San Pablo, Las Rejas, Buzeta). No son radios euclidianos teóricos: el texto `como_llegar` de cada actividad aclara el trayecto real (ver [03-nucleo-descubrimiento-actividades.md](./03-nucleo-descubrimiento-actividades.md)).

Referencias concretas del seed actual:

- 550 m — Taller de memoria, Centro Cultural Lo Prado
- 620 m — Taller de celular, Biblioteca Municipal
- 780 m — Gimnasia, Plaza Buzeta (límite caminable)
- 1400 m — Baile, Junta de Vecinos N°12 (intermedio)
- 2100 m — Control de salud, CESFAM (micro directa)

Ver [`supabase/schema.sql`](../supabase/schema.sql) y [`src/data/actividades.ts`](../src/data/actividades.ts).

## Traducción a la interfaz

El filtro de radio en la UI ofrece exactamente tres opciones — ni más ni menos — para no sobrecargar la decisión:

| Etiqueta en UI | Valor (`RADIO_OPCIONES.valor`) | Intención comunicada |
|----------------|-------------------------------|----------------------|
| **Caminando (800 m)** | `800` | “Puedo ir a pie sin cansarme” |
| **Cerca (1,5 km)** | `1500` | “Un poco más lejos, pero sigue siendo mi barrio” |
| **En micro (2,5 km)** | `2500` | “Necesito una micro, pero sin transbordo” |

Definición en código: `RADIO_OPCIONES` en [`src/data/actividades.ts`](../src/data/actividades.ts).

```ts
export const RADIO_OPCIONES = [
  { valor: 800,  etiqueta: "Caminando (800 m)" },
  { valor: 1500, etiqueta: "Cerca (1,5 km)" },
  { valor: 2500, etiqueta: "En micro (2,5 km)" },
];
```

Comportamiento:

- El filtro por defecto es **800 m** (caminable).
- Cambiar el radio actualiza inmediatamente el listado; no requiere “Aplicar”.
- Si no hay resultados en el radio actual, se sugiere ampliar al siguiente.

> [!CAUTION]
> **A DECIDIR:** si el radio por defecto debe ser configurable por el usuario o fijo en 800 m. También si a futuro se añade geolocalización en vivo para ordenar por distancia real vs. `distancia_metros` curada.

## Lenguaje para el usuario

Para este público, los metros crudos no son el lenguaje principal. Cada distancia se comunica en dos formas:

| Forma | Ejemplo | Dónde aparece |
|-------|---------|---------------|
| Métrica | “780 metros” / “1,4 km” | Badge de distancia (formateada por `formatearDistancia`) |
| Natural | “A 8 cuadras caminando” / “También pasa la micro 405 por Buzeta” | Texto `como_llegar` + descripción |

La ficha combina ambas: la métrica da precisión, el texto natural da tranquilidad.

## Datos y cálculo

| Aspecto | Estado actual | Evolución prevista |
|---------|---------------|--------------------|
| `distancia_metros` | Valor curado por actividad en Supabase y en `src/data/actividades.ts` | Cálculo dinámico por geolocalización del usuario (Haversine) cuando se habilite permiso de ubicación |
| `latitud` / `longitud` | Columnas opcionales en `public.actividades` | Requeridas para cálculo real y para Google Maps / deep-links |
| Orden del listado | Por `distancia_metros` y `fecha` | Por distancia real si hay ubicación; fallback a curada |

> [!IMPORTANT]
> Activar geolocalización en vivo requiere consentimiento explícito, manejo de permiso denegado y fallback claro. No se implementa hasta definir el flujo de permisos y privacidad (ver [07-arquitectura-y-stack.md](./07-arquitectura-y-stack.md) y [08-roadmap.md](./08-roadmap.md)).

## Documentos relacionados

- [03-nucleo-descubrimiento-actividades.md](./03-nucleo-descubrimiento-actividades.md) — cómo el filtro afecta el listado y la tarjeta.
- [04-integracion-transporte.md](./04-integracion-transporte.md) — cómo se resuelve el traslado una vez elegida la actividad.
- [06-requisitos-producto.md](./06-requisitos-producto.md) — requisito funcional de filtro por radio.
- [07-arquitectura-y-stack.md](./07-arquitectura-y-stack.md) — implementación técnica del filtro y geolocalización futura.
