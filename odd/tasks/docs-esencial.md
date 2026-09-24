# docs-esencial — Achicar docs a MVP + estrategia

## Objective
Reducir `docs/` de 2428 líneas / 14 archivos a solo lo esencial MVP + estrategia resumida.

## Problem
`docs/fuentes-de-datos/` (1193 líneas, 3 oleadas + síntesis) es investigación histórica que tapa lo operativo.

## Why
Usuario pidió mantener solo lo esencial en `main` (2026-09-24).

## Scope
- Mantener en `docs/`: README.md, 01-vision, 02-estrategia, 03-nucleo, 04-transporte, 05-concepto-cerca, 06-requisitos, 07-arquitectura, 08-roadmap
- Borrar: `docs/fuentes-de-datos/` completo (5 archivos)
- Limpiar links rotos a `fuentes-de-datos/` en 02 y README

## Constraints
- No tocar código `src/`, `supabase/`
- 02 debe quedar autocontenida como resumen ejecutivo
- README debe quedar sin sección Investigación profunda

## Tasks
- [x] T1 — branch chore/docs-esencial desde main (route: direct inline, trigger: state check)
- [x] T2 — borrar docs/fuentes-de-datos/ (route: direct inline, delegación explore falló por free-tier)
- [x] T3 — limpiar links en 02, 07, 08 y README (route: direct inline, 4 files mecánicos)
- [x] T4 — commit work-unit + verificación estructural

## Authorized scope
Branch chore/docs-esencial, solo `docs/` + `odd/tasks/docs-esencial.md`. Push/PR decisión del usuario.

## Acceptance criteria
- `docs/fuentes-de-datos/` no existe
- `grep -r fuentes-de-datos docs/` = 0 resultados
- `docs/` queda en ~1235 líneas / 9 archivos

## Applicable checks
- Estructural: `ls docs/`, `wc -l docs/*.md`, `grep -r fuentes-de-datos docs/ || echo OK`

## Progress
- T1 done: branch chore/docs-esencial creada desde a64e899
- T2 done: git rm -r docs/fuentes-de-datos/ (5 archivos)
- T3 done: 02 (161 líneas), 07 (205), 08 (135), README (92) sin refs
- T4 done: commit 1c5c8fa, 10 files, +52 -1234

## Verification evidence
- grep -r fuentes-de-datos docs/ = OK-sin-referencias
- wc -l docs/*.md = 1200 total / 9 archivos
- git status = clean en chore/docs-esencial

## Next step
- Push/PR decisión del usuario
