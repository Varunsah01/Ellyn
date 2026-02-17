-- Migration: known_company_domains
-- Run this in the Supabase SQL editor before seeding.

create extension if not exists pg_trgm;

create table if not exists known_company_domains (
  id              bigserial primary key,
  company_name    text not null,
  normalized_name text not null unique,
  domain          text not null,
  category        text,
  employees       integer,
  confidence      numeric(3,2) default 1.0,
  updated_at      timestamptz not null default now()
);

create index if not exists idx_kcd_normalized_name on known_company_domains (normalized_name);
create index if not exists idx_kcd_domain          on known_company_domains (domain);
create index if not exists idx_kcd_trgm            on known_company_domains using gin (normalized_name gin_trgm_ops);

alter table known_company_domains enable row level security;

create policy "service_role_all" on known_company_domains
  for all to service_role using (true) with check (true);
