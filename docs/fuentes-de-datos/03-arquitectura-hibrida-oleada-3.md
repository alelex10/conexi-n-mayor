---
title: "Fuentes de Datos — Oleada 3: Arquitectura Híbrida + Legal/B2G"
date: 2026-08-27
tags:
  - fuentes-datos
  - oleada-3
  - arquitectura-hibrida
  - pipeline
  - legal
  - b2g
  - chilecompra
  - actividad-facil
project: "Actividad Fácil / Conexión Mayor"
vault: "docs/fuentes-de-datos"
source: "vault/actividad facil/fuentes-de-datos/03 - Arquitectura Hibrida - Oleada 3.md"
status: "completo"
type: "investigacion"
oleada: 3
prev: "02 - Validacion Tecnica - Oleada 2.md"
---

> [← Índice](../README.md) · [Fuentes de Datos](./README.md)

# Fuentes de Datos — Oleada 3: Arquitectura Híbrida + Legal/B2G

> **Fecha:** 2026-08-27  
> **Objetivo:** Diseñar el pipeline que escale de 5 pilotos a 345 comunas sin colapsar, y blindarlo legal/comercialmente  
> **Método:** 2 subagentes paralelos — infra pipeline + legal/B2G — sintetizados

---

## Resumen Ejecutivo

Oleada 2 validó **qué técnica funciona**. Oleada 3 define **cómo operarla a escala y cómo cobrarla**.

**Pipeline ganador (3A):** Cron centralizado `pg_cron` (6h ChileCultura + diario municipal) → `raw_events` append-only → `staging_events` con hash `SHA256(titulo|fecha|lugar|comuna)` + `pg_trgm` fuzzy → queue `pgmq` async para geocode (1 req/s) y Vision (35s/afiche) → validación humana thresholds `≥0.85 auto / 0.70-0.85 cola / <0.70 reject` SLA 24h → `actividades` published + CDN purge on-demand. Costo: **$35-58 (5 comunas) → $110-135 (50) → $540-650 (345)**. Cron federado solo por **región (16)**, nunca por comuna (345 crons = pesadilla).

**Legal (3B):** Info municipal es pública (Ley 20.285) — hechos no son obra (Ley 17.336). Scraping web municipal es **legal-tolerado bajo riesgo bajo si es cortés, atribuido y opt-out <48h**. Único riesgo alto: **Facebook/WhatsApp** (TOS §3.2 prohíbe scraping sin PPCA/API Cloud). Nueva Ley 21.719 (vigente **01/12/2026**) exige **consentimiento separado, no bundleado**, y castiga datos sensibles (salud, RUT) con hasta 20.000 UTM.

**B2G (3B):** Compra real es **Compra Ágil hasta 30 UTM (~$2M)** (no 100), sin garantía, 5-15 días. Convenio Marco vigente es **ID 2239-3-LR24/25** (no 2239-2-LR26). Pricing ancla **$89k-169k/mes** entra justo bajo 30 UTM. Conecta Mayor tiene **336 municipios (97%)** — alianza cross-promo, no integración técnica. Pitch 30s: *"QR en el CESFAM que muestra sus talleres en letras grandes, $89 lucas por Compra Ágil, 90 días sin pago si no llena talleres."*

---

## 1. Arquitectura Pipeline Híbrido Nacional

### 1.1 Diagrama End-to-End

```
[FUENTES]                     [ORQUESTADOR]              [NORMALIZACIÓN]        [QUEUE]           [ENRIQUECIMIENTO]
ChileCultura ──┐                                      ┌─────────────────┐   ┌─────────────┐  ┌──────────────┐
Concepción ────┤─→ cron pg_cron ─→ Edge ingest ─→ raw_events ─→ staging_events ─→ pgmq ─→ geocode+Vision
WhatsApp ──────┘   (6h / diario)     (hash idempot.)    (dedupe)         (async)      (venue cache)
WhatsApp ─────────── webhook realtime ────────────────────────────────────────────────────────────────┘
                                                                                    │
                                                                                    ▼
                                                                         [VALIDACIÓN HUMANA]
                                                                         pending_review → approved/rejected
                                                                         thresholds 0.85/0.70 SLA 24h
                                                                                    │
                                                                                    ▼
                                                                         [PUBLICACIÓN]
                                                                         actividades RLS + Storage webp
                                                                         + CDN purge + ISR TanStack
```

**Principio:** Ingesta no bloquea publicación. `raw_events` es append-only; `staging_events` es donde ocurre deduplicación; queue desacopla lo lento (geocode 1 req/s, Vision 35s).

### 1.2 Ingesta — Cron Schedule

| Fuente | Mecanismo | Frecuencia | Cortesía |
|---|---|---|---|
| ChileCultura API | `pg_cron 0 */6 * * *` | Cada 6h | 400ms entre pages + ETag |
| Municipales (16 regiones) | `pg_cron 0 7 * * *` staggered 5min | Diario 04:00 CLT | 1000ms + User-Agent ActividadFacilBot/1.0 |
| WhatsApp inbox | Webhook realtime | Event-driven | 80 msg/s límite, idempotency wamid |
| Prune raw | `pg_cron 0 8 * * *` | Diario | DELETE >90 días |

**Dónde correr cron:** **Supabase `pg_cron + pg_net` primario** ($0, co-locado con datos) + **watchdog externo** (Crontap $3/mes) desde 50 comunas que alerta si `ingest_log` gap >8h. Vercel Cron descartado (timing no exacto, cada cambio = redeploy).

```sql
select cron.schedule('ingest-chilecultura', '0 */6 * * *', $$
  select net.http_post(url:='https://<project>.supabase.co/functions/v1/ingest-chilecultura',
    headers:='{"Authorization":"Bearer '|| current_setting('app.settings.service_role_key') ||'"}');
$$);
-- Municipales: 16 jobs ingest-municipal-region-{01..16} staggered
```

### 1.3 Normalización — Deduplicación e Idempotencia

**ID canónico:** `dedupe_hash = SHA256(normalize(titulo)|fecha|normalize(lugar)|normalize(comuna)).slice(0,16)` — no UUID random. Permite `ON CONFLICT DO NOTHING`.

```ts
function normalizeForHash(s:string){
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'')
    .replace(/\b(el|la|los|las|de|del)\b/g,'').trim().replace(/\s+/g,' ');
}
function buildDedupeHash(ev:RawEvent){
  return sha256(`${normalizeForHash(ev.titulo)}|${ev.fecha.slice(0,10)}|${normalizeForHash(ev.lugar)}|${normalizeForHash(ev.comuna)}`).slice(0,16);
}
```

- **Primaria:** hash exacto → 95% casos (ON CONFLICT idempotente).
- **Secundaria:** fuzzy `pg_trgm similarity >0.85` solo para cola 0.70-0.85 → marca `related_to` sin auto-dedup.
- **Updates:** `source_hash = sha256(JSON.stringify(ev))` — si cambia payload con mismo hash, merge por `source_trust` (municipal 90 > chilecultura 80 > whatsapp 60) y vuelve a `pending_review` si ya estaba approved.
- **Borrados:** Si evento no aparece en 2 ingestas consecutivas (12h ChileCultura), marca `deletion_candidate` → curador confirma o auto-baja 48h.

```sql
create table staging_events (
  dedupe_hash text primary key, titulo text, fecha_inicio date, lugar text,
  provenance text[], source_trust smallint, status text check (status in ('pending_review','approved','rejected','deleted')),
  confidence numeric(3,2), deletion_candidate bool default false
);
create extension pg_trgm; create index on staging_events using gin (titulo gin_trgm_ops);
```

### 1.4 Queue — Por Qué pgmq

| Opción | Throughput | Costo | Veredicto |
|---|---|---|---|
| **Supabase Queues (pgmq)** | ~500 msg/s, transaccional con Postgres, DLQ | $0 | **✅ MVP → 50 comunas** |
| Cloudflare Queues | 5k msg/s, edge | $0.40/millón | Solo si migrás a Workers |
| BullMQ + Redis | Alto, prioridades finas | $10-80/mes + workers | Overkill hasta 345 |

```sql
select pgmq.create('enrich_geocode');
select pgmq.send('enrich_geocode', '{"dedupe_hash":"evt_abc123"}'::jsonb);
-- consumer: SELECT * FROM pgmq.read('enrich_geocode',1,30); -- vt 30s, 3 intentos → DLQ
```

**Regla serverless:** Si usás Vercel/Supabase, no uses BullMQ (timeout 10-60s). pgmq es transaccional gratis.

### 1.5 Enriquecimiento — Geocoding sin Ban

Nominatim OSM: **1 req/s hard**. Estrategia:
1. Cache `venues` tabla (hit rate >85%, 30 días) — key `normalized_lugar+comuna`
2. Queue single-thread `concurrency=1` + `delay 1100ms`
3. Fallback Photon/Mapbox si 429 3×
4. Bulk inicial: precarga INE + OSM dump para 345 comunas (no geocodes en caliente)

### 1.6 Validación Humana

| Confidence | Acción | SLA |
|---|---|---|
| ≥0.85 | Auto-approve → published | <5 min |
| 0.70-0.85 | Cola pending_review (orden fecha ASC) | **24h p95**, alerta 20h |
| <0.70 | Auto-reject → rejected_events | — |
| deletion_candidate | Cola "¿sigue vigente?" | 48h auto-baja |

```sql
create view curator_sla as select date_trunc('day',created_at) dia,
  avg(extract(epoch from (reviewed_at-created_at))/3600) horas_promedio,
  count(*) filter(where reviewed_at-created_at > interval '24h') breaches
from staging_events where status='approved' group by 1;
```

### 1.7 Publicación — ISR + CDN

TanStack Start `s-maxage 3600 stale-while-revalidate 86400` + on-demand `POST /api/revalidate?slug={comuna}` con `x-secret` disparado por Supabase trigger `after update status=approved` → `net.http_post` → `purgeCloudflare(/comuna/{slug})`. RLS `actividades` lectura pública solo `status=approved`.

### 1.8 Costos Mensuales (USD)

| Concepto | 5 comunas (200 ev/mes) | 50 comunas (2k) | 345 comunas (12-15k) |
|---|---|---|---|
| Supabase Pro + compute | $25 | $35 | $85 |
| Edge Functions | $0 | $10 | $40-75 |
| Storage fotos webp 800px | $0 | $1 | $5-10 |
| **Vision+mini (60% con afiche)** | **$5** | **$48** | **$320** |
| LLM mini normalización | $3 | $20 | $80 |
| Hosting TanStack | $0-20 | $20 | $30 |
| **TOTAL** | **$33-58** | **$110-135** | **$540-650** |

> 70% es Vision — optimizar con precarga venues + webp antes de Vision ahorra $40/mes a escala.

### 1.9 Qué Se Rompe de 5 → 345 y Cómo Mitigar

| Capa | Se rompe a | Mitigación |
|---|---|---|
| DB índices | 50 comunas (50k rows) | Índices `dedupe_hash PK`, `status+comuna_id`, particionar `raw_events` mensual |
| RLS | 50 comunas | Policy simple `status=approved` para anon, service_role para curadores |
| Storage | 50 comunas (30GB) | WebP 800px + thumbs 400px + lifecycle 90d |
| Geocoding | 5 comunas (burst 200) | Venue cache + single worker 1 req/s |
| pg_cron | 345 comunas | **Shardear por región (16), nunca por comuna** |
| ISR | 50 comunas | On-demand granular, no full rebuild |

**Regla:** Centralizado (1 job) para MVP → 50 comunas; **federado por región (16)** desde 50 → 345. 345 crons es inoperable.

---

## 2. Legal / TOS — Blindaje

### 2.1 Principio Chile

Información municipal financiada con fondos públicos = **pública por Ley 20.285**. Hecho *"taller cueca jueves 10:00 CESFAM"* no es obra protegida (Ley 17.336). **Redacción literal + fotos/ flyers sí son protegidos** → re-escribir título <80 chars + link a fuente original.

### 2.2 Riesgo por Fuente + Mitigación

| Fuente | Riesgo | Mitigación obligatoria |
|---|---|---|
| **Webs municipales 345** | **Bajo-Medio** (muy bajo demanda, riesgo IP block) | 1 req/3-5s + `User-Agent: ActividadFacilBot/1.0 (+url)` + `If-Modified-Since` + cache 1x/día + horario 02-06 CLT + backoff 429→24h + atribución `Fuente: Muni X — ver original` + opt-out <48h |
| **ChileCultura API oculta** | **Medio** (cierran endpoint) | Cache 7 días + email MINCAP `chilecultura@cultura.gob.cl` pidiendo convenio formal + fallback scraping HTML |
| **Facebook** | **Alto** (TOS §3.2 prohíbe scraping, requiere PPCA) | **NO scrapear** — solo Graph API o manual |
| **WhatsApp** | **Crítico** (ban irreversible) | Solo Cloud API, nunca Baileys |
| **Datos personales** | **Alto** desde 01/12/2026 | Ver 2.3 |

### 2.3 Ley 21.719 (vigente 01/12/2026) — Qué Cambia

Crea Agencia Protección Datos, multas hasta 20.000 UTM (~$1.300M).

| Dato | Clasificación | Consentimiento |
|---|---|---|
| Nombre+comuna+teléfono | Común | **Sí, previo informado, libre, específico, no pre-tildado** |
| RUT, salud, movilidad, pensión | **Sensible** (Art.2o) | **Reforzado explícito + finalidad específica. No inferir.** Preguntar "¿necesita silla ruedas?" ya es sensible. |
| Preferencias (folclore, yoga) | Común | Sí |

**Implicancias Actividad Fácil:**
- Nunca pedir RUT completo. Checkbox separado (no bundleado con TOS): *"Autorizo a usar mi comuna y preferencias para recomendarme talleres. Puedo revocar."* Guardar `consent_version, timestamp, ip` en tabla `consents`.
- No etiquetar "vulnerable/dependiente" sin consentimiento explícito.
- Derechos ARCO: botón "Descargar/Eliminar mis datos" (<10 días).
- Tú eres Responsable, Supabase Encargado → firmar DPA + Registro Actividades Tratamiento.
- Política privacidad en lenguaje simple grande + audio.

---

## 3. B2G Go-to-Market Chile

### 3.1 ChileCompra — 3 Vías Reales

| Vía | Cuándo | Tope | Plazo | Garantía |
|---|---|---|---|---|
| **A. Trato Directo / Compra Ágil** | **Pilotos 0-5 (recomendada)** | **30 UTM (~$2,05M a 08/2026)** | 5-15 días hábiles | No |
| **B. Convenio Marco ID 2239-3-LR24/25 Software** | **Escala 50-345** | 100-25.000 UTM | 1 día (si ya estás en CM) | 5-10% si >100 UTM |
| **C. Licitación Pública L1/LE/LP** | >100 UTM grandes | — | 45-90 días | 1-2% seriedad + 5-10% fiel cumplimiento |

**Pasos Vía A (piloto):**
1. Inicio SII + Registro ChileProveedores (24-48h, $0 microempresa) + Certificado Habilidad
2. DIDECO pide 3 cotizaciones (tú +2)
3. Crea OC en mercadopublico.cl > Compra Ágil > adjunta > autoriza
4. Aceptas > facturas > pago 30 días
> Tope 30 UTM: si tu plan es $89k/mes ($1,06M/año = 15,6 UTM) entra holgado. Si $169k (29,6 UTM) justo bajo tope.

**Vía B:** Postulación semestral CM requiere acreditar experiencia/metodología/precios HH. Si no estás en CM, no puedes vender por ahí hasta próxima ventana (6-12 meses). **Estrategia:** opera por Vía A mientras postulas Q1 2026 con Conecta Mayor como validador.

### 3.2 Pricing Validado (benchmarks 2024-25: app municipal $180-450k/mes, gestión DIDECO $400-900k/mes)

| Plan | Precio/mes +IVA | Anual | Para quién | Incluye |
|---|---|---|---|---|
| **Piloto** | **$0×3m luego $89.000** | $1.068.000 (15,6 UTM) | 200 primeras <25k hab | Ingesta 2x/sem, landing /actividades/[comuna], QR mensual, reporte alcalde, WA Cloud |
| **Conexión** | **$169.000** | $2.028.000 (29,6 UTM) | 80% país medianas | Todo Piloto + Form validador DIDECO 1-click, 4 QR/mes, panel vivo, soporte WA | 
| **Mayor** | **$290.000** | $3.480.000 (51 UTM) | 20 grandes/capitales | Todo Conexión + PWA logo muni, integración SENAMA, reporte impreso Concejo, SLA 48h |

> Sin perpetuo. Piloto 90 días con **carta intención**: *"Si >100 usuarios/mes, pasan a Piloto pagado."* Descuento 15% anual anticipado.

### 3.3 Pitch + Objeciones

**30s (Alcalde):** *"Alcalde, 70% de sus talleres quedan vacíos porque la info está en Facebook y PDFs. Nosotros los ponemos en página simple letras grandes + QR para el CESFAM. En Lo Prado pasamos de 12 a 87 inscritos/mes sin que DIDECO toque nada. $89 lucas/mes por Compra Ágil en 5 días, 90 días sin pago si no llena talleres. ¿Le dejo el QR de su comuna para probar?"*

**2 min (DIDECO):** Captura automática 2x/sem sin trabajo extra → ficha simple qué/cuándo/dónde/WA → reporte mensual para Concejo. Link validador 1-click. $89k (=caja chica), demo vivo hoy.

| Objeción | Rebatida |
|---|---|
| "Sin presupuesto" | 0,1% DIDECO, ítem difusión, OC modelo Lo Prado, caja chica |
| "Ya tenemos web/FB" | No competimos, potenciamos y derivamos tráfico, su web queda fuente oficial |
| "¿Info errónea?" | `Fuente: Muni X — ver original` + link validador 1-click, responsabilidad municipal |
| "Pasa por Jurídico" | Carpeta ChileProveedores + privacidad 21.719 + modelo OC <30 UTM sin control |
| "Año electoral" | 90 días gratis sin OC ni contrato, solo carta evaluación |

### 3.4 Alianza Conecta Mayor (336 municipios, 97%)

**No pedir integración a su app** (roadmap celoso). **Ganadora: cross-promo + botón profundo.**

- Ellos ponen bloque *"¿Buscas talleres en tu comuna? Ver actividades cerca"* → deep link `actividadfacil.cl/actividades/[comuna]`
- Tú pones footer *"Alianza Conecta Mayor — acompañamiento 800 361 088"*
- Sin costo, sin exclusividad, atribución mutua, métricas trimestrales

**Plan 6 semanas:**
1. Semana 1: mapeo gerencia@conectamayor.cl + dossier 1 página (problema+screenshots+piloto Lo Prado+cross-promo) vía intro DIDECO Lo Prado
2. Semana 2: reunión descubrimiento (preguntar dolor difusión, no vender)
3. Semana 3: propuesta Convenio Colaboración (template UC, 12 meses renovable, opt-out por comuna)
4. Semana 4-5: piloto 5 comunas conjuntas (Lo Prado, Renca, La Pintana, Temuco, Valdivia) medir CTR ambos sentidos
5. Semana 6: firma + comunicado + mail a 336 DIDECOs con logo Conecta Mayor (vale más que 100 demos)

---

## 4. Roadmap Comercial 12 Meses

| Trim | Objetivo | Hitos | Ingreso |
|---|---|---|---|
| **Q1 1-3** | Validar 5 pilotos | 5 comunas live, dossier Conecta Mayor, ChileProveedores+DPA, cortesía implementada | $0 |
| **Q2 4-6** | Cerrar 20 pagados | Firma Conecta Mayor, 100 demos vivos, 20 OC Compra Ágil (Piloto/Conexión), reporte impreso | ~$2,5M/mes |
| **Q3 7-9** | Escalar 50 + postular CM | 50 comunas, postulación CM 2239, reporte automatizado, 0,5 vendedor B2G | ~$6M/mes |
| **Q4 10-12** | Tracción 80-100 | 80 comunas, CM adjudicado (si resulta), playbook licitación, caso SENAMA, MRR $10M+ | ~$10-12M/mes |

> Año 2 = CM + licitaciones + SENAMA nacional. No intentar 345 en 12 meses sin CM.

**Funnel 0→5 (no al azar, 5 estratégicas que abren 50):**
1. Lo Prado (prueba social RM)
2. Renca/Cerro Navia (boca a boca DIDECO norte)
3. La Pintana/San Bernardo (vulnerabilidad, SENAMA mira)
4. Valdivia/Temuco (fuera RM, replicabilidad)
5. Zapallar/Vitacura (willingness to pay alto)

**Táctica 0-5:** No PowerPoint. Scrapear, montar `/actividades/[comuna]` sin permiso, mandar mail DIDECO: *"Ya cargamos sus 14 talleres, vea cómo queda, ¿corrige en este link? Gratis 90 días."* Demo vivo 40% respuesta vs 5% PPT.

**Checklist antes de escalar:**
- [ ] Cortesía + User-Agent + cache
- [ ] TOS + Privacidad 21.719 + consentimiento desacoplado
- [ ] ChileProveedores + DPA Supabase + Registro Tratamiento
- [ ] Template OC Compra Ágil
- [ ] Dossier Conecta Mayor 1 pág

---

#oleada-3 #arquitectura-hibrida #legal #b2g #chilecompra #conecta-mayor
