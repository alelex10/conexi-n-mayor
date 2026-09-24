---
title: "02 — Estrategia de Adquisición de Actividades"
description: "Metodologías para poblar el catálogo de actividades y recomendación híbrida para el MVP."
---

# 02 — Estrategia de Adquisición de Actividades

> Cómo se obtiene, valida y mantiene actualizado el catálogo de actividades de Lo Prado.
> Este documento reemplaza al apartado “Operación de carga de datos” del PRD original y lo reorganiza por metodologías.

**Estado:** 🚧 A decidir — la recomendación híbrida está acordada a alto nivel; faltan definiciones de operación y validación.

> [!NOTE]
> Este archivo es el resumen ejecutivo vigente. La investigación de detalle (3 oleadas, 345 comunas) se archivó fuera de `docs/` para mantener solo lo esencial.

## Contenido

- [Resumen](#resumen)
- [2.1 APIs de Gobierno](#21-apis-de-gobierno)
- [2.2 Scraping web](#22-scraping-web)
- [2.3 IA + Web Search](#23-ia--web-search)
- [2.4 Carga manual comunitaria](#24-carga-manual-comunitaria)
- [2.5 Recomendación para el MVP: enfoque híbrido](#25-recomendación-para-el-mvp-enfoque-híbrido)
- [Tabla comparativa](#tabla-comparativa)
- [Modelo de datos y validación](#modelo-de-datos-y-validación)
- [Documentos relacionados](#documentos-relacionados)

## Resumen

No existe una única fuente completa y confiable de actividades locales para Lo Prado. La estrategia combina varias metodologías con distintos niveles de cobertura, frescura y costo operativo. El MVP prioriza **cobertura útil con validación humana** por sobre automatización total.

> [!IMPORTANT]
> Ninguna metodología por sí sola cubre el 100 % de la oferta. La tabla comparativa al final resume el compromiso entre factibilidad, confiabilidad y mantenimiento.

## 2.1 APIs de Gobierno

**Qué es:** consumo de APIs públicas de `datos.gob.cl`, SENAMA u otros portales de gobierno que expongan eventos o actividades con estructura formal.

| Aspecto | Detalle |
|---------|---------|
| **Factibilidad en Lo Prado** | Media-baja. Existen datos presupuestarios y programáticos, pero rara vez hay APIs REST de eventos locales en vivo a nivel comunal. |
| **Ventajas** | Datos estructurados, gratuitos, con licenciamiento claro. |
| **Desventajas / riesgos** | Baja actualización de actividades diarias a nivel municipal; cobertura irregular; dependencia de que el organismo mantenga el endpoint. |
| **Rol en el MVP** | Complementario. Útil si aparece un endpoint relevante; no se diseña el MVP dependiendo de él. |

> [!CAUTION]
> **A DECIDIR:** si se detecta un endpoint útil, quién lo monitorea y con qué frecuencia se sincroniza. Ver también [07-arquitectura-y-stack.md](./07-arquitectura-y-stack.md) para el lugar de esa integración en el stack.

## 2.2 Scraping web

**Qué es:** extracción automatizada del sitio oficial de Lo Prado (`loprado.cl`), Facebook municipal, páginas de centros culturales y sedes vecinales.

| Aspecto | Detalle |
|---------|---------|
| **Factibilidad** | Alta para obtener información directa y local. |
| **Ventajas** | Información primaria de la comuna; puede ejecutarse con frecuencia diaria o semanal. |
| **Desventajas / riesgos** | Frágil ante cambios de diseño del sitio; requiere mantenimiento del scraper; puede necesitar manejo de paginación, JS renderizado y límites de tasa; aspectos legales/ToS de cada fuente. |
| **Rol en el MVP** | Fuente principal automatizada, combinada con validación humana. |

Buenas prácticas si se implementa:

- Selectores resilientes y pruebas de regresión sobre fixtures HTML.
- Registro de última extracción, hash de contenido y alertas cuando la estructura cambia.
- Respeto de `robots.txt` y términos de cada sitio.

> [!CAUTION]
> **A DECIDIR:** alcance exacto de sitios a scrapear, frecuencia de ejecución, infraestructura donde corre el job y responsable de reparar el scraper cuando se rompe.

## 2.3 IA + Web Search

**Qué es:** agentes o scripts semanales que buscan eventos en noticias, redes sociales locales y web abierta, y sintetizan texto desestructurado a un formato limpio de actividad.

| Aspecto | Detalle |
|---------|---------|
| **Factibilidad** | Alta para sintetizar texto desestructurado. |
| **Ventajas** | Permite normalizar fuentes heterogéneas (afiches en imagen, posteos, notas) a un esquema común; amplía cobertura más allá de un solo sitio. |
| **Desventajas / riesgos** | Requiere **validación humana** para evitar alucinaciones; costo de inferencia; necesidad de prompts y esquemas estables; manejo de duplicados. |
| **Rol en el MVP** | Capa de normalización sobre scraping y otras fuentes; no publica directo sin revisión. |

En el repositorio ya existen ramas de exploración con extracción por visión (Groq) para pipeline de afiches con umbral HITL — ver [08-roadmap.md](./08-roadmap.md). Esa línea de trabajo es **experimental** y no forma parte del MVP publicado hasta que tenga validación.

> [!CAUTION]
> **A DECIDIR:** modelo/proveedor definitivo, umbral de confianza para publicación automática vs. revisión humana, quién valida y en qué herramienta (panel interno, tabla Supabase, etc.).

## 2.4 Carga manual comunitaria

**Qué es:** formulario o panel simple administrado por la **Oficina del Adulto Mayor de Lo Prado**, juntas de vecinos y organizaciones comunitarias para cargar actividades directamente.

| Aspecto | Detalle |
|---------|---------|
| **Factibilidad** | Alta. |
| **Ventajas** | 100 % confiable y verificado en origen; cubre actividades que no aparecen en web/redes. |
| **Desventajas / riesgos** | Depende de la voluntad y el tiempo de los encargados locales; requiere capacitación mínima y recordatorios. |
| **Rol en el MVP** | Fuente de verdad para actividades críticas; base de los datos seed actuales. |

Estado actual en el código:

- Tabla `public.actividades` en Supabase con RLS (ver [`supabase/schema.sql`](../supabase/schema.sql)).
- Datos seed de 5 actividades de Lo Prado insertados vía `schema.sql`.
- Tipo `disponibilidad` (`si` / `no` / `sin_info`) para baño y estacionamiento.

> [!CAUTION]
> **A DECIDIR:** diseño final del panel de carga (quién accede, autenticación, validación de campos, flujo de publicación `borrador → publicada → archivada`), y acuerdo operativo con la Oficina del Adulto Mayor.

## 2.5 Recomendación para el MVP: enfoque híbrido

**Recomendación vigente (acordada a alto nivel, pendiente de detalle operativo):**

> **IA + Scraping automático** de la web y redes de Lo Prado **combinado con panel simple de carga manual** para organizaciones comunitarias, con **validación humana** antes de publicar.

Diagrama de flujo (conceptual):

```
[ loprado.cl / FB / centros ] --scraping--> [ Normalización IA ] --+
                                                                    +--> [ Revisión humana ] --> [ Supabase: actividades publicadas ] --> [ Web ]
[ Carga manual comunitaria ] ---------------------------------------+
[ APIs Gobierno (si existen) ] --sync periódico--> [ Revisión ] ----+
```

Criterios de publicación:

- Toda actividad entra como `borrador` si proviene de scraping/IA; pasa a `publicada` solo tras revisión.
- La carga manual de usuarios autorizados puede publicar directo según el acuerdo operativo (a definir).
- Campos mínimos obligatorios: `nombre`, `fecha`, `hora`, `lugar`, `direccion`, `categoria`, `como_llegar`.

## Tabla comparativa

| Metodología | Factibilidad en Lo Prado | Cobertura | Frescura | Confiabilidad | Costo operativo | Fragilidad | Rol en MVP |
|-------------|--------------------------|-----------|----------|---------------|-----------------|------------|------------|
| **APIs de Gobierno** | Media-baja | Baja-media | Baja | Alta (si existe) | Bajo | Baja | Complementario |
| **Scraping web** | Alta | Media-alta | Alta | Media | Medio (mantener scraper) | **Alta** (cambios de DOM) | Fuente automatizada principal |
| **IA + Web Search** | Alta | Alta | Alta | Media (requiere validación) | Medio-alto | Media | Normalización + ampliación |
| **Carga manual comunitaria** | Alta | Media (depende de personas) | Media | **100 %** | Alto (tiempo humano) | Baja | Fuente de verdad curada |

> [!NOTE]
> La tabla resume la investigación original del PRD. Los valores son cualitativos y sirven para priorizar, no como métrica exacta.

## Modelo de datos y validación

Fuente autoritativa: [`supabase/schema.sql`](../supabase/schema.sql).

Campos clave de `public.actividades`:

- `id` (text, PK), `nombre`, `descripcion`, `categoria`, `fecha`, `hora`
- `lugar`, `direccion`, `latitud`/`longitud` (opcionales), `distancia_metros`
- `gratuito` (boolean), `precio` (text, si no es gratuito)
- `bano` / `estacionamiento` (`disponibilidad`: `si` / `no` / `sin_info`)
- `como_llegar` (texto natural), `fuente`, `estado` (`borrador` / `publicada` / `archivada`)

Validación:

- RLS: `anon` y `authenticated` solo leen `estado = 'publicada'`; `service_role` tiene acceso completo.
- Sugerencias (`public.sugerencias`) permiten `INSERT` anónimo; lectura solo vía `service_role`.

## Documentos relacionados

- [01-vision-general.md](./01-vision-general.md) — contexto del piloto.
- [03-nucleo-descubrimiento-actividades.md](./03-nucleo-descubrimiento-actividades.md) — cómo se presenta cada actividad al usuario.
- [06-requisitos-producto.md](./06-requisitos-producto.md) — PRD y criterios de aceptación.
- [07-arquitectura-y-stack.md](./07-arquitectura-y-stack.md) — dónde vive cada integración en el stack.
- [08-roadmap.md](./08-roadmap.md) — fases y automatización futura.
