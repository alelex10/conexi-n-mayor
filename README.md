# Conexión Mayor

Para la comuna de Lo Prado (Santiago, Chile), la combinación ideal de fuentes de datos, integraciones de transporte y accesibilidad para adultos mayores se estructura de la siguiente manera.

Investigación de Fuentes de Datos (Gratuitas)

Fuente Factibilidad en Chile / Lo Prado Ventajas Desventajas / Retos APIs de Gobierno Media-Baja: datos.gob.cl y SENAMA tienen datos presupuestarios, pero rara vez APIs REST de eventos locales en vivo. Estructuradas y gratuitas. Poca actualización de actividades diarias a nivel municipal. Scraping Web Alta: Extracción del sitio oficial de Lo Prado (loprado.cl), Facebook municipal y centros culturales. Información directa y local. Si la página cambia su diseño, el script de scraping se rompe. IA + Web Search Alta: Agentes con scripts semanales buscando eventos en noticias y redes sociales locales. Permite sintetizar texto desestructurado a formato limpio. Requiere validación para evitar alucinaciones. Carga Manual Alta: Formulario sencillo administrado por la Oficina del Adulto Mayor de Lo Prado o juntas de vecinos. 100% confiable y verificado. Depende de la voluntad y tiempo de los encargados locales.

Recomendación para el MVP: Utilizar un enfoque híbrido: IA + Scraping automático de las redes/web de Lo Prado combinado con un panel web ultra simple para carga manual por parte de organizaciones comunitarias.

Detalle de la Opción C: Integración de Transporte

Para adultos mayores, la integración de transporte no debe ser compleja. Consta de dos niveles:

Llamada directa a Radio Taxis Locales: Un botón grande que permita llamar por teléfono directamente a líneas de radio taxis que operen en Lo Prado o comunas adyacentes (Pudahuel, Estación Central). Evita la fricción de manejar apps.

Deep-Linking a Apps de Transporte (Uber/Cabify/DiDi): Un botón que abra la app con el destino ya ingresado (ej. "Pedir auto a esta actividad"), ahorrándoles escribir la dirección.

Investigación del Radio de Distancia ("Cerca")

Distancia caminable (Paso pausado): 500 a 800 metros (aprox. 5 a 8 cuadras). Toma entre 10 y 15 minutos caminando y es el límite recomendado para personas con movilidad reducida leve.

Transporte público (Red Movilidad): Hasta 2,5 km si el trayecto requiere solo 1 micro directa (sin transbordos ni combinación de Metro).

Documento de Requisitos del Producto (PRD)

1. Visión General del Producto

Nombre del Proyecto: Actividad Fácil

Objetivo: Conectar a los adultos mayores de la comuna de Lo Prado con actividades gratuitas o de bajo costo cercanas a su hogar mediante una interfaz móvil de fricción cero.

Plataforma: Android (Nativo o Flutter/React Native).

Ubicación Piloto: Comuna de Lo Prado, Santiago de Chile.

2. Público Objetivo y Perfil de Usuario

Usuario Principal: Adultos mayores (60+ años) con alfabetización digital básica o intermedia, posible visión disminuida o motricidad fina reducida.

Necesidades Clave: Interfaz limpia, información legible, pasos claros para llegar y certeza de los servicios del lugar (baños/estacionamiento).

3. Requisitos Funcionales (MVP)

Acceso y Navegación:

Navegación libre e inmediata sin requerir registro o inicio de sesión.

Diseño de pantalla simplificada: Muestra un máximo de 1 a 2 tarjetas de actividades por pantalla en formato vertical grande.

Descubrimiento de Actividades:

Filtro automático por geolocalización dentro de un radio configurable de 800m a 2.5 km.

Visualización clara de: Nombre, Fecha/Hora, Lugar exacto, Gratuito / De Pago.

Ficha de Detalles del Lugar:

Baños: Muestra si cuenta con baño disponible (o "Sin información").

Estacionamiento: Muestra disponibilidad (o "Sin información").

Módulo de Transporte e Indicaciones:

Texto descriptivo con instrucciones de llegada (ej. "Llegar en micro J10, bajarse en San Pablo con Las Rejas").

Botón directo a Google Maps.

Botón para llamar a Radio Taxi local o abrir app de transporte.

Canal de Feedback:

Botón accesible en el menú principal para enviar sugerencias o reportar errores de manera simple.

4. Requisitos No Funcionales (UX/UI y Accesibilidad)

Tipografía: Tamaño mínimo de fuente de 18sp para textos generales y 24sp para títulos.

Contraste: Cumplimiento de estándares WCAG AAA (alto contraste de texto negro sobre fondos claros o amarillos).

Área de Toque: Botones con un tamaño mínimo de 48 \times 48\text{ dp} para evitar toques accidentales.

Publicidad: 0\% banners publicitarios, ventanas emergentes o notificaciones invasivas.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a690934b-bfd5-4300-84f1-3a1ea437414d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
