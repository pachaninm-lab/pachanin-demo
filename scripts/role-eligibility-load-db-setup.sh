#!/usr/bin/env bash
set -Eeuo pipefail
: "${DATABASE_URL:?DATABASE_URL is required}"
BASE='apps/api/prisma/migrations/20260902140000_role_eligibility_shadow/migration.sql'
SUPERSEDED='apps/api/prisma/migrations/20260902143000_role_eligibility_superseded_current_guard/migration.sql'

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS public.organizations (
  id TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS auth.registration_applications (
  id TEXT PRIMARY KEY,
  version BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  requested_workspace TEXT NOT NULL,
  requested_role TEXT NOT NULL,
  inn TEXT NOT NULL,
  ogrn TEXT,
  kpp TEXT,
  legal_name TEXT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
SQL

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$BASE"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SUPERSEDED"
