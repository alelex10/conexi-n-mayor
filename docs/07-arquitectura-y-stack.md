---
title: "07 — Arquitectura y Stack"
description: "Stack real actual (TanStack Start + Supabase), estructura del proyecto y evolución hacia PWA."
---

# 07 — Arquitectura y Stack

> Qué hay hoy, por qué se eligió y qué falta decidir para llegar a PWA.

**Estado:** ✅ Definido (stack actual) / 🚧 A decidir (hosting, PWA, offline) / 🔜 Roadmap futuro (PWA)

## Contenido

- [Stack real actual](#stack-real-actual)
- [Evolución: web primero, luego PWA](#evolución-web-primero-luego-pwa)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Supabase: esquema y RLS](#supabase-esquema-y-rls)
- [Variables de entorno](#variables-de-entorno)
- [Decisiones pendientes](#decisiones-pendientes)
- [Documentos relacionados](#documentos-relacionados)

## Stack real actual

| Capa | Tecnología | Versión / Detalle | Propósito |
|------|------------|-------------------|-----------|
| **Framework** | TanStack Start (React 19) + TanStack Router | `1.168.x` / `1.170.x` | SSR, routing file-based, server functions |
| **Build** | Vite 8 + `@lovable.dev/vite-tanstack-config` | `8.1.5` / `2.15.0` | Dev server, build, alias `@`, Nitro/Cloudflare target |
| **Runtime server** | Nitro 3 (beta) | `3.0.260603-beta` | Adaptador de despliegue (Cloudflare por defecto) |
| **UI** | Tailwind CSS 4 + shadcn (Radix UI) | `4.2.1` | Estilos, componentes accesibles |
| **Iconos** | lucide-react | `0.575.0` | Iconografía |
| **Validación** | Zod + React Hook Form | `3.24.2` / `7.71.2` | Formularios (sugerencias, carga) |
| **Fechas** | date-fns | `4.1.0` | Formateo localizado `es-CL` |
| **Datos** | Supabase (Postgres + RLS) | `@supabase/supabase-js` `2.112.4` | Persistencia de `actividades` y `sugerencias` |
| **Utilidades** | clsx, tailwind-merge, class-variance-authority | — | Composición de clases |
| **Calidad** | ESLint 9 + Prettier 3 + TypeScript 5.8 (strict) | — | Lint, formato, tipos |

Fuente: [`package.json`](../package.json), [`vite.config.ts`](../vite.config.ts), [`tsconfig.json`](../tsconfig.json).

> [!NOTE]
> `vite.config.ts` delega la mayor parte de la configuración a `@lovable.dev/vite-tanstack-config` (TanStack devtools, `viteReact`, `tailwindcss`, `tsConfigPaths`, Nitro, alias `@`, dedupe). No duplicar plugins manualmente.

## Evolución: web primero, luego PWA

```
PRD original: Android nativo / Flutter / React Native
      │
      ▼
Actual: WEB responsive mobile-first (TanStack Start + Vite + Supabase)  ← estamos aquí
      │
      ▼
Siguiente: PWA (instalable, offline parcial, manifest + service worker)  ← roadmap futuro
```

**Por qué web primero (decisión vigente):**

- Distribución inmediata sin stores; iteración rápida con la contraparte municipal.
- Reutilización total del código web para PWA (no hay reescritura).
- Validación de producto antes de invertir en empaquetado nativo.

> [!IMPORTANT]
> **PWA no está implementada aún.** No hay `manifest.json` instalable ni service worker en el build actual. Ver [08-roadmap.md](./08-roadmap.md) para los pasos previstos.

Evolución prevista hacia PWA:

1. Manifest + iconos + `theme_color` acordes a WCAG AAA y marca definitiva.
2. Service worker con estrategia cache-first para shell y listado; datos de Supabase con revalidación.
3. Offline parcial: última lista vista + ficha en caché.
4. Criterio de instalación (beforeinstallprompt) sin ser invasivo.

> [!CAUTION]
> **A DECIDIR — PWA:** estrategia de caché, alcance offline, política de actualización del service worker, y si habrá notificaciones push (requiere permiso explícito y caso de uso validado). Ver también [08-roadmap.md](./08-roadmap.md).

## Estructura del proyecto

```
.
├── public/                     # Estáticos (favicons, imágenes)
├── src/
│   ├── components/             # UI shadcn + componentes de dominio
│   ├── data/
│   │   └── actividades.ts      # Tipos Actividad, RADIO_OPCIONES, RADIO_TAXIS (ejemplo), fallback mock
│   ├── lib/
│   │   └── actividades.functions.ts  # Server functions: listarActividades / obtenerActividad
│   ├── routes/                 # Rutas TanStack Router (/, /sugerencias, /db, etc.)
│   ├── hooks/                  # Hooks compartidos
│   ├── router.tsx              # Definición del router
│   ├── routeTree.gen.ts        # Generado — no editar a mano
│   ├── server.ts               # Entry SSR (Nitro)
│   ├── start.ts                # Entry cliente
│   └── styles.css              # Tailwind base + tokens
├── supabase/
│   └── schema.sql              # Esquema autoritativo (tipos, tablas, RLS, seed 5 actividades)
├── vite.config.ts              # Wrapper sobre @lovable.dev/vite-tanstack-config
├── tsconfig.json               # Strict, paths @/*, bundler resolution
└── docs/                       # Esta documentación
```

Convenciones vigentes:

- **Alias `@/*` → `src/*`** (definido en `tsconfig.json` y en el config de Lovable).
- **Rutas file-based** de TanStack Router; `routeTree.gen.ts` es generado.
- **Server functions** en `src/lib/*.functions.ts` para acceso a Supabase desde el servidor.

## Supabase: esquema y RLS

Fuente autoritativa: [`supabase/schema.sql`](../supabase/schema.sql) — idempotente, ejecutable completo en SQL Editor.

### Tipos

```sql
disponibilidad   — 'si' | 'no' | 'sin_info'
estado_actividad — 'borrador' | 'publicada' | 'archivada'
tipo_sugerencia  — 'sugerencia' | 'error' | 'actividad'
```

### Tabla `public.actividades`

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | text PK | ej. `taller-memoria` |
| `nombre`, `descripcion`, `categoria` | text | `descripcion` y `categoria` con defaults |
| `fecha`, `hora` | date, time | Índice `actividades_fecha_idx (fecha, hora)` |
| `lugar`, `direccion` | text | Dirección textual para Maps/deep-links |
| `latitud`, `longitud` | double precision | Opcionales hoy; requeridas para geolocalización real |
| `distancia_metros` | integer | Índice `actividades_distancia_idx`; valor curado en seed |
| `gratuito`, `precio` | boolean, text | `precio` solo si `gratuito = false` |
| `bano`, `estacionamiento` | `disponibilidad` | `sin_info` por defecto |
| `como_llegar`, `fuente` | text | Texto natural + origen del dato |
| `estado` | `estado_actividad` | `publicada` por defecto; índice `actividades_estado_idx` |
| `creado_en`, `actualizado_en` | timestamptz | `now()` |

**RLS:**

- `anon` y `authenticated` → `SELECT` solo donde `estado = 'publicada'`.
- `service_role` → acceso total (bypass RLS).

Seed actual: 5 actividades de Lo Prado (`taller-memoria`, `gimnasia-entretenida`, `baile-entretenido`, `control-salud`, `taller-celular`) con `ON CONFLICT (id) DO UPDATE`.

### Tabla `public.sugerencias`

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | uuid PK | `gen_random_uuid()` |
| `tipo` | `tipo_sugerencia` | `sugerencia` / `error` / `actividad` |
| `nombre`, `contacto` | text | Opcionales |
| `mensaje` | text | Requerido |
| `revisado` | boolean | `false` por defecto |
| `creado_en` | timestamptz | `now()` |

**RLS:**

- `anon` / `authenticated` → `INSERT` con `WITH CHECK (true)` (formulario público).
- Lectura solo vía `service_role` (sin política pública de `SELECT`).

## Variables de entorno

Definidas en [`.env.example`](../.env.example) — **solo servidor**, nunca exponer al cliente.

| Variable | Descripción | Dónde se consigue |
|----------|-------------|-------------------|
| `SB_URL` | URL del proyecto Supabase (`https://<ref>.supabase.co`) | Supabase Dashboard → Project Settings → API |
| `SB_PUBLISHABLE_KEY` | Clave pública (anon) — respeta RLS | idem |
| `SB_SECRET_KEY` | Clave secreta `sb_secret_*` — **bypasa RLS**, solo servidor | idem |

> [!CAUTION]
> **Seguridad:** `SB_SECRET_KEY` nunca se commitea ni se expone al cliente. El proyecto usa a propósito `SB_*` en lugar de `VITE_*` / `SUPABASE_*` para dejar claro que son variables de servidor (Nitro). Si una clave se filtró en un chat o log, rotarla antes de usarla.

Inicio rápido local:

```sh
cp .env.example .env   # completar SB_URL y claves
npm i
npm run dev
```

Luego ejecutar [`supabase/schema.sql`](../supabase/schema.sql) completo en Supabase SQL Editor.

> [!NOTE]
> **Pipeline híbrido a escala nacional:** el diseño validado para 345 comunas (pg_cron + pgmq + staging con hash + enrich Vision/geocode + validación humana) está detallado en [fuentes-de-datos/03-arquitectura-hibrida-oleada-3.md](./fuentes-de-datos/03-arquitectura-hibrida-oleada-3.md). Ver también [02-estrategia-adquisicion-actividades.md](./02-estrategia-adquisicion-actividades.md) (resumen) y [fuentes-de-datos/04-sintesis-recomendacion.md](./fuentes-de-datos/04-sintesis-recomendacion.md) (síntesis).

## Decisiones pendientes

> [!CAUTION]
> **A DECIDIR — Hosting y despliegue:**
> Destino definitivo (Cloudflare es el default de `@lovable.dev/vite-tanstack-config`, pero no está fijado como decisión final), dominio, pipeline de deploy y estrategia de variables de entorno en producción.

> [!CAUTION]
> **A DECIDIR — PWA y offline:**
> Alcance del service worker, estrategia de caché, manifest e iconografía final (depende del nombre definitivo — ver [01-vision-general.md](./01-vision-general.md#nombre-del-producto)), y si habrá notificaciones push.

> [!CAUTION]
> **A DECIDIR — Geolocalización en vivo:**
> Cálculo de distancia real (Haversine) vs. `distancia_metros` curada, flujo de permiso de ubicación, tratamiento de `latitud`/`longitud` faltantes y privacidad. Ver [05-concepto-cerca-radio-distancia.md](./05-concepto-cerca-radio-distancia.md).

> [!CAUTION]
> **A DECIDIR — Observabilidad:**
> Logging, monitoreo de errores y métricas de uso (sin tracking invasivo, coherente con RNF-07).

## Documentos relacionados

- [01-vision-general.md](./01-vision-general.md) — evolución de plataforma.
- [02-estrategia-adquisicion-actividades.md](./02-estrategia-adquisicion-actividades.md) — origen y validación de datos (resumen).
- [fuentes-de-datos/README.md](./fuentes-de-datos/README.md) — investigación profunda 345 comunas (deep dive).
- [fuentes-de-datos/03-arquitectura-hibrida-oleada-3.md](./fuentes-de-datos/03-arquitectura-hibrida-oleada-3.md) — pipeline híbrido nacional.
- [03-nucleo-descubrimiento-actividades.md](./03-nucleo-descubrimiento-actividades.md) — flujo que consume Supabase.
- [06-requisitos-producto.md](./06-requisitos-producto.md) — requisitos que el stack debe satisfacer.
- [08-roadmap.md](./08-roadmap.md) — fases y próximos pasos técnicos.
