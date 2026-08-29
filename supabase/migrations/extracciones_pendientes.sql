-- Conexión Mayor — IA extractor (Groq vision) — HITL queue
-- Ejecutar en Supabase → SQL Editor → New query → Run.
-- Idempotente: puede ejecutarse varias veces sin errores.
-- Requiere extensiones pgcrypto para gen_random_uuid() (ya creada en schema.sql).

-- 0) Extensión para gen_random_uuid() (no-op si ya existe)
create extension if not exists "pgcrypto";

-- 1) Tabla HITL: extracciones pendientes de revisión humana
--    confidence < 0.85 → needsReview = true → se inserta aquí, nunca auto-publica.
create table if not exists public.extracciones_pendientes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  raw_json jsonb not null,
  confidence numeric(3,2) not null check (confidence >= 0 and confidence <= 1),
  provider text not null default 'groq',
  status text not null default 'pendiente' check (status in ('pendiente','aprobada','rechazada')),
  image_url text,
  warnings text[]
);

-- Índices útiles para la cola de revisión
create index if not exists extracciones_pendientes_status_idx on public.extracciones_pendientes (status);
create index if not exists extracciones_pendientes_created_at_idx on public.extracciones_pendientes (created_at desc);
create index if not exists extracciones_pendientes_confidence_idx on public.extracciones_pendientes (confidence);

-- 2) Permisos — solo service_role puede leer/escribir (cola interna)
--    anon/authenticated no tienen acceso directo; el servidor usa SB_SECRET_KEY (service_role).
grant all on public.extracciones_pendientes to service_role;

-- Revoke accidental public grants if re-running
revoke all on public.extracciones_pendientes from anon, authenticated;

-- 3) RLS — habilitado, sin políticas públicas (solo service_role bypass)
alter table public.extracciones_pendientes enable row level security;

-- No public policies: by default with RLS enabled and no policy, anon/auth cannot select/insert.
-- Service_role bypasses RLS, so server writes/reads still work.
-- If you need an admin dashboard later, add a policy for authenticated with a role check.

-- 4) Comentario
comment on table public.extracciones_pendientes is 'HITL queue for Groq vision extractions with confidence < 0.85. Never auto-publish.';
