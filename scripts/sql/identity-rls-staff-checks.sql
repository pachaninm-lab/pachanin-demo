-- The bounded staff admission surface, measured as pc_staff_runtime (#3670).
--
-- Run by scripts/platform-v7-rls-integration.sh. This principal holds EXECUTE
-- on three functions and no table privilege anywhere, so everything it can do
-- is enumerated below.
\set ON_ERROR_STOP on

DO $staff_checks$
DECLARE
  failures integer := 0;
  measured text;
  counted bigint;
BEGIN
  ---------------------------------------------------------------------------
  -- What the surface is for.
  ---------------------------------------------------------------------------
  measured := coalesce((
    SELECT string_agg(organization_id, ',' ORDER BY organization_id)
    FROM auth.staff_admission_queue('user-staff', 'sas-1', 'capability-secret-digest', 100)
  ), 'NONE');
  IF measured = 'org-new,org-other' THEN
    RAISE NOTICE 'PASS  01 admission queue with a valid capability -> %', measured;
  ELSE
    RAISE WARNING 'FAIL  01 admission queue with a valid capability -> % (want org-new,org-other)', measured;
    failures := failures + 1;
  END IF;

  measured := coalesce((
    SELECT organization_id || '/' || coalesce(member_user_id, 'NONE') || '/' || coalesce(member_email, 'NONE')
    FROM auth.staff_admission_application('user-staff', 'sas-1', 'capability-secret-digest', 'kyc-new')
  ), 'NONE');
  IF measured = 'org-new/user-new/new@example.test' THEN
    RAISE NOTICE 'PASS  02 one application, platform-wide capability -> %', measured;
  ELSE
    RAISE WARNING 'FAIL  02 one application, platform-wide capability -> % (want org-new/user-new/new@example.test)', measured;
    failures := failures + 1;
  END IF;

  measured := coalesce((
    SELECT organization_id || '/' || coalesce(member_user_id, 'NONE')
    FROM auth.staff_admission_application('user-staff', 'sas-2', 'scoped-secret-digest', 'kyc-new')
  ), 'NONE');
  IF measured = 'org-new/user-new' THEN
    RAISE NOTICE 'PASS  03 one application, capability scoped to it -> %', measured;
  ELSE
    RAISE WARNING 'FAIL  03 one application, capability scoped to it -> % (want org-new/user-new)', measured;
    failures := failures + 1;
  END IF;

  ---------------------------------------------------------------------------
  -- The capability is a secret, not a pair of identifiers. Each of these
  -- presents a real actor and a real session id and is refused.
  ---------------------------------------------------------------------------
  BEGIN
    PERFORM organization_id FROM auth.staff_admission_queue(
      'user-staff', 'sas-1', 'guessed-digest', 100);
    RAISE WARNING 'FAIL  04 real session id with a wrong secret -> allowed (want denial)';
    failures := failures + 1;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS  04 real session id with a wrong secret -> denied';
  END;

  BEGIN
    PERFORM organization_id FROM auth.staff_admission_queue(
      'user-b', 'sas-1', 'capability-secret-digest', 100);
    RAISE WARNING 'FAIL  05 another actor presenting a real capability -> allowed (want denial)';
    failures := failures + 1;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS  05 another actor presenting a real capability -> denied';
  END;

  BEGIN
    PERFORM organization_id FROM auth.staff_admission_queue(
      'user-staff', 'sas-3', 'expired-secret-digest', 100);
    RAISE WARNING 'FAIL  06 expired capability -> allowed (want denial)';
    failures := failures + 1;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS  06 expired capability -> denied';
  END;

  BEGIN
    PERFORM organization_id FROM auth.staff_admission_queue(
      'user-staff', 'sas-2', 'scoped-secret-digest', 100);
    RAISE WARNING 'FAIL  07 capability without organization:list lists the queue -> allowed (want denial)';
    failures := failures + 1;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS  07 capability without organization:list lists the queue -> denied';
  END;

  ---------------------------------------------------------------------------
  -- Scope. A capability issued for one application cannot be spent elsewhere.
  ---------------------------------------------------------------------------
  BEGIN
    PERFORM organization_id FROM auth.staff_admission_application(
      'user-staff', 'sas-2', 'scoped-secret-digest', 'kyc-other');
    RAISE WARNING 'FAIL  08 scoped capability on another application -> allowed (want denial)';
    failures := failures + 1;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS  08 scoped capability on another application -> denied';
  END;

  -- An application that does not exist is refused exactly as one out of scope
  -- is, so the surface cannot be used to enumerate identifiers.
  BEGIN
    PERFORM organization_id FROM auth.staff_admission_application(
      'user-staff', 'sas-1', 'capability-secret-digest', 'kyc-guessed');
    RAISE WARNING 'FAIL  09 unknown application -> allowed (want the same denial)';
    failures := failures + 1;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS  09 unknown application -> denied, indistinguishably';
  END;

  ---------------------------------------------------------------------------
  -- The runtime holds no table privilege of its own, so a query it writes
  -- itself reaches nothing, whatever context it sets first.
  ---------------------------------------------------------------------------
  BEGIN
    PERFORM count(*) FROM public."users";
    RAISE WARNING 'FAIL  10 direct read of public.users -> allowed (want denial)';
    failures := failures + 1;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS  10 direct read of public.users -> denied';
  END;

  BEGIN
    PERFORM count(*) FROM public."organizations";
    RAISE WARNING 'FAIL  11 direct read of public.organizations -> allowed (want denial)';
    failures := failures + 1;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS  11 direct read of public.organizations -> denied';
  END;

  BEGIN
    PERFORM count(*) FROM public."user_orgs";
    RAISE WARNING 'FAIL  12 direct read of public.user_orgs -> allowed (want denial)';
    failures := failures + 1;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS  12 direct read of public.user_orgs -> denied';
  END;

  BEGIN
    PERFORM count(*) FROM public.kyc_tasks;
    RAISE WARNING 'FAIL  13 direct read of public.kyc_tasks -> allowed (want denial)';
    failures := failures + 1;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS  13 direct read of public.kyc_tasks -> denied';
  END;

  -- Setting the scope markers itself buys nothing: the policies that consult
  -- them are addressed to pc_staff_authority, which this role cannot become.
  PERFORM set_config('app.staff_admission_scope', 'org-a', true),
          set_config('app.staff_admission_decision', 'org-a', true);
  BEGIN
    PERFORM count(*) FROM public."users";
    RAISE WARNING 'FAIL  14 forged scope markers then a direct read -> allowed (want denial)';
    failures := failures + 1;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS  14 forged scope markers then a direct read -> denied';
  END;

  BEGIN
    EXECUTE 'SET ROLE pc_staff_authority';
    RESET ROLE;
    RAISE WARNING 'FAIL  15 SET ROLE pc_staff_authority -> allowed (want denial)';
    failures := failures + 1;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS  15 SET ROLE pc_staff_authority -> denied';
  END;

  -- The capability digests live in a table this role cannot read, so it cannot
  -- mint a capability for itself even knowing every identifier involved.
  BEGIN
    PERFORM count(*) FROM auth.staff_access_sessions;
    RAISE WARNING 'FAIL  16 staff runtime reads capability digests -> allowed (want denial)';
    failures := failures + 1;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS  16 staff runtime reads capability digests -> denied';
  END;

  ---------------------------------------------------------------------------
  -- Decisions.
  ---------------------------------------------------------------------------
  measured := coalesce((
    SELECT task_status || '/' || kyc_status || '/' || organization_status
    FROM auth.staff_admission_decision(
      'user-staff', 'sas-1', 'capability-secret-digest', 'kyc-new', 'APPROVE',
      'documents verified against the register')
  ), 'NONE');
  IF measured = 'APPROVED/VERIFIED/ACTIVE' THEN
    RAISE NOTICE 'PASS  17 approve an application -> %', measured;
  ELSE
    RAISE WARNING 'FAIL  17 approve an application -> % (want APPROVED/VERIFIED/ACTIVE)', measured;
    failures := failures + 1;
  END IF;

  measured := coalesce((
    SELECT string_agg(organization_id, ',' ORDER BY organization_id)
    FROM auth.staff_admission_queue('user-staff', 'sas-1', 'capability-secret-digest', 100)
  ), 'NONE');
  IF measured = 'org-other' THEN
    RAISE NOTICE 'PASS  18 the queue after the decision -> %', measured;
  ELSE
    RAISE WARNING 'FAIL  18 the queue after the decision -> % (want org-other)', measured;
    failures := failures + 1;
  END IF;

  BEGIN
    PERFORM task_status FROM auth.staff_admission_decision(
      'user-staff', 'sas-2', 'scoped-secret-digest', 'kyc-other', 'APPROVE',
      'documents verified against the register');
    RAISE WARNING 'FAIL  19 decide an application outside the capability scope -> allowed (want denial)';
    failures := failures + 1;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS  19 decide an application outside the capability scope -> denied';
  END;

  BEGIN
    PERFORM task_status FROM auth.staff_admission_decision(
      'user-staff', 'sas-1', 'capability-secret-digest', 'kyc-other', 'APPROVE', '');
    RAISE WARNING 'FAIL  20 decide with no stated reason -> allowed (want refusal)';
    failures := failures + 1;
  EXCEPTION WHEN invalid_parameter_value THEN
    RAISE NOTICE 'PASS  20 decide with no stated reason -> refused';
  END;

  BEGIN
    PERFORM task_status FROM auth.staff_admission_decision(
      'user-staff', 'sas-1', 'capability-secret-digest', 'kyc-other', 'DELETE',
      'documents verified against the register');
    RAISE WARNING 'FAIL  21 decide with an invented verb -> allowed (want refusal)';
    failures := failures + 1;
  EXCEPTION WHEN invalid_parameter_value THEN
    RAISE NOTICE 'PASS  21 decide with an invented verb -> refused';
  END;

  -- An application already settled is no longer pending, so a second decision
  -- on it is refused rather than silently overwriting the first.
  BEGIN
    PERFORM task_status FROM auth.staff_admission_decision(
      'user-staff', 'sas-1', 'capability-secret-digest', 'kyc-new', 'REJECT',
      'attempting to overturn a settled decision');
    RAISE WARNING 'FAIL  22 decide an already settled application -> allowed (want denial)';
    failures := failures + 1;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS  22 decide an already settled application -> denied';
  END;

  ---------------------------------------------------------------------------
  -- Role attributes, and the column-level ceiling on what a decision can write.
  ---------------------------------------------------------------------------
  measured := (
    SELECT rolsuper::text || '/' || rolbypassrls::text || '/' || rolinherit::text
    FROM pg_catalog.pg_roles WHERE rolname = current_user);
  IF measured = 'false/false/false' THEN
    RAISE NOTICE 'PASS  23 % is superuser/bypassrls/inherit -> %', current_user, measured;
  ELSE
    RAISE WARNING 'FAIL  23 % is superuser/bypassrls/inherit -> % (want false/false/false)', current_user, measured;
    failures := failures + 1;
  END IF;

  measured := (
    SELECT rolcanlogin::text || '/' || rolsuper::text || '/' || rolbypassrls::text
    FROM pg_catalog.pg_roles WHERE rolname = 'pc_staff_authority');
  IF measured = 'false/false/false' THEN
    RAISE NOTICE 'PASS  24 pc_staff_authority is login/superuser/bypassrls -> %', measured;
  ELSE
    RAISE WARNING 'FAIL  24 pc_staff_authority is login/superuser/bypassrls -> % (want false/false/false)', measured;
    failures := failures + 1;
  END IF;

  counted := (
    SELECT count(*) FROM pg_catalog.pg_auth_members m
    JOIN pg_catalog.pg_roles r ON r.oid = m.roleid
    WHERE r.rolname IN ('pc_staff_authority', 'pc_staff_runtime'));
  IF counted = 0 THEN
    RAISE NOTICE 'PASS  25 members of the staff roles -> %', counted;
  ELSE
    RAISE WARNING 'FAIL  25 members of the staff roles -> % (want 0)', counted;
    failures := failures + 1;
  END IF;

  -- A decision settles KYC state. It must not be able to rename an
  -- organization or move it to another tenant, and a policy cannot say so: a
  -- policy admits or refuses a row, never a column. Read from the catalog
  -- rather than through has_column_privilege, which needs USAGE on the schema
  -- this role deliberately does not hold.
  measured := coalesce((
    SELECT string_agg(DISTINCT a.attname, ',' ORDER BY a.attname)
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
    CROSS JOIN LATERAL pg_catalog.aclexplode(a.attacl) acl
    JOIN pg_catalog.pg_roles grantee ON grantee.oid = acl.grantee
    WHERE n.nspname = 'public'
      AND c.relname = 'organizations'
      AND grantee.rolname = 'pc_staff_authority'
      AND acl.privilege_type = 'UPDATE'
  ), 'NONE');
  IF measured = 'kycStatus,status,updatedAt,verifiedAt' THEN
    RAISE NOTICE 'PASS  26 organization columns a decision may write -> %', measured;
  ELSE
    RAISE WARNING 'FAIL  26 organization columns a decision may write -> % (want kycStatus,status,updatedAt,verifiedAt)', measured;
    failures := failures + 1;
  END IF;

  -- And table-level UPDATE must not have been granted alongside, which would
  -- make the column list decorative.
  counted := (
    SELECT count(*)
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(c.relacl) acl
    JOIN pg_catalog.pg_roles grantee ON grantee.oid = acl.grantee
    WHERE n.nspname = 'public'
      AND c.relname IN ('organizations', 'users', 'user_orgs')
      AND grantee.rolname = 'pc_staff_authority'
      AND acl.privilege_type IN ('UPDATE', 'INSERT', 'DELETE'));
  IF counted = 0 THEN
    RAISE NOTICE 'PASS  27 table-level writes on the identity tables -> % grants', counted;
  ELSE
    RAISE WARNING 'FAIL  27 table-level writes on the identity tables -> % grants (want 0)', counted;
    failures := failures + 1;
  END IF;

  IF failures > 0 THEN
    RAISE EXCEPTION 'identity isolation: % staff-runtime check(s) failed', failures;
  END IF;
  RAISE NOTICE 'staff runtime: 27 checks, 0 failures';
END;
$staff_checks$;
