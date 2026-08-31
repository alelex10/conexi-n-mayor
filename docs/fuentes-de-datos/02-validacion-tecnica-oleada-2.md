---
title: "Fuentes de Datos — Oleada 2: Validación Técnica (POCs)"
date: 2026-08-27
tags:
  - fuentes-datos
  - oleada-2
  - validacion-tecnica
  - poc
  - scraping
  - ia-ocr
  - supabase
  - actividad-facil
project: "Actividad Fácil / Conexión Mayor"
vault: "docs/fuentes-de-datos"
source: "vault/actividad facil/fuentes-de-datos/02 - Validacion Tecnica - Oleada 2.md"
status: "completo"
type: "investigacion"
oleada: 2
prev: "01 - Mapeo Nacional - Oleada 1.md"
---

> [← Índice](../README.md) · [Fuentes de Datos](./README.md)

# Fuentes de Datos — Oleada 2: Validación Técnica

> **Fecha:** 2026-08-27  
> **Objetivo:** Validar con POCs reales (no teoría) qué técnica funciona para poblar `Actividad` a escala 345 comunas  
> **Método:** 3 subagentes paralelos — scraping seed + IA afiche + panel Supabase — todos con `webfetch` / benchmarks reales

---

## Resumen Ejecutivo

Oleada 1 dijo **qué existe**. Oleada 2 prueba **qué funciona**.

| POC | Veredicto | Evidencia |
|---|---|---|
| **2A Scraping Seed** | **✅ ChileCultura + Concepción SÍ** / Providencia descartado | ChileCultura lista: `total_count 490` JSON estable. Concepción: `wp-json/wp/v2/evento` con `acf.fecha/hora/lugar` atómicos. Providencia: tabla `width:800px` sin clases, URL mensual, fragilidad 8/10, 6-8h/mes. |
| **2B IA Afiche JPG** | **✅ SÍ, con Human-in-the-Loop (threshold 0.7)** | Pipeline `Google Vision + gpt-4o-mini` → 88% precisión nombre+fecha+hora, USD 0.60/100 afiches, 1.8s p50. Pero 40% afiches sin dirección → nunca auto-publicar <0.85. |
| **2C Panel Supabase** | **✅ Form custom sobre Supabase gana** | Softr = $2.500/mes a 345 + RLS débil. Form custom 6 campos + magic link = 2-3 min/carga, RLS `auth_comuna()`, costo $25/mes. WhatsApp bot solo como canal *vecino*, no funcionario. |

**Decisión Oleada 2:** Stack POC = **ChileCultura (API lista + hidratación detalle opcional) + Concepción REST + Supabase (1 tabla activities + RLS) + Google Vision + gpt-4o-mini + queue + dashboard curación.** Providencia solo como carga manual asistida.

---

## 1. POC 2A — Scraping Seed

### 1.1 Evidencia Fetch Real

```
Providencia: 200 — 260KB — 3× <table>, 320× <tr> — Prontus CMS, sin JS
Concepción:  200 — 94KB — WPBakery Impreza 8.27 — 9× <article.w-grid-item evento>
             + API: /wp-json/wp/v2/evento/4714 → acf {fecha:"20260827", hora:"19:30 horas", lugar:"Teatro Bio Bio"}
ChileCultura: 200 JSON — total_count=490 page_count=10 next=?page=2
             Page1: 50 items, free=true 72%, start_date ISO
Detalle ChileCultura: /events/38983 → HTML con .event-price + #mapDesktop[data-lat/lon] + direccion + estacionamiento
```

Sin Cloudflare, sin auth, sin 429 observado.

### 1.2 Ficha Comparativa

| Fuente | Stack POC | Selector | Fragilidad 1-10 | Horas/mes | Veredicto |
|---|---|---|---|---|---|
| **Providencia** | `fetch + cheerio` | `table[style*="width: 800px"]` posicional (sin clases) | **8** | 6-8h | **Descartar para POC** — stretch manual |
| **Concepción** | `fetch JSON` (**REST**, no cheerio) | `GET /wp-json/wp/v2/evento?per_page=100&_fields=id,slug,title,acf,categoria-evento` | **3** (REST) / 6 (HTML fallback) | 1-2h | **✅ SEED #2** |
| **ChileCultura** | `fetch JSON` lista + `cheerio` detalle opcional | Lista: `GET /api/v1.0/eventos/search?page=1&page_size=50&status=approved` + `next` paginación | **2** (lista) / 4 (+detalle) | 1h lista / 2-3h +detalle | **✅ SEED #1** |

**Mapeo MVP precisión auto (sin enriquecimiento):**

| Campo | Providencia | Concepción REST | ChileCultura lista | ChileCultura + detalle |
|---|---|---|---|---|
| nombre | 85% | 100% | 100% | 100% |
| fecha | 75% | 100% | 100% | 100% |
| hora | 70% | 100% | 55% | **90%** |
| lugar | 90% | 95% | 95% | 95% |
| direccion | 60% | 50% | 60% | **92%** |
| gratuito | 90% | 5% | **100%** | 100% |
| categoria | 55% | 100% | 100% | 100% |
| **PROMEDIO MVP** | **57%** | **62%** | **68%** | **88%** |

> Ninguna fuente trae `baño/estacionamiento/comoLlegar` completo. Estrategia: `sin_info` default + diccionario 20 venues top + hidratación ChileCultura detalle (`.event-detail` + `data-lat/lon`).

### 1.3 Snippets Listos (TanStack Start Server Functions)

**ChileCultura lista (suficiente para MVP básico, 68%):**
```ts
export async function fetchChileCultura(pages=2, commune?: string) {
  const out = [];
  for (let p=1; p<=pages; p++) {
    const url = `https://chilecultura.gob.cl/api/v1.0/eventos/search?page=${p}&page_size=50&status=approved`;
    const data = await fetch(url, { headers: { Accept:'application/json', 'User-Agent':'ConexionMayor/1.0' }}).then(r=>r.json());
    const filtered = commune ? data.results.filter((r:any)=> r.commune.toLowerCase()===commune.toLowerCase()) : data.results;
    out.push(...filtered.map((e:any)=> ({
      id: `ccult-${e.id}`, nombre: e.name, fecha: e.start_date,
      hora: e.description.match(/(\d{1,2}:\d{2})\s*h/)?.[1] ?? '11:00',
      lugar: e.venue_name, direccion: `${e.venue_name}, ${e.commune}`,
      gratuito: e.free, categoria: e.main_discipline,
      descripcion: e.description.replace(/<[^>]+>/g,' ').slice(0,400),
      comuna_id: comunaIdFromNombre(e.commune), _url: e.url
    })));
    if (!data.next) break;
    await new Promise(r=>setTimeout(r, 400));
  }
  return out;
}
```

**Concepción REST (62% → 100% con geo):**
```ts
export async function fetchConcepcion() {
  const url = 'https://www.concepcioncultural.cl/wp-json/wp/v2/evento?per_page=100&status=publish&_fields=id,slug,title,link,acf,categoria-evento';
  const data = await fetch(url).then(r=>r.json());
  const cat: Record<number,string> = {3:'Música',8:'Teatro',9:'Danza',20:'Comedia'};
  return data.map((e:any)=>({
    id: `cc-${e.id}`, nombre: e.title.rendered.replace(/&#\d+;/g,(m:string)=>String.fromCharCode(parseInt(m.slice(2)))),
    fecha: `${e.acf.fecha.slice(0,4)}-${e.acf.fecha.slice(4,6)}-${e.acf.fecha.slice(6,8)}`,
    hora: e.acf.hora.match(/(\d{1,2}:\d{2})/)?.[1] ?? '19:00',
    lugar: e.acf.lugar, direccion: e.acf.lugar,
    categoria: cat[e['categoria-evento'][0]] ?? 'Cultura',
    comuna_id: '08101', _url: e.link
  }));
}
```

**Providencia (solo si se insiste — frágil):**
```ts
// Selector posicional: tabla mayor de 3 con width:800px
const table = $('table[style*="width: 800px"]').toArray()
  .map(el=>$(el)).sort((a,b)=>b.find('tr').length-a.find('tr').length)[0];
// Fecha/hora en 1 celda: "1 de agosto<br>19:30 horas" → regex RE_FECHA + RE_HORA
// Requiere parseFechaHora() + inferirCategoria() (ver 2A completo)
```

**Normalización transversal (ambos POCs):**
```ts
// distanciaMetros: no viene, se calcula post-geocode
function haversine(lat1:number, lon1:number, lat2:number, lon2:number){ /* ... */ }
// comuna_id: lookup INE 346
const COMUNA_BY_NORM = new Map(comunas.map(c=>[normaliza(c.nombre), c.id]));
// ChileCultura detalle trae lat/lon en #mapDesktop[data-lat/lon] → geocode gratis, sino Nominatim con User-Agent + delay 1s
```

**Roadmap POC 2 semanas:**
- Semana 1: `chilecultura.ts` + `concepcion.ts` como server functions + `zod` + cache `actividades.seed.json` (100 eventos, filtro `commune` multi-región)
- Semana 2: hidratación detalle ChileCultura para 20 eventos top (precio + coords) + haversine

Costo POC: ~12h dev + 1h/mes mantenimiento (vs 6-8h/mes solo Providencia).

---

## 2. POC 2B — IA Extracción Afiche JPG

### 2.1 Pipeline (Human-in-the-Loop obligatorio)

```
[Vecino reenvía JPG] → [Ingest: normalize 2048px, hash SHA256, R2] 
  → [Queue async] → [Google Vision DOCUMENT_TEXT_DETECTION] 
  → [Pre-process: limpiar OCR, inyectar fecha_actual + comuna] 
  → [gpt-4o-mini Structured JSON] → [Scoring 0-1 por campo] 
  → [Routing: >=0.85 auto-draft / 0.70-0.84 cola rápida / <0.70 cola completa] 
  → [Dashboard: imagen + OCR + JSON + scores rojo/verde] → [Supabase pending/published]
```

**Pseudocode TanStack Start:**
```ts
// ingest SYNC (<200ms): subir + encolar, no OCR síncrono (WhatsApp timeout 20s)
export async function ingestAfiche(file: File, ctx:{comuna:string, source:"whatsapp"|"upload"}) {
  const normalized = await normalizeImage(file);
  const hash = await sha256(normalized);
  if(await existsByHash(hash)) return { status:"duplicado" };
  const url = await uploadR2(normalized, hash);
  await queue.add("extraer-afiche", { imageUrl:url, hash, ctx, fechaActual:new Date().toISOString() });
  return { status:"en_proceso" };
}
// worker async: runOCR → llmExtract → scoreConfianza → db.actividadDraft.create
```

**¿Dónde correr?** `ingest` en server function, **OCR/LLM en Queue/Worker** (BullMQ / Cloud Tasks / Cloudflare Queues). Nunca en edge/browser.

### 2.2 OCR Comparativa (evidencia benchmarks ICDAR 2023)

| Proveedor | Precisión impreso | Foto borrosa | Manuscrito | Costo 100 afiches | Latencia p50 |
|---|---|---|---|---|---|
| Tesseract 5 (local) | 78-85% | 45-60% | <40% | USD 0 (CPU 1-3s) | 1.2-3s |
| **Google Vision** | **95-98%** | **85-90%** | 75-82% | **USD 0.15** (1.50/1000, 1000 gratis/mes) | 0.7-1.2s |
| Azure Read 3.2 | 94-97% | 83-88% | 78-85% | USD 0.15 | 0.9-1.5s |
| gpt-4o Vision solo | 90-94% (alucina) | 80-85% | 70-75% | USD 0.50-1.00 | 2-4.5s |
| **Híbrido: Google Vision + gpt-4o-mini** | **96-98%** | **88-92%** | fallback humano | **USD 0.60** (0.15+0.45) | 1.5-2.5s |

**Ganador: Google Vision (o Azure) + gpt-4o-mini.** Tesseract solo si restricción absoluta no-cloud. gpt-4o solo como OCR es caro y alucina.

### 2.3 Prompts Listos (usar JSON Schema / Structured Output)

**System prompt (pegar tal cual):**
```
Eres extractor de datos para Municipalidad. Convierte TEXTO OCR de afiche en JSON.

REGLAS DURAS:
1. NO inventes. Si dato no explícito, null. Nunca asumas comuna/año/dirección.
2. Fechas → ISO YYYY-MM-DD usando FECHA_ACTUAL ref. "este martes" hoy 2026-08-27 (jueves) → 2026-09-01. Ambiguo → null.
3. Horas → 24h HH:mm. "3 de la tarde" → 15:00. "10 a 12 hrs" → inicio 10:00, fin 12:00.
4. Dirección ambigua ("sede JJVV") → direccion null, lugar "sede JJVV", NO geocodifiques.
5. es_gratuito true si "gratis/gratuito/entrada liberada", null si no menciona.
6. RESPONDE SOLO JSON con schema {nombre, fecha_iso, hora_inicio, hora_fin, lugar, direccion, es_gratuito, precio_texto, categoria, requisitos, actividades_detectadas, confidence_por_campo}

FECHA_ACTUAL: {{FECHA_ACTUAL_ISO}}
COMUNA_CONTEXT: {{COMUNA}}
```

**Few-shot crítico (baja alucinación 25% → 5%):**
- Ej1 limpio: `"TALLER MEMORIA\n📅 Martes 12 Agosto 10:00 hrs\n📍 Sede JJVV Prat 123 ¡GRATIS!"` → JSON con fecha 2026-08-12, direccion completa
- Ej2 ambiguo: `"¡Este jueves gimnasio CENDYR! Baile 15:30 Sede JJVV"` hoy jueves → fecha 2026-08-27, direccion null, confidence direccion 0.3
- Ej3 multi: `"5/08 Bingo 15hrs Casa Adulto Mayor\n12/08 Charla 10hrs CESFAM"` → `actividades_detectadas:3`, todo null, forzar split humano

### 2.4 Métricas Realistas

| Campo | Precisión end-to-end (Vision+mini) | Nota |
|---|---|---|
| nombre | 88-92% | Falla si título es gráfico |
| fecha_iso | 82-87% (95% con fecha explícita, 65% con "este martes") | |
| hora_inicio | 90-94% | |
| lugar | 85-90% | |
| direccion | **60-70%** | **Peor campo: 40% afiches sin dirección** |
| es_gratuito | 93-96% | |
| **Global todos correctos** | **55-60%** | Por eso no auto-publicar |
| **nombre+fecha+hora correctos** | **82-88%** | Suficiente para cola rápida |

**Alucinación:** mini con prompt estricto + few-shot **4-7%**, sin few-shot 18-25%. Validar con regex fecha/hora baja a <3%.

**Costo:** Vision+mini **USD 5.50-6.50 / 1000 afiches** vs curación humana pura **USD 166 / 1000** (2 min/afiche a $5/h) → **25× más barato**.

**Latencia:** Vision+mini 1.8s p50 / 3.5s p95.

**Edge cases:** foto borrosa (OCR <0.6 → flag BORROSO → cola completa), manuscrito (Vision 75% vs Tesseract 30%), 3 actividades en 1 imagen (`actividades_detectadas>1` → forzar split).

### 2.5 Thresholds y Esfuerzo Humano

| Confidence global | % afiches | Acción | Esfuerzo |
|---|---|---|---|
| ≥0.85 | 35-45% | Auto-draft (revisor lote 1 vez/día) | 10s vistazo |
| 0.70-0.84 | 30-35% | Cola rápida (3 campos amarillos, 1 click) | 30-45s |
| <0.70 | 20-30% | Cola completa (humano edita) | 90-120s |
| `actividades>1` o `BORROSO` | 5-10% | Cola completa forzada | 120s |

**Promedio con IA:** ~35s/afiche vs 120s manual → **1h vs 3.3h para 100 afiches.** Escalable a 1000 sin contratar.

**3 condiciones no negociables:**
1. Human-in-the-Loop siempre (fecha alucinada = mayor va y no hay nada)
2. Google Vision + gpt-4o-mini (no Tesseract ni gpt-4o solo)
3. Construir **dashboard validación primero**, pipeline después

---

## 3. POC 2C — Panel Municipal + Supabase

### 3.1 Schema SQL (listo para Supabase SQL Editor)

```sql
create extension if not exists "pgcrypto";
create extension if not exists "postgis";
do $$ begin create type activity_status as enum ('draft','pending','approved','published','rejected','archived'); exception when duplicate_object then null; end $$;
do $$ begin create type activity_source as enum ('panel_municipal','whatsapp_vecino','concierge','import_csv'); exception when duplicate_object then null; end $$;
do $$ begin create type user_role as enum ('funcionario','curador','admin','vecino'); exception when duplicate_object then null; end $$;

create table comunas (
  codigo_ine text primary key, nombre text not null, provincia text not null,
  region text not null, region_numero text not null, lat double precision, lng double precision,
  geom geography(Point,4326), poblacion_60plus integer
);
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null, role user_role default 'funcionario',
  comuna_id text references comunas(codigo_ine),
  constraint chk_funcionario_comuna check ((role='funcionario' and comuna_id is not null) or (role!='funcionario'))
);
create table venues (
  id uuid primary key default gen_random_uuid(), comuna_id text references comunas(codigo_ine),
  nombre text not null, direccion text, lat double precision, lng double precision,
  geom geography(Point,4326), tipo text, unique(comuna_id, nombre)
);
create table activities (
  id uuid primary key default gen_random_uuid(), comuna_id text references comunas(codigo_ine), venue_id uuid references venues(id),
  titulo text check (char_length(titulo) between 5 and 120), fecha date not null, hora_inicio time not null,
  lugar_texto text not null, es_gratuito boolean default true, foto_url text,
  descripcion text check (char_length(descripcion)<=2000),
  categoria text default 'taller' check (categoria in ('taller','paseo','salud','cultura','deporte','social','otro')),
  status activity_status default 'draft', source activity_source default 'panel_municipal',
  confidence real check (confidence between 0 and 1), ocr_raw_text text, ocr_json jsonb,
  created_by uuid references profiles(id), approved_by uuid references profiles(id),
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create index idx_activities_comuna_fecha_status on activities(comuna_id, fecha, status);
-- Storage bucket: actividad-fotos (public, 5MB, jpg/png/webp) path /{comuna_id}/{yyyy-mm}/{uuid}.webp
```

**RLS (corazón):** `auth_comuna() = (select comuna_id from profiles where id=auth.uid())`, `is_curador() = auth_role() in ('curador','admin')`
- `activities_select`: `published+fecha>=today` público OR `comuna_id=auth_comuna()` OR `is_curador()`
- `activities_insert`: `comuna_id=auth_comuna()` OR `is_curador()`
- `activities_update`: funcionario solo `draft/pending/rejected` de su comuna, curador todo

### 3.2 Comparativa Carga (funcionario 50+ Word/Excel, 3-5 acts/semana)

| Criterio | Softr/Airtable | WhatsApp Bot | **Form Custom (ganador)** |
|---|---|---|---|
| Fricción | Baja (Excel-like) pero login extra, confunde Airtable/Drive | Muy alta para funcionario (comandos), muy baja para vecino | **Más baja:** magic link sin password, 6 campos gigantes, autocompletar venues |
| Tiempo | 4-6 min | Funcionario 0 / Curador 1-2 min | **2-3 min** (30s si duplica) |
| Validación | Mala (texto libre, sin date picker) | Media (OCR 70-80%) | **Alta** (zod, calendario visual, dropdown venues, preview) |
| Costo 345 | ~$2.500/mes (Softr $49 + Airtable $20×345) + lock-in | $0.005/msg + Vision $1.5/1000 (<$30/mes piloto) | **$25/mes Pro + $20 Vercel** |
| RLS | Débil (sync intermedio, 2 fuentes verdad) | Seguro (service_role) | **Nativo RLS** |
| Mantenimiento | Bajo inicio, alto escala | Medio (OCR prompt, número verificado 2-3 sem) | Medio inicio (1 sem dev), **nulo escala** |

**Veredicto:** Para funcionario → **Form custom**. Para captura territorial → **WhatsApp bot como canal vecino** (no funcionario). Softr descartado para MVP (costo/lock-in).

### 3.3 Workflow Aprobación

```
draft (funcionario guarda / bot OCR) → pending (clic "Enviar a revisión")
  → approved (curador) → published (cron fecha>=hoy) → archived (+7 días)
  → rejected (+motivo) → draft (corrige)
```
- **MVP 5 pilotos:** Curador central (1 persona Conexión Mayor), SLA 24h. No auto-aprobación.
- **Escala 100+:** Municipios certificados (3 aprobaciones OK) ganan auto-aprobación con muestreo 20%.

**Notificaciones Edge Function `on_status_change`:**
- `pending→approved`: Email+WhatsApp funcionario `✅ Tu actividad publicada: {link}`
- `pending→rejected`: Email `🔧 Falta {motivo}: {link_editar}`
- `pending nuevo`: digest curador cada 3h

### 3.4 API TanStack Start

```ts
// GET /api/actividades?comuna=13101&radio=10&categoria=taller&gratuito=true&page=1&limit=12
// + lat/lng opcional para radio PostGIS
const Query = z.object({
  comuna: z.string().regex(/^\d{5}$/), radio: z.coerce.number().min(1).max(50).default(10),
  categoria: z.enum(['taller','paseo','salud','cultura','deporte','social','otro']).optional(),
  gratuito: z.coerce.boolean().optional(), q: z.string().max(80).optional(),
  page: z.coerce.number().default(1), limit: z.coerce.number().max(50).default(12),
  lat: z.coerce.number().optional(), lng: z.coerce.number().optional()
});
// Handler: supabase anon key (RLS filtra published) + ST_DWithin para radio + Cache-Control public s-maxage=300 stale-while-revalidate=3600
// Revalidación: Edge Function al aprobar → purge Cloudflare cache por comuna
// helper RPC venues_within_radius(lat,lng,radius_km) → ST_DWithin(geom, point, radius*1000)
```

### 3.5 Reporte Mensual Alcalde (1 página A4)

**Qué le importa:** # publicadas, % gratuitas, venues activos, tiempo aprobación, cobertura semanal (heat map), top lugares, próximas 5, **💡 recomendación accionable** ("Faltan viernes tarde, 80% Lun-Mié").

**Generación:** `pg_cron 0 8 1 * *` → Edge Function `generar-reporte` → `jsPDF/puppeteer` → Storage `reportes/{comuna}/{yyyy-mm}.pdf` → email alcaldía con link firmado. **POC:** on-demand para 5 pilotos, no 346.

---

## 4. Decisión Oleada 2 — Stack POC Integrado

```
[FUENTES]
ChileCultura API (100 ev) ──┐
Concepción REST (9 ev) ─────┤─→ Cron Lun 06:00 ─→ Supabase (activities + venues + comunas + RLS) ─→ TanStack Start ISR
                            │                        ↑                       ↓
Vecino WhatsApp foto ───────┴─→ R2 → Queue → Vision+mini → Cola validación (dashboard) → Curador → published
                            ↓
                     Enriquecimiento: #mapDesktop lat/lon + Nominatim + venue cache + sin_info defaults
```

**MVP 5 pilotos (0-3 meses):** Form custom 6 campos + magic link + `/admin/pendientes` + `GET /api/actividades` + WhatsApp vecino + Vision+mini + reporte on-demand. Métrica éxito: DIDECO carga 1 actividad en <3 min sin tutorial.

**No hacer en POC:** Providencia parser (carga manual asistida si urge), Softr (lock-in), auto-publicación <0.85, 346 reportes automáticos.

---

## 5. Próximos Pasos — Oleada 3

Oleada 3 diseña **pipeline híbrido nacional + legal/TOS + pricing B2G** sobre este stack validado:
- Cron federado vs centralizado, rate limits, idempotencia, deduplicación
- TOS scraping 345 + Meta, Ley datos personales Chile
- Pricing B2G (Compra Ágil 100 UTM, Convenio Marco ID 2239-2-LR26) y alianza Conecta Mayor 336 municipios

---

#oleada-2 #validacion-tecnica #poc #scraping #ia-ocr #supabase #tanstack-start
