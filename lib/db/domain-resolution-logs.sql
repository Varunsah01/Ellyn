-- ============================================================================
-- Domain Resolution Analytics Table
-- ============================================================================
-- Run this once in the Supabase SQL editor (or include it in your migration
-- pipeline) to enable the domain-accuracy observability layer.
-- ============================================================================

create table if not exists domain_resolution_logs (
  id               uuid        primary key default gen_random_uuid(),
  company_name     text        not null,
  domain           text,
  domain_source    text        not null,       -- 'known_database' | 'clearbit' | 'brandfetch' | 'google_search' | 'heuristic' | 'unknown'
  mx_valid         boolean,                    -- null = not checked, true = pass, false = fail
  confidence_score numeric(5, 2),              -- 0–100
  attempted_layers jsonb,                      -- array of { layer, result, error? }
  created_at       timestamptz not null default now()
);

-- Indexes for the dashboard queries
create index if not exists idx_drl_domain_source on domain_resolution_logs (domain_source);
create index if not exists idx_drl_created_at    on domain_resolution_logs (created_at desc);
create index if not exists idx_drl_mx_valid      on domain_resolution_logs (mx_valid) where mx_valid = false;

-- ============================================================================
-- Row Level Security
-- ============================================================================
-- Inserts are done via the service-role key (server-side only), so we lock
-- down public access entirely and only grant service-role full access.

alter table domain_resolution_logs enable row level security;

-- Drop any existing policies before re-creating
drop policy if exists "service_role_all"    on domain_resolution_logs;
drop policy if exists "no_public_select"    on domain_resolution_logs;

-- Service-role bypass — Supabase service-role keys already bypass RLS, but
-- being explicit here protects against misconfiguration.
create policy "service_role_all"
  on domain_resolution_logs
  for all
  to service_role
  using (true)
  with check (true);

-- No direct public access
create policy "no_public_select"
  on domain_resolution_logs
  for select
  to authenticated
  using (false);

-- ============================================================================
-- Optional: auto-prune rows older than 90 days via pg_cron
-- Uncomment and run separately if pg_cron is available in your Supabase plan.
-- ============================================================================
-- select cron.schedule(
--   'prune-domain-resolution-logs',
--   '0 3 * * *',   -- 3 AM UTC daily
--   $$
--     delete from domain_resolution_logs
--     where created_at < now() - interval '90 days';
--   $$
-- );
