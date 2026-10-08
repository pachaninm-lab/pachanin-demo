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

-- A deal and the confirmed transfer an advance is recorded against. Seeded here
-- rather than in the harness so the identity checks keep the fixture set they
-- were written against, and confirmed on purpose: the guard refuses an advance
-- whose evidence is still pending, and a fixture that could not show that would
-- make the check vacuous.
INSERT INTO public."deals"(
  "id","tenantId","sellerOrgId","buyerOrgId","status","currency","dealNumber",
  "totalKopecks","pricePerTonDec","culture","cropClass","gost",
  "createdAt","updatedAt"
) VALUES
  ('pc-deal-adv','tenant-a','org-b','org-a','SIGNED','RUB','PC-ADV-1',
   100000,5000.000000,'Пшеница','3','ГОСТ 9353-2016',now(),now());

INSERT INTO public."bank_operations"(
  "id","dealId","type","status","amountKopecks","currency","debitAccount",
  "creditAccount","idempotencyKey","createdAt","updatedAt"
) VALUES
  ('pc-op-adv','pc-deal-adv','ADVANCE_IN','CONFIRMED',100000,'RUB','buyer',
   'escrow','pc-op-adv-key',now(),now()),
  ('pc-op-pending','pc-deal-adv','ADVANCE_IN','PENDING',100000,'RUB','buyer',
   'escrow','pc-op-pending-key',now(),now()),
  ('pc-op-pay','pc-deal-adv','PAYMENT_IN','CONFIRMED',100000,'RUB','buyer',
   'seller','pc-op-pay-key',now(),now());

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
SET ROLE pc_accounting_command_authority;

DO $pc_crop_accounting_write_checks$
DECLARE
  failures integer := 0;
BEGIN
  PERFORM set_config('app.current_user_id', 'user-a', true),
          set_config('app.current_org_id', 'org-a', true),
          set_config('app.current_tenant_id', 'tenant-a', true);

  ---------------------------------------------------------------------------
  -- 10. A well-formed grant attributed to the writer is admitted.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."signing_authorities"(
      "id","tenantId","organizationId","membershipId","authorityType",
      "validFrom","validTo","allowedDocumentTypes","allowedSigningModes",
      "certificateFingerprint","grantedByMembershipId","secondApprovalMembershipId"
    ) VALUES (
      'pc-w-ok','tenant-a','org-a','m-staff','ORGANIZATION_HEAD',
      now(), now() + interval '30 days', ARRAY['UPD'], ARRAY['PROVIDER_UI'],
      'pc-fp-w','m-a','m-both-a');
    RAISE NOTICE 'PASS 10 own-attributed grant admitted';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'FAIL 10 own-attributed grant admitted -> %', SQLERRM;
    failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 11. Attributing the grant to somebody else is refused. This is the check
  --     worth having in the database: a forged "granted by" cannot be caught
  --     afterwards, because the audit trail is the forged field.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."signing_authorities"(
      "id","tenantId","organizationId","membershipId","authorityType",
      "validFrom","validTo","allowedDocumentTypes","allowedSigningModes",
      "certificateFingerprint","grantedByMembershipId","secondApprovalMembershipId"
    ) VALUES (
      'pc-w-forge','tenant-a','org-a','m-staff','ORGANIZATION_HEAD',
      now(), now() + interval '30 days', ARRAY['UPD'], ARRAY['PROVIDER_UI'],
      'pc-fp-f','m-both-a','m-a');
    RAISE WARNING 'FAIL 11 forged attribution refused -> insert succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN
      RAISE NOTICE 'PASS 11 forged attribution refused';
  END;

  ---------------------------------------------------------------------------
  -- 12. Writing into another organization is refused even with a real
  --     membership somewhere else.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."signing_authorities"(
      "id","tenantId","organizationId","membershipId","authorityType",
      "validFrom","validTo","allowedDocumentTypes","allowedSigningModes",
      "certificateFingerprint","grantedByMembershipId","secondApprovalMembershipId"
    ) VALUES (
      'pc-w-cross','tenant-b','org-b','m-b','ORGANIZATION_HEAD',
      now(), now() + interval '30 days', ARRAY['UPD'], ARRAY['PROVIDER_UI'],
      'pc-fp-x','m-a','m-both-b');
    RAISE WARNING 'FAIL 12 cross-organization write refused -> insert succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege OR check_violation OR foreign_key_violation THEN
      RAISE NOTICE 'PASS 12 cross-organization write refused';
  END;

  ---------------------------------------------------------------------------
  -- 13. Revocation is an UPDATE of status, and it is permitted.
  ---------------------------------------------------------------------------
  BEGIN
    UPDATE public."signing_authorities"
       SET "status" = 'REVOKED', "revokedAt" = now()
     WHERE "id" = 'pc-w-ok';
    RAISE NOTICE 'PASS 13 revocation by status update permitted';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'FAIL 13 revocation by status update permitted -> %', SQLERRM;
    failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 14. Everything else on an existing row is immutable. Widening the ceiling
  --     must be refused by privilege, before any policy is consulted.
  ---------------------------------------------------------------------------
  BEGIN
    UPDATE public."signing_authorities"
       SET "amountLimitKopecks" = 999999999999
     WHERE "id" = 'pc-w-ok';
    RAISE WARNING 'FAIL 14 amount ceiling immutable -> update succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS 14 amount ceiling immutable';
  END;

  ---------------------------------------------------------------------------
  -- 15. An authority is retired, never deleted.
  ---------------------------------------------------------------------------
  BEGIN
    DELETE FROM public."signing_authorities" WHERE "id" = 'pc-w-ok';
    RAISE WARNING 'FAIL 15 authority cannot be deleted -> delete succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS 15 authority cannot be deleted';
  END;

  ---------------------------------------------------------------------------
  -- 16. A delegation may only be created by the membership it flows from.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."membership_delegations"(
      "id","tenantId","organizationId","fromMembershipId","toMembershipId",
      "capabilities","startsAt","endsAt","createdByMembershipId"
    ) VALUES (
      'pc-w-del','tenant-a','org-a','m-both-a','m-staff',
      ARRAY['accounting.package.close'], now(), now() + interval '3 days', 'm-a');
    RAISE WARNING 'FAIL 16 delegation must flow from the writer -> insert succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN
      RAISE NOTICE 'PASS 16 delegation must flow from the writer';
  END;

  IF failures > 0 THEN
    RAISE EXCEPTION 'pc-crop accounting write authority: % check(s) failed', failures;
  END IF;
  RAISE NOTICE 'pc-crop accounting contour: bounded write authority, 0 failures';
END;
$pc_crop_accounting_write_checks$;

---------------------------------------------------------------------------
-- Accounting documents: a signature is a one-way door.
--
-- The claim under test is that once a version is signed, neither the bytes it
-- covers nor the revision snapshot that made it verifiable can move. Three
-- mechanisms assert it and each binds a different set of principals, so each
-- is measured separately: the column grant against the runtime, the row
-- policy against the runtime, and the trigger against everyone including the
-- superuser.
---------------------------------------------------------------------------

DO $pc_crop_accounting_document_checks$
DECLARE
  failures integer := 0;
  affected integer;
  measured text;
BEGIN
  PERFORM set_config('app.current_user_id', 'user-a', true),
          set_config('app.current_org_id', 'org-a', true),
          set_config('app.current_tenant_id', 'tenant-a', true);

  ---------------------------------------------------------------------------
  -- 17. A document attributed to the writer is admitted.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."accounting_documents"(
      "id","tenantId","organizationId","documentType","createdByMembershipId"
    ) VALUES ('pc-doc-a','tenant-a','org-a','UPD','m-a');
    RAISE NOTICE 'PASS 17 own-attributed document admitted';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'FAIL 17 own-attributed document admitted -> %', SQLERRM;
    failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 18. The writer cannot record somebody else as the author.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."accounting_documents"(
      "id","tenantId","organizationId","documentType","createdByMembershipId"
    ) VALUES ('pc-doc-forged','tenant-a','org-a','UPD','m-staff');
    RAISE WARNING 'FAIL 18 forged document attribution refused -> insert succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN
      RAISE NOTICE 'PASS 18 forged document attribution refused';
  END;

  ---------------------------------------------------------------------------
  -- 19. A member of org-a cannot write into org-b, whatever it claims.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."accounting_documents"(
      "id","tenantId","organizationId","documentType","createdByMembershipId"
    ) VALUES ('pc-doc-cross','tenant-b','org-b','UPD','m-a');
    RAISE WARNING 'FAIL 19 cross-organization document refused -> insert succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege OR check_violation OR foreign_key_violation THEN
      RAISE NOTICE 'PASS 19 cross-organization document refused';
  END;

  ---------------------------------------------------------------------------
  -- 20. A version is admitted unsigned, carrying its revision snapshot.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."accounting_document_versions"(
      "id","tenantId","organizationId","documentId","versionNumber",
      "payloadHash","recordedRevisions","totalKopecks","createdByMembershipId"
    ) VALUES (
      'pc-ver-a1','tenant-a','org-a','pc-doc-a',1,
      'sha256-first', '{"WEIGHT":"weight-2","PRICE":"price-9"}'::jsonb,
      125000000, 'm-a');
    RAISE NOTICE 'PASS 20 unsigned version admitted';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'FAIL 20 unsigned version admitted -> %', SQLERRM;
    failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 21. A version cannot arrive already signed. Signing has to pass through
  --     the update path, which is where the guard and the column grant are.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."accounting_document_versions"(
      "id","tenantId","organizationId","documentId","versionNumber",
      "payloadHash","recordedRevisions","createdByMembershipId",
      "signedAt","signedByMembershipId","signingAuthorityId",
      "signatureCertificateFingerprint"
    ) VALUES (
      'pc-ver-presigned','tenant-a','org-a','pc-doc-a',9,
      'sha256-presigned', '{}'::jsonb, 'm-a',
      now(), 'm-a', 'pc-sa-a', 'pc-fp-a');
    RAISE WARNING 'FAIL 21 pre-signed version refused -> insert succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN
      RAISE NOTICE 'PASS 21 pre-signed version refused';
  END;

  ---------------------------------------------------------------------------
  -- 22. A version cannot hang off a document in another organization while
  --     claiming this one. Every foreign key on such a row is satisfied, so
  --     only the guard catches it.
  ---------------------------------------------------------------------------
  PERFORM set_config('app.current_user_id', 'user-b', true),
          set_config('app.current_org_id', 'org-b', true),
          set_config('app.current_tenant_id', 'tenant-b', true);
  INSERT INTO public."accounting_documents"(
    "id","tenantId","organizationId","documentType","createdByMembershipId"
  ) VALUES ('pc-doc-b','tenant-b','org-b','UPD','m-b');

  PERFORM set_config('app.current_user_id', 'user-a', true),
          set_config('app.current_org_id', 'org-a', true),
          set_config('app.current_tenant_id', 'tenant-a', true);
  BEGIN
    INSERT INTO public."accounting_document_versions"(
      "id","tenantId","organizationId","documentId","versionNumber",
      "payloadHash","recordedRevisions","createdByMembershipId"
    ) VALUES (
      'pc-ver-stolen','tenant-a','org-a','pc-doc-b',1,
      'sha256-stolen', '{}'::jsonb, 'm-a');
    RAISE WARNING 'FAIL 22 version bound to its document''s organization -> insert succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN raise_exception OR insufficient_privilege OR check_violation THEN
      RAISE NOTICE 'PASS 22 version bound to its document''s organization';
  END;

  ---------------------------------------------------------------------------
  -- 23. Signing an unsigned version is the one permitted update.
  ---------------------------------------------------------------------------
  BEGIN
    UPDATE public."accounting_document_versions"
       SET "signedAt" = now(),
           "signedByMembershipId" = 'm-a',
           "signingAuthorityId" = 'pc-sa-a',
           "signatureCertificateFingerprint" = 'pc-fp-a'
     WHERE "id" = 'pc-ver-a1';
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected = 1 THEN
      RAISE NOTICE 'PASS 23 unsigned version can be signed';
    ELSE
      RAISE WARNING 'FAIL 23 unsigned version can be signed -> % rows', affected;
      failures := failures + 1;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'FAIL 23 unsigned version can be signed -> %', SQLERRM;
    failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 24. A signed version cannot be signed again. The policy makes the row
  --     unreachable rather than raising, so the measurement is that nothing
  --     was touched and the stored signature is the original one.
  ---------------------------------------------------------------------------
  BEGIN
    UPDATE public."accounting_document_versions"
       SET "signedByMembershipId" = 'm-staff',
           "signatureCertificateFingerprint" = 'pc-fp-someone-else'
     WHERE "id" = 'pc-ver-a1';
    GET DIAGNOSTICS affected = ROW_COUNT;
    measured := affected::text || '/' || coalesce((
      SELECT "signedByMembershipId"
      FROM public."accounting_document_versions"
      WHERE "id" = 'pc-ver-a1'), 'null');
    IF measured = '0/m-a' THEN
      RAISE NOTICE 'PASS 24 signed version cannot be re-signed -> %', measured;
    ELSE
      RAISE WARNING 'FAIL 24 signed version cannot be re-signed -> % (want 0/m-a)', measured;
      failures := failures + 1;
    END IF;
  EXCEPTION
    -- The guard firing here means the row was reachable, which is the policy
    -- failing even though the write was still refused. Reported as a failure
    -- of this layer: the guard is measured on its own in check 34, and a
    -- contour that relies on its last line is one mistake from open.
    WHEN raise_exception THEN
      RAISE WARNING
        'FAIL 24 signed version cannot be re-signed -> the update policy admitted the row and only the guard stopped it (%)',
        SQLERRM;
      failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 25. The payload hash is not writable at all, signed or not. Measured on an
  --     unsigned version so the refusal is the column grant and not the policy.
  ---------------------------------------------------------------------------
  INSERT INTO public."accounting_document_versions"(
    "id","tenantId","organizationId","documentId","versionNumber",
    "payloadHash","recordedRevisions","createdByMembershipId"
  ) VALUES (
    'pc-ver-a2','tenant-a','org-a','pc-doc-a',2,
    'sha256-second', '{"WEIGHT":"weight-3"}'::jsonb, 'm-a');
  BEGIN
    UPDATE public."accounting_document_versions"
       SET "payloadHash" = 'sha256-rewritten'
     WHERE "id" = 'pc-ver-a2';
    RAISE WARNING 'FAIL 25 payload hash is not writable -> update succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS 25 payload hash is not writable';
    -- Reaching the guard means the column grant was widened. The write was
    -- still refused, but by the last line rather than the first.
    WHEN raise_exception THEN
      RAISE WARNING
        'FAIL 25 payload hash is not writable -> the column grant admitted the write and only the guard stopped it (%)',
        SQLERRM;
      failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 26. The revision snapshot is not writable either. Losing it would not
  --     falsify a document, it would make staleness undetectable, which is
  --     worse because nothing looks wrong.
  ---------------------------------------------------------------------------
  BEGIN
    UPDATE public."accounting_document_versions"
       SET "recordedRevisions" = '{}'::jsonb
     WHERE "id" = 'pc-ver-a2';
    RAISE WARNING 'FAIL 26 revision snapshot is not writable -> update succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS 26 revision snapshot is not writable';
    WHEN raise_exception THEN
      RAISE WARNING
        'FAIL 26 revision snapshot is not writable -> the column grant admitted the write and only the guard stopped it (%)',
        SQLERRM;
      failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 27. A version is never deleted; a superseded one is evidence.
  ---------------------------------------------------------------------------
  BEGIN
    DELETE FROM public."accounting_document_versions" WHERE "id" = 'pc-ver-a2';
    RAISE WARNING 'FAIL 27 version cannot be deleted -> delete succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS 27 version cannot be deleted';
  END;

  ---------------------------------------------------------------------------
  -- 28. A document cannot be issued without a number.
  ---------------------------------------------------------------------------
  BEGIN
    UPDATE public."accounting_documents"
       SET "status" = 'ISSUED'
     WHERE "id" = 'pc-doc-a';
    RAISE WARNING 'FAIL 28 issuing requires a number -> update succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE 'PASS 28 issuing requires a number';
  END;

  ---------------------------------------------------------------------------
  -- 29. Numbered and issued in one step is fine; renumbering afterwards is
  --     not. A reused or edited number is how a sequence stops being evidence.
  ---------------------------------------------------------------------------
  BEGIN
    UPDATE public."accounting_documents"
       SET "status" = 'ISSUED', "documentNumber" = 'UPD-2026-000001',
           "currentVersionNumber" = 2
     WHERE "id" = 'pc-doc-a';
    RAISE NOTICE 'PASS 29a a document can be numbered and issued';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'FAIL 29a a document can be numbered and issued -> %', SQLERRM;
    failures := failures + 1;
  END;

  BEGIN
    UPDATE public."accounting_documents"
       SET "documentNumber" = 'UPD-2026-000002'
     WHERE "id" = 'pc-doc-a';
    RAISE WARNING 'FAIL 29b an issued number is never reassigned -> update succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN raise_exception OR insufficient_privilege THEN
      RAISE NOTICE 'PASS 29b an issued number is never reassigned';
  END;

  ---------------------------------------------------------------------------
  -- 30. The pointer to the newest version never goes backwards, which would
  --     hide renderings that exist.
  ---------------------------------------------------------------------------
  BEGIN
    UPDATE public."accounting_documents"
       SET "currentVersionNumber" = 1
     WHERE "id" = 'pc-doc-a';
    RAISE WARNING 'FAIL 30 current version never goes backwards -> update succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN raise_exception OR insufficient_privilege THEN
      RAISE NOTICE 'PASS 30 current version never goes backwards';
  END;

  ---------------------------------------------------------------------------
  -- 31. A numbering sequence is created scoped to the writer's organization.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."accounting_number_counters"(
      "id","tenantId","organizationId","documentType","periodYear",
      "prefix","resetPolicy","padding"
    ) VALUES ('pc-cnt-a','tenant-a','org-a','UPD',2026,'УПД','ANNUAL',6);
    RAISE NOTICE 'PASS 31 numbering sequence created';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'FAIL 31 numbering sequence created -> %', SQLERRM;
    failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 32. The column-level UPDATE grant is enough to lock the row. This is the
  --     claim the gapless sequence rests on: if row locking needed a
  --     table-wide grant, the principal would have had to be widened.
  ---------------------------------------------------------------------------
  BEGIN
    PERFORM 1 FROM public."accounting_number_counters"
      WHERE "id" = 'pc-cnt-a' FOR UPDATE;
    RAISE NOTICE 'PASS 32 counter can be locked with a column-level update grant';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'FAIL 32 counter can be locked with a column-level update grant -> %', SQLERRM;
    failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 33. Taking a number is permitted; putting one back is not, because a
  --     lower ordinal re-issues a number already on somebody else's paper.
  ---------------------------------------------------------------------------
  UPDATE public."accounting_number_counters"
     SET "lastOrdinal" = 42 WHERE "id" = 'pc-cnt-a';
  BEGIN
    UPDATE public."accounting_number_counters"
       SET "lastOrdinal" = 41 WHERE "id" = 'pc-cnt-a';
    RAISE WARNING 'FAIL 33 counter never goes backwards -> update succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN raise_exception OR insufficient_privilege THEN
      RAISE NOTICE 'PASS 33 counter never goes backwards';
  END;

  ---------------------------------------------------------------------------
  -- 34. The scheme is not writable by this principal at all, so a live
  --     sequence cannot be reshaped even before the guard is consulted.
  ---------------------------------------------------------------------------
  BEGIN
    UPDATE public."accounting_number_counters"
       SET "padding" = 3 WHERE "id" = 'pc-cnt-a';
    RAISE WARNING 'FAIL 34 numbering scheme is not writable -> update succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS 34 numbering scheme is not writable';
    WHEN raise_exception THEN
      RAISE WARNING
        'FAIL 34 numbering scheme is not writable -> the column grant admitted the write and only the guard stopped it (%)',
        SQLERRM;
      failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 35. A sequence is never deleted; restarting one re-issues numbers.
  ---------------------------------------------------------------------------
  BEGIN
    DELETE FROM public."accounting_number_counters" WHERE "id" = 'pc-cnt-a';
    RAISE WARNING 'FAIL 35 counter cannot be deleted -> delete succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS 35 counter cannot be deleted';
  END;

  ---------------------------------------------------------------------------
  -- 36. And it cannot be created for another organization.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."accounting_number_counters"(
      "id","tenantId","organizationId","documentType","periodYear"
    ) VALUES ('pc-cnt-cross','tenant-b','org-b','UPD',2026);
    RAISE WARNING 'FAIL 36 cross-organization counter refused -> insert succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN
      RAISE NOTICE 'PASS 36 cross-organization counter refused';
  END;

  IF failures > 0 THEN
    RAISE EXCEPTION 'pc-crop accounting documents: % check(s) failed', failures;
  END IF;
  RAISE NOTICE 'pc-crop accounting contour: document immutability, 0 failures';
END;
$pc_crop_accounting_document_checks$;

RESET ROLE;
SET ROLE pc_accounting_authority;

DO $pc_crop_accounting_document_read_checks$
DECLARE
  failures integer := 0;
  measured text;
BEGIN
  ---------------------------------------------------------------------------
  -- 37. Documents and versions are read on the same terms as the rest of the
  --     contour: the organization the caller actually holds a membership in,
  --     never the one it claims.
  ---------------------------------------------------------------------------
  PERFORM set_config('app.current_user_id', 'user-a', true),
          set_config('app.current_org_id', 'org-a', true),
          set_config('app.current_tenant_id', 'tenant-a', true);
  measured := (SELECT count(*) FROM public."accounting_documents")::text || '/' ||
              (SELECT count(*) FROM public."accounting_document_versions")::text;
  IF measured = '1/2' THEN
    RAISE NOTICE 'PASS 37 member reads its own documents and versions -> %', measured;
  ELSE
    RAISE WARNING 'FAIL 37 member reads its own documents and versions -> % (want 1/2)', measured;
    failures := failures + 1;
  END IF;

  ---------------------------------------------------------------------------
  -- 38. The same caller claiming org-b reads nothing, and the org-b document
  --     created earlier proves the read is scoped rather than simply empty.
  ---------------------------------------------------------------------------
  PERFORM set_config('app.current_org_id', 'org-b', true),
          set_config('app.current_tenant_id', 'tenant-b', true);
  measured := (SELECT count(*) FROM public."accounting_documents")::text;
  IF measured = '0' THEN
    RAISE NOTICE 'PASS 38 forged organization reads no documents -> %', measured;
  ELSE
    RAISE WARNING 'FAIL 38 forged organization reads no documents -> % (want 0)', measured;
    failures := failures + 1;
  END IF;

  ---------------------------------------------------------------------------
  -- 39. The read principal stays read-only on the new tables too.
  ---------------------------------------------------------------------------
  PERFORM set_config('app.current_org_id', 'org-a', true),
          set_config('app.current_tenant_id', 'tenant-a', true);
  BEGIN
    UPDATE public."accounting_documents" SET "status" = 'CANCELLED'
     WHERE "id" = 'pc-doc-a';
    RAISE WARNING 'FAIL 39 read principal cannot write documents -> update succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS 39 read principal cannot write documents';
  END;

  IF failures > 0 THEN
    RAISE EXCEPTION 'pc-crop accounting document reads: % check(s) failed', failures;
  END IF;
  RAISE NOTICE 'pc-crop accounting contour: document reads, 0 failures';
END;
$pc_crop_accounting_document_read_checks$;

RESET ROLE;

DO $pc_crop_accounting_superuser_checks$
DECLARE
  failures integer := 0;
BEGIN
  ---------------------------------------------------------------------------
  -- 40. The trigger binds the superuser as well. A column grant only
  --     constrains the role it was withheld from, and row level security is
  --     bypassed here entirely — so this is the only one of the three
  --     mechanisms that still holds when the connection is fully privileged.
  ---------------------------------------------------------------------------
  BEGIN
    UPDATE public."accounting_document_versions"
       SET "payloadHash" = 'sha256-rewritten-by-owner'
     WHERE "id" = 'pc-ver-a1';
    RAISE WARNING 'FAIL 40 signed version is immutable to the superuser -> update succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN raise_exception THEN
      RAISE NOTICE 'PASS 40 signed version is immutable to the superuser';
  END;

  ---------------------------------------------------------------------------
  -- 41. And the snapshot on an unsigned version is equally beyond it.
  ---------------------------------------------------------------------------
  BEGIN
    UPDATE public."accounting_document_versions"
       SET "recordedRevisions" = '{"WEIGHT":"weight-999"}'::jsonb
     WHERE "id" = 'pc-ver-a2';
    RAISE WARNING 'FAIL 41 revision snapshot is immutable to the superuser -> update succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN raise_exception THEN
      RAISE NOTICE 'PASS 41 revision snapshot is immutable to the superuser';
  END;

  IF failures > 0 THEN
    RAISE EXCEPTION 'pc-crop accounting document guard: % check(s) failed', failures;
  END IF;
  RAISE NOTICE 'pc-crop accounting contour: guard binds every principal, 0 failures';
END;
$pc_crop_accounting_superuser_checks$;

---------------------------------------------------------------------------
-- The regulatory rule registry.
--
-- Seeded as the superuser, because publishing a rule is an ops act. The point
-- of the checks below is that the accounting principals can read it and have
-- no path to write it: a rule table a tenant could edit is one that could be
-- used to justify a wrong document after the fact.
---------------------------------------------------------------------------

INSERT INTO public."regulatory_rule_versions"(
  "id","ruleKey","versionTag","effectiveFrom","effectiveTo","status","source","payload"
) VALUES
  ('pc-rule-2025','VAT_RATES','2025-01',
   '2025-01-01T00:00:00Z','2026-01-01T00:00:00Z','ACTIVE',
   'НК РФ ст. 164', '{"rates":["10","20"]}'::jsonb),
  ('pc-rule-2026','VAT_RATES','2026-01',
   '2026-01-01T00:00:00Z',NULL,'ACTIVE',
   'НК РФ ст. 164', '{"rates":["10","20"]}'::jsonb);

DO $pc_crop_regulatory_rule_checks$
DECLARE
  failures integer := 0;
  measured text;
BEGIN
  ---------------------------------------------------------------------------
  -- 42. A successor starting exactly where its predecessor ends is a clean
  --     handover, not an overlap.
  ---------------------------------------------------------------------------
  measured := (SELECT count(*)::text FROM public."regulatory_rule_versions"
               WHERE "ruleKey" = 'VAT_RATES');
  IF measured = '2' THEN
    RAISE NOTICE 'PASS 42 adjacent rule windows coexist -> %', measured;
  ELSE
    RAISE WARNING 'FAIL 42 adjacent rule windows coexist -> % (want 2)', measured;
    failures := failures + 1;
  END IF;

  ---------------------------------------------------------------------------
  -- 43. Two versions in force at one instant makes "which rate applied"
  --     unanswerable, so the overlap is refused at write time.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."regulatory_rule_versions"(
      "id","ruleKey","versionTag","effectiveFrom","effectiveTo","status","source","payload"
    ) VALUES (
      'pc-rule-overlap','VAT_RATES','2026-06',
      '2026-06-01T00:00:00Z',NULL,'ACTIVE','НК РФ ст. 164','{}'::jsonb);
    RAISE WARNING 'FAIL 43 overlapping rule versions refused -> insert succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN raise_exception THEN
      RAISE NOTICE 'PASS 43 overlapping rule versions refused';
  END;

  ---------------------------------------------------------------------------
  -- 44. A published rule is immutable. A document recorded this revision as
  --     the reason it looks the way it does; editing the payload underneath
  --     would make that record false without changing the revision.
  ---------------------------------------------------------------------------
  BEGIN
    UPDATE public."regulatory_rule_versions"
       SET "payload" = '{"rates":["0"]}'::jsonb
     WHERE "id" = 'pc-rule-2026';
    RAISE WARNING 'FAIL 44 published rule is immutable -> update succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN raise_exception THEN
      RAISE NOTICE 'PASS 44 published rule is immutable';
  END;

  ---------------------------------------------------------------------------
  -- 45. Retiring a version by status is still possible, which is how a rule
  --     is withdrawn without erasing what it said.
  ---------------------------------------------------------------------------
  BEGIN
    UPDATE public."regulatory_rule_versions"
       SET "status" = 'SUPERSEDED' WHERE "id" = 'pc-rule-2025';
    RAISE NOTICE 'PASS 45 a rule version can be retired by status';
    UPDATE public."regulatory_rule_versions"
       SET "status" = 'ACTIVE' WHERE "id" = 'pc-rule-2025';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'FAIL 45 a rule version can be retired by status -> %', SQLERRM;
    failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 46. A rule with no citation cannot be audited, only trusted.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."regulatory_rule_versions"(
      "id","ruleKey","versionTag","effectiveFrom","status","source","payload"
    ) VALUES (
      'pc-rule-nosource','UPD_FORMAT','5.03',
      '2026-01-01T00:00:00Z','ACTIVE','   ','{}'::jsonb);
    RAISE WARNING 'FAIL 46 a rule must cite its source -> insert succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE 'PASS 46 a rule must cite its source';
  END;

  IF failures > 0 THEN
    RAISE EXCEPTION 'pc-crop regulatory rule registry: % check(s) failed', failures;
  END IF;
  RAISE NOTICE 'pc-crop accounting contour: regulatory rule registry, 0 failures';
END;
$pc_crop_regulatory_rule_checks$;

SET ROLE pc_accounting_command_authority;

DO $pc_crop_regulatory_rule_confinement_checks$
DECLARE
  failures integer := 0;
  measured text;
  affected integer;
BEGIN
  PERFORM set_config('app.current_user_id', 'user-a', true),
          set_config('app.current_org_id', 'org-a', true),
          set_config('app.current_tenant_id', 'tenant-a', true);

  ---------------------------------------------------------------------------
  -- 47. The rules are readable by a confined principal. They are public law,
  --     and a document that cannot name its rule is unverifiable.
  ---------------------------------------------------------------------------
  measured := (SELECT count(*)::text FROM public."regulatory_rule_versions");
  IF measured = '2' THEN
    RAISE NOTICE 'PASS 47 confined principal reads the rule registry -> %', measured;
  ELSE
    RAISE WARNING 'FAIL 47 confined principal reads the rule registry -> % (want 2)', measured;
    failures := failures + 1;
  END IF;

  ---------------------------------------------------------------------------
  -- 48. And has no path to write it. This is the property the registry exists
  --     for: a rule a tenant can edit is a rule that can be made to justify a
  --     document after the fact.
  ---------------------------------------------------------------------------
  BEGIN
    -- A rule key nothing else uses, so the only thing that can refuse this is
    -- the privilege boundary. Aiming it at VAT_RATES would let the overlap
    -- guard catch it instead, and the check would pass while the layer it
    -- measures had been widened.
    INSERT INTO public."regulatory_rule_versions"(
      "id","ruleKey","versionTag","effectiveFrom","status","source","payload"
    ) VALUES (
      'pc-rule-forged','INVENTED_RULE','2026-99',
      '2030-01-01T00:00:00Z','ACTIVE','invented','{"rates":["0"]}'::jsonb);
    RAISE WARNING 'FAIL 48 confined principal cannot publish a rule -> insert succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS 48 confined principal cannot publish a rule';
    WHEN raise_exception THEN
      RAISE WARNING
        'FAIL 48 confined principal cannot publish a rule -> the grant admitted the write and only the guard stopped it (%)',
        SQLERRM;
      failures := failures + 1;
  END;

  BEGIN
    UPDATE public."regulatory_rule_versions"
       SET "status" = 'SUPERSEDED' WHERE "id" = 'pc-rule-2026';
    RAISE WARNING 'FAIL 49 confined principal cannot retire a rule -> update succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS 49 confined principal cannot retire a rule';
  END;

  BEGIN
    DELETE FROM public."regulatory_rule_versions" WHERE "id" = 'pc-rule-2025';
    RAISE WARNING 'FAIL 50 confined principal cannot delete a rule -> delete succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS 50 confined principal cannot delete a rule';
  END;

  ---------------------------------------------------------------------------
  -- The organization's own tax status. The privilege shape here is the
  -- opposite of the rule registry's, on purpose: members may declare a status,
  -- but a declared version cannot change meaning after documents cite it.
  --
  -- The malformed-shape checks run first, before any profile exists. Ordered
  -- the other way they would overlap the open-ended profile and be refused by
  -- the guard instead of by the constraint each one measures — a check that
  -- passes because a neighbouring layer caught it is not measuring anything.
  ---------------------------------------------------------------------------

  ---------------------------------------------------------------------------
  -- 51. An exemption nobody can name is indistinguishable from not charging
  --     VAT for no reason.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."organization_tax_profiles"(
      "id","tenantId","organizationId","versionTag","taxRegime","vatStatus",
      "effectiveFrom","createdByMembershipId"
    ) VALUES (
      'pc-tax-noground','tenant-a','org-a','2027-01','ESHN','EXEMPT',
      '2027-01-01T00:00:00Z','m-a');
    RAISE WARNING 'FAIL 51 an exemption must name its ground -> insert succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE 'PASS 51 an exemption must name its ground';
    WHEN raise_exception THEN
      RAISE WARNING
        'FAIL 51 an exemption must name its ground -> the overlap guard answered instead of the constraint (%)',
        SQLERRM;
      failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 52. And a ground cited by an organization that is not exempt claims a
  --     status it does not hold.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."organization_tax_profiles"(
      "id","tenantId","organizationId","versionTag","taxRegime","vatStatus",
      "vatExemptionGround","effectiveFrom","createdByMembershipId"
    ) VALUES (
      'pc-tax-badground','tenant-a','org-a','2028-01','OSNO','PAYER',
      'ст. 145 НК РФ','2028-01-01T00:00:00Z','m-a');
    RAISE WARNING 'FAIL 52 only an exempt profile cites a ground -> insert succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE 'PASS 52 only an exempt profile cites a ground';
    WHEN raise_exception THEN
      RAISE WARNING
        'FAIL 52 only an exempt profile cites a ground -> the overlap guard answered instead of the constraint (%)',
        SQLERRM;
      failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 53. A member records a profile for its own organization.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."organization_tax_profiles"(
      "id","tenantId","organizationId","versionTag","taxRegime","vatStatus",
      "effectiveFrom","createdByMembershipId"
    ) VALUES (
      'pc-tax-a','tenant-a','org-a','2026-01','OSNO','PAYER',
      '2026-01-01T00:00:00Z','m-a');
    RAISE NOTICE 'PASS 53 tax profile recorded';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'FAIL 53 tax profile recorded -> %', SQLERRM;
    failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 54. Two statuses in force at once makes "was this organization charging
  --     VAT that day" unanswerable.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."organization_tax_profiles"(
      "id","tenantId","organizationId","versionTag","taxRegime","vatStatus",
      "effectiveFrom","createdByMembershipId"
    ) VALUES (
      'pc-tax-overlap','tenant-a','org-a','2026-06','USN','NOT_PAYER',
      '2026-06-01T00:00:00Z','m-a');
    RAISE WARNING 'FAIL 54 overlapping tax profiles refused -> insert succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN raise_exception THEN
      RAISE NOTICE 'PASS 54 overlapping tax profiles refused';
  END;

  ---------------------------------------------------------------------------
  -- 55. The substance of a recorded profile is not writable at all, so a
  --     document's cited status cannot change meaning under it.
  ---------------------------------------------------------------------------
  BEGIN
    UPDATE public."organization_tax_profiles"
       SET "vatStatus" = 'NOT_PAYER' WHERE "id" = 'pc-tax-a';
    RAISE WARNING 'FAIL 55 a recorded tax status is immutable -> update succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS 55 a recorded tax status is immutable';
    WHEN raise_exception THEN
      RAISE WARNING
        'FAIL 55 a recorded tax status is immutable -> the column grant admitted the write and only the guard stopped it (%)',
        SQLERRM;
      failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 56. Closing the window is how a successor is declared, and it happens
  --     once: re-cutting it later orphans documents issued under the version
  --     as it stood.
  ---------------------------------------------------------------------------
  BEGIN
    UPDATE public."organization_tax_profiles"
       SET "effectiveTo" = '2026-07-01T00:00:00Z' WHERE "id" = 'pc-tax-a';
    RAISE NOTICE 'PASS 56a a window can be closed once';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'FAIL 56a a window can be closed once -> %', SQLERRM;
    failures := failures + 1;
  END;

  -- Measured as rows touched rather than as an exception: the update policy
  -- only admits a row whose window is still open, and an unreachable row is
  -- silently skipped rather than refused. The guard says the same thing to the
  -- superuser, which is checked separately.
  BEGIN
    UPDATE public."organization_tax_profiles"
       SET "effectiveTo" = '2026-09-01T00:00:00Z' WHERE "id" = 'pc-tax-a';
    GET DIAGNOSTICS affected = ROW_COUNT;
    measured := affected::text || '/' || coalesce((
      SELECT to_char("effectiveTo" AT TIME ZONE 'UTC', 'YYYY-MM-DD')
      FROM public."organization_tax_profiles" WHERE "id" = 'pc-tax-a'), 'null');
    IF measured = '0/2026-07-01' THEN
      RAISE NOTICE 'PASS 56b a closed window is not re-cut -> %', measured;
    ELSE
      RAISE WARNING 'FAIL 56b a closed window is not re-cut -> % (want 0/2026-07-01)', measured;
      failures := failures + 1;
    END IF;
  EXCEPTION
    WHEN raise_exception THEN
      RAISE WARNING
        'FAIL 56b a closed window is not re-cut -> the update policy admitted the row and only the guard stopped it (%)',
        SQLERRM;
      failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 57. A successor beginning where its predecessor ends is a clean handover.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."organization_tax_profiles"(
      "id","tenantId","organizationId","versionTag","taxRegime","vatStatus",
      "vatExemptionGround","effectiveFrom","createdByMembershipId"
    ) VALUES (
      'pc-tax-a2','tenant-a','org-a','2026-07','ESHN','EXEMPT',
      'ст. 145 НК РФ','2026-07-01T00:00:00Z','m-a');
    RAISE NOTICE 'PASS 57 a successor profile starts where the last one ended';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'FAIL 57 a successor profile starts where the last one ended -> %', SQLERRM;
    failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 58. And none of it can be written into another organization.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."organization_tax_profiles"(
      "id","tenantId","organizationId","versionTag","taxRegime","vatStatus",
      "effectiveFrom","createdByMembershipId"
    ) VALUES (
      'pc-tax-cross','tenant-b','org-b','2026-01','OSNO','PAYER',
      '2026-01-01T00:00:00Z','m-a');
    RAISE WARNING 'FAIL 58 cross-organization tax profile refused -> insert succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege OR check_violation OR foreign_key_violation THEN
      RAISE NOTICE 'PASS 58 cross-organization tax profile refused';
  END;

  ---------------------------------------------------------------------------
  -- Versions of the agreement. Shape checks first again: a malformed row that
  -- also overlaps would be answered by the guard rather than by the constraint
  -- it is meant to measure. Drafts never overlap, so the malformed ones are
  -- drafts.
  ---------------------------------------------------------------------------

  ---------------------------------------------------------------------------
  -- 59. An amendment that names no predecessor leaves no chain back to what
  --     was originally agreed.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."contract_versions"(
      "id","tenantId","organizationId","contractNumber","versionNumber","status",
      "termsHash","terms","effectiveFrom","createdByMembershipId"
    ) VALUES (
      'pc-cv-orphan','tenant-a','org-a','ДП-2026/17',2,'DRAFT',
      'sha256-t2','{}'::jsonb,'2026-07-01T00:00:00Z','m-a');
    RAISE WARNING 'FAIL 59 an amendment must name what it replaces -> insert succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE 'PASS 59 an amendment must name what it replaces';
    WHEN raise_exception THEN
      RAISE WARNING
        'FAIL 59 an amendment must name what it replaces -> the overlap guard answered instead of the constraint (%)',
        SQLERRM;
      failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 60. A status and a signature that disagree produce a version that reads as
  --     signed to one check and unsigned to another.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."contract_versions"(
      "id","tenantId","organizationId","contractNumber","versionNumber","status",
      "termsHash","terms","effectiveFrom","signedAt","createdByMembershipId"
    ) VALUES (
      'pc-cv-halfsigned','tenant-a','org-a','ДП-2026/17',1,'DRAFT',
      'sha256-t1','{}'::jsonb,'2026-01-01T00:00:00Z','2026-01-01T00:00:00Z','m-a');
    RAISE WARNING 'FAIL 60 a draft carries no signature -> insert succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE 'PASS 60 a draft carries no signature';
  END;

  ---------------------------------------------------------------------------
  -- 61. The first signed version of an agreement.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."contract_versions"(
      "id","tenantId","organizationId","contractNumber","versionNumber","status",
      "termsHash","terms","effectiveFrom","signedAt","signedByMembershipId",
      "createdByMembershipId"
    ) VALUES (
      'pc-cv-1','tenant-a','org-a','ДП-2026/17',1,'SIGNED',
      'sha256-t1','{"pricePerTonKopecks":"1250000"}'::jsonb,
      '2026-01-01T00:00:00Z','2026-01-01T00:00:00Z','m-a','m-a');
    RAISE NOTICE 'PASS 61 first signed contract version recorded';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'FAIL 61 first signed contract version recorded -> %', SQLERRM;
    failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 62. A draft amendment may sit alongside the signed version it proposes to
  --     replace. That is what an amendment under negotiation is, and it
  --     governs nothing until signed.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."contract_versions"(
      "id","tenantId","organizationId","contractNumber","versionNumber","status",
      "termsHash","terms","effectiveFrom","supersedesVersionNumber",
      "createdByMembershipId"
    ) VALUES (
      'pc-cv-2draft','tenant-a','org-a','ДП-2026/17',2,'DRAFT',
      'sha256-t2','{"pricePerTonKopecks":"1300000"}'::jsonb,
      '2026-01-01T00:00:00Z',1,'m-a');
    RAISE NOTICE 'PASS 62 a draft amendment coexists with the signed version';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'FAIL 62 a draft amendment coexists with the signed version -> %', SQLERRM;
    failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 63. Two signed versions in force at once makes "which price applied on
  --     the 3rd" unanswerable.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."contract_versions"(
      "id","tenantId","organizationId","contractNumber","versionNumber","status",
      "termsHash","terms","effectiveFrom","signedAt","signedByMembershipId",
      "supersedesVersionNumber","createdByMembershipId"
    ) VALUES (
      'pc-cv-3signed','tenant-a','org-a','ДП-2026/17',3,'SIGNED',
      'sha256-t3','{}'::jsonb,'2026-03-01T00:00:00Z','2026-03-01T00:00:00Z','m-a',
      1,'m-a');
    RAISE WARNING 'FAIL 63 two signed versions in force refused -> insert succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN raise_exception THEN
      RAISE NOTICE 'PASS 63 two signed versions in force refused';
  END;

  ---------------------------------------------------------------------------
  -- 64. Terms that can move underneath a signature are evidence of nothing.
  ---------------------------------------------------------------------------
  BEGIN
    UPDATE public."contract_versions"
       SET "termsHash" = 'sha256-rewritten' WHERE "id" = 'pc-cv-1';
    RAISE WARNING 'FAIL 64 signed terms are not writable -> update succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS 64 signed terms are not writable';
    WHEN raise_exception THEN
      RAISE WARNING
        'FAIL 64 signed terms are not writable -> the column grant admitted the write and only the guard stopped it (%)',
        SQLERRM;
      failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 65. Closing the window and retiring by status is how an amendment takes
  --     over, so both stay permitted.
  ---------------------------------------------------------------------------
  BEGIN
    UPDATE public."contract_versions"
       SET "effectiveTo" = '2026-07-01T00:00:00Z', "status" = 'SUPERSEDED'
     WHERE "id" = 'pc-cv-1';
    RAISE NOTICE 'PASS 65 a signed version can be closed and superseded';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'FAIL 65 a signed version can be closed and superseded -> %', SQLERRM;
    failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 66. A version is never deleted: an amendment points back along the chain.
  ---------------------------------------------------------------------------
  BEGIN
    DELETE FROM public."contract_versions" WHERE "id" = 'pc-cv-1';
    RAISE WARNING 'FAIL 66 a contract version cannot be deleted -> delete succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS 66 a contract version cannot be deleted';
  END;

  ---------------------------------------------------------------------------
  -- 67. And none of it reaches another organization.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."contract_versions"(
      "id","tenantId","organizationId","contractNumber","versionNumber","status",
      "termsHash","terms","effectiveFrom","createdByMembershipId"
    ) VALUES (
      'pc-cv-cross','tenant-b','org-b','ДП-2026/99',1,'DRAFT',
      'sha256-x','{}'::jsonb,'2026-01-01T00:00:00Z','m-a');
    RAISE WARNING 'FAIL 67 cross-organization contract version refused -> insert succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege OR check_violation OR foreign_key_violation THEN
      RAISE NOTICE 'PASS 67 cross-organization contract version refused';
  END;

  IF failures > 0 THEN
    RAISE EXCEPTION 'pc-crop regulatory rule confinement: % check(s) failed', failures;
  END IF;
  RAISE NOTICE 'pc-crop accounting contour: rule registry read-only, tax profiles versioned, 0 failures';
END;
$pc_crop_regulatory_rule_confinement_checks$;

---------------------------------------------------------------------------
-- Work tasks. The property under test is the one the dashboard rests on: a
-- task the platform derived closes when its condition clears and not when
-- somebody agrees with it. Here that is measured against the confined write
-- principal, which is the principal an application actually runs as.
---------------------------------------------------------------------------

DO $pc_crop_work_task_checks$
DECLARE
  failures integer := 0;
  measured text;
BEGIN
  PERFORM set_config('app.current_user_id', 'user-a', true),
          set_config('app.current_org_id', 'org-a', true),
          set_config('app.current_tenant_id', 'tenant-a', true);

  ---------------------------------------------------------------------------
  -- 68. A person may raise their own note, attributed to themselves.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."accounting_work_tasks"(
      "id","tenantId","organizationId","taskType","origin","resolutionMode",
      "title","humanDescription","responsibleCapability","createdByMembershipId"
    ) VALUES (
      'pc-wt-manual','tenant-a','org-a','CALL_BUYER','MANUAL','HUMAN_JUDGEMENT',
      'Позвонить покупателю','Уточнить реквизиты','accounting.task.manage','m-a');
    RAISE NOTICE 'PASS 68 a member raises their own task';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'FAIL 68 a member raises their own task -> %', SQLERRM;
    failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 69. A hand-written derived task is refused. A derived task is a claim
  --     about the world, and this principal is not where such claims come
  --     from: the deriver runs server-side against sources it can see.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."accounting_work_tasks"(
      "id","tenantId","organizationId","taskType","origin","resolutionMode",
      "derivationKey","openDerivationKey","title","humanDescription",
      "responsibleCapability"
    ) VALUES (
      'pc-wt-forged','tenant-a','org-a','DOCUMENT_NOT_SIGNED','DERIVED',
      'SYSTEM_VERIFIED','forged','forged','т','о','documents.sign');
    RAISE WARNING 'FAIL 69 hand-written derived task refused -> insert succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN
      RAISE NOTICE 'PASS 69 hand-written derived task refused';
  END;

  ---------------------------------------------------------------------------
  -- 70. Attribution cannot be handed to somebody else. A principal that can
  --     name another member as author can also blame one.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."accounting_work_tasks"(
      "id","tenantId","organizationId","taskType","origin","resolutionMode",
      "title","humanDescription","responsibleCapability","createdByMembershipId"
    ) VALUES (
      'pc-wt-blamed','tenant-a','org-a','CALL_BUYER','MANUAL','HUMAN_JUDGEMENT',
      'т','о','accounting.task.manage','m-staff');
    RAISE WARNING 'FAIL 70 forged task attribution refused -> insert succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN
      RAISE NOTICE 'PASS 70 forged task attribution refused';
  END;

  ---------------------------------------------------------------------------
  -- 71. Nothing reaches another organization.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."accounting_work_tasks"(
      "id","tenantId","organizationId","taskType","origin","resolutionMode",
      "title","humanDescription","responsibleCapability","createdByMembershipId"
    ) VALUES (
      'pc-wt-cross','tenant-b','org-b','CALL_BUYER','MANUAL','HUMAN_JUDGEMENT',
      'т','о','accounting.task.manage','m-b');
    RAISE WARNING 'FAIL 71 cross-organization task refused -> insert succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege OR check_violation OR foreign_key_violation THEN
      RAISE NOTICE 'PASS 71 cross-organization task refused';
  END;

  ---------------------------------------------------------------------------
  -- 72. What a task is about is not in the column grant. This measures the
  --     grant rather than the guard: if the grant were widened, the guard
  --     would still refuse and this check must still fail, which is why it
  --     reports which layer answered.
  ---------------------------------------------------------------------------
  BEGIN
    UPDATE public."accounting_work_tasks"
       SET "taskType" = 'PAYMENT_NOT_MATCHED', "version" = "version" + 1
     WHERE "id" = 'pc-wt-manual';
    RAISE WARNING 'FAIL 72 the subject of a task is not writable -> update succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS 72 the subject of a task is not writable';
    WHEN raise_exception THEN
      RAISE WARNING
        'FAIL 72 the subject of a task is not writable -> the column grant admitted the write and only the guard stopped it (%)',
        SQLERRM;
      failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 73. Working a task is permitted: status, owner, deadline.
  ---------------------------------------------------------------------------
  BEGIN
    UPDATE public."accounting_work_tasks"
       SET "status" = 'IN_PROGRESS', "assignedMembershipId" = 'm-a',
           "version" = "version" + 1
     WHERE "id" = 'pc-wt-manual';
    RAISE NOTICE 'PASS 73 a task can be taken up';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'FAIL 73 a task can be taken up -> %', SQLERRM;
    failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 74. Closing somebody else's name onto the record is refused: the row
  --     records who acted, and that is the caller.
  ---------------------------------------------------------------------------
  BEGIN
    UPDATE public."accounting_work_tasks"
       SET "status" = 'RESOLVED', "resolvedByMembershipId" = 'm-staff',
           "version" = "version" + 1
     WHERE "id" = 'pc-wt-manual';
    RAISE WARNING 'FAIL 74 a task closure names the caller -> update succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN
      RAISE NOTICE 'PASS 74 a task closure names the caller';
  END;

  ---------------------------------------------------------------------------
  -- 75. A task is never deleted. One that was raised and then removed is
  --     indistinguishable from one that was never raised, which is exactly
  --     what a record of outstanding work must not be.
  ---------------------------------------------------------------------------
  BEGIN
    DELETE FROM public."accounting_work_tasks" WHERE "id" = 'pc-wt-manual';
    RAISE WARNING 'FAIL 75 a work task cannot be deleted -> delete succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS 75 a work task cannot be deleted';
  END;

  IF failures > 0 THEN
    RAISE EXCEPTION 'pc-crop work tasks: % check(s) failed', failures;
  END IF;
  RAISE NOTICE 'pc-crop accounting contour: work task confinement, 0 failures';
END;
$pc_crop_work_task_checks$;

RESET ROLE;
SET ROLE pc_accounting_authority;

DO $pc_crop_work_task_read_checks$
DECLARE
  failures integer := 0;
  measured text;
BEGIN
  PERFORM set_config('app.current_user_id', 'user-a', true),
          set_config('app.current_org_id', 'org-a', true),
          set_config('app.current_tenant_id', 'tenant-a', true);

  ---------------------------------------------------------------------------
  -- 76. A member reads their organization's tasks.
  ---------------------------------------------------------------------------
  measured := (SELECT count(*)::text FROM public."accounting_work_tasks");
  IF measured = '1' THEN
    RAISE NOTICE 'PASS 76 a member reads its own tasks -> %', measured;
  ELSE
    RAISE WARNING 'FAIL 76 a member reads its own tasks -> % (want 1)', measured;
    failures := failures + 1;
  END IF;

  ---------------------------------------------------------------------------
  -- 77. Claiming another organization yields nothing. The setting is
  --     forgeable by this principal; the membership behind it is not.
  ---------------------------------------------------------------------------
  PERFORM set_config('app.current_org_id', 'org-b', true),
          set_config('app.current_tenant_id', 'tenant-b', true);
  measured := (SELECT count(*)::text FROM public."accounting_work_tasks");
  IF measured = '0' THEN
    RAISE NOTICE 'PASS 77 a forged organization reads no tasks -> %', measured;
  ELSE
    RAISE WARNING 'FAIL 77 a forged organization reads no tasks -> % (want 0)', measured;
    failures := failures + 1;
  END IF;
  PERFORM set_config('app.current_org_id', 'org-a', true),
          set_config('app.current_tenant_id', 'tenant-a', true);

  ---------------------------------------------------------------------------
  -- 78. The read principal writes nothing, including the status that would
  --     make a task disappear from somebody's list.
  ---------------------------------------------------------------------------
  BEGIN
    UPDATE public."accounting_work_tasks"
       SET "status" = 'RESOLVED', "version" = "version" + 1
     WHERE "id" = 'pc-wt-manual';
    RAISE WARNING 'FAIL 78 the read principal cannot close a task -> update succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS 78 the read principal cannot close a task';
  END;

  IF failures > 0 THEN
    RAISE EXCEPTION 'pc-crop work task reads: % check(s) failed', failures;
  END IF;
  RAISE NOTICE 'pc-crop accounting contour: work task reads, 0 failures';
END;
$pc_crop_work_task_read_checks$;

RESET ROLE;
SET ROLE pc_accounting_command_authority;

---------------------------------------------------------------------------
-- Accounting periods. The platform is not the ledger, so what a close freezes
-- is exactly the document set the platform is authority for. These measure
-- that the confined principal can run a close and cannot re-cut one.
---------------------------------------------------------------------------

DO $pc_crop_accounting_period_checks$
DECLARE
  failures integer := 0;
BEGIN
  PERFORM set_config('app.current_user_id', 'user-a', true),
          set_config('app.current_org_id', 'org-a', true),
          set_config('app.current_tenant_id', 'tenant-a', true);

  ---------------------------------------------------------------------------
  -- 79. A member opens a period for their own organization, attributed to
  --     themselves.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."accounting_periods"(
      "id","tenantId","organizationId","periodStart","periodEnd",
      "openedByMembershipId"
    ) VALUES (
      'pc-per-a','tenant-a','org-a','2026-01-01T00:00:00Z',
      '2026-02-01T00:00:00Z','m-a');
    RAISE NOTICE 'PASS 79 a member opens a period';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'FAIL 79 a member opens a period -> %', SQLERRM;
    failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 80. Attribution cannot be handed to somebody else.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."accounting_periods"(
      "id","tenantId","organizationId","periodStart","periodEnd",
      "openedByMembershipId"
    ) VALUES (
      'pc-per-forged','tenant-a','org-a','2026-03-01T00:00:00Z',
      '2026-04-01T00:00:00Z','m-staff');
    RAISE WARNING 'FAIL 80 forged period attribution refused -> insert succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN
      RAISE NOTICE 'PASS 80 forged period attribution refused';
  END;

  ---------------------------------------------------------------------------
  -- 81. The window is not in the column grant. This measures the grant, not
  --     the guard: if the grant were widened the guard would still refuse, and
  --     the check must report that rather than pass.
  ---------------------------------------------------------------------------
  BEGIN
    UPDATE public."accounting_periods"
       SET "periodEnd" = '2026-01-15T00:00:00Z', "version" = "version" + 1
     WHERE "id" = 'pc-per-a';
    RAISE WARNING 'FAIL 81 a period window is not writable -> update succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS 81 a period window is not writable';
    WHEN raise_exception THEN
      RAISE WARNING
        'FAIL 81 a period window is not writable -> the column grant admitted the write and only the guard stopped it (%)',
        SQLERRM;
      failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 82. Running a close is permitted, and the database stamps the time.
  ---------------------------------------------------------------------------
  BEGIN
    UPDATE public."accounting_periods"
       SET "status" = 'CLOSING', "version" = "version" + 1
     WHERE "id" = 'pc-per-a';
    UPDATE public."accounting_periods"
       SET "status" = 'CLOSED', "closedByMembershipId" = 'm-a',
           "version" = "version" + 1
     WHERE "id" = 'pc-per-a';
    IF (SELECT "closedAt" FROM public."accounting_periods" WHERE "id" = 'pc-per-a')
       IS NULL THEN
      RAISE WARNING 'FAIL 82 a close is stamped by the database -> closedAt is null';
      failures := failures + 1;
    ELSE
      RAISE NOTICE 'PASS 82 a period closes and the database stamps the time';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'FAIL 82 a period closes -> %', SQLERRM;
    failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 83. A closed period is not selected for update by this principal at all,
  --     so reopening never reaches the guard.
  ---------------------------------------------------------------------------
  BEGIN
    UPDATE public."accounting_periods"
       SET "status" = 'OPEN', "version" = "version" + 1
     WHERE "id" = 'pc-per-a';
    IF (SELECT "status" FROM public."accounting_periods" WHERE "id" = 'pc-per-a')
       = 'CLOSED' THEN
      RAISE NOTICE 'PASS 83 a closed period is unreachable for update';
    ELSE
      RAISE WARNING 'FAIL 83 a closed period is unreachable for update -> it moved';
      failures := failures + 1;
    END IF;
  EXCEPTION
    WHEN raise_exception THEN
      RAISE WARNING
        'FAIL 83 a closed period is unreachable for update -> the row policy admitted it and only the guard stopped it (%)',
        SQLERRM;
      failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 84. A period is never deleted: the documents inside it would become
  --     unattributable to any close.
  ---------------------------------------------------------------------------
  BEGIN
    DELETE FROM public."accounting_periods" WHERE "id" = 'pc-per-a';
    RAISE WARNING 'FAIL 84 a period cannot be deleted -> delete succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS 84 a period cannot be deleted';
  END;

  ---------------------------------------------------------------------------
  -- 85. And none of it reaches another organization.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."accounting_periods"(
      "id","tenantId","organizationId","periodStart","periodEnd",
      "openedByMembershipId"
    ) VALUES (
      'pc-per-cross','tenant-b','org-b','2026-05-01T00:00:00Z',
      '2026-06-01T00:00:00Z','m-b');
    RAISE WARNING 'FAIL 85 cross-organization period refused -> insert succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege OR check_violation OR foreign_key_violation THEN
      RAISE NOTICE 'PASS 85 cross-organization period refused';
  END;

  IF failures > 0 THEN
    RAISE EXCEPTION 'pc-crop accounting periods: % check(s) failed', failures;
  END IF;
  RAISE NOTICE 'pc-crop accounting contour: period close, 0 failures';
END;
$pc_crop_accounting_period_checks$;

RESET ROLE;

RESET ROLE;
SET ROLE pc_accounting_command_authority;

---------------------------------------------------------------------------
-- Advances. The remaining balance of an advance is the sum of its offsets and
-- nothing else, so what matters here is that the confined principal can add
-- offsets and cannot edit or remove one — and that neither the grant nor the
-- policy lets it attribute an offset to somebody else or reach another
-- organization's advance.
---------------------------------------------------------------------------

DO $pc_crop_advance_checks$
DECLARE
  failures integer := 0;
BEGIN
  PERFORM set_config('app.current_user_id', 'user-a', true),
          set_config('app.current_org_id', 'org-a', true),
          set_config('app.current_tenant_id', 'tenant-a', true);

  ---------------------------------------------------------------------------
  -- 86. A member records an advance against confirmed money, attributed to
  --     themselves.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."accounting_advances"(
      "id","tenantId","organizationId","dealId","counterpartyOrgId",
      "amountKopecks","currency","receivedAt","bankOperationId",
      "recordedByMembershipId"
    ) VALUES (
      'pc-adv-a','tenant-a','org-a','pc-deal-adv','org-b',100000,'RUB',
      '2026-03-10T00:00:00Z','pc-op-adv','m-a');
    RAISE NOTICE 'PASS 86 a member records an advance';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'FAIL 86 a member records an advance -> %', SQLERRM;
    failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 87. Attributing the record to another membership is refused by the policy,
  --     not merely discouraged.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."accounting_advances"(
      "id","tenantId","organizationId","dealId","counterpartyOrgId",
      "amountKopecks","currency","receivedAt","bankOperationId",
      "recordedByMembershipId"
    ) VALUES (
      'pc-adv-forged','tenant-a','org-a','pc-deal-adv','org-b',100000,'RUB',
      '2026-03-10T00:00:00Z','pc-op-adv','m-staff');
    RAISE WARNING 'FAIL 87 forged advance attribution refused -> insert succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN
      RAISE NOTICE 'PASS 87 forged advance attribution refused';
  END;

  ---------------------------------------------------------------------------
  -- 88. Evidence that has not been confirmed buys nothing.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."accounting_advances"(
      "id","tenantId","organizationId","dealId","counterpartyOrgId",
      "amountKopecks","currency","receivedAt","bankOperationId",
      "recordedByMembershipId"
    ) VALUES (
      'pc-adv-pending','tenant-a','org-a','pc-deal-adv','org-b',100000,'RUB',
      '2026-03-11T00:00:00Z','pc-op-pending','m-a');
    RAISE WARNING 'FAIL 88 unconfirmed evidence refused -> insert succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN raise_exception THEN
      RAISE NOTICE 'PASS 88 unconfirmed evidence refused';
  END;

  ---------------------------------------------------------------------------
  -- 89. Offsets accumulate while they fit.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."accounting_advance_offsets"(
      "id","tenantId","organizationId","advanceId","amountKopecks","appliedAt",
      "reason","idempotencyKey","appliedByMembershipId"
    ) VALUES (
      'pc-advoff-a','tenant-a','org-a','pc-adv-a',60000,
      '2026-03-20T00:00:00Z','against delivery','pc-advoff-a-key','m-a');
    RAISE NOTICE 'PASS 89 an offset within the advance is accepted';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'FAIL 89 an offset within the advance -> %', SQLERRM;
    failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 90. And stop exactly at what arrived.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."accounting_advance_offsets"(
      "id","tenantId","organizationId","advanceId","amountKopecks","appliedAt",
      "reason","idempotencyKey","appliedByMembershipId"
    ) VALUES (
      'pc-advoff-over','tenant-a','org-a','pc-adv-a',50000,
      '2026-03-21T00:00:00Z','over','pc-advoff-over-key','m-a');
    RAISE WARNING 'FAIL 90 an offset past the advance refused -> insert succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN raise_exception THEN
      RAISE NOTICE 'PASS 90 an offset past the advance refused';
  END;

  ---------------------------------------------------------------------------
  -- 91. An offset is not editable, at the privilege level.
  ---------------------------------------------------------------------------
  BEGIN
    UPDATE public."accounting_advance_offsets"
       SET "amountKopecks" = 1 WHERE "id" = 'pc-advoff-a';
    RAISE WARNING 'FAIL 91 an offset is not editable -> update succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS 91 an offset is not editable';
    WHEN raise_exception THEN
      RAISE WARNING
        'FAIL 91 an offset is not editable -> the grant admitted the write and only the trigger stopped it (%)',
        SQLERRM;
      failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 92. Nor removable.
  ---------------------------------------------------------------------------
  BEGIN
    DELETE FROM public."accounting_advance_offsets" WHERE "id" = 'pc-advoff-a';
    RAISE WARNING 'FAIL 92 an offset is not removable -> delete succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS 92 an offset is not removable';
    WHEN raise_exception THEN
      RAISE WARNING
        'FAIL 92 an offset is not removable -> the grant admitted the delete and only the trigger stopped it (%)',
        SQLERRM;
      failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 93. Forged offset attribution refused.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."accounting_advance_offsets"(
      "id","tenantId","organizationId","advanceId","amountKopecks","appliedAt",
      "reason","idempotencyKey","appliedByMembershipId"
    ) VALUES (
      'pc-advoff-forged','tenant-a','org-a','pc-adv-a',1,
      '2026-03-22T00:00:00Z','forged','pc-advoff-forged-key','m-staff');
    RAISE WARNING 'FAIL 93 forged offset attribution refused -> insert succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN
      RAISE NOTICE 'PASS 93 forged offset attribution refused';
  END;

  ---------------------------------------------------------------------------
  -- 94. Claiming another organization's context buys nothing. The principal can
  --     set app.current_org_id itself, which is exactly why this is measured.
  ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('app.current_org_id', 'org-b', true),
            set_config('app.current_tenant_id', 'tenant-b', true);
    IF EXISTS (SELECT 1 FROM public."accounting_advances" WHERE "id" = 'pc-adv-a')
    THEN
      RAISE WARNING
        'FAIL 94 a forged organization sees nothing -> org-a advance was visible';
      failures := failures + 1;
    ELSE
      RAISE NOTICE 'PASS 94 a forged organization sees nothing';
    END IF;
    PERFORM set_config('app.current_org_id', 'org-a', true),
            set_config('app.current_tenant_id', 'tenant-a', true);
  END;

  ---------------------------------------------------------------------------
  -- 95. An advance is never deleted: the offsets against it would become
  --     unattributable to any money that arrived.
  ---------------------------------------------------------------------------
  BEGIN
    DELETE FROM public."accounting_advances" WHERE "id" = 'pc-adv-a';
    RAISE WARNING 'FAIL 95 an advance cannot be deleted -> delete succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS 95 an advance cannot be deleted';
  END;

  ---------------------------------------------------------------------------
  -- 96. The command principal can read the evidence — through the definer
  --     function and only through it. Without this the whole advance path
  --     fails closed, so the negative check below has to be paired with it.
  ---------------------------------------------------------------------------
  BEGIN
    IF (
      SELECT "status" FROM public.app_pc_crop_advance_evidence('pc-op-adv')
    ) = 'CONFIRMED' THEN
      RAISE NOTICE 'PASS 96 the command principal reads the cited operation';
    ELSE
      RAISE WARNING
        'FAIL 96 the command principal reads the cited operation -> wrong status';
      failures := failures + 1;
    END IF;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE WARNING
        'FAIL 96 the command principal reads the cited operation -> execute denied';
      failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 97. The bank ledger itself stays out of reach. The definer function is the
  --     only door, and it opens for one operation at a time.
  ---------------------------------------------------------------------------
  BEGIN
    PERFORM 1 FROM public."bank_operations" WHERE "id" = 'pc-op-adv';
    RAISE WARNING
      'FAIL 97 the bank ledger is not readable directly -> select succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS 97 the bank ledger is not readable directly';
  END;

  IF failures > 0 THEN
    RAISE EXCEPTION 'pc-crop advances: % check(s) failed', failures;
  END IF;
  RAISE NOTICE 'pc-crop accounting contour: advances, 0 failures';
END;
$pc_crop_advance_checks$;

RESET ROLE;

-- The read principal, measured against the same door -------------------------
--
-- The definer function runs with the bootstrap role's privilege on
-- bank_operations. Executing it is therefore a privilege in its own right, and
-- the read principal of this contour has no business holding it: nothing on the
-- read path consults a bank operation. Measured here rather than asserted,
-- because the difference between this and an open EXECUTE is invisible in the
-- function body.
SET ROLE pc_accounting_authority;

DO $pc_crop_advance_evidence_boundary$
DECLARE
  failures int := 0;
BEGIN
  PERFORM set_config('app.current_user_id', 'u-acc-a', true),
          set_config('app.current_org_id', 'org-a', true),
          set_config('app.current_tenant_id', 'tenant-a', true);

  ---------------------------------------------------------------------------
  -- 98. The read principal cannot execute the evidence definer.
  ---------------------------------------------------------------------------
  BEGIN
    PERFORM * FROM public.app_pc_crop_advance_evidence('pc-op-adv');
    RAISE WARNING
      'FAIL 98 the read principal cannot reach the bank ledger -> execute succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS 98 the read principal cannot reach the bank ledger';
  END;

  IF failures > 0 THEN
    RAISE EXCEPTION
      'pc-crop advance evidence boundary: % check(s) failed', failures;
  END IF;
  RAISE NOTICE
    'pc-crop accounting contour: advance evidence boundary, 0 failures';
END;
$pc_crop_advance_evidence_boundary$;

-- Service lines, as the confined command principal ---------------------------
--
-- A service charge is the other half of what a deal costs, and unlike a price it
-- is calculated rather than agreed: tonnage, days, a rate. These measure that the
-- confined principal can raise a line and cannot make it say more than its own
-- terms support, cannot approve its own, and cannot reprice one afterwards.
SET ROLE pc_accounting_command_authority;

DO $pc_crop_deal_service_checks$
DECLARE
  failures integer := 0;
  measured bigint;
BEGIN
  PERFORM set_config('app.current_user_id', 'user-a', true),
          set_config('app.current_org_id', 'org-a', true),
          set_config('app.current_tenant_id', 'tenant-a', true);

  ---------------------------------------------------------------------------
  -- 99. A member records storage on their own deal: 40 tons for 10 days at 3
  --     roubles a ton-day, which is 1200 roubles and nothing else.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."accounting_deal_services"(
      "id","tenantId","organizationId","dealId","counterpartyOrgId","kind",
      "unit","quantityMilliUnits","tonnageMilliTons","periodFrom","periodTo",
      "rateKopecks","amountKopecks","currency","renderedAt",
      "recordedByMembershipId","idempotencyKey"
    ) VALUES (
      'pc-svc-a','tenant-a','org-a','pc-deal-adv','org-b','STORAGE','TON_DAY',
      400000,40000,'2026-09-01T00:00:00Z','2026-09-11T00:00:00Z',300,120000,
      'RUB','2026-09-11T00:00:00Z','m-a','pc-svc-a-key');
    RAISE NOTICE 'PASS 99 a member records a service line';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'FAIL 99 a member records a service line -> %', SQLERRM;
    failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 100. Attribution cannot be handed to somebody else. The two-person rule
  --      below is only worth having if the first of the two names is honest.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."accounting_deal_services"(
      "id","tenantId","organizationId","dealId","counterpartyOrgId","kind",
      "unit","quantityMilliUnits","tonnageMilliTons","periodFrom","periodTo",
      "rateKopecks","amountKopecks","currency","renderedAt",
      "recordedByMembershipId","idempotencyKey"
    ) VALUES (
      'pc-svc-forged','tenant-a','org-a','pc-deal-adv','org-b','STORAGE',
      'TON_DAY',400000,40000,'2026-09-01T00:00:00Z','2026-09-11T00:00:00Z',300,
      120000,'RUB','2026-09-11T00:00:00Z','m-staff','pc-svc-forged-key');
    RAISE WARNING 'FAIL 100 forged service attribution refused -> insert succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN
      RAISE NOTICE 'PASS 100 forged service attribution refused';
  END;

  ---------------------------------------------------------------------------
  -- 101. A total that does not follow from the quantity and the rate.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."accounting_deal_services"(
      "id","tenantId","organizationId","dealId","counterpartyOrgId","kind",
      "unit","quantityMilliUnits","tonnageMilliTons","periodFrom","periodTo",
      "rateKopecks","amountKopecks","currency","renderedAt",
      "recordedByMembershipId","idempotencyKey"
    ) VALUES (
      'pc-svc-inflated','tenant-a','org-a','pc-deal-adv','org-b','STORAGE',
      'TON_DAY',400000,40000,'2026-09-01T00:00:00Z','2026-09-11T00:00:00Z',300,
      999999,'RUB','2026-09-11T00:00:00Z','m-a','pc-svc-inflated-key');
    RAISE WARNING 'FAIL 101 an invented total refused -> insert succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE 'PASS 101 an invented total refused';
  END;

  ---------------------------------------------------------------------------
  -- 102. More ton-days than the window and the tonnage support. This is the
  --      arithmetic a storage charge is inflated through, and the total below
  --      is internally consistent — only the ton-days are not.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."accounting_deal_services"(
      "id","tenantId","organizationId","dealId","counterpartyOrgId","kind",
      "unit","quantityMilliUnits","tonnageMilliTons","periodFrom","periodTo",
      "rateKopecks","amountKopecks","currency","renderedAt",
      "recordedByMembershipId","idempotencyKey"
    ) VALUES (
      'pc-svc-tondays','tenant-a','org-a','pc-deal-adv','org-b','STORAGE',
      'TON_DAY',500000,40000,'2026-09-01T00:00:00Z','2026-09-11T00:00:00Z',300,
      150000,'RUB','2026-09-11T00:00:00Z','m-a','pc-svc-tondays-key');
    RAISE WARNING 'FAIL 102 ton-days beyond the window refused -> insert succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE 'PASS 102 ton-days beyond the window refused';
  END;

  ---------------------------------------------------------------------------
  -- 103. The membership that raised the line does not approve it.
  ---------------------------------------------------------------------------
  BEGIN
    UPDATE public."accounting_deal_services"
       SET "status" = 'APPROVED', "approvedByMembershipId" = 'm-a',
           "version" = "version" + 1
     WHERE "id" = 'pc-svc-a';
    RAISE WARNING 'FAIL 103 self-approval refused -> update succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege OR check_violation OR raise_exception THEN
      RAISE NOTICE 'PASS 103 self-approval refused';
  END;

  ---------------------------------------------------------------------------
  -- 104. A second membership in the same organization approves, and the
  --      database stamps the time rather than taking the one offered.
  ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('app.current_user_id', 'user-both', true);
    UPDATE public."accounting_deal_services"
       SET "status" = 'APPROVED', "approvedByMembershipId" = 'm-both-a',
           "approvedAt" = '2020-01-01T00:00:00Z',
           "version" = "version" + 1
     WHERE "id" = 'pc-svc-a';
    SELECT EXTRACT(YEAR FROM "approvedAt")::bigint INTO measured
      FROM public."accounting_deal_services" WHERE "id" = 'pc-svc-a';
    IF measured > 2020 THEN
      RAISE NOTICE 'PASS 104 a second person approves and the time is stamped';
    ELSE
      RAISE WARNING
        'FAIL 104 a second person approves and the time is stamped -> antedated to %',
        measured;
      failures := failures + 1;
    END IF;
    PERFORM set_config('app.current_user_id', 'user-a', true);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'FAIL 104 a second person approves -> %', SQLERRM;
    failures := failures + 1;
    PERFORM set_config('app.current_user_id', 'user-a', true);
  END;

  ---------------------------------------------------------------------------
  -- 105. The priced terms are not in the column grant. This measures the grant
  --      rather than the guard: were the grant widened the guard would still
  --      refuse, and the check must report that instead of passing.
  ---------------------------------------------------------------------------
  BEGIN
    UPDATE public."accounting_deal_services"
       SET "rateKopecks" = 1, "amountKopecks" = 400, "version" = "version" + 1
     WHERE "id" = 'pc-svc-a';
    RAISE WARNING 'FAIL 105 a service line is not repriceable -> update succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS 105 a service line is not repriceable';
    WHEN raise_exception THEN
      RAISE WARNING
        'FAIL 105 a service line is not repriceable -> the grant admitted the update and only the trigger stopped it (%)',
        SQLERRM;
      failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 106. A rendered service either happened or it did not; the line stays.
  ---------------------------------------------------------------------------
  BEGIN
    DELETE FROM public."accounting_deal_services" WHERE "id" = 'pc-svc-a';
    RAISE WARNING 'FAIL 106 a service line cannot be deleted -> delete succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS 106 a service line cannot be deleted';
    WHEN raise_exception THEN
      RAISE WARNING
        'FAIL 106 a service line cannot be deleted -> the grant admitted the delete and only the trigger stopped it (%)',
        SQLERRM;
      failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 107. A reversal that cancels a large charge with a small one.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."accounting_deal_services"(
      "id","tenantId","organizationId","dealId","counterpartyOrgId","kind",
      "unit","quantityMilliUnits","tonnageMilliTons","periodFrom","periodTo",
      "rateKopecks","amountKopecks","currency","renderedAt",
      "recordedByMembershipId","reversesServiceId","idempotencyKey"
    ) VALUES (
      'pc-svc-cheaprev','tenant-a','org-a','pc-deal-adv','org-b','STORAGE',
      'TON_DAY',40000,4000,'2026-09-01T00:00:00Z','2026-09-11T00:00:00Z',300,
      12000,'RUB','2026-09-12T00:00:00Z','m-a','pc-svc-a',
      'pc-svc-cheaprev-key');
    RAISE WARNING 'FAIL 107 a mismatched reversal refused -> insert succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN raise_exception THEN
      RAISE NOTICE 'PASS 107 a mismatched reversal refused';
  END;

  ---------------------------------------------------------------------------
  -- 108. A line on another organization's books.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."accounting_deal_services"(
      "id","tenantId","organizationId","dealId","counterpartyOrgId","kind",
      "unit","quantityMilliUnits","tonnageMilliTons","periodFrom","periodTo",
      "rateKopecks","amountKopecks","currency","renderedAt",
      "recordedByMembershipId","idempotencyKey"
    ) VALUES (
      'pc-svc-cross','tenant-b','org-b','pc-deal-adv','org-a','STORAGE',
      'TON_DAY',400000,40000,'2026-09-01T00:00:00Z','2026-09-11T00:00:00Z',300,
      120000,'RUB','2026-09-11T00:00:00Z','m-b','pc-svc-cross-key');
    RAISE WARNING 'FAIL 108 cross-organization service refused -> insert succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege OR check_violation OR foreign_key_violation THEN
      RAISE NOTICE 'PASS 108 cross-organization service refused';
  END;

  ---------------------------------------------------------------------------
  -- 109. Claiming another organization's context buys nothing. The principal
  --      can set app.current_org_id itself, which is why this is measured.
  ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('app.current_org_id', 'org-b', true),
            set_config('app.current_tenant_id', 'tenant-b', true);
    IF EXISTS (
      SELECT 1 FROM public."accounting_deal_services" WHERE "id" = 'pc-svc-a'
    ) THEN
      RAISE WARNING
        'FAIL 109 a forged organization sees no service lines -> org-a line was visible';
      failures := failures + 1;
    ELSE
      RAISE NOTICE 'PASS 109 a forged organization sees no service lines';
    END IF;
    PERFORM set_config('app.current_org_id', 'org-a', true),
            set_config('app.current_tenant_id', 'tenant-a', true);
  END;

  IF failures > 0 THEN
    RAISE EXCEPTION 'pc-crop deal services: % check(s) failed', failures;
  END IF;
  RAISE NOTICE 'pc-crop accounting contour: deal services, 0 failures';
END;
$pc_crop_deal_service_checks$;

RESET ROLE;

-- Service lines, as the read principal ---------------------------------------
SET ROLE pc_accounting_authority;

DO $pc_crop_deal_service_read_checks$
DECLARE
  failures integer := 0;
  measured bigint;
BEGIN
  PERFORM set_config('app.current_user_id', 'user-a', true),
          set_config('app.current_org_id', 'org-a', true),
          set_config('app.current_tenant_id', 'tenant-a', true);

  ---------------------------------------------------------------------------
  -- 110. The read principal reads its own organization's lines.
  ---------------------------------------------------------------------------
  SELECT count(*) INTO measured
    FROM public."accounting_deal_services" WHERE "dealId" = 'pc-deal-adv';
  IF measured = 1 THEN
    RAISE NOTICE 'PASS 110 the read principal reads its own lines -> %', measured;
  ELSE
    RAISE WARNING
      'FAIL 110 the read principal reads its own lines -> % (want 1)', measured;
    failures := failures + 1;
  END IF;

  ---------------------------------------------------------------------------
  -- 111. And writes none of them.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."accounting_deal_services"(
      "id","tenantId","organizationId","dealId","counterpartyOrgId","kind",
      "unit","quantityMilliUnits","tonnageMilliTons","periodFrom","periodTo",
      "rateKopecks","amountKopecks","currency","renderedAt",
      "recordedByMembershipId","idempotencyKey"
    ) VALUES (
      'pc-svc-read','tenant-a','org-a','pc-deal-adv','org-b','STORAGE',
      'TON_DAY',400000,40000,'2026-09-01T00:00:00Z','2026-09-11T00:00:00Z',300,
      120000,'RUB','2026-09-11T00:00:00Z','m-a','pc-svc-read-key');
    RAISE WARNING
      'FAIL 111 the read principal records nothing -> insert succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS 111 the read principal records nothing';
  END;

  ---------------------------------------------------------------------------
  -- 112. Nor approves one. Approval is what turns a line into money owed.
  ---------------------------------------------------------------------------
  BEGIN
    UPDATE public."accounting_deal_services"
       SET "status" = 'REJECTED', "version" = "version" + 1
     WHERE "id" = 'pc-svc-a';
    RAISE WARNING
      'FAIL 112 the read principal decides nothing -> update succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS 112 the read principal decides nothing';
  END;

  IF failures > 0 THEN
    RAISE EXCEPTION
      'pc-crop deal service reads: % check(s) failed', failures;
  END IF;
  RAISE NOTICE 'pc-crop accounting contour: deal service reads, 0 failures';
END;
$pc_crop_deal_service_read_checks$;

-- Payments and allocations, as the confined command principal ----------------
--
-- A payment is money the bank already moved, so the questions here are whether
-- it can be counted twice and whether more can be allocated from it than moved.
SET ROLE pc_accounting_command_authority;

DO $pc_crop_payment_checks$
DECLARE
  failures integer := 0;
BEGIN
  PERFORM set_config('app.current_user_id', 'user-a', true),
          set_config('app.current_org_id', 'org-a', true),
          set_config('app.current_tenant_id', 'tenant-a', true);

  ---------------------------------------------------------------------------
  -- 113. A member records a payment against a confirmed transfer.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."accounting_payments"(
      "id","tenantId","organizationId","dealId","counterpartyOrgId","direction",
      "amountKopecks","currency","paidAt","bankOperationId",
      "recordedByMembershipId","idempotencyKey"
    ) VALUES (
      'pc-pay-a','tenant-a','org-a','pc-deal-adv','org-b','INCOMING',100000,
      'RUB','2026-09-12T00:00:00Z','pc-op-pay','m-a','pc-pay-a-key');
    RAISE NOTICE 'PASS 113 a member records a payment';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'FAIL 113 a member records a payment -> %', SQLERRM;
    failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 114. The same transfer is not both an advance and a payment. The bank
  --      moved the money once; counted twice it would settle a debt twice.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."accounting_payments"(
      "id","tenantId","organizationId","dealId","counterpartyOrgId","direction",
      "amountKopecks","currency","paidAt","bankOperationId",
      "recordedByMembershipId","idempotencyKey"
    ) VALUES (
      'pc-pay-dual','tenant-a','org-a','pc-deal-adv','org-b','INCOMING',100000,
      'RUB','2026-09-12T00:00:00Z','pc-op-adv','m-a','pc-pay-dual-key');
    RAISE WARNING
      'FAIL 114 a transfer already spent as an advance refused -> insert succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN raise_exception THEN
      RAISE NOTICE 'PASS 114 a transfer already spent as an advance refused';
  END;

  ---------------------------------------------------------------------------
  -- 115. Attribution cannot be handed to somebody else.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."accounting_payments"(
      "id","tenantId","organizationId","dealId","counterpartyOrgId","direction",
      "amountKopecks","currency","paidAt","bankOperationId",
      "recordedByMembershipId","idempotencyKey"
    ) VALUES (
      'pc-pay-forged','tenant-a','org-a','pc-deal-adv','org-b','INCOMING',100000,
      'RUB','2026-09-12T00:00:00Z','pc-op-pay','m-staff','pc-pay-forged-key');
    RAISE WARNING 'FAIL 115 forged payment attribution refused -> insert succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege OR check_violation OR unique_violation THEN
      RAISE NOTICE 'PASS 115 forged payment attribution refused';
  END;

  ---------------------------------------------------------------------------
  -- 116. An allocation against the approved service line from check 104.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."accounting_payment_allocations"(
      "id","tenantId","organizationId","paymentId","dealServiceId",
      "amountKopecks","allocatedAt","reason","idempotencyKey",
      "allocatedByMembershipId"
    ) VALUES (
      'pc-payall-a','tenant-a','org-a','pc-pay-a','pc-svc-a',60000,
      '2026-09-13T00:00:00Z','against the storage act','pc-payall-a-key','m-a');
    RAISE NOTICE 'PASS 116 an allocation within the payment is accepted';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'FAIL 116 an allocation within the payment is accepted -> %',
      SQLERRM;
    failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 117. And not a kopeck past what was paid.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."accounting_payment_allocations"(
      "id","tenantId","organizationId","paymentId","dealServiceId",
      "amountKopecks","allocatedAt","reason","idempotencyKey",
      "allocatedByMembershipId"
    ) VALUES (
      'pc-payall-over','tenant-a','org-a','pc-pay-a','pc-svc-a',40001,
      '2026-09-13T00:00:00Z','over','pc-payall-over-key','m-a');
    RAISE WARNING 'FAIL 117 an allocation past the payment refused -> insert succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN raise_exception THEN
      RAISE NOTICE 'PASS 117 an allocation past the payment refused';
  END;

  ---------------------------------------------------------------------------
  -- 118. An allocation is not editable. Measured against the grant: were the
  --      grant widened the trigger would still refuse, and this must report
  --      that rather than pass.
  ---------------------------------------------------------------------------
  BEGIN
    UPDATE public."accounting_payment_allocations"
       SET "amountKopecks" = 1 WHERE "id" = 'pc-payall-a';
    RAISE WARNING 'FAIL 118 an allocation is not editable -> update succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS 118 an allocation is not editable';
    WHEN raise_exception THEN
      RAISE WARNING
        'FAIL 118 an allocation is not editable -> the grant admitted the update and only the trigger stopped it (%)',
        SQLERRM;
      failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 119. A payment is never deleted: the money moved.
  ---------------------------------------------------------------------------
  BEGIN
    DELETE FROM public."accounting_payments" WHERE "id" = 'pc-pay-a';
    RAISE WARNING 'FAIL 119 a payment cannot be deleted -> delete succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS 119 a payment cannot be deleted';
    WHEN raise_exception THEN
      RAISE WARNING
        'FAIL 119 a payment cannot be deleted -> the grant admitted the delete and only the trigger stopped it (%)',
        SQLERRM;
      failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 120. A forged organization context buys nothing.
  ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('app.current_org_id', 'org-b', true),
            set_config('app.current_tenant_id', 'tenant-b', true);
    IF EXISTS (SELECT 1 FROM public."accounting_payments" WHERE "id" = 'pc-pay-a')
    THEN
      RAISE WARNING
        'FAIL 120 a forged organization sees no payments -> org-a payment was visible';
      failures := failures + 1;
    ELSE
      RAISE NOTICE 'PASS 120 a forged organization sees no payments';
    END IF;
    PERFORM set_config('app.current_org_id', 'org-a', true),
            set_config('app.current_tenant_id', 'tenant-a', true);
  END;

  IF failures > 0 THEN
    RAISE EXCEPTION 'pc-crop payments: % check(s) failed', failures;
  END IF;
  RAISE NOTICE 'pc-crop accounting contour: payments, 0 failures';
END;
$pc_crop_payment_checks$;

RESET ROLE;

-- Payments, as the read principal --------------------------------------------
SET ROLE pc_accounting_authority;

DO $pc_crop_payment_read_checks$
DECLARE
  failures integer := 0;
  measured bigint;
BEGIN
  PERFORM set_config('app.current_user_id', 'user-a', true),
          set_config('app.current_org_id', 'org-a', true),
          set_config('app.current_tenant_id', 'tenant-a', true);

  ---------------------------------------------------------------------------
  -- 121. The read principal reads its own organization's payments.
  ---------------------------------------------------------------------------
  SELECT count(*) INTO measured
    FROM public."accounting_payments" WHERE "dealId" = 'pc-deal-adv';
  IF measured = 1 THEN
    RAISE NOTICE 'PASS 121 the read principal reads its own payments -> %', measured;
  ELSE
    RAISE WARNING
      'FAIL 121 the read principal reads its own payments -> % (want 1)', measured;
    failures := failures + 1;
  END IF;

  ---------------------------------------------------------------------------
  -- 122. And allocates nothing.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."accounting_payment_allocations"(
      "id","tenantId","organizationId","paymentId","dealServiceId",
      "amountKopecks","allocatedAt","reason","idempotencyKey",
      "allocatedByMembershipId"
    ) VALUES (
      'pc-payall-read','tenant-a','org-a','pc-pay-a','pc-svc-a',1,
      '2026-09-13T00:00:00Z','read','pc-payall-read-key','m-a');
    RAISE WARNING 'FAIL 122 the read principal allocates nothing -> insert succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS 122 the read principal allocates nothing';
  END;

  IF failures > 0 THEN
    RAISE EXCEPTION 'pc-crop payment reads: % check(s) failed', failures;
  END IF;
  RAISE NOTICE 'pc-crop accounting contour: payment reads, 0 failures';
END;
$pc_crop_payment_read_checks$;

-- Reconciliation statements, as the confined command principal ---------------
SET ROLE pc_accounting_command_authority;

DO $pc_crop_reconciliation_checks$
DECLARE
  failures integer := 0;
BEGIN
  PERFORM set_config('app.current_user_id', 'user-a', true),
          set_config('app.current_org_id', 'org-a', true),
          set_config('app.current_tenant_id', 'tenant-a', true);

  ---------------------------------------------------------------------------
  -- 123. A member prepares a statement for their own organization.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."accounting_reconciliations"(
      "id","tenantId","organizationId","dealId","counterpartyOrgId",
      "periodStart","periodEnd","currency","openingBalanceKopecks",
      "chargedKopecks","reversedKopecks","paidKopecks","advanceAppliedKopecks",
      "closingBalanceKopecks","payloadHash","preparedByMembershipId"
    ) VALUES (
      'pc-rec-a','tenant-a','org-a','pc-deal-adv','org-b',
      '2026-09-01T00:00:00Z','2026-10-01T00:00:00Z','RUB',0,
      120000,0,60000,0,60000,repeat('a',64),'m-a');
    RAISE NOTICE 'PASS 123 a member prepares a reconciliation';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'FAIL 123 a member prepares a reconciliation -> %', SQLERRM;
    failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 124. A bottom line that does not follow from the figures above it. This is
  --      the number the counterparty compares against their own books.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."accounting_reconciliations"(
      "id","tenantId","organizationId","dealId","counterpartyOrgId",
      "periodStart","periodEnd","currency","openingBalanceKopecks",
      "chargedKopecks","reversedKopecks","paidKopecks","advanceAppliedKopecks",
      "closingBalanceKopecks","payloadHash","preparedByMembershipId"
    ) VALUES (
      'pc-rec-invented','tenant-a','org-a','pc-deal-adv','org-b',
      '2026-11-01T00:00:00Z','2026-12-01T00:00:00Z','RUB',0,
      100,0,0,0,999,repeat('b',64),'m-a');
    RAISE WARNING 'FAIL 124 an invented bottom line refused -> insert succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE 'PASS 124 an invented bottom line refused';
  END;

  ---------------------------------------------------------------------------
  -- 125. Two statements covering the same days would give the counterparty two
  --      bottom lines to agree with.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."accounting_reconciliations"(
      "id","tenantId","organizationId","dealId","counterpartyOrgId",
      "periodStart","periodEnd","currency","openingBalanceKopecks",
      "chargedKopecks","reversedKopecks","paidKopecks","advanceAppliedKopecks",
      "closingBalanceKopecks","payloadHash","preparedByMembershipId"
    ) VALUES (
      'pc-rec-overlap','tenant-a','org-a','pc-deal-adv','org-b',
      '2026-09-15T00:00:00Z','2026-10-15T00:00:00Z','RUB',0,
      0,0,0,0,0,repeat('c',64),'m-a');
    RAISE WARNING 'FAIL 125 an overlapping window refused -> insert succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN raise_exception THEN
      RAISE NOTICE 'PASS 125 an overlapping window refused';
  END;

  ---------------------------------------------------------------------------
  -- 126. The figures are not in the column grant. Measured against the grant,
  --      not the guard.
  ---------------------------------------------------------------------------
  BEGIN
    UPDATE public."accounting_reconciliations"
       SET "chargedKopecks" = 1, "version" = "version" + 1
     WHERE "id" = 'pc-rec-a';
    RAISE WARNING 'FAIL 126 a statement is not rewritable -> update succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS 126 a statement is not rewritable';
    WHEN raise_exception THEN
      RAISE WARNING
        'FAIL 126 a statement is not rewritable -> the grant admitted the update and only the trigger stopped it (%)',
        SQLERRM;
      failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 127. The membership that prepared a statement does not answer it.
  ---------------------------------------------------------------------------
  BEGIN
    UPDATE public."accounting_reconciliations"
       SET "status" = 'AGREED', "respondedByMembershipId" = 'm-a',
           "version" = "version" + 1
     WHERE "id" = 'pc-rec-a';
    RAISE WARNING 'FAIL 127 self-agreement refused -> update succeeded';
    failures := failures + 1;
  EXCEPTION
    WHEN insufficient_privilege OR check_violation OR raise_exception THEN
      RAISE NOTICE 'PASS 127 self-agreement refused';
  END;

  ---------------------------------------------------------------------------
  -- 128. A second membership answers, and the database stamps the time.
  ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('app.current_user_id', 'user-both', true);
    UPDATE public."accounting_reconciliations"
       SET "status" = 'AGREED', "respondedByMembershipId" = 'm-both-a',
           "respondedAt" = '2020-01-01T00:00:00Z',
           "version" = "version" + 1
     WHERE "id" = 'pc-rec-a';
    IF (SELECT EXTRACT(YEAR FROM "respondedAt")::bigint
          FROM public."accounting_reconciliations" WHERE "id" = 'pc-rec-a') > 2020
    THEN
      RAISE NOTICE 'PASS 128 a second person answers and the time is stamped';
    ELSE
      RAISE WARNING
        'FAIL 128 a second person answers and the time is stamped -> antedated';
      failures := failures + 1;
    END IF;
    PERFORM set_config('app.current_user_id', 'user-a', true);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'FAIL 128 a second person answers -> %', SQLERRM;
    failures := failures + 1;
    PERFORM set_config('app.current_user_id', 'user-a', true);
  END;

  IF failures > 0 THEN
    RAISE EXCEPTION 'pc-crop reconciliations: % check(s) failed', failures;
  END IF;
  RAISE NOTICE 'pc-crop accounting contour: reconciliations, 0 failures';
END;
$pc_crop_reconciliation_checks$;

-- Provider-neutral attestation, as the confined command principal -----------
--
-- The governance artefact is the FGIS contour's attestation table, extended
-- rather than duplicated. These checks are about the extension: that a neutral
-- subject is governed by the database, that the FGIS guarantee survived losing
-- its blanket NOT NULL, and that the accounting principals reach the neutral
-- rows without reaching the FGIS ones.
SET ROLE pc_accounting_command_authority;

DO $pc_crop_connection_attestation_checks$
DECLARE
  failures integer := 0;
  subject_a text := 'pc-conn-subject-a';
  first_id text;
  second_id text;
  gates integer;
BEGIN
  PERFORM set_config('app.current_user_id', 'user-a', true),
          set_config('app.current_org_id', 'org-a', true),
          set_config('app.current_tenant_id', 'tenant-a', true);

  ---------------------------------------------------------------------------
  -- 129. A member registers a subject for their own organization.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."connection_attestation_subjects"(
      "id","tenantId","organizationId","connectionKind","providerCode",
      "environment","createdByMembershipId"
    ) VALUES (
      subject_a, 'tenant-a', 'org-a', 'EDO', 'DIADOC', 'PRE_PRODUCTION', 'm-a'
    );
    RAISE NOTICE 'PASS 129 a member registers a connection subject';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'FAIL 129 a member registers a connection subject -> %', SQLERRM;
    failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 130. A vendor name in mixed case is refused rather than silently kept.
  --      Two spellings of one operator would be two approval histories.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."connection_attestation_subjects"(
      "id","tenantId","organizationId","connectionKind","providerCode",
      "environment","createdByMembershipId"
    ) VALUES (
      'pc-conn-subject-case', 'tenant-a', 'org-a', 'EDO', 'Diadoc',
      'PRE_PRODUCTION', 'm-a'
    );
    RAISE WARNING 'FAIL 130 an unnormalized provider code refused -> insert succeeded';
    failures := failures + 1;
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS 130 an unnormalized provider code refused';
  END;

  ---------------------------------------------------------------------------
  -- 131. A subject for somebody else's organization is refused.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."connection_attestation_subjects"(
      "id","tenantId","organizationId","connectionKind","providerCode",
      "environment","createdByMembershipId"
    ) VALUES (
      'pc-conn-subject-b', 'tenant-b', 'org-b', 'EDO', 'DIADOC',
      'PRE_PRODUCTION', 'm-b'
    );
    RAISE WARNING 'FAIL 131 cross-organization subject refused -> insert succeeded';
    failures := failures + 1;
  EXCEPTION WHEN insufficient_privilege OR check_violation OR raise_exception THEN
    RAISE NOTICE 'PASS 131 cross-organization subject refused';
  END;

  ---------------------------------------------------------------------------
  -- 132. The first gate is recorded, and the platform computes the hash.
  ---------------------------------------------------------------------------
  BEGIN
    first_id := public.app_pc_crop_record_connection_attestation(
      subject_a, 'OWNER', 'APPROVED', 'Operator contract reviewed',
      'evidence://edo/owner', now() + interval '30 days',
      'pc-conn-key-1', 'pc-conn-correlation-1'
    );
    IF first_id IS NULL THEN
      RAISE WARNING 'FAIL 132 the first gate is recorded -> no id returned';
      failures := failures + 1;
    ELSE
      RAISE NOTICE 'PASS 132 the first gate is recorded';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'FAIL 132 the first gate is recorded -> %', SQLERRM;
    failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 133. The same actor cannot also answer a second gate. Four gates exist so
  --      that four people look.
  ---------------------------------------------------------------------------
  BEGIN
    PERFORM public.app_pc_crop_record_connection_attestation(
      subject_a, 'SECURITY', 'APPROVED', 'Same person, second gate',
      'evidence://edo/security', now() + interval '30 days',
      'pc-conn-key-2', 'pc-conn-correlation-2'
    );
    RAISE WARNING 'FAIL 133 one actor cannot answer two gates -> it was recorded';
    failures := failures + 1;
  EXCEPTION WHEN raise_exception THEN
    RAISE NOTICE 'PASS 133 one actor cannot answer two gates';
  END;

  ---------------------------------------------------------------------------
  -- 134. A second person answers the next gate.
  --
  --      Verified through the reader, not by selecting the table: the command
  --      principal has no grant there, which is check 135. The chain linkage
  --      those two rows form is audited from an unconfined connection below,
  --      because that is who would audit it.
  ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('app.current_user_id', 'user-both', true);
    second_id := public.app_pc_crop_record_connection_attestation(
      subject_a, 'SECURITY', 'APPROVED', 'Independent security review',
      'evidence://edo/security', now() + interval '30 days',
      'pc-conn-key-3', 'pc-conn-correlation-3'
    );
    PERFORM set_config('app.current_user_id', 'user-a', true);
    IF second_id IS NULL THEN
      RAISE WARNING 'FAIL 134 a second person answers -> no id returned';
      failures := failures + 1;
    ELSE
      RAISE NOTICE 'PASS 134 a second person answers the next gate';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'FAIL 134 a second person answers -> %', SQLERRM;
    failures := failures + 1;
    PERFORM set_config('app.current_user_id', 'user-a', true);
  END;

  ---------------------------------------------------------------------------
  -- 135. Nobody writes the attestation table directly. The command principal
  --      has no grant there, so it cannot forge a row about an FGIS
  --      configuration either.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."fgis_grain_provider_attestations"(
      "id","subjectKind","connectionSubjectId","tenantId","organizationId",
      "gate","decision","configurationVersion","actorUserId","actorRole",
      "mfaVerified","justification","evidenceReference","validUntil",
      "idempotencyKey","correlationId","hash"
    ) VALUES (
      'pc-conn-forged', 'CONNECTION_SUBJECT', subject_a, 'tenant-a', 'org-a',
      'LEGAL', 'APPROVED', 0, 'user-a', 'ADMIN', true, 'forged', 'evidence://x',
      now() + interval '1 day', 'pc-conn-key-forged', 'pc-conn-correlation-forged',
      repeat('a', 64)
    );
    RAISE WARNING 'FAIL 135 the attestation table is not writable directly -> insert succeeded';
    failures := failures + 1;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS 135 the attestation table is not writable directly';
  END;

  ---------------------------------------------------------------------------
  -- 136. The subject's version only moves forward, one step at a time.
  ---------------------------------------------------------------------------
  BEGIN
    UPDATE public."connection_attestation_subjects"
       SET "version" = 5 WHERE "id" = subject_a;
    RAISE WARNING 'FAIL 136 a subject version does not jump -> it did';
    failures := failures + 1;
  EXCEPTION WHEN insufficient_privilege OR raise_exception THEN
    RAISE NOTICE 'PASS 136 a subject version does not jump';
  END;

  ---------------------------------------------------------------------------
  -- 137. What the subject is about never changes. Four approvals of one
  --      operator's test endpoint must not become approvals of production.
  ---------------------------------------------------------------------------
  BEGIN
    UPDATE public."connection_attestation_subjects"
       SET "environment" = 'PRODUCTION' WHERE "id" = subject_a;
    RAISE WARNING 'FAIL 137 a subject does not change what it is about -> it did';
    failures := failures + 1;
  EXCEPTION WHEN insufficient_privilege OR raise_exception THEN
    RAISE NOTICE 'PASS 137 a subject does not change what it is about';
  END;

  ---------------------------------------------------------------------------
  -- 138. An attestation is never deleted, and neither is its subject.
  ---------------------------------------------------------------------------
  BEGIN
    DELETE FROM public."connection_attestation_subjects" WHERE "id" = subject_a;
    RAISE WARNING 'FAIL 138 a subject is not deleted -> it was';
    failures := failures + 1;
  EXCEPTION WHEN insufficient_privilege OR raise_exception THEN
    RAISE NOTICE 'PASS 138 a subject is not deleted';
  END;

  ---------------------------------------------------------------------------
  -- 139. The FGIS guarantee survived. `configurationId` lost its blanket NOT
  --      NULL so a neutral row could exist; a row that claims to be about an
  --      FGIS configuration must still carry one.
  ---------------------------------------------------------------------------
  BEGIN
    PERFORM 1
      FROM pg_catalog.pg_constraint
     WHERE conname = 'fgis_grain_provider_attestation_subject_binding_ck'
       AND conrelid = 'public.fgis_grain_provider_attestations'::regclass;
    IF FOUND THEN
      RAISE NOTICE 'PASS 139 an FGIS attestation still requires its configuration';
    ELSE
      RAISE WARNING
        'FAIL 139 an FGIS attestation still requires its configuration -> the check is gone';
      failures := failures + 1;
    END IF;
  END;

  ---------------------------------------------------------------------------
  -- 140. Exactly one subject per row: never both, never neither.
  ---------------------------------------------------------------------------
  BEGIN
    PERFORM 1
      FROM pg_catalog.pg_constraint
     WHERE conname = 'fgis_grain_provider_attestation_one_subject_ck'
       AND conrelid = 'public.fgis_grain_provider_attestations'::regclass;
    IF FOUND THEN
      RAISE NOTICE 'PASS 140 an attestation is about exactly one thing';
    ELSE
      RAISE WARNING 'FAIL 140 an attestation is about exactly one thing -> the check is gone';
      failures := failures + 1;
    END IF;
  END;

  ---------------------------------------------------------------------------
  -- 141. The reader answers about this organization's subject, and reports the
  --      gates that are live for the version the subject is actually at.
  ---------------------------------------------------------------------------
  BEGIN
    SELECT count(*) INTO gates
      FROM public.app_pc_crop_connection_attestation_state(subject_a);
    IF gates = 2 THEN
      RAISE NOTICE 'PASS 141 the reader reports the live gates -> 2';
    ELSE
      RAISE WARNING 'FAIL 141 the reader reports the live gates -> %', gates;
      failures := failures + 1;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'FAIL 141 the reader reports the live gates -> %', SQLERRM;
    failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 142. Forging the organization buys nothing: the reader is a definer and
  --      therefore not confined by row level security, so it demands the
  --      caller's organization itself.
  ---------------------------------------------------------------------------
  BEGIN
    PERFORM set_config('app.current_org_id', 'org-b', true);
    SELECT count(*) INTO gates
      FROM public.app_pc_crop_connection_attestation_state(subject_a);
    PERFORM set_config('app.current_org_id', 'org-a', true);
    IF gates = 0 THEN
      RAISE NOTICE 'PASS 142 a forged organization reads no attestations';
    ELSE
      RAISE WARNING 'FAIL 142 a forged organization reads no attestations -> %', gates;
      failures := failures + 1;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'FAIL 142 a forged organization reads no attestations -> %', SQLERRM;
    failures := failures + 1;
    PERFORM set_config('app.current_org_id', 'org-a', true);
  END;

  IF failures > 0 THEN
    RAISE EXCEPTION 'pc-crop connection attestations: % check(s) failed', failures;
  END IF;
  RAISE NOTICE 'pc-crop accounting contour: connection attestations, 0 failures';
END;
$pc_crop_connection_attestation_checks$;

RESET ROLE;

-- The neutral rows are readable by the read principal; the FGIS ones are not --
SET ROLE pc_accounting_authority;

DO $pc_crop_connection_attestation_read_checks$
DECLARE
  failures integer := 0;
  gates integer;
BEGIN
  PERFORM set_config('app.current_user_id', 'user-a', true),
          set_config('app.current_org_id', 'org-a', true),
          set_config('app.current_tenant_id', 'tenant-a', true);

  ---------------------------------------------------------------------------
  -- 143. The read principal reads its own subjects.
  ---------------------------------------------------------------------------
  BEGIN
    SELECT count(*) INTO gates
      FROM public."connection_attestation_subjects";
    RAISE NOTICE 'PASS 143 the read principal reads its own subjects -> %', gates;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'FAIL 143 the read principal reads its own subjects -> %', SQLERRM;
    failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- 144. And cannot reach the attestation table itself. It gets the function,
  --      which can only ever answer about connection subjects — never about
  --      the FGIS governance history sharing the table.
  ---------------------------------------------------------------------------
  BEGIN
    PERFORM 1 FROM public."fgis_grain_provider_attestations" LIMIT 1;
    RAISE WARNING 'FAIL 144 the read principal cannot reach the attestation table -> it can';
    failures := failures + 1;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS 144 the read principal cannot reach the attestation table';
  END;

  ---------------------------------------------------------------------------
  -- 145. The read principal records nothing.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public."connection_attestation_subjects"(
      "id","tenantId","organizationId","connectionKind","providerCode",
      "environment","createdByMembershipId"
    ) VALUES (
      'pc-conn-subject-read', 'tenant-a', 'org-a', 'ONE_C', 'ONEC',
      'PRE_PRODUCTION', 'm-a'
    );
    RAISE WARNING 'FAIL 145 the read principal records nothing -> insert succeeded';
    failures := failures + 1;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS 145 the read principal records nothing';
  END;

  IF failures > 0 THEN
    RAISE EXCEPTION 'pc-crop connection attestation reads: % check(s) failed', failures;
  END IF;
  RAISE NOTICE 'pc-crop accounting contour: connection attestation reads, 0 failures';
END;
$pc_crop_connection_attestation_read_checks$;

RESET ROLE;

-- The chain, audited the way an auditor would ------------------------------
DO $pc_crop_connection_attestation_chain_checks$
DECLARE
  failures integer := 0;
  broken integer;
  head_count integer;
BEGIN
  ---------------------------------------------------------------------------
  -- 146. Every attestation of a connection subject links to the row before it,
  --      and only the first links to nothing. A chain that forks or restarts
  --      proves nothing, and the platform computes these hashes itself: no
  --      caller supplies one.
  ---------------------------------------------------------------------------
  SELECT count(*) INTO broken
    FROM public."fgis_grain_provider_attestations" a
   WHERE a."subjectKind" = 'CONNECTION_SUBJECT'
     AND a."prevHash" IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public."fgis_grain_provider_attestations" previous
        WHERE previous."connectionSubjectId" = a."connectionSubjectId"
          AND previous."hash" = a."prevHash"
     );

  SELECT count(*) INTO head_count
    FROM public."fgis_grain_provider_attestations" a
   WHERE a."subjectKind" = 'CONNECTION_SUBJECT'
     AND a."prevHash" IS NULL;

  IF broken = 0 AND head_count = 1 THEN
    RAISE NOTICE 'PASS 146 the attestation chain is unbroken and has one head';
  ELSE
    RAISE WARNING
      'FAIL 146 the attestation chain is unbroken and has one head -> % dangling, % heads',
      broken, head_count;
    failures := failures + 1;
  END IF;

  ---------------------------------------------------------------------------
  -- 147. The hash is over the content. Recomputing it from the row reproduces
  --      it, so a row whose text somebody edited would no longer match.
  ---------------------------------------------------------------------------
  SELECT count(*) INTO broken
    FROM public."fgis_grain_provider_attestations" a
   WHERE a."subjectKind" = 'CONNECTION_SUBJECT'
     AND a."hash" <> encode(
       sha256(
         convert_to(
           concat_ws(
             '|', a."id", a."connectionSubjectId", a."configurationVersion"::text,
             a."gate", a."decision", a."actorUserId", a."actorRole",
             a."justification", a."evidenceReference",
             to_char(a."validUntil" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.USOF'),
             coalesce(a."prevHash", '')
           ),
           'UTF8'
         )
       ),
       'hex'
     );

  IF broken = 0 THEN
    RAISE NOTICE 'PASS 147 every attestation hash matches its own content';
  ELSE
    RAISE WARNING 'FAIL 147 every attestation hash matches its own content -> % mismatched', broken;
    failures := failures + 1;
  END IF;

  IF failures > 0 THEN
    RAISE EXCEPTION 'pc-crop connection attestation chain: % check(s) failed', failures;
  END IF;
  RAISE NOTICE 'pc-crop accounting contour: connection attestation chain, 0 failures';
END;
$pc_crop_connection_attestation_chain_checks$;

RESET ROLE;

ROLLBACK;
