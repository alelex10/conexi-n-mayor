# Conexión Mayor

> Piloto para **Lo Prado, Santiago de Chile** — conecta a personas de 60+ años con actividades gratuitas o de bajo costo cercanas a su hogar, con interfaz móvil de fricción cero.

[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![TanStack Start](https://img.shields.io/badge/TanStack_Start-1.168-FF4154?logo=react&logoColor=white)](https://tanstack.com/start)
[![TanStack Router](https://img.shields.io/badge/TanStack_Router-1.170-FF4154)](https://tanstack.com/router)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20RLS-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![WCAG](https://img.shields.io/badge/WCAG-AAA-0A7B3E)](./docs/06-requisitos-producto.md#requisitos-no-funcionales)
[![License](https://img.shields.io/badge/license-MIT-lightgrey)](#)

> [!CAUTION]
> **A DECIDIR — Nombre definitivo:** candidatos actuales: **Conexión Mayor**, **Actividad Fácil**, **Ciudad Viva Mayor**. *Conexión Mayor* se usa como nombre de trabajo hasta el anuncio oficial. Ver [`docs/01-vision-general.md`](./docs/01-vision-general.md#nombre-del-producto).

## Contenido

- [Qué es](#qué-es)
- [Documentación](#documentación)
- [Stack](#stack)
- [Inicio rápido](#inicio-rápido)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Scripts](#scripts)
- [Roadmap](#roadmap)
- [Development](#development)
- [Build with Lovable](#build-with-lovable)

## Qué es

Plataforma **web mobile-first** (siguiente etapa: PWA) que resuelve un flujo único con excelencia: **descubrir → entender → llegar**.

- Sin registro ni inicio de sesión; 1–2 tarjetas grandes por pantalla.
- Filtro por distancia caminable o en micro directa (800 m / 1500 m / 2500 m).
- Ficha con baño y estacionamiento siempre explícitos (`sí` / `no` / `sin información`).
- Módulo “Cómo llegar” en lenguaje natural + Google Maps; integración de transporte a alto nivel (ver [`docs/04-integracion-transporte.md`](./docs/04-integracion-transporte.md)).

> [!NOTE]
> La plataforma original del PRD era Android nativo / Flutter. La dirección vigente es **web primero, luego PWA**. Ver [`docs/01-vision-general.md`](./docs/01-vision-general.md#evolución-de-plataforma-del-prd-original-a-la-web-actual) y [`docs/07-arquitectura-y-stack.md`](./docs/07-arquitectura-y-stack.md#evolución-web-primero-luego-pwa).

## Documentación

Toda la documentación vive en [`docs/`](./docs/README.md). El índice maestro explica cómo leerla.

| Documento | Descripción |
|-----------|-------------|
| [docs/README.md](./docs/README.md) | **Índice maestro** — leyenda de estados y guía de lectura. |
| [docs/01-vision-general.md](./docs/01-vision-general.md) | Visión, público 60+, alcance Lo Prado y evolución de plataforma. |
| [docs/02-estrategia-adquisicion-actividades.md](./docs/02-estrategia-adquisicion-actividades.md) | **Estrategia de Adquisición de Actividades** — APIs, scraping, IA+Web Search, carga manual y recomendación híbrida. |
| [docs/03-nucleo-descubrimiento-actividades.md](./docs/03-nucleo-descubrimiento-actividades.md) | Núcleo: listado, filtro por radio, tarjeta y ficha de detalle. |
| [docs/04-integracion-transporte.md](./docs/04-integracion-transporte.md) | Transporte a alto nivel (radio taxi + deep-link apps) — ⏳ pendiente detalle implementación. |
| [docs/05-concepto-cerca-radio-distancia.md](./docs/05-concepto-cerca-radio-distancia.md) | Qué significa “cerca”: 500–800 m caminable, hasta 2,5 km en micro directa. |
| [docs/06-requisitos-producto.md](./docs/06-requisitos-producto.md) | **PRD completo** — funcionales y no funcionales con checkboxes de MVP. |
| [docs/07-arquitectura-y-stack.md](./docs/07-arquitectura-y-stack.md) | Stack real actual y evolución hacia PWA. |
| [docs/08-roadmap.md](./docs/08-roadmap.md) | Timeline por fases y próximos pasos. |

## Stack

| Capa | Tecnología |
|------|------------|
| Framework | TanStack Start (React 19) + TanStack Router + Vite 8 |
| Datos | Supabase (Postgres + RLS) — tablas `actividades` y `sugerencias` |
| UI | Tailwind CSS 4 + shadcn / Radix UI |
| Validación | Zod + React Hook Form |

Detalle completo en [`docs/07-arquitectura-y-stack.md`](./docs/07-arquitectura-y-stack.md).

## Inicio rápido

Requisitos: Node.js 18+ y npm (o bun). Recomendado instalar con [nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
# 1. Clonar e instalar
git clone <this-repository-url>
cd conexi-n-mayor
npm i

# 2. Variables de entorno (solo servidor — nunca commitear .env)
cp .env.example .env
# Editar .env con SB_URL, SB_PUBLISHABLE_KEY y SB_SECRET_KEY
# Valores en: Supabase Dashboard → Project Settings → API

# 3. Crear esquema y datos seed en Supabase
# Supabase Dashboard → SQL Editor → New query → pegar supabase/schema.sql completo → Run
# Debe devolver 5 filas en: SELECT * FROM public.actividades WHERE estado='publicada';

# 4. Desarrollo
npm run dev
# Abre http://localhost:3000

# 5. (Opcional) Verificar datos sin Supabase
# Si .env no está configurado, la app usa el fallback mock de src/data/actividades.ts
```

> [!IMPORTANT]
> Las claves `SB_*` son **solo de servidor** (Nitro). No uses prefijo `VITE_` y no expongas `SB_SECRET_KEY` al cliente. Ver [`.env.example`](./.env.example) y [`docs/07-arquitectura-y-stack.md`](./docs/07-arquitectura-y-stack.md#variables-de-entorno).

## Estructura del proyecto

```
├── docs/                  # Documentación (índice + 8 guías)
├── public/                # Estáticos
├── src/
│   ├── components/        # UI (shadcn) + componentes de dominio
│   ├── data/actividades.ts # Tipos, RADIO_OPCIONES, RADIO_TAXIS (ejemplo), fallback mock
│   ├── lib/               # Server functions (Supabase)
│   ├── routes/            # Rutas file-based (/, /actividad.$id, /sugerencias, /db)
│   └── styles.css         # Tailwind base
├── supabase/schema.sql    # Esquema autoritativo (tipos, tablas, RLS, seed)
├── vite.config.ts         # Wrapper sobre @lovable.dev/vite-tanstack-config
└── package.json
```

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo (Vite) |
| `npm run build` | Build de producción |
| `npm run preview` | Previsualizar build |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

## Roadmap

```
Fase 0  template tanstack_start_ts (0f401e5)
Fase 1  MVP Actividad Fácil (0e5e3b9)
Fase 2  Réplica Ciudad Viva Mayor — diseño referencia (e1abf19)
Fase 3  Supabase conectado — schema + RLS + seed (7cfb336 / a6a31cd / 1f61d23)
Fase 4  Lista del barrio + unificación diseño (2ec5e7b) + merge (7b60b28)
Ahora  Estabilización web + docs/
Próximo  PWA · Automatizar adquisición · Transporte detallado · Validación Oficina Adulto Mayor
```

Detalle por fase en [`docs/08-roadmap.md`](./docs/08-roadmap.md).

## Development

Trabajo local recomendado:

- Node.js + npm vía nvm; `npm run dev` levanta el entorno en `http://localhost:3000`.
- Antes de tocar estilos o rutas, revisa [`docs/03-nucleo-descubrimiento-actividades.md`](./docs/03-nucleo-descubrimiento-actividades.md) y [`docs/06-requisitos-producto.md`](./docs/06-requisitos-producto.md) para no romper requisitos de accesibilidad (WCAG AAA, 18sp/24sp, 48×48 dp, 0 % publicidad).
- Cambios en el modelo de datos: editar [`supabase/schema.sql`](./supabase/schema.sql) (idempotente) y reflejar en [`src/data/actividades.ts`](./src/data/actividades.ts) si afecta tipos o constantes.

## Build with Lovable

Este proyecto fue creado con [Lovable](https://lovable.dev) y permanece sincronizado con su editor.

- **Editor:** [a690934b-bfd5-4300-84f1-3a1ea437414d](https://lovable.dev/projects/a690934b-bfd5-4300-84f1-3a1ea437414d) — cada cambio en Lovable se commitea a este repositorio.
- **Propiedad total:** el código es tuyo; `git push` a `main` sincroniza de vuelta a Lovable.
- Evita reescribir historial publicado (`rebase` / `force push` sobre commits ya sincronizados).

---

¿Primera vez aquí? Empieza por [`docs/README.md`](./docs/README.md) → [`docs/01-vision-general.md`](./docs/01-vision-general.md).
