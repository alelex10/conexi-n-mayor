---
title: "Fuentes de Datos — Índice (MOC)"
date: 2026-08-27
tags:
  - fuentes-datos
  - moc
  - indice
  - investigacion
  - actividad-facil
project: "Actividad Fácil / Conexión Mayor"
vault: "docs/fuentes-de-datos"
source: "vault/actividad facil/fuentes-de-datos/00 - Indice.md"
status: "en-curso"
type: "MOC"
---

> [← Índice](../README.md) · [Fuentes de Datos](./README.md)

# Fuentes de Datos — Índice

> **Proyecto:** Actividad Fácil / Conexión Mayor — App 60+ actividades gratuitas cercanas  
> **Alcance:** 345 comunas de Chile  
> **Directorio:** `docs/fuentes-de-datos/` · origen `vault/actividad facil/fuentes-de-datos/` (creado 2026-08-27)

---

## Mapa de Archivos

### Este MOC
- [Índice (MOC)](./README.md) — vos estás acá

### Esta Investigación (2026-08-27 →)

1. [01 — Mapeo Nacional (Oleada 1)](./01-mapeo-nacional-oleada-1.md) — **completo 27/08** — 4 subagentes: APIs + fragmentación 10 comunas + redes + B2G
2. [02 — Validación Técnica (Oleada 2)](./02-validacion-tecnica-oleada-2.md) — **completo 27/08** — POCs: scraping + IA + Supabase
3. [03 — Arquitectura Híbrida (Oleada 3)](./03-arquitectura-hibrida-oleada-3.md) — **completo 27/08** — pipeline pg_cron/pgmq + legal 21.719 + B2G
4. [04 — Síntesis y Recomendación](./04-sintesis-recomendacion.md) — **completo 27/08** — veredicto + matriz + roadmap 12 meses

---

## Hallazgos Clave Oleada 1

| # | Insight | Implicancia |
|---|---------|-------------|
| 1 | **ChileCultura API oculta = única nacional viva** (490 eventos, diaria, sin auth) | Motor MVP, pero sin hora/dirección/baño → requiere enriquecimiento |
| 2 | **Scraping 345 webs = 500-600 parsers, 450-650 d/h, 1 FTE/año mantenimiento** | Descartado federado; solo 20% fácil (Providencia, Concepción) como seed |
| 3 | **Facebook = afiche JPG + texto libre, Graph API requiere PPCA (4-6 sem, alta tasa rechazo)** | No firehose; complemento curado piloto RM |
| 4 | **WhatsApp bot = canal de carga viable** (inbound gratis, 8 pax/grupo, invite-only) | Inbox concierge: vecino reenvía afiche → OCR+LLM → publica en 24h |
| 5 | **Vamos a Cuidarnos usa concierge humano, no CMS self-service** | Copiar: municipio autoriza, vos curás; no 345 CMS |
| 6 | **Conecta Mayor tiene 336 municipios (97%)** | Alianza cross-promo, no competir |
| 7 | **Compra Ágil hasta 100 UTM (~$6,8M) sin licitación** | Puerta entrada B2G para piloto |

---

## Estado

- [x] Oleada 1 — Mapeo Nacional (27/08/2026) — [01 - Mapeo Nacional - Oleada 1](./01-mapeo-nacional-oleada-1.md)
- [x] Oleada 2 — Validación Técnica (27/08/2026) — [02 - Validacion Tecnica - Oleada 2](./02-validacion-tecnica-oleada-2.md)
- [x] Oleada 3 — Arquitectura Híbrida (27/08/2026) — [03 - Arquitectura Hibrida - Oleada 3](./03-arquitectura-hibrida-oleada-3.md)
- [x] Síntesis y Recomendación (27/08/2026) — [04 - Sintesis y Recomendacion](./04-sintesis-recomendacion.md)

---

## Cómo usar

1. Entrá por este MOC cada vez que retomes.
2. Click en los links relativos para navegar (GitHub render).
3. Este MOC es el nodo central de `docs/fuentes-de-datos/` — ver también [Mapa de documentos](../README.md).

> [!NOTE]
> **Origen vault:** `vault/actividad facil/fuentes-de-datos/` — portado fielmente a Markdown GFM. Contenido no inventado; links externos verificados 27/08/2026.

#investigacion #fuentes-datos #moc
