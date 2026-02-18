-- 003_activity_log.sql
-- Tracks user actions for the activity feed (contact created/updated,
-- sequence created, contacts enrolled).  Written to by server-side route
-- handlers via the service-role client; read by the browser client.

create table if not exists activity_log (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  type        text        not null,
  description text        not null default '',
  contact_id  uuid        references contacts(id) on delete set null,
  metadata    jsonb       not null default '{}',
  created_at  timestamptz not null default now()
);

-- Fast lookup: all events for a user, newest first
create index if not exists activity_log_user_created_idx
  on activity_log (user_id, created_at desc);

-- Optional: filter by event type per user
create index if not exists activity_log_user_type_idx
  on activity_log (user_id, type);

-- RLS: enable so the browser client can only see its own rows
alter table activity_log enable row level security;

-- SELECT: authenticated users see only their own rows
create policy "activity_log_select_own"
  on activity_log for select
  using (auth.uid() = user_id);

-- INSERT: the service-role client (used by server routes) bypasses RLS
-- entirely, so no INSERT policy is needed for that path.
-- If you ever want to allow the anon/authenticated key to insert directly
-- from the browser, uncomment the policy below:
--
-- create policy "activity_log_insert_own"
--   on activity_log for insert
--   with check (auth.uid() = user_id);
