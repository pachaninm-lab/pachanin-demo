-- Bootstrap the platform owner as a real PLATFORM_OWNER so the staff control
-- centre renders the full owner interface (assignments/me returns the role).
--
-- Runs as the DDL superuser, so it bypasses RLS/FORCE RLS. Idempotent — every
-- statement is ON CONFLICT DO NOTHING. Passwords are not used for the owner
-- (controlled/session login); the hash is a non-verifiable placeholder that
-- blocks password auth. psql vars: org_id, tenant_id, user_id, owner_email, full_name.
\set ON_ERROR_STOP on

-- Platform operator's own organisation.
INSERT INTO public.organizations
  (id, inn, name, type, status, "tenantId", "kycStatus", "amlStatus", "verifiedAt", "createdAt", "updatedAt")
VALUES
  (:'org_id', '9999999999', 'Прозрачная Цена — оператор платформы', 'LEGAL', 'ACTIVE',
   :'tenant_id', 'VERIFIED', 'CLEAR', NOW(), NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Owner user.
INSERT INTO public.users
  (id, email, "passwordHash", "fullName", status, "createdAt", "updatedAt")
VALUES
  (:'user_id', :'owner_email', 'controlled-login-no-password', :'full_name', 'ACTIVE', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Owner membership in the platform organisation.
INSERT INTO public.user_orgs
  (id, "userId", "organizationId", role, "isDefault", "joinedAt")
VALUES
  (:'user_id' || '-membership', :'user_id', :'org_id', 'ADMIN', TRUE, NOW())
ON CONFLICT DO NOTHING;

-- Active PLATFORM_OWNER staff assignment — the full owner control plane.
-- (An AFTER INSERT trigger also flips credential_states.mfa_enabled on.)
INSERT INTO auth.staff_assignments
  (id, user_id, role, status, valid_from, reason, created_at, updated_at)
VALUES
  (:'user_id' || '-platform-owner', :'user_id', 'PLATFORM_OWNER', 'ACTIVE', NOW(),
   'Bootstrap platform owner (controlled pilot).', NOW(), NOW())
ON CONFLICT DO NOTHING;
