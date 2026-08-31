---
title: "08 — Roadmap"
description: "Timeline por fases desde el template hasta los próximos pasos del piloto Lo Prado."
---

# 08 — Roadmap

> De dónde venimos, dónde estamos y qué sigue. Cada fase enlaza a los documentos que le dan contexto.

**Estado:** ✅ Definido (histórico y fase actual) / 🔜 Roadmap futuro (próximos pasos)

> [!NOTE]
> **Síntesis nacional:** el roadmap 12 meses 5→50→345 comunas y la decisión pipeline híbrido viven en [fuentes-de-datos/04-sintesis-recomendacion.md](./fuentes-de-datos/04-sintesis-recomendacion.md) (ver también [fuentes-de-datos/README.md](./fuentes-de-datos/README.md)).

## Contenido

- [Línea de tiempo visual](#línea-de-tiempo-visual)
- [Fase 0 — Template](#fase-0--template)
- [Fase 1 — MVP Actividad Fácil](#fase-1--mvp-actividad-fácil)
- [Fase 2 — Diseño de referencia Ciudad Viva Mayor](#fase-2--diseño-de-referencia-ciudad-viva-mayor)
- [Fase 3 — Supabase conectado](#fase-3--supabase-conectado)
- [Fase 4 — Lista del barrio y unificación de diseño](#fase-4--lista-del-barrio-y-unificación-de-diseño)
- [Fase Actual — Estabilización web](#fase-actual--estabilización-web)
- [Próximos pasos](#próximos-pasos)
- [Dependencias y riesgos](#dependencias-y-riesgos)
- [Documentos relacionados](#documentos-relacionados)

## Línea de tiempo visual

```
0f401e5  template tanstack_start_ts
  │
  ├─► 0e5e3b9  MVP Actividad Fácil ──────────────────────► Fase 1
  │
  ├─► e1abf19  Réplica Ciudad Viva Mayor (diseño) ─────► Fase 2
  │
  ├─► 7cfb336 / a6a31cd / 1f61d23 / a6a31cd  Supabase
  │         (schema + RLS + seed 5 actividades) ───────► Fase 3
  │
  ├─► 2ec5e7b  Lista del barrio + unificación diseño ──► Fase 4
  │     7b60b28  Merge main (resolución conflictos)
  │
  ├─► AHORA  Estabilización web + docs/  ◄───────────── Fase Actual
  │
  └─► PRÓXIMO
        ├─ Estabilizar web (accesibilidad, rendimiento)
        ├─ PWA (manifest + offline parcial)
        ├─ Automatizar adquisición (scraping + IA + validación)
        ├─ Transporte — detalle de implementación
        └─ Validación con Oficina Adulto Mayor Lo Prado
```

> [!NOTE]
> Los hashes citados son los inferidos del `git log` (`0f401e5` → `0e5e3b9` → `e1abf19` → `7cfb336`/`a6a31cd`/`1f61d23` → `2ec5e7b` → `7b60b28` → ramas `feat/*` posteriores). Las ramas `feat/ai-groq-extractor`, `feat/ai-model-selector` y `feat/db-vista` son líneas experimentales no integradas al flujo principal.

## Fase 0 — Template

| Atributo | Detalle |
|----------|---------|
| **Commit base** | `0f401e5` — `template: tanstack_start_ts` |
| **Contenido** | Proyecto TanStack Start (React 19) + TanStack Router + Vite + Tailwind + shadcn, sin dominio. |
| **Resultado** | Base técnica lista para iterar. |

## Fase 1 — MVP Actividad Fácil

| Atributo | Detalle |
|----------|---------|
| **Commit** | `0e5e3b9` — *Implementó MVP de Actividad Fácil* |
| **Contenido** | Primer flujo funcional: listado de actividades, tarjeta, ficha con baño/estacionamiento, `como_llegar`, filtro por radio (800/1500/2500), canal `/sugerencias`. Datos mock en `src/data/actividades.ts`. |
| **Documento** | PRD original mapeado en [06-requisitos-producto.md](./06-requisitos-producto.md); núcleo en [03-nucleo-descubrimiento-actividades.md](./03-nucleo-descubrimiento-actividades.md). |

## Fase 2 — Diseño de referencia Ciudad Viva Mayor

| Atributo | Detalle |
|----------|---------|
| **Commit** | `e1abf19` — *replica Ciudad Viva Mayor tal cual diseño de referencia* |
| **Contenido** | Ajuste visual para alinear con el diseño de referencia “Ciudad Viva Mayor” (paleta, tipografía, tarjetas grandes, alto contraste). |
| **Nota de nombre** | Este commit introduce el segundo candidato de nombre. Ver [01-vision-general.md](./01-vision-general.md#nombre-del-producto) — sigue **A decidir**. |

## Fase 3 — Supabase conectado

| Atributo | Detalle |
|----------|---------|
| **Commits** | `7cfb336` (fondo crema), `a6a31cd` (*Conectó el backend con Supabase*), `1f61d23` (*connect routes to Supabase, fix schema inserts, add RLS*), ajustes posteriores |
| **Contenido** | `supabase/schema.sql` con tipos `disponibilidad`/`estado_actividad`/`tipo_sugerencia`, tablas `actividades` y `sugerencias`, RLS, índices y seed de 5 actividades de Lo Prado. Rutas conectadas vía server functions (`listarActividades` / `obtenerActividad`). Fallback a `src/data/actividades.ts` si no hay env. |
| **Documentos** | [07-arquitectura-y-stack.md](./07-arquitectura-y-stack.md#supabase-esquema-y-rls), [02-estrategia-adquisicion-actividades.md](./02-estrategia-adquisicion-actividades.md) |

## Fase 4 — Lista del barrio y unificación de diseño

| Atributo | Detalle |
|----------|---------|
| **Commits** | `2ec5e7b` — *Agrega lista de actividades del barrio y unifica diseño en todas las vistas*; `7b60b28` — *merge(main): resolve conflictos Lovable 2ec5e7b en supabase-integration* |
| **Contenido** | Vista de lista del barrio, unificación visual entre vistas, resolución de conflictos entre ramas `supabase-integration` y `main` (Lovable). |
| **Ramas experimentales relacionadas** | `feat/db-vista` (`/db` para inspeccionar Supabase), `feat/ai-groq-extractor` (visión Groq para afiches con HITL), `feat/ai-model-selector` — ver notas en [02-estrategia-adquisicion-actividades.md](./02-estrategia-adquisicion-actividades.md). |

## Fase Actual — Estabilización web

| Atributo | Detalle |
|----------|---------|
| **Estado** | 🚧 En curso |
| **Contenido** | Web funcional con Supabase; documentación `docs/` (este set); correcciones de env (`594676b` y siguientes). |
| **Criterios de salida** | `docs/` completo, README raíz reescrito, accesibilidad y rendimiento con medición inicial, seed validado con contraparte. |

## Próximos pasos

| # | Paso | Estado | Descripción | Depende de |
|---|------|--------|-------------|------------|
| **1** | **Estabilizar web** | 🔜 Siguiente | Auditoría WCAG AAA, Lighthouse/Web Vitals, corrección de contrastes y focos, medición RNF-05/RNF-06. | — |
| **2** | **PWA** | 🔜 Roadmap futuro | Manifest, iconos, service worker (offline parcial: última lista + ficha en caché), criterio de instalación no invasivo. | Nombre definitivo, hosting |
| **3** | **Automatizar adquisición** | 🔜 Roadmap futuro | Jobs de scraping (`loprado.cl` / FB), normalización IA + validación humana, panel de carga manual para Oficina Adulto Mayor. Ver deep dive: [fuentes-de-datos/](./fuentes-de-datos/README.md) + [03-arquitectura-hibrida](./fuentes-de-datos/03-arquitectura-hibrida-oleada-3.md) y [Síntesis 12 meses](./fuentes-de-datos/04-sintesis-recomendacion.md#6-roadmap-12-meses--5-50-345). | Acuerdo operativo, [02-estrategia-adquisicion-actividades.md](./02-estrategia-adquisicion-actividades.md) |
| **4** | **Transporte — detalle** | ⏳ Pendiente detalle implementación | Directorio validado de radio taxis, deep-links Uber/Cabify/DiDi, copy y orden de botones, pruebas con usuarios 60+. | Validación municipal, [04-integracion-transporte.md](./04-integracion-transporte.md) |
| **5** | **Validación con Oficina Adulto Mayor** | 🔜 Roadmap futuro | Pruebas con usuarios reales 60+, ajuste de lenguaje y radios, acuerdo de carga y actualización de actividades. | Pasos 1–3 |
| **6** | **Geolocalización en vivo (opcional)** | 🚧 A decidir | Cálculo Haversine, flujo de permiso, fallback a `distancia_metros` curada. | Privacidad, [05-concepto-cerca-radio-distancia.md](./05-concepto-cerca-radio-distancia.md) |

> [!CAUTION]
> **A DECIDIR — Orden y priorización:** el orden anterior es el propuesto. Puede ajustarse según la disponibilidad de la contraparte municipal y la validación de las ramas experimentales de IA. Cualquier cambio se refleja aquí y en los documentos afectados.

> [!IMPORTANT]
> **PWA no está hecha.** No prometer instalación ni offline hasta completar el paso 2. La dirección es **web primero, luego PWA** (ver [01-vision-general.md](./01-vision-general.md) y [07-arquitectura-y-stack.md](./07-arquitectura-y-stack.md)).

## Dependencias y riesgos

| Riesgo | Mitigación |
|--------|------------|
| Cambios de DOM rompen scrapers | Tests sobre fixtures HTML + alertas de hash de contenido (ver [02-estrategia-adquisicion-actividades.md](./02-estrategia-adquisicion-actividades.md)) |
| Alucinaciones de IA | Validación humana obligatoria antes de `publicada` |
| Carga manual depende de voluntarios | Acuerdo operativo + recordatorios + panel simple |
| Nombre no definido retrasa PWA/marca | Mantener *Conexión Mayor* como nombre de trabajo hasta decisión (ver [01-vision-general.md](./01-vision-general.md)) |
| Geolocalización sin permiso | Fallback a `distancia_metros` curada + mensaje claro |

## Documentos relacionados

- [01-vision-general.md](./01-vision-general.md) — visión y evolución de plataforma.
- [02-estrategia-adquisicion-actividades.md](./02-estrategia-adquisicion-actividades.md) — automatización futura (resumen).
- [fuentes-de-datos/README.md](./fuentes-de-datos/README.md) — deep dive métodos adquisición 345 comunas.
- [fuentes-de-datos/04-sintesis-recomendacion.md](./fuentes-de-datos/04-sintesis-recomendacion.md) — Síntesis y roadmap 12 meses 5→50→345.
- [fuentes-de-datos/03-arquitectura-hibrida-oleada-3.md](./fuentes-de-datos/03-arquitectura-hibrida-oleada-3.md) — pipeline híbrido nacional + legal/B2G.
- [04-integracion-transporte.md](./04-integracion-transporte.md) — transporte pendiente.
- [05-concepto-cerca-radio-distancia.md](./05-concepto-cerca-radio-distancia.md) — geolocalización futura.
- [06-requisitos-producto.md](./06-requisitos-producto.md) — alcance por fase.
- [07-arquitectura-y-stack.md](./07-arquitectura-y-stack.md) — base técnica para PWA.
