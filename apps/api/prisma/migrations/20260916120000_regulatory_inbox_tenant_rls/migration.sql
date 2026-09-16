-- Tenant boundary for the two regulatory integration inbox tables.
--
-- These are the last two of the five tenant-bearing tables that migration
-- 20260831010000 measured as uncovered. That migration closed three and left
-- these deliberately, with the reason written down: they are written by the
-- regulatory integration ingest through raw SQL across six repositories, and
-- whether that path runs inside the RLS transaction had not been established.
-- Enabling row security on an ingest that carries no tenant setting does not
-- protect it, it stops it.
--
-- That path has now been traced, which is what this migration is waiting on.
-- All six repositories - inbox, inbox-lifecycle, control-tower,
-- control-tower.redrive, reconciliation and fgis-grain-sdiz-projection - reach
-- the database only through RlsTransactionService.withTrustedContext: thirteen
-- call sites, and not one direct PrismaService use between them. That method is
-- the only one the service exposes, it sets all five of app.current_user_id,
-- app.current_org_id, app.current_tenant_id, app.current_role and
-- app.current_session_id, and it throws RlsContextError before opening the
-- transaction when the tenant id is blank. So the ingest cannot reach these
-- tables without the setting these policies require.
--
-- Two further facts were checked rather than assumed. The entries table already
-- defaults "tenantId" to current_setting('app.current_tenant_id', true), so the
-- design always expected the context to be there. And no other writer exists:
-- outside the six repositories the only references in the tree are migrations,
-- the RLS gate, three verify scripts that read migration TEXT rather than the
-- database, and tests.
--
-- One test does write these tables with raw SQL and no context:
-- regulatory-integration.control-tower.postgresql.spec.ts, which seeds and
-- cleans up across two tenants in single statements. It is deliberately left
-- alone, and the reason is measured rather than assumed: the workflow that runs
-- it (pc-crop-07b.yml) connects as the postgres superuser, and a superuser has
-- rolbypassrls, which skips row security altogether - FORCE binds the table
-- OWNER, not a role that bypasses. Verified on PostgreSQL 16: with both tables
-- forced and policies in place, that role still reads rows from both tenants
-- and deletes across both, while a NOSUPERUSER role in the same database is
-- refused.
--
-- The consequence is worth stating rather than leaving implied: that spec does
-- not exercise this boundary and cannot regress it. What proves the boundary is
-- the NOSUPERUSER measurement recorded in the V8.4.1 decision, and the gate in
-- scripts/sql/identity-rls-no-inert-policies.sql, which now has no exclusions
-- left.
--
-- Raised as #4828.

-- 1. regulatory_integration_inbox_entries.
--
-- The full lifecycle lives here: the ingest inserts, the lifecycle and
-- control-tower repositories update state, leases and verification, and the
-- reconciliation path deletes. So all four verbs carry a policy, each one the
-- same tenancy qualifier - what may be read, written, changed or removed is the
-- caller's own tenant, and nothing else.
ALTER TABLE public."regulatory_integration_inbox_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."regulatory_integration_inbox_entries" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS regulatory_integration_inbox_entries_tenant_select ON public."regulatory_integration_inbox_entries";
CREATE POLICY regulatory_integration_inbox_entries_tenant_select ON public."regulatory_integration_inbox_entries"
  FOR SELECT
  USING (
    app_rls_context_ready()
    AND "tenantId" = current_setting('app.current_tenant_id', true)
  );

DROP POLICY IF EXISTS regulatory_integration_inbox_entries_tenant_insert ON public."regulatory_integration_inbox_entries";
CREATE POLICY regulatory_integration_inbox_entries_tenant_insert ON public."regulatory_integration_inbox_entries"
  FOR INSERT
  WITH CHECK (
    app_rls_context_ready()
    AND "tenantId" = current_setting('app.current_tenant_id', true)
  );

-- USING decides which rows may be changed; WITH CHECK decides what they may be
-- changed into.
--
-- WITH CHECK is the second barrier here rather than the first, and saying so
-- matters: app_regulatory_inbox_identity_immutable, the trigger migration
-- 20260722120000 already installs, refuses any UPDATE that alters "tenantId"
-- (along with organizationId, provider, externalEventId, rawBodySha256,
-- evidenceReference and receivedAt). Measured on PostgreSQL 16, an attempt to
-- move a row to another tenant is stopped by that trigger, not by this policy.
-- The clause is still written, because a boundary that depends on a trigger
-- elsewhere continuing to cover exactly these columns is a boundary with a
-- dependency nobody declared.
DROP POLICY IF EXISTS regulatory_integration_inbox_entries_tenant_update ON public."regulatory_integration_inbox_entries";
CREATE POLICY regulatory_integration_inbox_entries_tenant_update ON public."regulatory_integration_inbox_entries"
  FOR UPDATE
  USING (
    app_rls_context_ready()
    AND "tenantId" = current_setting('app.current_tenant_id', true)
  )
  WITH CHECK (
    app_rls_context_ready()
    AND "tenantId" = current_setting('app.current_tenant_id', true)
  );

DROP POLICY IF EXISTS regulatory_integration_inbox_entries_tenant_delete ON public."regulatory_integration_inbox_entries";
CREATE POLICY regulatory_integration_inbox_entries_tenant_delete ON public."regulatory_integration_inbox_entries"
  FOR DELETE
  USING (
    app_rls_context_ready()
    AND "tenantId" = current_setting('app.current_tenant_id', true)
  );

-- 2. regulatory_integration_inbox_conflicts.
--
-- Three verbs, not four, and the omission is deliberate. The repositories
-- select, insert and delete conflicts; nothing updates one. Adding an UPDATE
-- policy would permit an operation no code performs, and the honest default for
-- a boundary is to refuse what is not needed. If a future path does need to
-- update a conflict it will be refused, which is the failure direction worth
-- having.
ALTER TABLE public."regulatory_integration_inbox_conflicts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."regulatory_integration_inbox_conflicts" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS regulatory_integration_inbox_conflicts_tenant_select ON public."regulatory_integration_inbox_conflicts";
CREATE POLICY regulatory_integration_inbox_conflicts_tenant_select ON public."regulatory_integration_inbox_conflicts"
  FOR SELECT
  USING (
    app_rls_context_ready()
    AND "tenantId" = current_setting('app.current_tenant_id', true)
  );

DROP POLICY IF EXISTS regulatory_integration_inbox_conflicts_tenant_insert ON public."regulatory_integration_inbox_conflicts";
CREATE POLICY regulatory_integration_inbox_conflicts_tenant_insert ON public."regulatory_integration_inbox_conflicts"
  FOR INSERT
  WITH CHECK (
    app_rls_context_ready()
    AND "tenantId" = current_setting('app.current_tenant_id', true)
  );

DROP POLICY IF EXISTS regulatory_integration_inbox_conflicts_tenant_delete ON public."regulatory_integration_inbox_conflicts";
CREATE POLICY regulatory_integration_inbox_conflicts_tenant_delete ON public."regulatory_integration_inbox_conflicts"
  FOR DELETE
  USING (
    app_rls_context_ready()
    AND "tenantId" = current_setting('app.current_tenant_id', true)
  );
