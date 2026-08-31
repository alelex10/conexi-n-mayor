---
title: "Conexión Mayor — Índice de Documentación"
description: "Punto de entrada a toda la documentación del proyecto piloto Lo Prado."
---

# Conexión Mayor — Índice de Documentación

> Punto de entrada único a la documentación del piloto **Lo Prado, Santiago de Chile**.
> Para el contexto ejecutivo abre [`01-vision-general.md`](./01-vision-general.md); para el detalle técnico, [`07-arquitectura-y-stack.md`](./07-arquitectura-y-stack.md).

**Estado global:** 🚧 En construcción — el MVP web está funcional; varios ejes siguen **A decidir**.

## Contenido

- [Cómo leer esta documentación](#cómo-leer-esta-documentación)
- [Leyenda de estados](#leyenda-de-estados)
- [Mapa de documentos](#mapa-de-documentos)
- [Flujo de lectura recomendado](#flujo-de-lectura-recomendado)
- [Convenciones](#convenciones)
- [Historial de cambios](#historial-de-cambios)

## Cómo leer esta documentación

Esta carpeta `docs/` es la fuente autoritativa de producto, diseño y arquitectura.
El [`README.md` raíz](../README.md) es solo un resumen operativo con instrucciones de inicio rápido.

> [!NOTE]
> Si encuentras información desactualizada, abre un issue o actualiza el archivo correspondiente y registra el cambio en [08-roadmap.md](./08-roadmap.md).

## Leyenda de estados

| Badge                               | Significado                                               | Acción esperada                                   |
| ----------------------------------- | --------------------------------------------------------- | ------------------------------------------------- |
| ✅ Definido                         | Decisión tomada y reflejada en código o diseño            | No requiere debate; mantener actualizado          |
| 🚧 A decidir                        | Falta decisión explícita                                  | Requiere definición antes de implementar          |
| ⏳ Pendiente detalle implementación | Dirección acordada a alto nivel, faltan detalles técnicos | Definir en fase de diseño técnico                 |
| 🔜 Roadmap futuro                   | Acordado como siguiente fase, aún no iniciado             | Planificar según [08-roadmap.md](./08-roadmap.md) |

> [!CAUTION]
> **A DECIDIR — Nombre definitivo del producto:** los candidatos actuales son **Conexión Mayor**, **Actividad Fácil** y **Ciudad Viva Mayor**. Hasta el anuncio oficial, se usa _Conexión Mayor_ como nombre de trabajo en toda la documentación y en los mensajes visibles al usuario se evita fijar marca.

## Mapa de documentos

| #   | Documento                                                                              | Estado                              | Descripción breve                                                                                                                                             |
| --- | -------------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| —   | [README.md](./README.md) _(este archivo)_                                              | ✅ Definido                         | Índice maestro, leyenda y guía de lectura.                                                                                                                    |
| 01  | [01-vision-general.md](./01-vision-general.md)                                         | ✅ Definido                         | Visión, objetivo, público 60+, alcance piloto Lo Prado y evolución de plataforma (Android nativo → web → PWA).                                                |
| 02  | [02-estrategia-adquisicion-actividades.md](./02-estrategia-adquisicion-actividades.md) | 🚧 A decidir                        | **Estrategia de Adquisición de Actividades** — metodologías de carga de datos (APIs, scraping, IA+Web Search, carga manual) y recomendación híbrida para MVP. → Deep dive: [fuentes-de-datos/](./fuentes-de-datos/README.md) |
| 03  | [03-nucleo-descubrimiento-actividades.md](./03-nucleo-descubrimiento-actividades.md)   | ✅ Definido                         | Núcleo del producto: listado, filtro por radio, tarjeta y ficha de detalle (baño / estacionamiento / cómo llegar).                                            |
| 04  | [04-integracion-transporte.md](./04-integracion-transporte.md)                         | ⏳ Pendiente detalle implementación | Integración de transporte a alto nivel (radio taxi + deep-link apps). Sin detalle telefónico ni de implementación final.                                      |
| 05  | [05-concepto-cerca-radio-distancia.md](./05-concepto-cerca-radio-distancia.md)         | ✅ Definido                         | Definición de “cerca”: umbrales caminables y en micro, opciones de radio en UI (800 m / 1500 m / 2500 m).                                                     |
| 06  | [06-requisitos-producto.md](./06-requisitos-producto.md)                               | ✅ Definido                         | PRD completo con requisitos funcionales y no funcionales, checkboxes de MVP y criterios de aceptación.                                                        |
| 07  | [07-arquitectura-y-stack.md](./07-arquitectura-y-stack.md)                             | ✅ Definido / 🚧 A decidir          | Stack real actual (TanStack Start + Supabase + Tailwind), evolución web → PWA y decisiones pendientes (hosting, offline, etc.).                               |
| 08  | [08-roadmap.md](./08-roadmap.md)                                                       | ✅ Definido                         | Timeline por fases desde el template hasta próximos pasos (estabilizar web, PWA, automatizar adquisición, transporte, validación).                            |

## Flujo de lectura recomendado

**Para una primera visita (15 min):**

1. [01-vision-general.md](./01-vision-general.md) — contexto y por qué existe el proyecto.
2. [06-requisitos-producto.md](./06-requisitos-producto.md) — qué hace y qué no hace el MVP.
3. [05-concepto-cerca-radio-distancia.md](./05-concepto-cerca-radio-distancia.md) — qué significa “cerca” para este público.
4. [07-arquitectura-y-stack.md](./07-arquitectura-y-stack.md) — con qué está construido hoy.

**Para profundizar:**

5. [03-nucleo-descubrimiento-actividades.md](./03-nucleo-descubrimiento-actividades.md) — detalle del flujo principal.
6. [02-estrategia-adquisicion-actividades.md](./02-estrategia-adquisicion-actividades.md) — cómo se poblará el contenido.
7. [04-integracion-transporte.md](./04-integracion-transporte.md) — alcance actual de transporte.
8. [08-roadmap.md](./08-roadmap.md) — de dónde venimos y hacia dónde vamos.

## Investigación profunda

> Directorio dedicado portado desde el vault Obsidian `vault/actividad facil/fuentes-de-datos/` — evidencia verificada con `websearch`/`webfetch`, 9 subagentes, 345 comunas.

### `fuentes-de-datos/` — Métodos de adquisición a escala nacional

Investigación 2026-08-27, 3 oleadas sobre 345 comunas. **Entrada:** [fuentes-de-datos/README.md](./fuentes-de-datos/README.md) (MOC).

| # | Documento | Descripción |
|---|-----------|-------------|
| 00 | [README.md](./fuentes-de-datos/README.md) | Índice MOC — mapa de oleadas, hallazgos clave (7 insights) y estado |
| 01 | [01-mapeo-nacional-oleada-1.md](./fuentes-de-datos/01-mapeo-nacional-oleada-1.md) | **Oleada 1 — Mapeo Nacional:** 4 subagentes (APIs, fragmentación 10 comunas, redes, B2G). Tabla maestra 8 fuentes, ranking unificado. ChileCultura como motor. |
| 02 | [02-validacion-tecnica-oleada-2.md](./fuentes-de-datos/02-validacion-tecnica-oleada-2.md) | **Oleada 2 — Validación Técnica:** 3 POCs (scraping seed, IA afiche Vision+mini, panel Supabase). Snippets TS/SQL listos. |
| 03 | [03-arquitectura-hibrida-oleada-3.md](./fuentes-de-datos/03-arquitectura-hibrida-oleada-3.md) | **Oleada 3 — Arquitectura Híbrida:** pipeline pg_cron/pgmq, geocoding 1 req/s, legal Ley 21.719, B2G ChileCompra 30 UTM, alianza Conecta Mayor |
| 04 | [04-sintesis-recomendacion.md](./fuentes-de-datos/04-sintesis-recomendacion.md) | **Síntesis y Recomendación:** veredicto 1 página, matriz decisión final, pipeline híbrido, roadmap 12 meses 5→50→345 |

> [!NOTE]
> `docs/02-estrategia-adquisicion-actividades.md` es el **resumen ejecutivo**. Para evidencia completa, ver `fuentes-de-datos/`.

## Convenciones

- **Idioma:** español neutro profesional en todos los artefactos de `docs/`. Los comentarios y mensajes de código permanecen en inglés cuando el proyecto ya los usa.
- **Formato:** Markdown con tablas GitHub Flavored, callouts `> [!NOTE]` / `> [!IMPORTANT]` / `> [!CAUTION]` y TOC con enlaces ancla.
- **Bloques “A decidir”:** siempre con `> [!CAUTION] > **A DECIDIR:** …` para que sean visibles en GitHub y Lovable.
- **Enlaces cruzados:** cada documento enlaza a los relacionados en su sección final.
- **Fuente de verdad para datos:** [`supabase/schema.sql`](../supabase/schema.sql) y [`src/data/actividades.ts`](../src/data/actividades.ts).

## Historial de cambios

| Fecha      | Cambio                                                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| 2026-08-31 | Creación inicial de `docs/` con 8 documentos + este índice. Estructura basada en PRD original y estado real del código. |

---

**Siguiente paso sugerido:** abre [01-vision-general.md](./01-vision-general.md).
