-- Identity isolation, measured as the tenant/auth runtime principal (#3670).
--
-- Run by scripts/platform-v7-rls-integration.sh as pc_auth_runtime: LOGIN,
-- NOINHERIT, NOSUPERUSER, NOBYPASSRLS. Every context value below is written by
-- this very connection, which is the point — these are the settings a compromised
-- or careless runtime can forge, and the checks establish what forging them buys.
\set ON_ERROR_STOP on

DO $tenant_checks$
DECLARE
  failures integer := 0;
  measured text;
  counted bigint;
  escape_role text;
BEGIN
  -- Each check states its expectation inline rather than through a helper, so a
  -- reader of the log can see exactly what was demanded of the database.

  ---------------------------------------------------------------------------
  -- No context at all. A statement that reaches the database without a
  -- transaction context must see nothing, not everything.
  ---------------------------------------------------------------------------
  measured := (SELECT count(*) FROM public."users")::text || '/' ||
              (SELECT count(*) FROM public."user_orgs")::text || '/' ||
              (SELECT count(*) FROM public."organizations")::text;
  IF measured = '0/0/0' THEN
    RAISE NOTICE 'PASS  01 no context users/memberships/orgs -> %', measured;
  ELSE
    RAISE WARNING 'FAIL  01 no context users/memberships/orgs -> % (want 0/0/0)', measured;
    failures := failures + 1;
  END IF;

  ---------------------------------------------------------------------------
  -- Pre-password login authority. This is the only identity read available
  -- before bcrypt proves possession of the password: one credential row and
  -- no membership, tenant, organization or MFA material.
  ---------------------------------------------------------------------------
  measured := coalesce((
    SELECT user_id || ' ' || password_hash
    FROM auth.resolve_login_credential('a@example.test')
  ), 'NONE');
  IF measured = 'user-a hash-a' THEN
    RAISE NOTICE 'PASS  02 minimal credential bootstrap -> %', measured;
  ELSE
    RAISE WARNING 'FAIL  02 minimal credential bootstrap -> % (want user-a hash-a)', measured;
    failures := failures + 1;
  END IF;

  -- Historical wider bootstrap entry points stay in migration history but the
  -- login runtime must not be able to execute any of them.
  measured :=
    has_function_privilege(current_user, 'auth.resolve_login_identity(text)', 'EXECUTE')::text || '/' ||
    has_function_privilege(current_user, 'auth.resolve_login_identity_by_id(text)', 'EXECUTE')::text || '/' ||
    has_function_privilege(current_user, 'auth.resolve_login_memberships(text)', 'EXECUTE')::text || '/' ||
    has_function_privilege(current_user, 'auth.resolve_login_memberships_ordered(text)', 'EXECUTE')::text || '/' ||
    has_function_privilege(current_user, 'auth.resolve_login_context_by_email(text)', 'EXECUTE')::text;
  IF measured = 'false/false/false/false/false' THEN
    RAISE NOTICE 'PASS  02b retired broad login functions -> %', measured;
  ELSE
    RAISE WARNING 'FAIL  02b retired broad login functions -> % (want all false)', measured;
    failures := failures + 1;
  END IF;

  -- The membership-id projection is the first post-password lookup. It exposes
  -- no organization or tenant and returns every server-authoritative choice in
  -- deterministic order for a multi-membership identity.
  measured := coalesce((
    SELECT string_agg(membership_id, ',' ORDER BY membership_id)
    FROM auth.resolve_post_password_membership_ids('user-both')
  ), 'NONE');
  IF measured = 'm-both-a,m-both-b' THEN
    RAISE NOTICE 'PASS  02c post-password membership choices -> %', measured;
  ELSE
    RAISE WARNING 'FAIL  02c post-password membership choices -> % (want m-both-a,m-both-b)', measured;
    failures := failures + 1;
  END IF;

  -- Context is resolved only by a membership explicitly bound to the proven
  -- identity. This is the positive half of that boundary.
  measured := coalesce((
    SELECT user_id || '/' || membership_id || '/' || organization_id || '/' || tenant_id
    FROM auth.resolve_post_password_membership_context('user-a', 'm-a')
  ), 'NONE');
  IF measured = 'user-a/m-a/org-a/tenant-a' THEN
    RAISE NOTICE 'PASS  02d post-password context by membership -> %', measured;
  ELSE
    RAISE WARNING 'FAIL  02d post-password context by membership -> % (want user-a/m-a/org-a/tenant-a)', measured;
    failures := failures + 1;
  END IF;

  -- A membership that belongs to somebody else cannot be paired with this
  -- identity, so selecting an organization after password proof cannot cross tenants.
  measured := coalesce((
    SELECT membership_id FROM auth.resolve_post_password_membership_context('user-a', 'm-b')
  ), 'NONE');
  IF measured = 'NONE' THEN
    RAISE NOTICE 'PASS  02e login context refuses another identity''s membership -> %', measured;
  ELSE
    RAISE WARNING 'FAIL  02e login context refuses another identity''s membership -> % (want NONE)', measured;
    failures := failures + 1;
  END IF;

  measured := coalesce((
    SELECT user_id || '/' || role || '/' || tenant_id
    FROM auth.resolve_session_identity_v2('user-staff', 'm-staff', 'org-a', 'tenant-a')
  ), 'NONE');
  IF measured = 'user-staff/FARMER/tenant-a' THEN
    RAISE NOTICE 'PASS  02f session identity for a consistent session row -> %', measured;
  ELSE
    RAISE WARNING 'FAIL  02f session identity for a consistent session row -> % (want user-staff/FARMER/tenant-a)', measured;
    failures := failures + 1;
  END IF;

  -- A session row whose columns disagree resolves to nothing rather than to
  -- whichever identity the first join happens to find.
  measured := coalesce((
    SELECT user_id FROM auth.resolve_session_identity_v2('user-staff', 'm-staff', 'org-b', 'tenant-b')
  ), 'NONE');
  IF measured = 'NONE' THEN
    RAISE NOTICE 'PASS  02g session identity for an inconsistent session row -> %', measured;
  ELSE
    RAISE WARNING 'FAIL  02g session identity for an inconsistent session row -> % (want NONE)', measured;
    failures := failures + 1;
  END IF;

  -- The shape the repository actually issues, lock and all: a lateral join
  -- from the session row onto the bounded identity function, locking only the
  -- session. PostgreSQL refuses FOR UPDATE against a function scan, so naming
  -- the session explicitly is load-bearing rather than stylistic.
  BEGIN
    measured := coalesce((
      SELECT identity.user_id || '/' || identity.organization_id || '/' || s.status
      FROM auth.sessions s
      JOIN LATERAL auth.resolve_session_identity_v2(
        s.user_id, s.membership_id, s.organization_id, s.tenant_id
      ) identity ON TRUE
      JOIN auth.credential_states cs ON cs.user_id = s.user_id
      WHERE s.id = 'sess-staff'
      FOR UPDATE OF s
    ), 'NONE');
    IF measured = 'user-staff/org-a/ACTIVE' THEN
      RAISE NOTICE 'PASS  02h locked session context query -> %', measured;
    ELSE
      RAISE WARNING 'FAIL  02h locked session context query -> % (want user-staff/org-a/ACTIVE)', measured;
      failures := failures + 1;
    END IF;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'FAIL  02h locked session context query -> %', SQLERRM;
    failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- Product session scope. A Gekta session has no membership, organization or
  -- tenant, so the platform's own resolver must not produce an identity for
  -- it. This is what keeps the product session out of every platform route
  -- without a single guard change: the refusal is structural.
  ---------------------------------------------------------------------------
  measured := coalesce((
    SELECT identity.user_id
    FROM auth.sessions s
    JOIN LATERAL auth.resolve_session_identity_v2(
      s.user_id, s.membership_id, s.organization_id, s.tenant_id
    ) identity ON TRUE
    JOIN auth.credential_states cs ON cs.user_id = s.user_id
    WHERE s.id = 'sess-gekta'
  ), 'NONE');
  IF measured = 'NONE' THEN
    RAISE NOTICE 'PASS  02i platform session context refuses a product session -> %', measured;
  ELSE
    RAISE WARNING 'FAIL  02i platform session context refuses a product session -> % (want NONE)', measured;
    failures := failures + 1;
  END IF;

  -- user-new does have a membership (m-new in org-new). The product session
  -- must not pick it up: a session without an organization stays without one
  -- even when the same person belongs to one elsewhere.
  measured := coalesce((
    SELECT s.id || '/' || coalesce(s.organization_id, 'no-org') || '/' || coalesce(s.membership_id, 'no-membership')
    FROM auth.sessions s
    WHERE s.id = 'sess-gekta' AND s.scope = 'GEKTA'
  ), 'NONE');
  IF measured = 'sess-gekta/no-org/no-membership' THEN
    RAISE NOTICE 'PASS  02j product session carries no organization -> %', measured;
  ELSE
    RAISE WARNING 'FAIL  02j product session carries no organization -> % (want sess-gekta/no-org/no-membership)', measured;
    failures := failures + 1;
  END IF;

  -- The read the product runtime actually issues. It resolves the subject
  -- directly and is bounded by scope, so a platform session identifier
  -- presented on a product route resolves to nothing.
  measured := coalesce((
    SELECT subject.user_id || '/' || s.scope
    FROM auth.sessions s
    JOIN LATERAL auth.resolve_product_session_identity_v1(s.user_id) subject ON TRUE
    JOIN auth.credential_states cs ON cs.user_id = s.user_id
    WHERE s.id = 'sess-gekta' AND s.scope = 'GEKTA'
  ), 'NONE');
  IF measured = 'user-new/GEKTA' THEN
    RAISE NOTICE 'PASS  02k product session context resolves its subject -> %', measured;
  ELSE
    RAISE WARNING 'FAIL  02k product session context resolves its subject -> % (want user-new/GEKTA)', measured;
    failures := failures + 1;
  END IF;

  measured := coalesce((
    SELECT s.id
    FROM auth.sessions s
    JOIN LATERAL auth.resolve_product_session_identity_v1(s.user_id) subject ON TRUE
    WHERE s.id = 'sess-staff' AND s.scope = 'GEKTA'
  ), 'NONE');
  IF measured = 'NONE' THEN
    RAISE NOTICE 'PASS  02l product session context refuses a platform session -> %', measured;
  ELSE
    RAISE WARNING 'FAIL  02l product session context refuses a platform session -> % (want NONE)', measured;
    failures := failures + 1;
  END IF;

  -- Продуктовый резолвер не умеет возвращать организационную принадлежность:
  -- в его типе таких колонок нет. Проверяется реакция базы, а не намерение.
  BEGIN
    PERFORM organization_id FROM auth.resolve_product_session_identity_v1('user-new');
    RAISE WARNING 'FAIL  02m product identity exposed an organization column';
    failures := failures + 1;
  EXCEPTION WHEN undefined_column THEN
    RAISE NOTICE 'PASS  02m product identity has no organization column';
  END;

  ---------------------------------------------------------------------------
  -- Tenant A context: its own organization and no other.
  ---------------------------------------------------------------------------
  PERFORM set_config('app.current_user_id', 'user-a', true),
          set_config('app.current_org_id', 'org-a', true),
          set_config('app.current_tenant_id', 'tenant-a', true),
          set_config('app.current_role', 'ADMIN', true),
          set_config('app.current_session_id', 'sess-a', true);

  measured := coalesce((SELECT string_agg(id, ',' ORDER BY id) FROM public."organizations"), 'NONE');
  IF measured = 'org-a' THEN
    RAISE NOTICE 'PASS  03 tenant A sees organizations -> %', measured;
  ELSE
    RAISE WARNING 'FAIL  03 tenant A sees organizations -> % (want org-a)', measured;
    failures := failures + 1;
  END IF;

  -- A guessed identifier from another tenant matches nothing, so an identifier
  -- leak is not an access grant.
  counted := (SELECT count(*) FROM public."organizations" WHERE id = 'org-b');
  IF counted = 0 THEN
    RAISE NOTICE 'PASS  04 tenant A guesses org-b by identifier -> % rows', counted;
  ELSE
    RAISE WARNING 'FAIL  04 tenant A guesses org-b by identifier -> % rows (want 0)', counted;
    failures := failures + 1;
  END IF;

  -- user-a administers org-a, so it reads the members of org-a and nobody else.
  measured := coalesce((SELECT string_agg(id, ',' ORDER BY id) FROM public."users"), 'NONE');
  IF measured = 'user-a,user-both,user-staff' THEN
    RAISE NOTICE 'PASS  05 org administrator reads its own members -> %', measured;
  ELSE
    RAISE WARNING 'FAIL  05 org administrator reads its own members -> % (want user-a,user-both,user-staff)', measured;
    failures := failures + 1;
  END IF;

  measured := coalesce((SELECT string_agg(id, ',' ORDER BY id) FROM public."user_orgs"), 'NONE');
  IF measured = 'm-a,m-both-a,m-staff' THEN
    RAISE NOTICE 'PASS  06 org administrator reads its own memberships -> %', measured;
  ELSE
    RAISE WARNING 'FAIL  06 org administrator reads its own memberships -> % (want m-a,m-both-a,m-staff)', measured;
    failures := failures + 1;
  END IF;

  ---------------------------------------------------------------------------
  -- Multi-membership. The same identity in tenant B context reads its own
  -- memberships and not the other members of either organization.
  ---------------------------------------------------------------------------
  PERFORM set_config('app.current_user_id', 'user-both', true),
          set_config('app.current_org_id', 'org-b', true),
          set_config('app.current_tenant_id', 'tenant-b', true),
          set_config('app.current_role', 'FARMER', true),
          set_config('app.current_session_id', 'sess-both', true);

  measured := coalesce((SELECT string_agg(id, ',' ORDER BY id) FROM public."user_orgs"), 'NONE');
  IF measured = 'm-both-a,m-both-b' THEN
    RAISE NOTICE 'PASS  07 multi-membership reads only its own -> %', measured;
  ELSE
    RAISE WARNING 'FAIL  07 multi-membership reads only its own -> % (want m-both-a,m-both-b)', measured;
    failures := failures + 1;
  END IF;

  counted := (SELECT count(*) FROM public."users" WHERE id = 'user-a');
  IF counted = 0 THEN
    RAISE NOTICE 'PASS  08 tenant B cannot read a tenant A identity -> % rows', counted;
  ELSE
    RAISE WARNING 'FAIL  08 tenant B cannot read a tenant A identity -> % rows (want 0)', counted;
    failures := failures + 1;
  END IF;

  ---------------------------------------------------------------------------
  -- Claiming the ADMIN label without the membership row that carries it.
  -- app.current_role is written by this connection; org administration is not.
  ---------------------------------------------------------------------------
  PERFORM set_config('app.current_user_id', 'user-b', true),
          set_config('app.current_org_id', 'org-b', true),
          set_config('app.current_tenant_id', 'tenant-b', true),
          set_config('app.current_role', 'ADMIN', true),
          set_config('app.current_session_id', 'sess-b', true);

  BEGIN
    INSERT INTO public."user_orgs"(id, "userId", "organizationId", role, "isDefault", "joinedAt")
    VALUES ('m-forged', 'user-a', 'org-b', 'ADMIN', false, now());
    RAISE WARNING 'FAIL  09 forged ADMIN label inserts a membership -> allowed (want denial)';
    failures := failures + 1;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS  09 forged ADMIN label inserts a membership -> denied';
  END;

  measured := coalesce((SELECT string_agg(id, ',' ORDER BY id) FROM public."users"), 'NONE');
  IF measured = 'user-b' THEN
    RAISE NOTICE 'PASS  10 forged ADMIN label reads other members -> % (self only)', measured;
  ELSE
    RAISE WARNING 'FAIL  10 forged ADMIN label reads other members -> % (want user-b)', measured;
    failures := failures + 1;
  END IF;

  ---------------------------------------------------------------------------
  -- The forged staff setting. An earlier revision of the migration read
  -- platform authority out of app.current_staff_roles; this connection can
  -- write that setting, and did, reading every organization and every user.
  ---------------------------------------------------------------------------
  PERFORM set_config('app.current_user_id', 'user-b', true),
          set_config('app.current_org_id', 'org-b', true),
          set_config('app.current_tenant_id', 'tenant-b', true),
          set_config('app.current_role', 'FARMER', true),
          set_config('app.current_session_id', 'sess-b', true),
          set_config('app.current_staff_roles', 'PLATFORM_ADMIN', true);

  measured := coalesce((SELECT string_agg(id, ',' ORDER BY id) FROM public."organizations"), 'NONE');
  IF measured = 'org-b' THEN
    RAISE NOTICE 'PASS  11 forged app.current_staff_roles -> % (own organization only)', measured;
  ELSE
    RAISE WARNING 'FAIL  11 forged app.current_staff_roles -> % (want org-b)', measured;
    failures := failures + 1;
  END IF;

  ---------------------------------------------------------------------------
  -- Impersonating a real member of staff. Not an invented identity: the user
  -- id below belongs to an ACTIVE COMPLIANCE_STAFF assignment, and the session
  -- id to that person's live, unrevoked, MFA-verified session. Both rows exist
  -- and this connection can read them. A predicate that consults rows rather
  -- than settings still admitted this substitution, which is why the generic
  -- policies carry no cross-tenant branch at all.
  ---------------------------------------------------------------------------
  PERFORM set_config('app.current_user_id', 'user-staff', true),
          set_config('app.current_org_id', 'org-a', true),
          set_config('app.current_tenant_id', 'tenant-a', true),
          set_config('app.current_role', 'FARMER', true),
          set_config('app.current_session_id', 'sess-staff', true),
          set_config('app.current_staff_roles', '', true);

  measured := coalesce((SELECT string_agg(id, ',' ORDER BY id) FROM public."organizations"), 'NONE');
  IF measured = 'org-a' THEN
    RAISE NOTICE 'PASS  12 impersonated real staff session, organizations -> %', measured;
  ELSE
    RAISE WARNING 'FAIL  12 impersonated real staff session, organizations -> % (want org-a)', measured;
    failures := failures + 1;
  END IF;

  measured := coalesce((SELECT string_agg(id, ',' ORDER BY id) FROM public."users"), 'NONE');
  IF measured = 'user-staff' THEN
    RAISE NOTICE 'PASS  13 impersonated real staff session, users -> % (self only)', measured;
  ELSE
    RAISE WARNING 'FAIL  13 impersonated real staff session, users -> % (want user-staff)', measured;
    failures := failures + 1;
  END IF;

  ---------------------------------------------------------------------------
  -- Impersonating a real organization administrator. user-a really does
  -- administer org-a; the claim here points that identity at org-b and states
  -- org-b's real tenant identifier alongside it. Neither identifier is a
  -- secret — a policy that accepted the pair as proof of belonging was reading
  -- back the attacker's own input, and this is the check that caught it.
  ---------------------------------------------------------------------------
  PERFORM set_config('app.current_user_id', 'user-a', true),
          set_config('app.current_org_id', 'org-b', true),
          set_config('app.current_tenant_id', 'tenant-b', true),
          set_config('app.current_role', 'ADMIN', true),
          set_config('app.current_session_id', 'sess-a', true);

  measured := coalesce((SELECT string_agg(id, ',' ORDER BY id) FROM public."organizations"), 'NONE');
  IF measured = 'org-a' THEN
    RAISE NOTICE 'PASS  14 real org admin pointed at another tenant -> % (own membership only)', measured;
  ELSE
    RAISE WARNING 'FAIL  14 real org admin pointed at another tenant -> % (want org-a)', measured;
    failures := failures + 1;
  END IF;

  counted := (SELECT count(*) FROM public."organizations" WHERE id = 'org-b' AND "tenantId" = 'tenant-b');
  IF counted = 0 THEN
    RAISE NOTICE 'PASS  14b correctly stated foreign id and tenant -> % rows', counted;
  ELSE
    RAISE WARNING 'FAIL  14b correctly stated foreign id and tenant -> % rows (want 0)', counted;
    failures := failures + 1;
  END IF;

  BEGIN
    UPDATE public."organizations" SET "kycStatus" = 'VERIFIED' WHERE id = 'org-b';
    IF NOT FOUND THEN
      RAISE NOTICE 'PASS  14c real org admin writes another tenant -> 0 rows';
    ELSE
      RAISE WARNING 'FAIL  14c real org admin writes another tenant -> rows written (want 0)';
      failures := failures + 1;
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS  14c real org admin writes another tenant -> denied';
  END;

  measured := coalesce((SELECT string_agg(id, ',' ORDER BY id) FROM public."user_orgs"), 'NONE');
  IF measured = 'm-a' THEN
    RAISE NOTICE 'PASS  15 real org admin pointed at another tenant, memberships -> % (own only)', measured;
  ELSE
    RAISE WARNING 'FAIL  15 real org admin pointed at another tenant, memberships -> % (want m-a)', measured;
    failures := failures + 1;
  END IF;

  ---------------------------------------------------------------------------
  -- Privileged columns. An identity maintains its own row; it does not replace
  -- its own credential material or resurrect a deleted account.
  ---------------------------------------------------------------------------
  PERFORM set_config('app.current_user_id', 'user-a', true),
          set_config('app.current_org_id', 'org-a', true),
          set_config('app.current_tenant_id', 'tenant-a', true),
          set_config('app.current_role', 'ADMIN', true),
          set_config('app.current_session_id', 'sess-a', true);

  BEGIN
    UPDATE public."users" SET "passwordHash" = 'replaced' WHERE id = 'user-a';
    RAISE WARNING 'FAIL  16 identity rewrites its own credential -> allowed (want denial)';
    failures := failures + 1;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS  16 identity rewrites its own credential -> denied';
  END;

  BEGIN
    UPDATE public."users" SET "deletedAt" = NULL WHERE id = 'user-a';
    RAISE WARNING 'FAIL  17 identity clears its own deletion marker -> allowed (want denial)';
    failures := failures + 1;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS  17 identity clears its own deletion marker -> denied';
  END;

  BEGIN
    UPDATE public."users" SET "fullName" = 'Alice Renamed' WHERE id = 'user-a';
    RAISE NOTICE 'PASS  18 identity maintains its own profile -> allowed';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE WARNING 'FAIL  18 identity maintains its own profile -> denied (want allowed)';
    failures := failures + 1;
  END;

  ---------------------------------------------------------------------------
  -- The bounded staff surface is out of reach from here, in every direction.
  ---------------------------------------------------------------------------
  BEGIN
    PERFORM organization_id FROM auth.staff_admission_queue(
      'user-staff', 'sas-1', 'capability-secret-digest', 100);
    RAISE WARNING 'FAIL  19 tenant runtime calls the admission queue -> allowed (want denial)';
    failures := failures + 1;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS  19 tenant runtime calls the admission queue -> denied';
  END;

  BEGIN
    PERFORM organization_id FROM auth.staff_admission_application(
      'user-staff', 'sas-1', 'capability-secret-digest', 'kyc-other');
    RAISE WARNING 'FAIL  20 tenant runtime opens one application -> allowed (want denial)';
    failures := failures + 1;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS  20 tenant runtime opens one application -> denied';
  END;

  BEGIN
    PERFORM task_status FROM auth.staff_admission_decision(
      'user-staff', 'sas-1', 'capability-secret-digest', 'kyc-other', 'APPROVE',
      'documents verified against the register');
    RAISE WARNING 'FAIL  21 tenant runtime decides an application -> allowed (want denial)';
    failures := failures + 1;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS  21 tenant runtime decides an application -> denied';
  END;

  -- The digest is readable from here, and reading it buys nothing above. That
  -- is the argument for why the capability is not merely a shared secret: the
  -- principal holding the secret cannot reach a single function that takes it.
  measured := coalesce(
    (SELECT token_hash FROM auth.staff_access_sessions WHERE id = 'sas-1'), 'DENIED');
  IF measured = 'capability-secret-digest' THEN
    RAISE NOTICE 'PASS  22 tenant runtime holds the capability digest -> % (and it opens nothing)', measured;
  ELSE
    RAISE WARNING 'FAIL  22 tenant runtime holds the capability digest -> % (want the digest itself)', measured;
    failures := failures + 1;
  END IF;

  -- Forging the staff scope markers reaches nothing: the policies that consult
  -- them are addressed to a role this connection cannot become.
  PERFORM set_config('app.staff_admission_scope', 'queue:pending', true),
          set_config('app.staff_admission_decision', 'org-other', true);

  measured := coalesce((SELECT string_agg(id, ',' ORDER BY id) FROM public."organizations"), 'NONE');
  IF measured = 'org-a' THEN
    RAISE NOTICE 'PASS  23 forged staff scope markers, organizations -> %', measured;
  ELSE
    RAISE WARNING 'FAIL  23 forged staff scope markers, organizations -> % (want org-a)', measured;
    failures := failures + 1;
  END IF;

  counted := 0;
  BEGIN
    WITH forged AS (
      UPDATE public."organizations" SET "kycStatus" = 'VERIFIED'
      WHERE id = 'org-other' RETURNING 1
    )
    SELECT count(*) INTO counted FROM forged;
  EXCEPTION WHEN insufficient_privilege THEN
    counted := 0;
  END;
  IF counted = 0 THEN
    RAISE NOTICE 'PASS  24 forged decision marker writes another tenant -> % rows', counted;
  ELSE
    RAISE WARNING 'FAIL  24 forged decision marker writes another tenant -> % rows (want 0)', counted;
    failures := failures + 1;
  END IF;

  ---------------------------------------------------------------------------
  -- Role attributes. These are the properties the whole arrangement rests on.
  ---------------------------------------------------------------------------
  measured := (
    SELECT rolsuper::text || '/' || rolbypassrls::text || '/' || rolinherit::text
    FROM pg_catalog.pg_roles WHERE rolname = current_user);
  IF measured = 'false/false/false' THEN
    RAISE NOTICE 'PASS  25 % is superuser/bypassrls/inherit -> %', current_user, measured;
  ELSE
    RAISE WARNING 'FAIL  25 % is superuser/bypassrls/inherit -> % (want false/false/false)', current_user, measured;
    failures := failures + 1;
  END IF;

  counted := (
    SELECT count(*) FROM pg_catalog.pg_auth_members m
    JOIN pg_catalog.pg_roles r ON r.oid = m.member
    WHERE r.rolname = current_user);
  IF counted = 0 THEN
    RAISE NOTICE 'PASS  26 % belongs to no other role -> % memberships', current_user, counted;
  ELSE
    RAISE WARNING 'FAIL  26 % belongs to no other role -> % memberships (want 0)', current_user, counted;
    failures := failures + 1;
  END IF;

  ---------------------------------------------------------------------------
  -- Escaping into the privileged principals. Attempted for real, one role at a
  -- time, and then proved against the catalog so a future grant that opens a
  -- path is caught even if the attempt is ever reordered away.
  ---------------------------------------------------------------------------
  FOREACH escape_role IN ARRAY ARRAY['pc_staff_runtime', 'pc_staff_authority', 'pc_identity_bootstrap']
  LOOP
    BEGIN
      EXECUTE format('SET ROLE %I', escape_role);
      RESET ROLE;
      RAISE WARNING 'FAIL  27 SET ROLE % from % -> allowed (want denial)', escape_role, current_user;
      failures := failures + 1;
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS  27 SET ROLE % from % -> denied', escape_role, current_user;
    END;
  END LOOP;

  measured := coalesce((
    SELECT string_agg(rolname, ',' ORDER BY rolname)
    FROM pg_catalog.pg_roles
    WHERE rolname IN ('pc_staff_runtime', 'pc_staff_authority', 'pc_identity_bootstrap')
      AND pg_catalog.pg_has_role(current_user, oid, 'MEMBER')
  ), 'none');
  IF measured = 'none' THEN
    RAISE NOTICE 'PASS  28 privileged roles reachable from % -> %', current_user, measured;
  ELSE
    RAISE WARNING 'FAIL  28 privileged roles reachable from % -> % (want none)', current_user, measured;
    failures := failures + 1;
  END IF;

  ---------------------------------------------------------------------------
  -- Every P0 identity command is exposed to the isolated auth principal, while
  -- the internal registration role-mapping helper remains private.
  ---------------------------------------------------------------------------
  measured := (
    has_function_privilege(current_user, 'auth.resolve_invitation_acceptance_credential(text,text)', 'EXECUTE')
    AND has_function_privilege(current_user, 'auth.accept_organization_invitation_identity(text,text,bigint,text,text,boolean,text,text,text,text)', 'EXECUTE')
    AND has_function_privilege(current_user, 'auth.change_organization_membership_role(text,text,text,text,text,text,bigint,text)', 'EXECUTE')
    AND has_function_privilege(current_user, 'auth.revoke_organization_membership(text,text,text,text,text,text,bigint)', 'EXECUTE')
    AND has_function_privilege(current_user, 'auth.prepare_organization_mfa_recovery_target(text,text,text,text,text,text,bigint)', 'EXECUTE')
    AND has_function_privilege(current_user, 'auth.organization_mfa_recovery_snapshot(text,text,text,text,text,text)', 'EXECUTE')
    AND has_function_privilege(current_user, 'auth.resolve_mfa_recovery_identity(text,text)', 'EXECUTE')
    AND has_function_privilege(current_user, 'auth.finalize_mfa_recovery_identity(text,text,text,bigint)', 'EXECUTE')
    AND has_function_privilege(current_user, 'auth.registration_platform_actor_authorized(text,text)', 'EXECUTE')
    AND has_function_privilege(current_user, 'auth.registration_organization_admin_context(text,text,text,text,text)', 'EXECUTE')
    AND has_function_privilege(current_user, 'auth.registration_platform_review_queue(text,text,integer)', 'EXECUTE')
    AND has_function_privilege(current_user, 'auth.registration_organization_join_queue(text,text,text,text,text,integer)', 'EXECUTE')
    AND has_function_privilege(current_user, 'auth.lock_registration_decision_application(text,text,text,text,text,text,text)', 'EXECUTE')
    AND has_function_privilege(current_user, 'auth.apply_registration_identity_transition(text,text,text,text,text,text,text,text)', 'EXECUTE')
    AND has_function_privilege(current_user, 'auth.account_data_export(text,text,text,text,text)', 'EXECUTE')
    AND has_function_privilege(current_user, 'auth.anonymize_account_identity(text,text,text,text,text)', 'EXECUTE')
    AND NOT has_function_privilege(current_user, 'auth.registration_role_assignment_allowed(text,text)', 'EXECUTE')
  )::text;
  IF measured = 'true' THEN
    RAISE NOTICE 'PASS  29 bounded P0 identity command surface -> %', measured;
  ELSE
    RAISE WARNING 'FAIL  29 bounded P0 identity command surface -> % (want true)', measured;
    failures := failures + 1;
  END IF;

  measured := coalesce((
    SELECT user_id || '/' || jsonb_array_length(membership_data)::text
    FROM auth.account_data_export(
      'sess-staff', 'user-staff', 'm-staff', 'org-a', 'tenant-a'
    )
  ), 'NONE');
  IF measured = 'user-staff/1' THEN
    RAISE NOTICE 'PASS  30 session-bound account export -> %', measured;
  ELSE
    RAISE WARNING 'FAIL  30 session-bound account export -> % (want user-staff/1)', measured;
    failures := failures + 1;
  END IF;

  measured := coalesce((
    SELECT user_id
    FROM auth.account_data_export(
      'sess-staff', 'user-staff', 'm-b', 'org-b', 'tenant-b'
    )
  ), 'NONE');
  IF measured = 'NONE' THEN
    RAISE NOTICE 'PASS  31 account export refuses a substituted tenant tuple -> %', measured;
  ELSE
    RAISE WARNING 'FAIL  31 account export refuses a substituted tenant tuple -> % (want NONE)', measured;
    failures := failures + 1;
  END IF;

  measured := coalesce((
    SELECT applied::text
    FROM auth.anonymize_account_identity(
      'sess-staff', 'user-staff', 'm-staff', 'org-a', 'tenant-a'
    )
  ), 'NONE');
  IF measured = 'true' THEN
    RAISE NOTICE 'PASS  32 authenticated account anonymization -> %', measured;
  ELSE
    RAISE WARNING 'FAIL  32 authenticated account anonymization -> % (want true)', measured;
    failures := failures + 1;
  END IF;

  measured := coalesce((
    SELECT applied::text
    FROM auth.anonymize_account_identity(
      'sess-staff', 'user-staff', 'm-staff', 'org-a', 'tenant-a'
    )
  ), 'NONE');
  IF measured = 'false' THEN
    RAISE NOTICE 'PASS  33 anonymization replay fails closed -> %', measured;
  ELSE
    RAISE WARNING 'FAIL  33 anonymization replay fails closed -> % (want false)', measured;
    failures := failures + 1;
  END IF;

  IF failures > 0 THEN
    RAISE EXCEPTION 'identity isolation: % tenant-runtime check(s) failed', failures;
  END IF;
  RAISE NOTICE 'tenant runtime: minimal login + tenant isolation checks, 0 failures';
END;
$tenant_checks$;
