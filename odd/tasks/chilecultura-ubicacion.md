# chilecultura-ubicacion — API-first con orden comuna → región

## Objective
La búsqueda funciona solo con la API (Supabase vacío): filtra por comuna y región, ordenando comuna primero y región después en la vista.

## Problem
- `RM_REGION_ID = 13` pedía Magallanes, no la RM (bug raíz de "región equivocada").
- `fetchLista` solo soporta `region`; no hay filtro por comuna ni modo API-only.
- `dedupeSortSlice` ordena todo por fecha y rompería el orden comuna-first.
- Supabase vacío + fallback a mock mete 5 actividades falsas cuando no hay env.

## Why
Usuario pidió API-only con orden comuna → región (2026-09-24). Provincia investigada: la API no la soporta.

## Scope
- `src/lib/chilecultura.ts`: RM=1, LO_PRADO=311, REGION_IDS (1-16 verificados), fetch por commune, merge comuna-first con dedupe, `listCacheKey()`, `findCachedActividad()`
- `src/lib/actividades.functions.ts`: params `communeId/regionId/soloExternos/paginas`, orden agrupado (base → comuna → región), fast-path detalle con helper
- `src/routes/comparar.tsx`: tab ChileCultura en modo API-only comuna 311 + región 1, 5 páginas
- `src/lib/chilecultura.test.ts`: actualizar region 13→1, nuevos tests comuna-first
- `src/routes/index.tsx`: solo comentario (home sigue Supabase-only por decisión)

## Constraints
- No importar `src/lib/chilecultura` (server-only) desde componentes cliente; pasar literales con comentario
- `search=` se ignora en la API, `commune` con nombre da 500: solo IDs numéricos
- Provincia no existe en la API: fuera de alcance, posible mapeo cliente futuro

## Tasks
- [x] T1 — chilecultura.ts (route: direct inline)
- [x] T2 — actividades.functions.ts (route: direct inline)
- [x] T3 — tests (route: direct inline)
- [x] T4 — comparar.tsx + verificación + commit (route: direct inline)

## Authorized scope
Branch feat/chilecultura-ubicacion. Push/PR decisión del usuario.

## Acceptance criteria
- `fetchLista({commune: 311})` pide `?commune=311`; merge con región deja comuna primero sin duplicados
- `listarActividades({soloExternos: true, communeId: 311, regionId: 1})` no toca Supabase ni mock
- Tests 23+/23+ en verde, tsc limpio

## Applicable checks
- `npm test -- src/lib/chilecultura.test.ts`
- `npx tsc --noEmit`

## Progress
- Branch feat/chilecultura-ubicacion desde main c0a8a2d
- Investigación: RM=1 (207 eventos), Lo Prado=311 (0 eventos), Santiago=295 (113), provincia imposible

## Verification evidence
- chilecultura.test.ts: 24/24 verde (incluye comuna-first + default RM)
- tsc --noEmit: limpio (tras fix exactOptionalPropertyTypes con spreads)
- full npm test: 49/50, único fallo pre-existente geolocalización (verificado en base)
- En vivo: commune=311 → 0 eventos, commune=295 → 113, region=1 → 207 RM

## Next step
- Push/PR decisión del usuario; reiniciar vite dev para probar (cambió código server-side)
