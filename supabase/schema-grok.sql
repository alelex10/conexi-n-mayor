-- Conexión Mayor — Grok (xAI) web-search — HITL queue
-- Ejecutar este archivo COMPLETO en Supabase → SQL Editor → New query → Run.
-- Idempotente: puede ejecutarse varias veces sin errores.
-- Requiere extensión pgcrypto para gen_random_uuid() (ya creada en schema.sql).
-- Este archivo es el "delta spec" para la feature feat/grok-busqueda-actividades-web.
-- Duplica la migración supabase/migrations/busquedas_grok_pendientes.sql para conveniencia (schema-grok.sql como entry point).

create extension if not exists "pgcrypto";

create table if not exists public.busquedas_grok_pendientes (
  id uuid primary key default gen_random_uuid(),
  creado_en timestamptz not null default now(),
  ubicacion text not null,
  radio_metros integer,
  raw_json jsonb not null,
  confidence numeric(3,2) not null check (confidence >= 0 and confidence <= 1),
  provider text not null default 'xai:grok-4-0709',
  status text not null default 'pendiente' check (status in ('pendiente','aprobada','rechazada')),
  warnings text[]
);

create index if not exists busquedas_grok_pendientes_status_idx on public.busquedas_grok_pendientes (status);
create index if not exists busquedas_grok_pendientes_creado_en_idx on public.busquedas_grok_pendientes (creado_en desc);
create index if not exists busquedas_grok_pendientes_confidence_idx on public.busquedas_grok_pendientes (confidence);
create index if not exists busquedas_grok_pendientes_ubicacion_idx on public.busquedas_grok_pendientes (ubicacion);

grant all on public.busquedas_grok_pendientes to service_role;
revoke all on public.busquedas_grok_pendientes from anon, authenticated;

alter table public.busquedas_grok_pendientes enable row level security;

comment on table public.busquedas_grok_pendientes is 'HITL queue for Grok (xAI) web-search with confidence < 0.85. Never auto-publish.';
