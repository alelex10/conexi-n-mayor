---
title: "03 — Núcleo: Descubrimiento de Actividades"
description: "Flujo principal del producto: listar, filtrar por radio, tarjeta y ficha de detalle."
---

# 03 — Núcleo: Descubrimiento de Actividades

> El corazón del producto. Si este flujo no es claro en 30 segundos, el resto no importa.

**Estado:** ✅ Definido — implementado en la web actual; ajustes de accesibilidad y copy siguen iterando.

## Contenido

- [Principio rector](#principio-rector)
- [Flujo principal](#flujo-principal)
- [Listado y filtro por radio](#listado-y-filtro-por-radio)
- [Tarjeta de actividad](#tarjeta-de-actividad)
- [Ficha de detalle](#ficha-de-detalle)
- [Estados y casos borde](#estados-y-casos-borde)
- [Accesibilidad del núcleo](#accesibilidad-del-núcleo)
- [Fuente de datos](#fuente-de-datos)
- [Documentos relacionados](#documentos-relacionados)

## Principio rector

**Un camino, sin desvíos:** abrir → ver actividades cercanas → entender una → saber cómo llegar.

Todo lo que no sirva a ese camino es secundario en el MVP. No hay login, no hay feed algorítmico, no hay notificaciones invasivas.

## Flujo principal

```
Apertura (sin login)
  → Lista de actividades del barrio (orden: proximidad + fecha)
    → Filtro por radio [800 m | 1500 m | 2500 m]
      → Tarjeta (1–2 por pantalla)
        → Ficha de detalle (baño / estacionamiento / cómo llegar)
          → Acción: ver en Google Maps / pedir transporte / volver
```

Criterios de aceptación del flujo:

- [x] El usuario ve actividades sin registrarse ni iniciar sesión.
- [x] El filtro por radio afecta inmediatamente el listado.
- [x] Cada actividad muestra si es gratuita o de pago.
- [x] La ficha de detalle responde “¿cómo llego?” en lenguaje natural.

## Listado y filtro por radio

**Comportamiento actual:**

- Fuente: `public.actividades` con `estado = 'publicada'`, fallback a `src/data/actividades.ts` si Supabase no está configurado.
- Orden: por `distancia_metros` y `fecha` (ver `supabase/schema.sql` — índices en `fecha, hora` y `distancia_metros`).
- Filtro: selector de radio con tres opciones fijas (ver [05-concepto-cerca-radio-distancia.md](./05-concepto-cerca-radio-distancia.md)).

| Opción en UI      | Valor  | Intención                            |
| ----------------- | ------ | ------------------------------------ |
| Caminando (800 m) | `800`  | Movilidad reducida leve, 5–8 cuadras |
| Cerca (1,5 km)    | `1500` | Radio intermedio                     |
| En micro (2,5 km) | `2500` | Una micro directa sin transbordo     |

Definición en código: `RADIO_OPCIONES` en [`src/data/actividades.ts`](../src/data/actividades.ts) — valores `800`, `1500`, `2500`.

> [!NOTE]
> `distancia_metros` en la base es hoy un valor curado por actividad (seed). El cálculo por geolocalización real del usuario es parte del roadmap (ver [08-roadmap.md](./08-roadmap.md)).

## Tarjeta de actividad

Cada tarjeta responde en una mirada: **qué es, cuándo, dónde y cuánto cuesta**.

Campos visibles en tarjeta (mínimo):

| Campo        | Origen                | Notas                                                            |
| ------------ | --------------------- | ---------------------------------------------------------------- |
| Nombre       | `nombre`              | Título principal, 24sp, alto contraste                           |
| Fecha y hora | `fecha` + `hora`      | Formato localizado `es-CL` (ej. “Lunes 1 de septiembre — 10:30”) |
| Lugar        | `lugar`               | Nombre del recinto                                               |
| Dirección    | `direccion`           | Texto corto, truncado si es necesario                            |
| Costo        | `gratuito` / `precio` | Badge “Gratuito” o precio textual                                |
| Distancia    | `distancia_metros`    | Formateada como “550 metros” o “1,4 km”                          |
| Categoría    | `categoria`           | Chip o etiqueta secundaria                                       |

Reglas de presentación:

- **1 a 2 tarjetas por pantalla** en móvil (vertical, grande).
- Tipografía mínima 18sp cuerpo, 24sp títulos; botones 48×48 dp; contraste WCAG AAA.
- Sin truncar información crítica (fecha, lugar, costo).

## Ficha de detalle

Al tocar una tarjeta, la ficha amplía sin abrumar.

| Sección                 | Campos                                          | Valores posibles                                                               |
| ----------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------ |
| **Encabezado**          | Nombre, categoría, fecha/hora, lugar, dirección | —                                                                              |
| **Descripción**         | `descripcion`                                   | Texto claro, sin jerga                                                         |
| **Servicios del lugar** | `bano`, `estacionamiento`                       | `si` / `no` / `sin_info` → se muestra como “Sí” / “No” / “Sin información”     |
| **Cómo llegar**         | `como_llegar`                                   | Texto natural (ej. “Llegar en micro J10, bajarse en San Pablo con Las Rejas…”) |
| **Acciones**            | Botón Google Maps, bloque transporte            | Ver [04-integracion-transporte.md](./04-integracion-transporte.md)             |

Ejemplo de `como_llegar` (datos seed reales):

> “Llegar en micro J10, bajarse en San Pablo con Las Rejas. Camine media cuadra hacia el poniente.”

> [!IMPORTANT]
> `bano` y `estacionamiento` **nunca se omiten**. Si no hay dato, se muestra explícitamente “Sin información” — la certeza es parte de la accesibilidad.

## Estados y casos borde

| Estado                                | Qué ve el usuario                                                                 |
| ------------------------------------- | --------------------------------------------------------------------------------- |
| **Sin actividades en el radio**       | Mensaje claro + sugerencia de ampliar a 1,5 km o 2,5 km                           |
| **Sin geolocalización / sin permiso** | Listado por defecto con `distancia_metros` curada; opción de activar ubicación    |
| **Actividad sin `como_llegar`**       | Se muestra dirección + botón Google Maps; bloque de transporte sin texto de micro |
| **Actividad de pago sin `precio`**    | Badge “De pago” sin monto; se invita a consultar en el lugar                      |
| **Error de carga (Supabase)**         | Fallback a datos mock de `src/data/actividades.ts` si aplica; mensaje no técnico  |

> [!CAUTION]
> **A DECIDIR:** copy exacto de estados vacíos y de error, y si el fallback mock debe mantenerse a largo plazo o retirarse cuando Supabase sea la única fuente.

## Accesibilidad del núcleo

Requisitos que aplican directamente a este flujo (ver [06-requisitos-producto.md](./06-requisitos-producto.md#requisitos-no-funcionales)):

- Contraste WCAG AAA, tipografía 18sp/24sp, área de toque 48×48 dp.
- Navegación por teclado y lectores de pantalla; foco visible.
- Lenguaje natural para distancias (“A 8 cuadras caminando” además de “780 metros”).

## Fuente de datos

- **Producción:** Supabase `public.actividades` (`estado = 'publicada'`) — ver [`supabase/schema.sql`](../supabase/schema.sql).
- **Fallback local:** [`src/data/actividades.ts`](../src/data/actividades.ts) — tipos `Actividad`, `RADIO_OPCIONES`, formateadores `formatearFecha` / `formatearDistancia`.
- **Sugerencias:** `public.sugerencias` + ruta `/sugerencias` (ver [06-requisitos-producto.md](./06-requisitos-producto.md)).

## Documentos relacionados

- [02-estrategia-adquisicion-actividades.md](./02-estrategia-adquisicion-actividades.md) — origen del contenido.
- [04-integracion-transporte.md](./04-integracion-transporte.md) — bloque de transporte en la ficha.
- [05-concepto-cerca-radio-distancia.md](./05-concepto-cerca-radio-distancia.md) — definición de radios.
- [06-requisitos-producto.md](./06-requisitos-producto.md) — PRD y criterios de aceptación.
- [07-arquitectura-y-stack.md](./07-arquitectura-y-stack.md) — implementación técnica del listado y filtros.
