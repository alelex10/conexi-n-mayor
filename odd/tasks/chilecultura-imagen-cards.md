# chilecultura-imagen-cards — Preview imagen única en cards

## Objective
Mostrar `image` de ChileCultura como preview en cards y detalle, con fallback cuando viene vacía.

## Problem
`RawEvent.image` (string único) se descarta en `mapToActividad`; las cards no tienen preview visual.

## Why
Usuario pidió usar la imagen en la vista previa de las cards (2026-09-24).

## Scope
- `src/data/actividades.ts`: agregar `imagenUrl?: string`
- `src/lib/chilecultura.ts`: pasar `raw.image` en `mapToActividad`
- `src/lib/chilecultura.test.ts`: cubrir imagen presente/ausente
- UI: `src/routes/index.tsx`, `src/routes/comparar.tsx`, `src/routes/actividad.$id.tsx` con `<img loading="lazy">` + alt = nombre
- No tocar Supabase schema (externos son live-merge, no persistidos)

## Constraints
- API da imagen ÚNICA (string URL `uploads/cropped_*`, a veces `""`); `disciplines[]` es array pero no son imágenes
- 60+ UX: imagen decorativa con alt, no romper si falta; lazy + aspect fijo para no mover layout
- No inferir galería múltiple: no existe en API

## Tasks
- [x] T1 — tipo + mapper (route: direct inline, 2 files mecánicos)
- [x] T2 — tests imagen (route: direct inline)
- [x] T3 — previews UI en 3 rutas (route: direct inline, delegación imposible por free-tier)
- [x] T4 — npm test + tsc + commit work-unit

## Authorized scope
Branch feat/chilecultura-imagen-cards, solo `src/data/actividades.ts`, `src/lib/chilecultura*`, `src/routes/index.tsx`, `src/routes/comparar.tsx`, `src/routes/actividad.$id.tsx`, `odd/tasks/chilecultura-imagen-cards.md`. Push/PR decisión del usuario.

## Acceptance criteria
- `mapToActividad` con image URL la expone como `imagenUrl`; con `""` la omite
- Cards ChileCultura muestran `<img>` cuando hay URL, nada roto cuando no hay
- `npm test -- src/lib/chilecultura.test.ts` en verde

## Applicable checks
- `npm test -- src/lib/chilecultura.test.ts`
- `npx tsc --noEmit` (si está disponible)
- `grep -rn imagenUrl src/`

## Progress
- Branch feat/chilecultura-imagen-cards desde main a64e899

## Verification evidence
- tsc --noEmit: limpio
- chilecultura.test.ts: 22/22 verde (incluye nuevo test imagen única/vacía)
- full npm test: 47/48, 1 fallo pre-existente en use-device-location.test.ts (SSR guard, verificado en base limpia vía stash)
- grep imagenUrl: tipo + mapper + test + 4 previews

## Next step
- Push/PR decisión del usuario
