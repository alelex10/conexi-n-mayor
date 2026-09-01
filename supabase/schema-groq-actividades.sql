-- Conexión Mayor — Groq web-search — HITL queue
-- Ejecutar este archivo COMPLETO en Supabase → SQL Editor → New query → Run.
-- Idempotente: puede ejecutarse varias veces sin errores.
-- Requiere extensión pgcrypto para gen_random_uuid() (ya creada en schema.sql).
-- Este archivo es el "delta spec" para la feature feat/groq-busqueda-actividades-web (ex grok).
-- Duplica la migración supabase/migrations/busquedas_groq_pendientes.sql para conveniencia (schema-groq-actividades.sql como entry point).

create extension if not exists "pgcrypto";

-- Compatibilidad: renombrar tabla vieja si existe
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'busquedas_grok_pendientes' and table_schema = 'public')
     and not exists (select 1 from information_schema.tables where table_name = 'busquedas_groq_pendientes' and table_schema = 'public') then
    alter table public.busquedas_grok_pendientes rename to busquedas_groq_pendientes;
  end if;
end $$;

create table if not exists public.busquedas_groq_pendientes (
  id uuid primary key default gen_random_uuid(),
  creado_en timestamptz not null default now(),
  ubicacion text not null,
  radio_metros integer,
  raw_json jsonb not null,
  confidence numeric(3,2) not null check (confidence >= 0 and confidence <= 1),
  provider text not null default 'groq:qwen/qwen3.6-27b',
  status text not null default 'pendiente' check (status in ('pendiente','aprobada','rechazada')),
  warnings text[]
);

create index if not exists busquedas_groq_pendientes_status_idx on public.busquedas_groq_pendientes (status);
create index if not exists busquedas_groq_pendientes_creado_en_idx on public.busquedas_groq_pendientes (creado_en desc);
create index if not exists busquedas_groq_pendientes_confidence_idx on public.busquedas_groq_pendientes (confidence);
create index if not exists busquedas_groq_pendientes_ubicacion_idx on public.busquedas_groq_pendientes (ubicacion);

grant all on public.busquedas_groq_pendientes to service_role;
revoke all on public.busquedas_groq_pendientes from anon, authenticated;

alter table public.busquedas_groq_pendientes enable row level security;

comment on table public.busquedas_groq_pendientes is 'HITL queue for Groq web-search with confidence < 0.85. Never auto-publish.';
