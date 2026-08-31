---
title: "01 — Visión General"
description: "Objetivo, público, alcance piloto Lo Prado y evolución de plataforma del proyecto Conexión Mayor."
---

# 01 — Visión General

> Conectar a personas de 60+ años de Lo Prado con actividades gratuitas o de bajo costo cercanas a su hogar, mediante una interfaz móvil de fricción cero.

**Estado:** ✅ Definido

## Contenido

- [Objetivo](#objetivo)
- [Público objetivo](#público-objetivo)
- [Alcance del piloto](#alcance-del-piloto)
- [Propuesta de valor](#propuesta-de-valor)
- [Evolución de plataforma: del PRD original a la web actual](#evolución-de-plataforma-del-prd-original-a-la-web-actual)
- [Nombre del producto](#nombre-del-producto)
- [Principios de diseño](#principios-de-diseño)
- [Fuera de alcance en el MVP](#fuera-de-alcance-en-el-mvp)
- [Documentos relacionados](#documentos-relacionados)

## Objetivo

Reducir el aislamiento y aumentar la participación comunitaria de adultos mayores en Lo Prado facilitando el **descubrimiento y la asistencia** a actividades locales pertinentes, cercanas y accesibles.

El problema no es la falta de actividades, sino la **fragmentación de la información**: afiches en sedes, publicaciones en Facebook municipal, avisos del CESFAM y boca a boca. El producto centraliza esa oferta en un único lugar legible y accionable.

Métrica de éxito del piloto (orientativa, a validar con la Oficina del Adulto Mayor):

- Al menos un porcentaje relevante de usuarios encuentra una actividad a la que efectivamente asiste en sus primeras dos semanas de uso.
- Tiempo desde apertura hasta comprensión de una actividad < 30 segundos sin ayuda.

> [!NOTE]
> Las métricas definitivas se acuerdan con la contraparte municipal. Ver [08-roadmap.md](./08-roadmap.md) — fase de validación.

## Público objetivo

| Atributo | Descripción |
|----------|-------------|
| **Usuario principal** | Personas de **60+ años** residentes en Lo Prado, con alfabetización digital básica o intermedia. |
| **Contexto de uso** | Teléfono móvil propio, frecuentemente con visión disminuida o motricidad fina reducida. Uso en el hogar o en sede vecinal. |
| **Necesidades críticas** | Texto grande y legible, pocos pasos, información certera sobre servicios del lugar (baño, estacionamiento) y cómo llegar sin transbordos. |
| **Usuarios secundarios** | Familiares, dirigentes vecinales y personal de la Oficina del Adulto Mayor que cargan o recomiendan actividades. |

Ver detalle de requisitos de accesibilidad en [06-requisitos-producto.md](./06-requisitos-producto.md#requisitos-no-funcionales).

## Alcance del piloto

- **Territorio:** comuna de **Lo Prado, Santiago de Chile**. Todas las actividades de referencia, direcciones y distancias usan Lo Prado como centro.
- **Oferta:** actividades **gratuitas o de bajo costo** del municipio, CESFAM, centros culturales, juntas de vecinos y organizaciones comunitarias.
- **Operación inicial:** carga curada de actividades (ver [02-estrategia-adquisicion-actividades.md](./02-estrategia-adquisicion-actividades.md)).

> [!IMPORTANT]
> El piloto no pretende cubrir toda la Región Metropolitana en esta etapa. Escalar a otras comunas requiere revalidar fuentes de datos y radios de distancia.

## Propuesta de valor

1. **Cero fricción para descubrir:** sin registro ni inicio de sesión; al abrir, el usuario ve actividades cercanas ordenadas por proximidad y fecha.
2. **Información accionable:** cada ficha responde “¿qué es?”, “¿cuándo?”, “¿dónde?” y “¿cómo llego?” en lenguaje claro, con baño/estacionamiento explícitos.
3. **Transporte sin complejidad:** indicaciones en texto natural + acceso directo a Google Maps y a opciones de transporte (ver [04-integracion-transporte.md](./04-integracion-transporte.md)).
4. **Canal de retorno simple:** formulario de sugerencias accesible desde el menú principal.

El núcleo de esta propuesta se detalla en [03-nucleo-descubrimiento-actividades.md](./03-nucleo-descubrimiento-actividades.md).

## Evolución de plataforma: del PRD original a la web actual

| Etapa | Plataforma planteada | Estado |
|-------|----------------------|--------|
| **PRD original** | Android nativo o Flutter / React Native | Documento de referencia; no implementado. |
| **Decisión vigente** | **Web primero** (responsive, mobile-first) | ✅ Implementado — ver [07-arquitectura-y-stack.md](./07-arquitectura-y-stack.md). |
| **Siguiente etapa** | **PWA** (instalable, offline parcial, notificaciones si aplica) | 🔜 Roadmap futuro — ver [08-roadmap.md](./08-roadmap.md). No está implementada aún. |

**Por qué web primero:**

- Distribución inmediata sin pasar por stores.
- Iteración más rápida con la contraparte municipal.
- Base directa para PWA posterior sin reescribir el producto.

> [!NOTE]
> La mención a Android/Flutter en el PRD original se conserva como contexto histórico en [06-requisitos-producto.md](./06-requisitos-producto.md). La dirección actual es **web → PWA**.

## Nombre del producto

> [!CAUTION]
> **A DECIDIR — Nombre definitivo:** candidatos actuales: **Conexión Mayor**, **Actividad Fácil**, **Ciudad Viva Mayor**. Ninguno es definitivo. En código y documentación se usa *Conexión Mayor* como nombre de trabajo; la marca visible al usuario se definirá antes del lanzamiento piloto y debe ser consistente en toda la interfaz.

Criterios para la decisión (orientativos):

- Comprensible sin explicación para 60+.
- Fácil de pronunciar y recordar por teléfono.
- Sin colisión con programas municipales existentes.

## Principios de diseño

1. **1–2 tarjetas por pantalla**, tipografía grande, alto contraste (WCAG AAA).
2. **Lenguaje natural:** “A 8 cuadras caminando” en lugar de “780 m”.
3. **Certeza sobre el lugar:** baño y estacionamiento siempre visibles, aunque sea como “Sin información”.
4. **0 % publicidad**, 0 banners, 0 ventanas emergentes.
5. **Un camino principal:** descubrir → entender → llegar. Todo lo demás es secundario.

Detalle normativo en [06-requisitos-producto.md](./06-requisitos-producto.md) y umbrales de distancia en [05-concepto-cerca-radio-distancia.md](./05-concepto-cerca-radio-distancia.md).

## Fuera de alcance en el MVP

- Registro, login o perfiles personalizados.
- Pagos dentro de la aplicación.
- Chat o mensajería entre usuarios.
- Recomendaciones algorítmicas personalizadas.
- Cobertura fuera de Lo Prado.

## Documentos relacionados

- [02-estrategia-adquisicion-actividades.md](./02-estrategia-adquisicion-actividades.md) — cómo se poblará el contenido.
- [03-nucleo-descubrimiento-actividades.md](./03-nucleo-descubrimiento-actividades.md) — flujo principal del producto.
- [05-concepto-cerca-radio-distancia.md](./05-concepto-cerca-radio-distancia.md) — qué significa “cerca”.
- [06-requisitos-producto.md](./06-requisitos-producto.md) — PRD completo.
- [07-arquitectura-y-stack.md](./07-arquitectura-y-stack.md) — stack real y evolución a PWA.
- [08-roadmap.md](./08-roadmap.md) — fases y próximos pasos.
