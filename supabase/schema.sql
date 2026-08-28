-- Actividad Fácil / Ciudad Viva Mayor — esquema para Supabase (Lo Prado)
-- Ejecutar este archivo completo en Supabase → SQL Editor → New query → Run.

-- 1) Tipos ------------------------------------------------------------------
do $$ begin
  create type public.disponibilidad as enum ('si', 'no', 'sin_info');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.estado_actividad as enum ('borrador', 'publicada', 'archivada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tipo_sugerencia as enum ('sugerencia', 'error', 'actividad');
exception when duplicate_object then null; end $$;

-- 2) Tabla de actividades ---------------------------------------------------
create table if not exists public.actividades (
  id text primary key,
  nombre text not null,
  descripcion text not null default '',
  categoria text not null default 'General',
  fecha date not null,
  hora time not null,
  lugar text not null,
  direccion text not null,
  latitud double precision,
  longitud double precision,
  distancia_metros integer not null default 0,
  gratuito boolean not null default true,
  precio text,
  bano public.disponibilidad not null default 'sin_info',
  estacionamiento public.disponibilidad not null default 'sin_info',
  como_llegar text not null default '',
  fuente text,
  estado public.estado_actividad not null default 'publicada',
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists actividades_fecha_idx on public.actividades (fecha, hora);
create index if not exists actividades_estado_idx on public.actividades (estado);

grant select on public.actividades to anon;
grant select on public.actividades to authenticated;
grant all on public.actividades to service_role;

alter table public.actividades enable row level security;

drop policy if exists "Actividades publicadas son públicas" on public.actividades;
create policy "Actividades publicadas son públicas"
  on public.actividades for select
  to anon, authenticated
  using (estado = 'publicada');

-- 3) Tabla de sugerencias / feedback ---------------------------------------
create table if not exists public.sugerencias (
  id uuid primary key default gen_random_uuid(),
  tipo public.tipo_sugerencia not null default 'sugerencia',
  nombre text,
  contacto text,
  mensaje text not null,
  revisado boolean not null default false,
  creado_en timestamptz not null default now()
);

grant all on public.sugerencias to service_role;
-- Sin grants para anon/authenticated: solo el servidor escribe y lee.

alter table public.sugerencias enable row level security;

-- 4) Datos iniciales de Lo Prado -------------------------------------------
insert into public.actividades
  (id, nombre, descripcion, categoria, fecha, hora, lugar, direccion, distancia_metros,
   gratuito, precio, bano, estacionamiento, como_llegar, fuente, estado)
values
  ('taller-memoria', 'Ejercicios entretenidos de memoria, lectura y juegos de mesa. Se entrega café y galletas. No necesita inscribirse.', 'Salud y mente', '2026-09-01', '10:30', 'Centro Cultural Lo Prado', 'San Pablo 5850, Lo Prado, Santiago', 550, true, null, 'si', 'si', 'Llegar en micro J10, bajarse en San Pablo con Las Rejas. Camine media cuadra hacia el poniente.', 'carga manual', 'publicada'),
  ('gimnasia-entretenida', 'Clase suave de 45 minutos con monitora del programa Adulto Mayor. Traiga agua y ropa cómoda.', 'Ejercicio', '2026-09-02', '09:00', 'Plaza Buzeta', 'Buzeta 1500, Lo Prado, Santiago', 780, true, null, 'sin_info', 'no', 'A 8 cuadras caminando desde la Municipalidad. También pasa la micro 405 por Buzeta.', 'carga manual', 'publicada'),
  ('baile-entretenido', 'Música en vivo, baile y once compartida. Aporte voluntario para la once.', 'Recreación', '2026-09-03', '16:00', 'Sede Junta de Vecinos N°12', 'Las Rejas Norte 1200, Lo Prado, Santiago', 1400, false, '$1.000 por persona', 'si', 'sin_info', 'Micro I09 hasta Las Rejas Norte con Mapocho. La sede está frente al almacén.', 'carga manual', 'publicada'),
  ('control-salud', 'Toma de presión, medición de azúcar y orientación de enfermería. Lleve su cédula de identidad.', 'Salud', '2026-09-04', '09:30', 'CESFAM Lo Prado', 'Av. San Pablo 6550, Lo Prado, Santiago', 2100, true, null, 'si', 'si', 'Micro J10 o 405 por San Pablo. Bajarse en el paradero del CESFAM, sin transbordos.', 'carga manual', 'publicada'),
  ('taller-celular', 'Taller paso a paso: llamadas, WhatsApp y fotos. Traiga su celular cargado.', 'Aprendizaje', '2026-09-05', '11:00', 'Biblioteca Municipal de Lo Prado', 'San Pablo 5960, Lo Prado, Santiago', 620, true, null, 'si', 'no', 'A 6 cuadras caminando por San Pablo hacia el oriente. Vereda plana y con semáforos.', 'carga manual', 'publicada')
on conflict (id) do nothing;

-- Nota: la columna `nombre` se completa aquí porque el insert usa el orden de columnas
-- declarado arriba; ajusta los textos desde el panel de Supabase si lo necesitas.
