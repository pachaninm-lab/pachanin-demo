-- Platform-v7 runtime persistence schema draft
-- Status: proposed, not applied
-- Purpose: durable command/event/snapshot store for bid and logistics runtime layers.

create table if not exists platform_v7_runtime_commands (
  command_id text primary key,
  idempotency_key text not null unique,
  scope_id text not null,
  aggregate_type text not null check (aggregate_type in ('bid', 'logistics')),
  aggregate_id text not null,
  action text not null,
  actor_role text not null,
  actor_id text,
  status text not null check (status in ('SUCCEEDED', 'FAILED')),
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_platform_v7_runtime_commands_scope
  on platform_v7_runtime_commands (scope_id, aggregate_type, created_at desc);

create index if not exists idx_platform_v7_runtime_commands_aggregate
  on platform_v7_runtime_commands (aggregate_type, aggregate_id, created_at desc);

create table if not exists platform_v7_runtime_events (
  event_id text primary key,
  command_id text not null references platform_v7_runtime_commands(command_id),
  scope_id text not null,
  aggregate_type text not null check (aggregate_type in ('bid', 'logistics')),
  aggregate_id text not null,
  actor_role text not null,
  actor_id text,
  title text not null,
  details text not null,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_platform_v7_runtime_events_scope
  on platform_v7_runtime_events (scope_id, aggregate_type, created_at desc);

create index if not exists idx_platform_v7_runtime_events_aggregate
  on platform_v7_runtime_events (aggregate_type, aggregate_id, created_at desc);

create table if not exists platform_v7_runtime_snapshots (
  snapshot_id text primary key,
  scope_id text not null,
  aggregate_type text not null check (aggregate_type in ('bid', 'logistics')),
  aggregate_id text not null,
  revision integer not null,
  projection jsonb not null,
  last_command_id text references platform_v7_runtime_commands(command_id),
  created_at timestamptz not null default now(),
  unique (scope_id, aggregate_type, aggregate_id)
);

create index if not exists idx_platform_v7_runtime_snapshots_scope
  on platform_v7_runtime_snapshots (scope_id, aggregate_type);

-- Production rules:
-- 1. command insert and snapshot update must be transactional;
-- 2. idempotency_key must remain unique;
-- 3. failed command must not overwrite last valid projection;
-- 4. runtime persistence passport must stay non-durable until this schema is actually applied and used by runtime stores.
