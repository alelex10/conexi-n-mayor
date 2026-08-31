---
title: "Fuentes de Datos — Síntesis y Recomendación Final"
date: 2026-08-27
tags:
  - fuentes-datos
  - sintesis
  - recomendacion
  - roadmap
  - actividad-facil
  - decision
project: "Actividad Fácil / Conexión Mayor"
vault: "docs/fuentes-de-datos"
source: "vault/actividad facil/fuentes-de-datos/04 - Sintesis y Recomendacion.md"
status: "completo"
type: "sintesis"
oleadas: "1,2,3"
---

> [← Índice](../README.md) · [Fuentes de Datos](./README.md)

# Fuentes de Datos — Síntesis y Recomendación Final

> **Fecha:** 2026-08-27  
> **Investigación completa:** 3 oleadas, 9 subagentes, 345 comunas, evidencia `websearch`+`webfetch` verificada  
> **Lectura:** 10 minutos para decidir próximos 12 meses

---

## 1. Veredicto en Una Página

**No existe API nacional 60+ con 345 comunas. Scraping federado de 345 webs = 500-600 parsers, 550 días-hombre + 1 FTE/año, 20% fácil real. Facebook firehose requiere PPCA (rechazo comercial alto) y CrowdTangle murió.**

**La única vía que escala sin quemar el equipo:**

> **ChileCultura API (490 eventos nacionales, gratis, sin auth) como motor + 2-3 scrapers seed (Concepción REST) + Supabase como single source of truth + inbox WhatsApp concierge (vecino reenvía afiche → Vision+mini → humano valida en 24h) + form custom 6 campos para DIDECO. Costo piloto $35-58/mes, nacional $540-650/mes. Venta B2G por Compra Ágil 30 UTM ($89k-169k/mes) con Conecta Mayor (336 municipios) como canal.**

**Si hacés solo una cosa en las próximas 2 semanas:** Montá `Supabase + form 6 campos + ChileCultura cron 6h + dashboard curación` y cargá 5 pilotos sin pedir permiso. Demo vivo > PowerPoint.

---

## 2. Matriz Decisión Final — Ranking Unificado 3 Oleadas

| Rank | Fuente/Estrategia | Cobertura 345 | Frescura | Precisión MVP | Costo/mes | Mantenimiento | Riesgo Legal | Veredicto |
|---|---|---|---|---|---|---|---|---|
| **🥇** | **ChileCultura API lista (+ detalle opcional)** | 70-80% (16 regiones, ~100 comunas simultáneas) | Diaria | 68% lista / **88% +detalle** | $0 | 1-3h/mes | Medio (oculta) | **Motor nacional** |
| **🥈** | **Supabase + form custom + concierge humano** | **100%** (vos sos la fuente) | 24h humana | **100%** (dato curado) | $25 | 1-2 curadores | Bajo | **Infra ganadora** |
| **🥉** | **Concepción REST + otros WP municipales** | 10-15% cada uno | Diaria | 62% → 100% hora/fecha | $0 | 1-2h/mes c/u | Bajo | Seed municipal |
| 4 | **WhatsApp inbox vecino (Vision+mini)** | 100% captura | Realtime | 82-88% nombre+fecha+hora | $5/100 → $320/nacional | Queue + thresholds | Crítico si es scraping | **Canal captura, no load** |
| 5 | IND/SIGI scraping | ~50% regional | Semanal | 70% | $0+dev | Alto (HTML) | Bajo | Secundaria etaria |
| — | Google Vision + gpt-4o-mini | — | 1.8s | 96-98% OCR / 4-7% alucinación | $0.60/100 | Prompt | — | Stack IA elegido |
| — | datos.gob.cl CKAN | <5% actividades | Obsoleta | 0% | $0 | Bajo | Bajo | Watchdog futuro |
| **❌** | **Scraping 345 webs federado** | 20% fácil real | 1-3 sem lag | 57% promedio | 550 d/h inicial | **1 FTE/año** | Bajo-Medio | **Descartado** |
| **❌** | **Facebook firehose 345** | 100% posts pero no estructurado | Realtime | <40% sin IA | $32-47/mes | 4-6 sem half-life | **Alto** | **Descartado masivo** |
| **❌** | CrowdTangle / Content Library | Nula comercial | — | — | $371/mes | — | — | **No elegible** |

---

## 3. Arquitectura Recomendada — Pipeline Híbrido Nacional

```
[ChileCultura 6h] ──┐
[Concepción diario] ─┤─→ pg_cron → Edge ingest (hash SHA256 titulo|fecha|lugar|comuna) → raw_events
[WhatsApp realtime] ─┘              (idempotente ON CONFLICT)                │
                                                                             ▼
                                                                      staging_events
                                                                      (dedupe + pg_trgm fuzzy)
                                                                             │
                                                              ┌──────────────┴──────────────┐
                                                              ▼                             ▼
                                                        pgmq geocode                  pgmq vision
                                                        (1 req/s, cache venues)      (Vision+mini 35s)
                                                              │                             │
                                                              └──────────────┬──────────────┘
                                                                             ▼
                                                                    cola validación
                                                              ≥0.85 auto / 0.70-0.85 humano SLA24h
                                                                             │
                                                                             ▼
                                                                    actividades (RLS)
                                                                    + Storage webp + CDN purge
                                                                             │
                                                                             ▼
                                                                    TanStack Start ISR
                                                           /comuna/[slug] /actividad/[id]
```

**Stack POC (2 semanas, ~12h dev):**
- Supabase Pro ($25) + `pg_cron + pg_net + pgmq + pg_trgm + postgis` + `venues` cache
- Edge Functions: `ingest-chilecultura`, `ingest-municipal`, `ingest-whatsapp`, `normalize`, `enrich-geocode`, `enrich-vision`
- TanStack Start: `fetchChileCultura()` + `fetchConcepcion()` server functions + `GET /api/actividades?comuna=X&radio=Y` + ISR `s-maxage 3600`
- Queue: **pgmq** (transaccional, $0) — migrar a Cloudflare Queues solo si depth >200 sostenido
- Cron: **pg_cron primario + watchdog Crontap $3/mes** desde 50 comunas

**Cron schedule:**
- ChileCultura: `0 */6 * * *` (6h, 400ms cortesía, ETag)
- Municipales: 16 jobs por región `0 7 * * *` staggered 5min (nunca 345 crons)
- WhatsApp: webhook realtime, ack <1s, enqueue
- Prune: `DELETE raw_events >90d` diario

**Deduplicación:** Hash `SHA256(normalize(titulo)|YYYY-MM-DD|normalize(lugar)|normalize(comuna))` + `source_hash` para detectar updates. Fuzzy trigram solo como red seguridad cola.

**Costos:** $35-58 (5 comunas) → $110-135 (50) → $540-650 (345). 70% es Vision — optimizar con webp previo + cache venues (ahorra $40/mes).

---

## 4. Validación Técnica — Qué Funciona y Qué No

| POC | Hallazgo Clave | Acción |
|---|---|---|
| **Scraping** | Providencia fragilidad 8/10 (tabla `width:800px` sin clases, URL mensual, regex fecha/hora 70%) → descartar. Concepción REST 3/10 (acf.fecha `YYYYMMDD` + hora atomizados) → seed #2. ChileCultura 2/10 (JSON paginado `next`) → seed #1. | Seed = ChileCultura + Concepción. Providencia solo carga manual asistida. |
| **IA Afiche** | Vision 95-98% impreso, Azure 94-97%, Tesseract 78-85% (borrosa 45-60%). Vision+mini USD 0.60/100, 1.8s p50, alucinación 4-7% con few-shot (18-25% sin). Dirección peor campo 60-70%. | Stack: Google Vision + gpt-4o-mini, thresholds 0.85/0.70, Human-in-the-Loop obligatorio. Dashboard validación primero. |
| **Panel** | Softr $2.500/mes a 345 + RLS débil + sync. Form custom 6 campos + magic link = 2-3 min, RLS `auth_comuna()`, $25/mes, nulo a escala. | Form custom gana. WhatsApp solo como canal vecino, no funcionario. |

**Schema Supabase listo:** `comunas` (346 INE) + `profiles` (role funcionario/curador) + `venues` (cache geocode) + `activities` (titulo, fecha, hora, lugar, es_gratuito, foto_url, status draft/pending/approved/published, source, confidence, ocr_json) + RLS `comuna_id = auth_comuna()` + Storage `actividad-fotos` public webp.

---

## 5. Legal y B2G — Cómo No Bloquearse y Cómo Cobrar

**Legal:** Hecho público ≠ obra (Ley 17.336). Scraping municipal tolerado si cortés (1 req/3-5s, User-Agent identificable, `If-Modified-Since`, cache 1x/día, horario 02-06 CLT, atribución `Fuente: Muni X — ver original`, opt-out 48h). ChileCultura: pedir convenio formal MINCAP. Facebook/WhatsApp: nunca scrapear (ban garantizado). Ley 21.719 (01/12/2026): consentimiento separado no bundleado, RUT/salud = sensible reforzado, ARCO <10 días, DPA Supabase.

**ChileCompra (vías reales 2026):**

| Vía | Tope | Cuándo |
|---|---|---|
| **Compra Ágil** | **30 UTM (~$2,05M)** | **Pilotos 0-50 (recomendada)** — 5-15 días, 3 cotizaciones, sin garantía |
| **Convenio Marco ID 2239-3-LR24/25 Software** | 100-25.000 UTM | Escala 50-345 — 1 día si ya estás en CM (postulación semestral) |
| Licitación L1/LE/LP | — | >100 UTM grandes — 45-90 días |

**Pricing (entra en 30 UTM sin dolor):**

| Plan | Mes +IVA | Anual | Target |
|---|---|---|---|
| **Piloto** | **$0×3m → $89.000** | $1.068.000 (15,6 UTM) | 200 primeras <25k hab |
| **Conexión** | **$169.000** | $2.028.000 (29,6 UTM) | 80% medianas | 
| **Mayor** | **$290.000** | $3.480.000 (51 UTM, 2 OC o CM) | 20 grandes |

**Alianza Conecta Mayor (336 municipios, 97%):** No pedir integración app. Cross-promo: ellos bloque *"Ver talleres en tu comuna"* → tu deep link; tú footer *"Alianza Conecta Mayor 800 361 088"*. Plan 6 semanas: dossier 1 pág vía intro Lo Prado → reunión descubrimiento → Convenio Colaboración UC (12 meses, sin costo) → piloto 5 comunas conjuntas → mail a 336 DIDECOs con su logo.

**Pitch 30s Alcalde:** *"70% de sus talleres quedan vacíos porque la info está en PDFs. Nosotros los ponemos en página letras grandes + QR para el CESFAM. En Lo Prado de 12 a 87 inscritos/mes sin que DIDECO toque nada. $89 lucas por Compra Ágil en 5 días, 90 días sin pago si no llena talleres. ¿Le dejo el QR?"*

---

## 6. Roadmap 12 Meses — 5 → 50 → 345

| Trim | Objetivo | Hitos | MRR |
|---|---|---|---|
| **Q1 M1-3** | Validar 5 pilotos | 5 comunas live (demo sin permiso), dossier Conecta Mayor, ChileProveedores + DPA, cortesía implementada | $0 |
| **Q2 M4-6** | Cerrar 20 pagados | Firma Conecta Mayor, 100 demos vivos, 20 OC Compra Ágil, reporte alcalde impreso día 5 | ~$2,5M/mes |
| **Q3 M7-9** | Escalar 50 + postular CM | 50 comunas, postulación CM 2239, reporte automatizado, 0,5 vendedor B2G | ~$6M/mes |
| **Q4 M10-12** | Tracción 80-100 | 80 comunas, CM adjudicado (si resulta), playbook licitación, caso SENAMA | ~$10-12M/mes |

**Funnel 0→5 (5 estratégicas que abren 50):** Lo Prado (prueba social) + Renca/Cerro Navia (boca a boca norte) + La Pintana/San Bernardo (vulnerabilidad, SENAMA) + Valdivia/Temuco (fuera RM) + Zapallar/Vitacura (willingness to pay alto).

**Táctica:** No PPT. Montar `/actividades/[comuna]` ya, mandar mail DIDECO: *"Ya cargamos sus 14 talleres, corrige en este link, gratis 90 días."* Demo vivo 40% respuesta vs 5% PPT.

**Reporte alcalde (lo que vende):** 3 números gigantes (personas informadas / inscripciones / talleres) + heat map barrio + top 3 talleres + foto lleno + recomendación accionable + QR. Entregar físico día 5, no solo mail.

---

## 7. Próximos Pasos Concretos — Próximas 2 Semanas

**Semana 1 — Infra + Ingesta (6 días):**
- [ ] `supabase sql editor`: schema + RLS + Storage + seed 346 comunas INE
- [ ] Edge Functions `ingest-chilecultura` + `ingest-municipal` (ChileCultura lista + Concepción REST)
- [ ] `GET /api/actividades?comuna=X` + TanStack Start ISR + cache
- [ ] Cron pg_cron 6h + diario + ingest_log
- [ ] `/panel/[comuna]` form 6 campos + magic link + `/admin/pendientes` curador

**Semana 2 — IA + Comercial (6 días):**
- [ ] WhatsApp Cloud webhook + queue pgmq + Vision+mini + thresholds + dashboard validación
- [ ] 5 pilotos live (Lo Prado + 4) sin pedir permiso
- [ ] Registro ChileProveedores + Política Privacidad 21.719 + TOS + consentimiento
- [ ] Dossier Conecta Mayor 1 pág + mail intro vía Lo Prado
- [ ] Reporte alcalde template (HTML→PDF on-demand)

**Métrica éxito 14 días:** DIDECO carga 1 actividad en <3 min sin tutorial + 1 curador valida 30 afiches en <1h.

---

## 8. Archivos de Esta Investigación

- [00 — Índice (MOC)](./README.md) — vos estás acá
- [01 — Mapeo Nacional](./01-mapeo-nacional-oleada-1.md) — 4 subagentes, ranking fuentes
- [02 — Validación Técnica](./02-validacion-tecnica-oleada-2.md) — POCs scraping/IA/Supabase con snippets
- [03 — Arquitectura Híbrida](./03-arquitectura-hibrida-oleada-3.md) — pipeline + legal/B2G
- **[04 — Síntesis (este archivo)](./04-sintesis-recomendacion.md)** — decisión y roadmap

---

## 9. Referencias Clave Verificadas

- ChileCultura viva: `chilecultura.gob.cl/api/v1.0/eventos/search?page=1&page_size=50&status=approved` (490, 27/08/2026)
- Concepción: `concepcioncultural.cl/wp-json/wp/v2/evento` (acf)
- Providencia: `providencia.cl/provi/2026-actividades-de-agosto` (tabla width:800px)
- datos.gob.cl: `package_search?q=taller+deportivo` (1 resultado 2015)
- Meta: PPCA docs, TOS 04/03/2026, CrowdTangle shutdown 14/08/2024, Content Library CASD $371/mes
- WhatsApp Cloud: 8 pax/grupo, 10k grupos, OBA, per-message 01/07/2025
- ChileCompra: Compra Ágil 30 UTM, CM ID 2239-3-LR24/25, Vamos a Cuidarnos `vamosacuidarnos.org/entidades-y-ayuntamientos`, Conecta Mayor 336 municipios

---

**Decisión del Orquestador:** No construir 345 scrapers. Construir **1 inbox de WhatsApp con humano que publica en 24h + 1 API que sirve 345 comunas + 1 reporte que el alcalde puede mostrar en el Concejo.** La tecnología es commodity (Supabase+TanStack+Vision). El moat es **operación + confianza B2G + Conecta Mayor**.

#sintesis #recomendacion #roadmap #actividad-facil #fuentes-datos #decision
