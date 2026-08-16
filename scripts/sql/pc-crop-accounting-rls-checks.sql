-- PC-CROP accounting contour isolation, measured as pc_accounting_authority.
--
-- The two accounting tables are readable through exactly one policy each, and
-- those policies must not be satisfiable by a claim. The runtime principal can
-- execute `SET LOCAL app.current_org_id = '<any org>'` itself, so every check
-- below forges the context deliberately and demands that forging it buys
-- nothing. The identity contour learned this the hard way: a setting the
-- confined principal can write is not an authority.
--
-- Run through the admin connection with SET ROLE rather than a dedicated
-- login. pc_accounting_authority is NOLOGIN until the slice that wires an API
-- provisions its credential, and SET ROLE exercises the same enforcement path:
-- the role is NOBYPASSRLS and both tables are FORCE ROW LEVEL SECURITY, so
-- policies are evaluated against it exactly as they would be over the wire.
--
-- Fixtures come from the harness: org-a/tenant-a, org-b/tenant-b, user-a is
-- ADMIN in org-a, user-b is in org-b, and user-both holds a membership in both
-- organizations — the external-accountant shape the programme must never leak
-- across.
\set ON_ERROR_STOP on

BEGIN;

-- org-b holds only two memberships in the harness, and the two-person rule
-- needs three distinct people per authority: a holder, a granter and an
-- independent approver. One extra membership is seeded here rather than in the
-- harness so the identity checks keep the fixture set they were written
-- against.
INSERT INTO public."users"(
  "id","email","passwordHash","fullName","status","createdAt","updatedAt"
) VALUES
  ('pc-user-b2','pc-b2@example.test','hash-pc-b2','Fedor','ACTIVE',now(),now());

INSERT INTO public."user_orgs"(
  "id","userId","organizationId","role","isDefault","joinedAt"
) VALUES
  ('pc-m-b2','pc-user-b2','org-b','FARMER',false,now());

-- Every authority names three different memberships. The database refuses any
-- other shape, which is the point of the two-person rule and the reason these
-- fixtures cannot be written the lazy way.
INSERT INTO public."signing_authorities"(
  "id","tenantId","organizationId","membershipId","authorityType",
  "validFrom","validTo","allowedDocumentTypes","allowedSigningModes",
  "certificateFingerprint","grantedByMembershipId","secondApprovalMembershipId"
) VALUES
  ('pc-sa-a','tenant-a','org-a','m-a','ORGANIZATION_HEAD',
   now() - interval '1 day', now() + interval '365 days',
   ARRAY['UPD'], ARRAY['PROVIDER_UI'], 'pc-fp-a', 'm-staff', 'm-both-a'),
  ('pc-sa-b','tenant-b','org-b','m-b','ORGANIZATION_HEAD',
   now() - interval '1 day', now() + interval '365 days',
   ARRAY['UPD'], ARRAY['PROVIDER_UI'], 'pc-fp-b', 'pc-m-b2', 'm-both-b');

INSERT INTO public."membership_delegations"(
  "id","tenantId","organizationId","fromMembershipId","toMembershipId",
  "capabilities","startsAt","endsAt","createdByMembershipId"
) VALUES
  ('pc-del-a','tenant-a','org-a','m-a','m-staff',
   ARRAY['accounting.package.close'],
   now() - interval '1 day', now() + interval '7 days', 'm-a'),
  ('pc-del-b','tenant-b','org-b','m-b','m-both-b',
   ARRAY['accounting.package.close'],
   now() - interval '1 day', now() + interval '7 days', 'm-b');

SET ROLE pc_accounting_authority;

DO $pc_crop_accounting_checks$
DECLARE
  failures integer := 0;
  measured text;

  PROCEDURE_NOTE constant text := 'context is forged on purpose in every negative case';
BEGIN
  PERFORM PROCEDURE_NOTE;

  ---------------------------------------------------------------------------
  -- 1. The holder reads its own authority.
  ---------------------------------------------------------------------------
  PERFORM set_config('app.current_user_id', 'user-a', true),
          set_config('app.current_org_id', 'org-a', true),
          set_config('app.current_tenant_id', 'tenant-a', true);
  measured := (SELECT count(*) FROM public."signing_authorities")::text;
  IF measured = '1' THEN
    RAISE NOTICE 'PASS  1 authority holder reads its own row -> %', measured;
  ELSE
    RAISE WARNING 'FAIL  1 authority holder reads its own row -> % (want 1)', measured;
    failures := failures + 1;
  END IF;

  ---------------------------------------------------------------------------
  -- 2. A member of another organization claims org-a. Membership is read from
  --    user_orgs, so the claim is worth nothing.
  ---------------------------------------------------------------------------
  PERFORM set_config('app.current_user_id', 'user-b', true),
          set_config('app.current_org_id', 'org-a', true),
          set_config('app.current_tenant_id', 'tenant-a', true);
  measured := (SELECT count(*) FROM public."signing_authorities")::text || '/' ||
              (SELECT count(*) FROM public."membership_delegations")::text;
  IF measured = '0/0' THEN
    RAISE NOTICE 'PASS  2 forged organization claim reads nothing -> %', measured;
  ELSE
    RAISE WARNING 'FAIL  2 forged organization claim reads nothing -> % (want 0/0)', measured;
    failures := failures + 1;
  END IF;

  ---------------------------------------------------------------------------
  -- 3. A real member forges the tenant. Each row carries the true tenant and
  --    the pair is pinned by a foreign key, so nothing matches.
  ---------------------------------------------------------------------------
  PERFORM set_config('app.current_user_id', 'user-a', true),
          set_config('app.current_org_id', 'org-a', true),
          set_config('app.current_tenant_id', 'tenant-b', true);
  measured := (SELECT count(*) FROM public."signing_authorities")::text;
  IF measured = '0' THEN
    RAISE NOTICE 'PASS  3 forged tenant reads nothing -> %', measured;
  ELSE
    RAISE WARNING 'FAIL  3 forged tenant reads nothing -> % (want 0)', measured;
    failures := failures + 1;
  END IF;

  ---------------------------------------------------------------------------
  -- 4. The external-accountant shape. user-both belongs to org-a and org-b.
  --    Acting in org-b it must see org-b only, never org-a.
  ---------------------------------------------------------------------------
  PERFORM set_config('app.current_user_id', 'user-both', true),
          set_config('app.current_org_id', 'org-b', true),
          set_config('app.current_tenant_id', 'tenant-b', true);
  measured := coalesce((
    SELECT string_agg(DISTINCT "organizationId", ',' ORDER BY "organizationId")
    FROM public."membership_delegations"
  ), 'NONE');
  IF measured = 'org-b' THEN
    RAISE NOTICE 'PASS  4 dual-organization member sees only the active one -> %', measured;
  ELSE
    RAISE WARNING 'FAIL  4 dual-organization member sees only the active one -> % (want org-b)', measured;
    failures := failures + 1;
  END IF;

  ---------------------------------------------------------------------------
  -- 5. The same person switched to org-a must not carry org-b rows across.
  ---------------------------------------------------------------------------
  PERFORM set_config('app.current_user_id', 'user-both', true),
          set_config('app.current_org_id', 'org-a', true),
          set_config('app.current_tenant_id', 'tenant-a', true);
  measured := coalesce((
    SELECT string_agg(DISTINCT "organizationId", ',' ORDER BY "organizationId")
    FROM public."membership_delegations"
  ), 'NONE');
  IF measured = 'NONE' THEN
    RAISE NOTICE 'PASS  5 organization switch carries nothing across -> %', measured;
  ELSE
    RAISE WARNING 'FAIL  5 organization switch carries nothing across -> % (want NONE)', measured;
    failures := failures + 1;
  END IF;

  ---------------------------------------------------------------------------
  -- 6. A delegation recipient reads the delegation addressed to it and no
  --    signing authority, because it holds none and is not an administrator.
  ---------------------------------------------------------------------------
  PERFORM set_config('app.current_user_id', 'user-staff', true),
          set_config('app.current_org_id', 'org-a', true),
          set_config('app.current_tenant_id', 'tenant-a', true);
  measured := (SELECT count(*) FROM public."membership_delegations")::text || '/' ||
              (SELECT count(*) FROM public."signing_authorities")::text;
  IF measured = '1/0' THEN
    RAISE NOTICE 'PASS  6 recipient reads its delegation, no authority -> %', measured;
  ELSE
    RAISE WARNING 'FAIL  6 recipient reads its delegation, no authority -> % (want 1/0)', measured;
    failures := failures + 1;
  END IF;

  ---------------------------------------------------------------------------
  -- 7. No context at all. A statement that arrives without one must see
  --    nothing, not everything.
  ---------------------------------------------------------------------------
  PERFORM set_config('app.current_user_id', '', true),
          set_config('app.current_org_id', '', true),
          set_config('app.current_tenant_id', '', true);
  measured := (SELECT count(*) FROM public."signing_authorities")::text || '/' ||
              (SELECT count(*) FROM public."membership_delegations")::text;
  IF measured = '0/0' THEN
    RAISE NOTICE 'PASS  7 absent context reads nothing -> %', measured;
  ELSE
    RAISE WARNING 'FAIL  7 absent context reads nothing -> % (want 0/0)', measured;
    failures := failures + 1;
  END IF;

  ---------------------------------------------------------------------------
  -- 8. The principal may only read. A write must be refused by privilege,
  --    before any policy is consulted.
  ---------------------------------------------------------------------------
  PERFORM set_config('app.current_user_id', 'user-a', true),
          set_config('app.current_org_id', 'org-a', true),
          set_config('app.current_tenant_id', 'tenant-a', true);
  BEGIN
    UPDATE public."signing_authorities" SET "status" = 'REVOKED' WHERE "id" = 'pc-sa-a';
    RAISE WARNING 'FAIL  8 read-only principal cannot write -> update succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS  8 read-only principal cannot write -> permission denied';
  END;

  ---------------------------------------------------------------------------
  -- 9. The free-text reason column was withheld at grant level, so selecting
  --    it must fail even for a row the principal may otherwise read.
  ---------------------------------------------------------------------------
  BEGIN
    PERFORM "reason" FROM public."membership_delegations" LIMIT 1;
    RAISE WARNING 'FAIL  9 withheld reason column unreadable -> select succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS  9 withheld reason column unreadable -> permission denied';
  END;

  IF failures > 0 THEN
    RAISE EXCEPTION 'pc-crop accounting isolation: % check(s) failed', failures;
  END IF;
  RAISE NOTICE 'pc-crop accounting contour: organization and tenant isolation, 0 failures';
END;
$pc_crop_accounting_checks$;

RESET ROLE;
ROLLBACK;
