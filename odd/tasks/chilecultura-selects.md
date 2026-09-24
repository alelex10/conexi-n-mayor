# chilecultura-selects — Selects región/comuna con default por ubicación detectada

## Objective
La vista de búsqueda por API tiene selects de región y comuna; de entrada toman la ubicación detectada en el dispositivo y buscan por esa comuna/región.

## Problem
El tab ChileCultura buscaba fijo Lo Prado 311 + RM 1 sin control visible; el usuario no puede elegir otra comuna/región ni partir de su ubicación real.

## Why
Usuario lo pidió (2026-09-24): selects listando regiones y comunas que primero capten lo detectado por la ubicación ya implementada.

## Scope
- `src/data/ubicacion-chile.ts` (ya generado, sin commit): REGIONES_CHILE (16) + COMUNAS_POR_REGION (346, IDs ChileCultura)
- Nuevo `src/lib/ubicacion-match.ts` (client-safe): `detectarIdsDesdeEtiqueta()` + tests
- `src/routes/comparar.tsx`: selects accesibles + "Usar mi ubicación" + Buscar; auto-fetch inicial con defaults
- No tocar home, Groq tab ni Supabase

## Constraints
- `useDeviceLocation` da coords + `locationLabel` (BigDataCloud: locality/city/principalSubdivision) — matchear por nombre normalizado, comuna primero
- Si no hay match o se deniega permiso: defaults Lo Prado 311 + RM 1, búsqueda manual siempre usable
- No auto re-fetch en loop: el hook intenta una sola vez; los selects solo se pisan si el usuario no los tocó
- 60+ UX: labels grandes, targets min-h-12/14, sin dependencia de mapa

## Tasks
- [x] T0 — dataset estático 16 regiones + 346 comunas (cruce cc IDs + juanbrujo MIT + 4 Talagante manual)
- [x] T1 — matcher + tests (route: direct inline)
- [x] T2 — UI selects + autodetección en comparar.tsx (route: direct inline)
- [x] T3 — verificación + commit (route: direct inline)

## Authorized scope
Branch feat/chilecultura-selects. Push/PR decisión del usuario.

## Acceptance criteria
- Con etiqueta "Lo Prado" → comuna 311 + región 1; con "Santiago" → comuna 295 + región 1; sin match → null (defaults)
- Cambiar región filtra comunas; Buscar refetchea con los IDs elegidos
- Tests matcher en verde, tsc limpio

## Applicable checks
- `npm test -- src/lib/ubicacion-match.test.ts src/lib/chilecultura.test.ts`
- `npx tsc --noEmit`

## Progress
- Branch feat/chilecultura-selects; T0 done (409 líneas, RM con 52 comunas)

## Verification evidence
- matcher: 6/6 verde; chilecultura: 24/24 verde; full suite 55/56 (único fallo pre-existente geolocalización)
- tsc --noEmit limpio
- Handler soporta "Toda la región" (sin grupo comuna) sin pisar con default RM

## Next step
- Push/PR decisión del usuario; reiniciar vite dev para probar (cambió server-side + cliente)
