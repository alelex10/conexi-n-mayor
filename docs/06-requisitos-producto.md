---
title: "06 — Requisitos de Producto (PRD)"
description: "Requisitos funcionales y no funcionales del MVP, con estado por ítem y criterios de aceptación."
---

# 06 — Requisitos de Producto (PRD)

> Fuente autoritativa de qué hace y qué no hace el MVP. Cada requisito indica su estado en el producto actual.

**Estado:** ✅ Definido — el PRD original se conserva y se mapea al estado real del código.

## Contenido

- [Contexto y evolución](#contexto-y-evolución)
- [Requisitos funcionales](#requisitos-funcionales)
- [Requisitos no funcionales](#requisitos-no-funcionales)
- [Matriz de trazabilidad](#matriz-de-trazabilidad)
- [Fuera de alcance (MVP)](#fuera-de-alcance-mvp)
- [Criterios de aceptación por requisito](#criterios-de-aceptación-por-requisito)
- [Documentos relacionados](#documentos-relacionados)

## Contexto y evolución

| Aspecto | PRD original | Estado actual |
|---------|--------------|---------------|
| Nombre de trabajo | Actividad Fácil | Conexión Mayor (nombre de trabajo; ver [01-vision-general.md](./01-vision-general.md)) |
| Plataforma | Android nativo o Flutter / React Native | **Web primero** (TanStack Start + Vite), luego PWA — ver [07-arquitectura-y-stack.md](./07-arquitectura-y-stack.md) |
| Piloto | Lo Prado, Santiago de Chile | Sin cambios |
| Público | 60+ con alfabetización digital básica/intermedia | Sin cambios |

> [!NOTE]
> La mención a Android/Flutter se conserva aquí solo como contexto histórico. La dirección vigente es **web → PWA** (ver [01-vision-general.md](./01-vision-general.md#evolución-de-plataforma-del-prd-original-a-la-web-actual)).

## Requisitos funcionales

Leyenda: `- [x]` implementado en el MVP web · `- [ ]` pendiente o parcial.

### RF-01 — Acceso y navegación

- [x] **RF-01.1** Navegación libre e inmediata **sin registro ni inicio de sesión**.
- [x] **RF-01.2** Diseño de pantalla simplificada: **1 a 2 tarjetas por pantalla** en formato vertical grande.

### RF-02 — Descubrimiento de actividades

- [x] **RF-02.1** Filtro automático por geolocalización / distancia dentro de radio configurable **800 m – 2,5 km** (opciones: 800 / 1500 / 2500).
- [x] **RF-02.2** Visualización clara en cada tarjeta de: **nombre, fecha/hora, lugar exacto, gratuito / de pago**.
- [x] **RF-02.3** Listado ordenado por proximidad y fecha.

### RF-03 — Ficha de detalles del lugar

- [x] **RF-03.1** Campo **baño**: `si` / `no` / `sin_info` — siempre visible, nunca omitido.
- [x] **RF-03.2** Campo **estacionamiento**: `si` / `no` / `sin_info` — siempre visible.
- [x] **RF-03.3** Campo **descripción** y **categoría** visibles en ficha.

> [!IMPORTANT]
> `bano` y `estacionamiento` usan el tipo `disponibilidad` (`si` / `no` / `sin_info`) definido en [`supabase/schema.sql`](../supabase/schema.sql). Mostrar “Sin información” es un requisito, no un fallback.

### RF-04 — Módulo de transporte e indicaciones

- [x] **RF-04.1** Texto descriptivo **“Cómo llegar”** en lenguaje natural (ej. “Llegar en micro J10, bajarse en San Pablo con Las Rejas…”).
- [x] **RF-04.2** Botón directo a **Google Maps** con dirección/coordenadas de la actividad.
- [ ] **RF-04.3** Botón para **llamar a radio taxi** local — ⏳ Pendiente detalle implementación (ver [04-integracion-transporte.md](./04-integracion-transporte.md)).
- [ ] **RF-04.4** Botón **“Pedir auto”** con deep-link a Uber / Cabify / DiDi — ⏳ Pendiente detalle implementación.

### RF-05 — Canal de feedback

- [x] **RF-05.1** Botón accesible en el menú principal para **enviar sugerencias o reportar errores** de forma simple (ruta `/sugerencias`).
- [x] **RF-05.2** Persistencia en `public.sugerencias` con RLS (INSERT anónimo permitido, lectura solo `service_role`) — ver [`supabase/schema.sql`](../supabase/schema.sql).

### RF-06 — Gestión de contenido (operación)

- [x] **RF-06.1** Tabla `public.actividades` con estados `borrador` / `publicada` / `archivada` y RLS (solo `publicada` visible a `anon`).
- [ ] **RF-06.2** Panel simple de carga manual para Oficina del Adulto Mayor / juntas de vecinos — 🚧 A decidir (ver [02-estrategia-adquisicion-actividades.md](./02-estrategia-adquisicion-actividades.md)).
- [ ] **RF-06.3** Automatización híbrida (scraping + IA + validación) — 🚧 A decidir / 🔜 Roadmap.

## Requisitos no funcionales

| ID | Requisito | Norma / Valor | Estado |
|----|-----------|---------------|--------|
| **RNF-01** | Tipografía mínima | **18sp** cuerpo, **24sp** títulos | ✅ Definido — aplicado en diseño |
| **RNF-02** | Contraste | **WCAG AAA** (texto negro sobre fondos claros/amarillos) | ✅ Definido |
| **RNF-03** | Área de toque | Botones **48×48 dp** mínimo | ✅ Definido |
| **RNF-04** | Publicidad | **0 %** banners, popups o notificaciones invasivas | ✅ Definido |
| **RNF-05** | Rendimiento | Carga inicial < 3 s en 3G; listado filtrable sin recarga completa | 🚧 A decidir (falta medición formal) |
| **RNF-06** | Accesibilidad | Navegación por teclado, foco visible, compatibilidad con lectores de pantalla | ✅ Definido (parcial; requiere auditoría) |
| **RNF-07** | Privacidad | Sin tracking invasivo; geolocalización solo con consentimiento explícito | ✅ Definido |
| **RNF-08** | Disponibilidad | Web responsive, mobile-first; PWA instalable a futuro | ✅ Web / 🔜 PWA |

> [!CAUTION]
> **A DECIDIR — RNF-05 y RNF-06:** falta definir herramienta y umbral de medición de rendimiento (Lighthouse / Web Vitals) y realizar auditoría de accesibilidad con usuarios reales y validadores automáticos. Ver [07-arquitectura-y-stack.md](./07-arquitectura-y-stack.md) y [08-roadmap.md](./08-roadmap.md).

## Matriz de trazabilidad

| Requisito | Código / Schema | Doc de detalle |
|-----------|-----------------|----------------|
| RF-01, RF-02, RF-03 | `src/routes/`, `src/data/actividades.ts`, `supabase/schema.sql` | [03-nucleo-descubrimiento-actividades.md](./03-nucleo-descubrimiento-actividades.md) |
| RF-02.1 (radio) | `RADIO_OPCIONES` en `src/data/actividades.ts` | [05-concepto-cerca-radio-distancia.md](./05-concepto-cerca-radio-distancia.md) |
| RF-04 | `como_llegar`, `direccion`, `latitud/longitud` en `public.actividades` | [04-integracion-transporte.md](./04-integracion-transporte.md) |
| RF-05 | `public.sugerencias`, ruta `/sugerencias` | [03-nucleo-descubrimiento-actividades.md](./03-nucleo-descubrimiento-actividades.md) |
| RF-06 | `supabase/schema.sql` (`estado`, RLS) | [02-estrategia-adquisicion-actividades.md](./02-estrategia-adquisicion-actividades.md) |
| RNF-01–04 | `src/styles.css`, Tailwind, shadcn | [07-arquitectura-y-stack.md](./07-arquitectura-y-stack.md) |

## Fuera de alcance (MVP)

- Registro, login, perfiles o personalización por usuario.
- Pagos dentro de la aplicación.
- Chat o mensajería entre usuarios.
- Recomendaciones algorítmicas personalizadas.
- Cobertura fuera de Lo Prado.
- Notificaciones push (hasta PWA).

## Criterios de aceptación por requisito

| Requisito | Criterio de aceptación |
|-----------|------------------------|
| **RF-01.1** | Al abrir la app web, el usuario ve actividades sin ningún paso de registro. |
| **RF-01.2** | En viewport móvil (360–414 px) se ven 1–2 tarjetas completas sin scroll horizontal. |
| **RF-02.1** | Cambiar el radio (800/1500/2500) actualiza el listado inmediatamente; sin resultados muestra sugerencia de ampliar. |
| **RF-02.2** | Cada tarjeta muestra nombre, fecha/hora localizada `es-CL`, lugar y badge de costo. |
| **RF-03.1/03.2** | Baño y estacionamiento siempre visibles como “Sí” / “No” / “Sin información”. |
| **RF-04.1** | `como_llegar` se muestra en lenguaje natural, sin códigos internos. |
| **RF-04.2** | Botón Google Maps abre la dirección/coordenadas correctas en nueva pestaña/app. |
| **RF-05.1** | Formulario de sugerencias accesible desde el menú; envío sin login; validación de `mensaje` requerido. |
| **RNF-01–03** | Auditoría visual: tipografía ≥ 18sp/24sp, contraste AAA, botones ≥ 48×48 dp. |
| **RNF-04** | No existe ningún banner, popup o solicitud de permiso no esencial en el flujo principal. |

## Documentos relacionados

- [01-vision-general.md](./01-vision-general.md) — visión y principios.
- [02-estrategia-adquisicion-actividades.md](./02-estrategia-adquisicion-actividades.md) — RF-06 en detalle.
- [03-nucleo-descubrimiento-actividades.md](./03-nucleo-descubrimiento-actividades.md) — RF-01 a RF-03.
- [04-integracion-transporte.md](./04-integracion-transporte.md) — RF-04.
- [05-concepto-cerca-radio-distancia.md](./05-concepto-cerca-radio-distancia.md) — RF-02.1.
- [07-arquitectura-y-stack.md](./07-arquitectura-y-stack.md) — implementación técnica de cada requisito.
- [08-roadmap.md](./08-roadmap.md) — qué falta y en qué orden.
