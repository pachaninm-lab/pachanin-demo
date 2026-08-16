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

  IF failures > 0 THEN
    RAISE EXCEPTION 'pc-crop regulatory rule confinement: % check(s) failed', failures;
  END IF;
  RAISE NOTICE 'pc-crop accounting contour: rule registry read-only, tax profiles versioned, 0 failures';
END;
$pc_crop_regulatory_rule_confinement_checks$;

RESET ROLE;

ROLLBACK;
