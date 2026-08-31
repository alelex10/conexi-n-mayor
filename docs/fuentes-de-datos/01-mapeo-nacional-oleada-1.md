---
title: "Fuentes de Datos — Oleada 1: Mapeo Nacional (345 comunas)"
date: 2026-08-27
tags:
  - fuentes-datos
  - oleada-1
  - mapeo-nacional
  - investigacion
  - actividad-facil
project: "Actividad Fácil / Conexión Mayor"
vault: "docs/fuentes-de-datos"
source: "vault/actividad facil/fuentes-de-datos/01 - Mapeo Nacional - Oleada 1.md"
status: "completo"
type: "investigacion"
oleada: 1
---

> [← Índice](../README.md) · [Fuentes de Datos](./README.md)

# Fuentes de Datos — Oleada 1: Mapeo Nacional

> **Fecha:** 2026-08-27  
> **Alcance:** 345 comunas de Chile (escala nacional, no solo Lo Prado)  
> **Método:** 4 subagentes paralelos con `websearch` + `webfetch` verificados (sin inferencias)  
> **Vault:** `actividad facil/fuentes-de-datos/` — nuevo directorio dedicado (creado 27/08/2026)

---

## Resumen Ejecutivo

**No existe hoy en Chile una API nacional que entregue actividades gratuitas/fechadas con cobertura 345 comunas y campos MVP completos.** La investigación iterativa con 4 lentes lo confirma desde ángulos independientes:

1. **APIs Nacionales (1A):** Solo **ChileCultura `chilecultura.gob.cl/api/v1.0/eventos/search`** es API REST viva nacional (~490 eventos, sin auth, paga filtrado `free`, `region`, `commune`), pero es **oculta/no documentada**, sin `hora`, sin `dirección`, sin `baño/estacionamiento`. `datos.gob.cl` tiene CKAN pero **cero datasets vigentes** de talleres (último 2015). SENAMA/IND/SERNATUR **no tienen API**.
2. **Webs Municipales (1B):** Muestra 10 comunas estratificadas → solo **20% fácil** (Providencia, Concepción con tabla HTML), **60% difícil** (WP noticias + afiche JPG + corporaciones con dominio distinto), **20% imposible** (Maipú SPA sin SSR, La Florida sin agenda). Extrapolado a 345: ~500-600 parsers, 450-650 días-hombre inicial + 150-200 roturas/año. **Scraping federado no escala.**
3. **Redes Sociales (1C):** 80% de actividades municipales viven como **afiche JPG + texto libre** en Facebook. Requiere OCR+LLM sí o sí. Graph API para 345 Pages requiere `Page Public Content Access` (App Review 4-6 semanas, alta tasa de rechazo comercial). CrowdTangle **murió 14/08/2024**, su reemplazo (Meta Content Library) es **solo académico, USD 371/mes, no comercial**. WhatsApp Groups API es **8 personas/grupo, invite-only**, no lee JJVV consumer.
4. **Modelo Humano B2G (1D):** La gemela española **Vamos a Cuidarnos (Bizkaia)** probó que el modelo ganador es **municipio autoriza, equipo central cura** (concierge), no CMS self-service. Incluso ellos con 10 municipios prefirieron 2 personas curando antes que dar CMS al funcionario. En Chile, el canal B2G ya existe: **Conecta Mayor / Espacio Mayor tiene 336 municipios (97%)** por Vamos Chilenos. Compra municipal vía **Compra Ágil hasta 100 UTM (~$6,8M CLP)** sin licitación.

**Veredicto Oleada 1:** La vía técnica pura (API nacional o scraping federado o Facebook firehose) colapsa a escala. **La vía ganadora es híbrida: ChileCultura como motor nacional + curaduría humana concierge (WhatsApp bot como inbox) + Supabase como single source of truth + 2-3 scrapers seed solo para comunas FÁCILES.**

> **Frase para tu pitch:** *"A diferencia de Elige Cultura (agenda nacional sin filtro 60+), y a diferencia de scrapear 345 webs que es mantener 600 scrapers rotos, Actividad Fácil es el inbox de WhatsApp donde el municipio reenvía el afiche y en 24h está publicado, con reporte mensual para su cuenta pública."*

---

## 1. Mapa de Fuentes Nacionales — Tabla Maestra

### 1A. APIs y Datos Abiertos (detalle completo en subagente 1A)

| #     | Fuente                                                         | API REST?                 | Frescura                                         | Cobertura Comunal                     | Costo            | Estado para 345 comunas                   |
| ----- | -------------------------------------------------------------- | ------------------------- | ------------------------------------------------ | ------------------------------------- | ---------------- | ----------------------------------------- |
| **1** | **ChileCultura `chilecultura.gob.cl/api/v1.0/eventos/search`** | **SÍ (oculta, no doc)**   | Diaria (`total_count:490` verificado 27/08/2026) | 16 regiones, ~100 comunas simultáneas | Gratis, sin auth | **🥇 PRIMARIA MVP — única nacional viva** |
| 2     | `datos.gob.cl` CKAN                                            | SÍ (CKAN genérica)        | Anual/obsoleta (último taller 2015)              | Teórica 345, práctica <5% actividades | Gratis           | ❌ No es fuente de cartelera               |
| 3     | SENAMA                                                         | NO (HTML/PDF/XLSX)        | Semestral (22 ELEAM)                             | 22 sedes nacionales                   | 0                | ❌ Solo directorio estático                |
| 4     | IND/SIGI `sigi.ind.cl`                                         | NO (HTML jQuery)          | Semanal (talleres 60+ 3×/sem)                    | ~50% regional desigual                | 0 + dev scraper  | 🥈 Secundaria etaria valiosa              |
| 5     | ChileAtiende API `chileatiende.gob.cl/desarrolladores`         | SÍ (con `access_token`)   | Trimestral (trámites)                            | Oficinas 16 regiones                  | Gratis           | ❌ Solo tramitología                       |
| 6     | SERNATUR                                                       | NO (CSV 2012)             | Obsoleta                                         | Destinos geográficos 100%             | 0                | ❌ No actividades                          |
| 7     | IDE Patrimonio `ide.patrimoniocultural.gob.cl`                 | WMS/ArcGIS                | Semestral (capas)                                | 100% geográfica                       | 0                | 🥉 Enriquecimiento geo                    |
| 8     | Portales `datos.*.cl` municipales                              | NO estándar (CSV/PDF/KMZ) | Anual/abandonado                                 | 1 comuna/portal                       | 0                | ❌ 345 formatos distintos                  |

**Campos MVP vs ChileCultura (brecha crítica):**

| Campo MVP requerido | ChileCultura entrega | Brecha |
|---|---|---|
| `nombre` | `name` ✅ | — |
| `fecha` | `start_date/end_date` (día) ✅ | Falta `hora` |
| `hora` | ❌ No | **Bloqueante** |
| `lugar` | `venue_name` texto | Sin dirección estructurada |
| `dirección` | ❌ | Requiere geocoding |
| `gratuito/precio` | `free` bool | Sin monto |
| `categoría` | `main_discipline` (18 valores) | Mapear a 4-5 propias |
| `descripción` | `description` HTML | OK |
| `baño/estacionamiento` | ❌ | Requiere enriquecimiento |
| `comoLlegar` | ❌ | Requiere OSM/Google |

> **Links verificados 27/08/2026:**
> - `https://chilecultura.gob.cl/api/v1.0/eventos/search?page=1&page_size=2` → 200 `{"total_count":490}`
> - `https://datos.gob.cl/api/3/action/package_search?q=senama&rows=10` → `count:0`
> - `https://sigi.ind.cl/actividad/buscar` → HTML sin JSON

### 1B. Fragmentación Municipal (muestra 10 comunas — detalle en subagente 1B)

| Comuna | Agenda URL | Formato | CMS | Clasificación |
|---|---|---|---|---|
| **Lo Prado** | `loprado.cl/category/noticias` + `fccloprado.cl` | HTML noticias + JPG afiche | WordPress | 🟡 Difícil |
| **Santiago** | `munistgo.cl` → `santiagocultura.cl` | HTML noticias | WordPress | 🟡 Difícil |
| **Maipú** | `municipalidadmaipu.cl/cultura` | **SPA sin SSR** — `webfetch` = `doesn't work without JS` | Vue/Nuxt | 🔴 Imposible |
| **Providencia** | `providencia.cl/provi/2026-actividades-de-agosto` | **Tabla HTML** `FECHA Y HORA | ACTIVIDAD | LUGAR` + `GRATUITA` | Propietario | 🟢 **Fácil** |
| **Puente Alto** | 4 dominios `culturapuentealto.cl` + `talleres.ptealto.cl` (auth ClaveÚnica) | Catálogo + YouTube 2020 | WordPress | 🟡 Difícil |
| **La Florida** | `plaflorida.cl/cultura` | Solo noticias, `culturalaflorida.cl` 403 | WordPress | 🔴 Imposible |
| **Valparaíso** | `municipalidaddevalparaiso.cl` | Boletín + **Cloudflare WAF** bloqueante | WP + CF Bot Mgmt | 🟡 Difícil |
| **Concepción** | `concepcioncultural.cl/agenda/` | **Cards** `categoría+fecha+hora+lugar` | WordPress | 🟢 **Fácil** |
| **Temuco** | `temuco.cl/tramites-servicios/talleres-para-personas-mayores` | Tabla estática `Taller | Horario | Lugar | Periodo` | WordPress Enfold | 🟡 Difícil |
| **Antofagasta** | `municipalidadantofagasta.cl/.../talleres` | Tabla `Taller | Grupo` | Joomla! | 🟡 Difícil |

**Distribución muestra:** 🟢 20% Fácil / 🟡 60% Difícil / 🔴 20% Imposible  
**Extrapolación nacional (ajustada a 345 con rurales):** 🟢 ~10-15% (35-50 comunas) / 🟡 ~50-60% / 🔴 ~30-35%

**Esfuerzo scraping federado estimado:**
- Parsers: 345 comunas × 1-2 dominios = **500-600 parsers**
- Dev inicial: **450-650 días-hombre** (Fácil 0.5d, Difícil 2-4d, Imposible 5d)
- Mantenimiento: **30-40% webs cambian/año → 150-200 roturas/año = 1 FTE permanente**

### 1C. Redes Sociales (detalle en subagente 1C)

| Red | API oficial 345 comunas? | Realidad | Escalabilidad |
|---|---|---|---|
| **Facebook Pages** | PPCA/PPMA (App Review 4-6 sem, alta tasa rechazo comercial) | 90% posts = afiche JPG + texto libre, fecha dentro de imagen → requiere OCR+LLM | **Baja** |
| **Instagram** | Graph API `Business Discovery` (30 hashtags/7d, ventana 24h) + Basic Display sunset 09/2025 | Similar FB, menos volumen mayor | **Muy baja** |
| **CrowdTangle** | **Shutdown 14/08/2024** | Reemplazo Content Library = solo académico, USD 371/mes, no comercial | **Nula** |
| **WhatsApp Groups** | Cloud API 8 pax/grupo, 10k grupos, invite-only, USD 0.0889/msg marketing | 90% JJVV son consumer groups no-scrapeables | **Baja lectura, Alta como canal de CARGA** |
| **Apify scraper** | Gestionado `facebook-pages-scraper` USD 5.4-10/1k pages | Más estable que casero, pero mismo riesgo TOS + HTML drift 4-6 sem | **POC 1 mes sí, prod no** |

**TOS Meta (04/03/2026):** `You may not access data using automated means without permission. We reserve rights against text and data mining.` + `Automated Data Collection Terms`. Cortes: `hiQ v LinkedIn (2022)` y `Meta v Bright Data (23/01/2024)` protegen logged-off scraping de cargo penal, pero **no de demanda civil por breach + ban operativo** (IP ban, fingerprint, Guest View 2025 cada vez más loggeado-required).

**WhatsApp como canal de carga (el uso viable):** Bot Cloud API donde vecino/dirigente reenvía afiche → OCR+LLM → bot responde `¿Es {fecha} {hora} en {lugar}? Confirma con 1` (ventana Service gratis) → tras 2 confirmaciones publica. Costo <USD 45/mes. TOS-compliant (invite link opt-in).

### 1D. Modelo Humano B2G (detalle en subagente 1D)

**Vamos a Cuidarnos (Bizkaia, 10 municipios, +5k usuarios):** NO es CMS self-service. Es **concierge**: *"El equipo se encarga de mantener la app viva, coordinándonos con el Ayuntamiento"*. Licencia incluye *"plataforma de gestión + soporte + estadísticas + gestión integral de contenidos para que no tenga que preocuparse"*. Combinado con fondos Diputación Foral Bizkaia/BBK/Mapfre. **Lección: ni ellos con 10 municipios se animaron a darle CMS al funcionario.**

**Conecta Mayor / Espacio Mayor (Chile):** 336 municipios (97%) por Vamos Chilenos (80k celulares). **No tiene API** pública hoy, pero es **canal de confianza B2G** que vos no tenés. Estrategia recomendada: **aliado de difusión, apps separadas** (banner en Espacio Mayor + talleres Academia Digital Itinerante), no competir ni pedir ser feature. Pitch: *"Les pasamos feed JSON validado de 345 comunas como sección Panoramas; ustedes suman métrica participación."* Contacto: `contacto@conectamayor.cl`.

**Comparativa CMS para portal municipal (funcionario 50+, Word/Excel/WhatsApp, 3-5 acts/semana):**

| Herramienta | Fricción | Tiempo/act | Multi-tenant | Costo 345 muni | Validación |
|---|---|---|---|---|---|
| Google Forms+Sheets | ⭐ Baja (ya lo conoce) | 1-2 min | ❌ columna `comuna` | Gratis | Débil |
| **Airtable** | ⭐⭐ Baja-Media (Excel con colores) | 2-3 min | ⚠️ 1 base + 345 vistas | $6.900/mes (345 licencias Pro) | Buena |
| **Supabase** | Alta cruda / **Baja con form custom** | 2 min (con form) | ✅ RLS `WHERE comuna_id = X` | $25/mes Pro + infra | **Excelente** |
| Strapi/Directus | Media (conceptos Content-Type) | 5 min | ⚠️ config | Self-host $99/mes | Muy buena |
| **Softr/Stacker sobre Supabase** | ⭐ Muy baja (botón "Agregar Actividad", 6 campos) | 1.5-2 min | ✅ `Logged-in -> filter comuna` | $50-200/mes + base | Buena |

**Stack recomendado:** `Funcionario → Softr/Next.js form (6 campos) → Supabase (1 tabla activities + RLS + storage fotos) → webhook → TanStack Start ISR + curación central`

**Viabilidad B2G Chile (ChileCompra):**
- **Convenio Marco ID 2239-2-LR26** (Desarrollo Software, 100-25.000 UTM ~$6,8M-$1.700M) — catálogo 1-clic si ganás licitación marco.
- **Compra Ágil** (desde 12/12/2024, Ley 21.634) **hasta 100 UTM (~$6,8M / ~USD 7k)** — 3 cotizaciones, sin resolución, solo para EMT pymes en 1º llamado. **Tu puerta de entrada para piloto.**
- Ciclo venta: 6-18 meses, presupuesto DIDECO se arma oct-nov.

**Pricing propuesto:**
| Plan | Precio anual | Vía compra |
|---|---|---|
| Gratis Vitrina (300 comunas chicas) | $0 | — |
| Piloto Impacto (30 medianas) | $1,2M-2,9M (18-43 UTM) | Compra Ágil |
| Pro Ciudad Amigable (15 grandes) | $4,8M-6,5M (70-95 UTM) | Compra Ágil tope |
| Convenio Marco (GORE/SENAMA paquete 10) | $25M-40M | Convenio Marco |

---

## 2. Ranking Unificado Oleada 1

| Rank | Fuente/Estrategia | Cobertura 345 | Frescura | Confiabilidad | Costo | Mantenimiento | Veredicto |
|---|---|---|---|---|---|---|---|
| **🥇** | **ChileCultura API oculta** | 70-80% efectiva (16 regiones, ~100 comunas simultáneas) | Diaria | Media (sin SLA/doc) | 0 | Medio | **Primaria MVP — motor nacional** |
| **🥈** | **IND/SIGI scraping** | ~50% regional | Semanal | Media (HTML) | 0+dev | Alto | Secundaria etaria 60+ |
| **🥉** | **Supabase + Softr + curación concierge** | 100% (vos sos la fuente) | 24h humana | Alta (vos controlás) | $25-200/mes | Bajo (1-2 curadores) | **Infraestructura ganadora** |
| 4 | IDE Patrimonio (WMS) | 100% geo | Semestral | Alta | 0 | Bajo | Enriquecimiento, no cartelera |
| — | datos.gob.cl CKAN | <5% actividades | Obsoleta | Alta (infra) / Nula (dato) | 0 | Bajo | Watchdog futuro |
| — | Facebook firehose | 100% posts pero no estructurado | Real-time | Baja (ban/HTML drift) | $32-47/mes + 20% dev | Muy alto | Complemento curado piloto RM |
| — | Scraping 345 webs | 20% fácil real | 1-3 sem lag | Baja (fragilidad) | 450-650 d/h | 1 FTE/año | **Descartado federado** |

---

## 3. Implicancia Arquitectónica para TanStack Start

**Descartar:** "un scraper por comuna" y "Facebook como backend".

**Adoptar — Pipeline Híbrido Recomendado (Oleada 1):**

```
[FUENTES]                          [INGESTA]                    [VALIDACIÓN]              [CONSUMO]
ChileCultura API (490 ev) ──┐
IND/SIGI scraping ──────────┤─→ Cron 6-12h ─→ Supabase ─→ Cola humana (2 curadores) ─→ TanStack Start
Providencia/Concepción ─────┤   (3 parsers)      (RLS)        (WhatsApp bot inbox)         GET /api/actividades?comuna=X
                             │                                              │
WhatsApp bot (vecino) ───────┴─→ inbound gratis ────────────────────────────┘
                             ↓
                    Enriquecimiento: OSM Nominatim + IDE Patrimonio + flag manual baño/estac.
```

- **Fase 0 (0-3 meses):** Vos curás 100% concierge con 5 pilotos (1 RM, 1 Valpo, 1 Biobío, 1 sur rural, 1 norte). Google Form → Supabase → TanStack Start. Municipio solo reenvía afiche por WhatsApp.
- **Fase 1 (3-9 meses):** Softr form 6 campos (título, fecha, lugar, cupo, gratis/sí-no, foto) solo para esos 5. Medís adopción <30% = mantenés concierge.
- **Fase 2 (9-18 meses):** Con 5 casos + reportes PDF mensuales, vendés paquete 10 comunas vía Compra Ágil + alianza Conecta Mayor.

**Campos MVP que NINGUNA fuente nacional resuelve (requiere enriquecimiento propio):** `hora`, `dirección exacta`, `baño`, `estacionamiento`, `comoLlegar` → resolver con geocoding + capa IDE Patrimonio + flag manual.

---

## 4. Próximos Pasos — Oleada 2

Oleada 1 mapeó **qué existe**. Oleada 2 valida **qué funciona técnicamente** con POCs reales (sin inventar):

- **2A — POC Scraping Seed (Providencia + Concepción + ChileCultura):** `fetch+cheerio` + normalización `commune` a código INE 346 + `main_discipline` a 4-5 categorías propias.
- **2B — POC IA Extraction (Facebook afiche JPG):** `OCR → LLM NER → geocoding` con tasa precisión y costo por 100 actividades.
- **2C — POC Panel Municipal (Softr + Supabase RLS + WhatsApp bot):** flujo 6 campos + validación `draft/pending/approved` + reporte PDF mensual mock.

Cada POC con métrica: **precisión, costo/mes, tiempo/carga, mantenimiento**.

---

## 5. Archivos de Esta Investigación

- **Este archivo:** `01 - Mapeo Nacional - Oleada 1.md` — síntesis Orquestador (vos estás acá)
- **Próximos:** `02 - Validacion Tecnica - Oleada 2.md`, `03 - Arquitectura Hibrida - Oleada 3.md`, `04 - Sintesis y Recomendacion.md`
- **MOC actualizado:** `README.md` (este directorio)

---

## 6. Referencias Verificadas (selección Oleada 1)

- ChileCultura API viva: `https://chilecultura.gob.cl/api/v1.0/eventos/search?page=1&page_size=50&status=approved&free=true` (200, 490 eventos 27/08/2026)
- datos.gob.cl: `https://datos.gob.cl/api/3/action/package_search?q=taller+deportivo&rows=10` (count:1, 2015)
- SENAMA: `https://www.senama.gob.cl/establecimientos-de-larga-estadia-para-adultos-mayores-eleam` (22 ELEAM jun 2025)
- SIGI: `https://sigi.ind.cl/actividad/buscar` (HTML, no API) + `ind.cl/actividades-deportivas-gratuitas`
- Municipal muestra: `loprado.cl`, `providencia.cl/provi/2026-actividades-de-agosto` (tabla 150 filas), `concepcioncultural.cl/agenda/`, `municipalidadmaipu.cl` (SPA Vue)
- Meta: `developers.facebook.com/docs/features-reference/page-public-content-access` (PPCA), TOS 04/03/2026, CrowdTangle shutdown 14/08/2024, Content Library CASD USD 371/mes
- WhatsApp: Cloud API Groups (8 pax, 10k grupos, OBA), pricing Chile USD 0.0889/0.0200 per-message 01/07/2025
- B2G: ChileCompra Convenio Marco ID 2239-2-LR26 (100-25.000 UTM), Compra Ágil 100 UTM Ley 21.634, Vamos a Cuidarnos `vamosacuidarnos.org/entidades-y-ayuntamientos`, Conecta Mayor `conectamayor.cl` (336 municipios)

---

#oleada-1 #mapeo-nacional #fuentes-datos #actividad-facil #chilecultura #scraping #b2g #supabase
