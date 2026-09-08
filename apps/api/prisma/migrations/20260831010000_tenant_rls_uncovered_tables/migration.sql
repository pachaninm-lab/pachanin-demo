-- Tenant boundary for three tables that carry a tenant and had no row policy.
--
-- V8.4.1 asks that a consumer operation NEVER affect a tenant it has no
-- relationship with. The recorded assessment measured the gap as three tables;
-- measured again against the complete forward-only chain on PostgreSQL 16 it is
-- five, of forty that carry a tenant column:
--
--   deal_events                             live, written inside the RLS transaction
--   fgis_grain_tenant_read_provider_claims  no runtime caller
--   fgis_grain_tenant_read_audit_heads      no runtime caller
--   regulatory_integration_inbox_entries    ingest path, NOT closed here
--   regulatory_integration_inbox_conflicts  ingest path, NOT closed here
--
-- The last two are deliberately left, and the requirement stays FAIL because of
-- them. They are written by the regulatory integration ingest through raw SQL
-- across six repositories, and whether that path runs inside the RLS
-- transaction has not been established. Enabling row security on an ingest that
-- carries no tenant setting does not protect anything - it stops the ingest.
-- Closing them needs that path traced first, which is its own pass. Recording
-- them here rather than quietly covering three of five is the point: a partial
-- boundary described as a whole one is the failure this programme keeps finding.
--
-- The boundary is placed in the migration chain rather than in
-- infra/sql/production-rls-policies.sql, for the reason migration
-- 20260807006000 already states: the boundary must be forward-only, not an
-- accidental property of a later deploy artifact. #4814 and #4815 were the same
-- correction.
--
-- Raised as #4828.

-- 1. deal_events.
--
-- Written by postgresql-deal-command.service.ts inside RlsTransactionService, so
-- app.current_tenant_id is set on every legitimate write, and read there for the
-- hash chain's previous entry.
--
-- The qualifier is tenancy ONLY. deal_documents adds app_document_deal_authorized
-- and it would be easy to copy that here, but it would be a different control:
-- the chain read looks up the previous event to compute prevHash, and making
-- that read depend on per-deal visibility could break the command path for a
-- case this migration cannot enumerate. V8.4.1 asks for the tenant boundary;
-- per-deal visibility on this table is a separate decision with its own
-- evidence, not something to slip in beside it.
--
-- Append-only is untouched. The trigger and rules from 20260712090000 still
-- refuse UPDATE and DELETE; this adds who may read and insert, not whether a row
-- may change.
ALTER TABLE public."deal_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."deal_events" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deal_events_tenant_select ON public."deal_events";
CREATE POLICY deal_events_tenant_select ON public."deal_events"
  FOR SELECT
  USING (
    app_rls_context_ready()
    AND "tenantId" = current_setting('app.current_tenant_id', true)
  );

DROP POLICY IF EXISTS deal_events_tenant_insert ON public."deal_events";
CREATE POLICY deal_events_tenant_insert ON public."deal_events"
  FOR INSERT
  WITH CHECK (
    app_rls_context_ready()
    AND "tenantId" = current_setting('app.current_tenant_id', true)
  );

-- 2. The two FGIS tenant-read tables the same migration missed.
--
-- Their siblings fgis_grain_tenant_read_audits and
-- fgis_grain_tenant_read_authorizations were given row security in
-- 20260730101500 and these two were not, which reads as an omission rather than
-- a decision: all four carry the same tenantId/organizationId pair and belong to
-- the same contour. The qualifier is the sibling's, so the four now agree.
--
-- Neither table has a runtime caller anywhere in apps/api/src, so this is
-- hardening ahead of a first reader rather than a change to live behaviour.
ALTER TABLE public."fgis_grain_tenant_read_provider_claims" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fgis_grain_tenant_read_provider_claims" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fgis_grain_tenant_read_provider_claims_select ON public."fgis_grain_tenant_read_provider_claims";
CREATE POLICY fgis_grain_tenant_read_provider_claims_select ON public."fgis_grain_tenant_read_provider_claims"
  FOR SELECT
  USING (
    fgis_grain_tenant_read_context_ready(false)
    AND "tenantId" = current_setting('app.current_tenant_id', true)
    AND "organizationId" = current_setting('app.current_org_id', true)
  );

DROP POLICY IF EXISTS fgis_grain_tenant_read_provider_claims_insert ON public."fgis_grain_tenant_read_provider_claims";
CREATE POLICY fgis_grain_tenant_read_provider_claims_insert ON public."fgis_grain_tenant_read_provider_claims"
  FOR INSERT
  WITH CHECK (
    fgis_grain_tenant_read_context_ready(true)
    AND "tenantId" = current_setting('app.current_tenant_id', true)
    AND "organizationId" = current_setting('app.current_org_id', true)
  );

ALTER TABLE public."fgis_grain_tenant_read_audit_heads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fgis_grain_tenant_read_audit_heads" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fgis_grain_tenant_read_audit_heads_select ON public."fgis_grain_tenant_read_audit_heads";
CREATE POLICY fgis_grain_tenant_read_audit_heads_select ON public."fgis_grain_tenant_read_audit_heads"
  FOR SELECT
  USING (
    fgis_grain_tenant_read_context_ready(false)
    AND "tenantId" = current_setting('app.current_tenant_id', true)
    AND "organizationId" = current_setting('app.current_org_id', true)
  );

DROP POLICY IF EXISTS fgis_grain_tenant_read_audit_heads_insert ON public."fgis_grain_tenant_read_audit_heads";
CREATE POLICY fgis_grain_tenant_read_audit_heads_insert ON public."fgis_grain_tenant_read_audit_heads"
  FOR INSERT
  WITH CHECK (
    fgis_grain_tenant_read_context_ready(true)
    AND "tenantId" = current_setting('app.current_tenant_id', true)
    AND "organizationId" = current_setting('app.current_org_id', true)
  );

DROP POLICY IF EXISTS fgis_grain_tenant_read_audit_heads_update ON public."fgis_grain_tenant_read_audit_heads";
CREATE POLICY fgis_grain_tenant_read_audit_heads_update ON public."fgis_grain_tenant_read_audit_heads"
  FOR UPDATE
  USING (
    fgis_grain_tenant_read_context_ready(true)
    AND "tenantId" = current_setting('app.current_tenant_id', true)
    AND "organizationId" = current_setting('app.current_org_id', true)
  );
