from pathlib import Path
import json

# 1. Forward-only PostgreSQL authority for enumeration-safe idempotency and immediate membership revocation.
migration_path = Path('apps/api/prisma/migrations/20260731201200_p0_registration_enumeration_guard/migration.sql')
assert not migration_path.exists(), 'enumeration guard migration already exists'
migration_path.parent.mkdir(parents=True, exist_ok=True)
migration_path.write_text("""-- P0 registration anti-enumeration and membership-session authority.

CREATE TABLE auth.registration_public_attempts (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  request_hash TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  outcome TEXT NOT NULL,
  application_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT registration_public_attempts_outcome_check
    CHECK (outcome IN ('APPLICATION_CREATED', 'SUPPRESSED_EXISTING_ACCOUNT')),
  CONSTRAINT registration_public_attempts_application_fkey
    FOREIGN KEY (application_id) REFERENCES auth.registration_applications(id) ON DELETE RESTRICT,
  CONSTRAINT registration_public_attempts_application_binding_check
    CHECK (
      (outcome = 'APPLICATION_CREATED' AND application_id IS NOT NULL)
      OR (outcome = 'SUPPRESSED_EXISTING_ACCOUNT' AND application_id IS NULL)
    )
);

CREATE INDEX registration_public_attempts_request_hash_idx
  ON auth.registration_public_attempts(request_hash);
CREATE INDEX registration_public_attempts_created_idx
  ON auth.registration_public_attempts(created_at);

CREATE OR REPLACE FUNCTION auth.reject_registration_public_attempt_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION 'auth.registration_public_attempts is append-only';
END;
$$;

CREATE TRIGGER registration_public_attempts_append_only
BEFORE UPDATE OR DELETE ON auth.registration_public_attempts
FOR EACH ROW EXECUTE FUNCTION auth.reject_registration_public_attempt_mutation();

CREATE TRIGGER registration_public_attempts_no_truncate
BEFORE TRUNCATE ON auth.registration_public_attempts
FOR EACH STATEMENT EXECUTE FUNCTION auth.reject_registration_public_attempt_mutation();

DROP TRIGGER IF EXISTS auth_revoke_on_membership_change ON public.user_orgs;

CREATE OR REPLACE FUNCTION auth.revoke_sessions_for_membership_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  revocation_code TEXT;
BEGIN
  revocation_code := CASE
    WHEN OLD.status IS DISTINCT FROM NEW.status AND NEW.status <> 'ACTIVE'
      THEN 'MEMBERSHIP_NOT_ACTIVE'
    ELSE 'MEMBERSHIP_CHANGED'
  END;

  UPDATE auth.sessions
  SET status = 'REVOKED',
      revoked_at = NOW(),
      revocation_reason = revocation_code,
      updated_at = NOW()
  WHERE membership_id = OLD.id
    AND status IN ('ACTIVE', 'MFA_PENDING');

  UPDATE auth.refresh_tokens rt
  SET status = 'REVOKED',
      revoked_at = NOW(),
      revocation_reason = revocation_code
  FROM auth.sessions s
  WHERE s.id = rt.session_id
    AND s.membership_id = OLD.id
    AND rt.status IN ('ACTIVE', 'ROTATED');
  RETURN NEW;
END;
$$;

CREATE TRIGGER auth_revoke_on_membership_change
AFTER UPDATE OF \"userId\", \"organizationId\", role, status ON public.user_orgs
FOR EACH ROW
WHEN (
  OLD.\"userId\" IS DISTINCT FROM NEW.\"userId\"
  OR OLD.\"organizationId\" IS DISTINCT FROM NEW.\"organizationId\"
  OR OLD.role IS DISTINCT FROM NEW.role
  OR OLD.status IS DISTINCT FROM NEW.status
)
EXECUTE FUNCTION auth.revoke_sessions_for_membership_change();

REVOKE ALL ON auth.registration_public_attempts FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.reject_registration_public_attempt_mutation() FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.revoke_sessions_for_membership_change() FROM PUBLIC;

DO $grant_registration_attempts$
DECLARE
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['app_service', 'auth_service', 'app_auth']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('GRANT SELECT, INSERT ON auth.registration_public_attempts TO %I', role_name);
      EXECUTE format('REVOKE UPDATE, DELETE ON auth.registration_public_attempts FROM %I', role_name);
    END IF;
  END LOOP;
END
$grant_registration_attempts$;
""")

# 2. Remove the obsolete direct registration and synthetic identity authority.
auth_path = Path('apps/api/src/modules/auth/auth.service.ts')
auth = auth_path.read_text()
assert auth.count('  BadRequestException,\n') == 1
assert auth.count("import { RegisterDto } from './dto/register.dto';\n") == 1
auth = auth.replace('  BadRequestException,\n', '', 1)
auth = auth.replace("import { RegisterDto } from './dto/register.dto';\n", '', 1)
constants_start = auth.index('const SELF_REGISTERABLE_ROLES:')
constants_end_marker = "const SYNTHETIC_SEED_ENABLED = String(process.env.SEED_CANONICAL_TEST_DEAL ?? '').toLowerCase() === 'true';\n"
constants_end = auth.index(constants_end_marker, constants_start) + len(constants_end_marker)
auth = auth[:constants_start] + "const KNOWN_ROLES = new Set<string>(Object.values(Role));\nconst PRIVILEGED_MFA_ROLES = new Set<string>(ROLES_REQUIRING_MFA);\n" + auth[constants_end:]
self_register_start = auth.index('export function canSelfRegisterRole(')
self_register_end = auth.index('\nexport function requiresRoleMfa(', self_register_start)
auth = auth[:self_register_start] + auth[self_register_end + 1:]
seed_type_start = auth.index('type SeedCompatibilityUser = {')
seed_type_end = auth.index('\ntype AuthUserProjection = {', seed_type_start)
auth = auth[:seed_type_start] + auth[seed_type_end + 1:]
auth = auth.replace('  private readonly seedCompatibilityUsers: SeedCompatibilityUser[] = [];\n\n', '', 1)
register_start = auth.index('  async register(')
register_end = auth.index('\n  async refresh(', register_start)
auth = auth[:register_start] + auth[register_end:]
synthetic_start = auth.index('  /** Synthetic E2E compatibility only. Runtime authorization never reads this cache. */')
synthetic_end = auth.index('  private async issueActiveTokens(', synthetic_start)
auth = auth[:synthetic_start] + auth[synthetic_end:]
for forbidden in ['async register(', 'registerSyntheticSeedUser', 'SEED_CANONICAL_TEST_DEAL', 'seedCompatibilityUsers', 'canSelfRegisterRole']:
    assert forbidden not in auth, f'obsolete registration authority remains: {forbidden}'
auth_path.write_text(auth)

auth_spec_path = Path('apps/api/src/modules/auth/auth.service.spec.ts')
auth_spec_path.write_text("""import fs from 'node:fs';
import path from 'node:path';
import {
  requiresRecentFinancialMfa,
  requiresRoleMfa,
} from './auth.service';
import {
  FINANCIAL_MFA_THRESHOLD_KOPECKS,
  Role,
} from '../../common/types/request-user';

const authSource = fs.readFileSync(path.join(process.cwd(), 'src/modules/auth/auth.service.ts'), 'utf8');

describe('persistent auth policy', () => {
  it('contains no direct registration or synthetic identity authority', () => {
    expect(authSource).not.toContain('async register(');
    expect(authSource).not.toContain('registerSyntheticSeedUser');
    expect(authSource).not.toContain('SEED_CANONICAL_TEST_DEAL');
    expect(authSource).not.toContain('seedCompatibilityUsers');
  });

  it.each([
    Role.ADMIN,
    Role.COMPLIANCE_OFFICER,
    Role.ARBITRATOR,
  ])('requires MFA before activating privileged role %s', (role) => {
    expect(requiresRoleMfa(role)).toBe(true);
  });

  it('requires recent MFA at the exact financial threshold', () => {
    expect(requiresRecentFinancialMfa(FINANCIAL_MFA_THRESHOLD_KOPECKS - 1)).toBe(false);
    expect(requiresRecentFinancialMfa(FINANCIAL_MFA_THRESHOLD_KOPECKS)).toBe(true);
    expect(requiresRecentFinancialMfa(FINANCIAL_MFA_THRESHOLD_KOPECKS + 1)).toBe(true);
  });
});
""")

# 3. Replace public registration submission with enumeration-safe, durable idempotency.
registration_path = Path('apps/api/src/modules/auth/registration-application.service.ts')
registration = registration_path.read_text()
old_existing_type_start = registration.index('type ExistingApplicationRow = {')
old_existing_type_end = registration.index('\ntype EmailChallengeRow = {', old_existing_type_start)
new_existing_type = """type RegistrationAttemptOutcome = 'APPLICATION_CREATED' | 'SUPPRESSED_EXISTING_ACCOUNT';

type ExistingSubmissionRow = {
  id: string | null;
  request_hash: string;
  status: string;
  correlation_id: string;
  idempotency_key: string;
  outcome: RegistrationAttemptOutcome;
};
"""
registration = registration[:old_existing_type_start] + new_existing_type + registration[old_existing_type_end + 1:]
old_status_type = """type ApplicationStatusRow = {
  id: string;
  kind: string;
  status: string;
  correlation_id: string;
  requested_workspace: PublicWorkspaceClass;
  submitted_at: Date;
  updated_at: Date;
  expires_at: Date;
  decision_reason: string | null;
  version: bigint;
};
"""
new_status_type = """type ApplicationStatusRow = {
  id: string;
  status: string;
  correlation_id: string;
  submitted_at: Date;
  updated_at: Date;
  expires_at: Date;
  decision_reason: string | null;
  version: bigint;
};
"""
assert registration.count(old_status_type) == 1
registration = registration.replace(old_status_type, new_status_type, 1)
submit_start = registration.index('  async submit(\n')
submit_end = registration.index('\n  async verifyEmail(', submit_start)
new_submit = r'''  async submit(
    dto: RegisterDto,
    context: {
      idempotencyKey?: string;
      correlationId: string;
      deliveryKey?: string;
      ip?: string;
      userAgent?: string;
    },
  ) {
    const idempotencyKey = String(context.idempotencyKey ?? '').trim();
    if (idempotencyKey.length < 16 || idempotencyKey.length > 128) {
      throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    }

    const normalized = {
      email: dto.email.trim().toLowerCase(),
      phone: normalizePhone(dto.phone),
      fullName: dto.fullName.trim(),
      position: dto.position.trim(),
      orgLegalName: dto.orgLegalName.trim(),
      orgInn: dto.orgInn.replace(/\D/g, ''),
      orgKpp: dto.orgKpp?.replace(/\D/g, '') || null,
      orgOgrn: dto.orgOgrn?.replace(/\D/g, '') || null,
      orgType: dto.orgType,
      region: dto.region.trim(),
      workspace: dto.workspace,
      termsVersion: dto.termsVersion.trim(),
      privacyVersion: dto.privacyVersion.trim(),
    };
    const requestHash = hashAuthMaterial(stableJson(normalized));

    const existing = await this.findByIdempotency(idempotencyKey);
    if (existing) {
      if (!registrationTokenHashMatches(existing.request_hash, requestHash)) {
        throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD' });
      }
      return this.submissionResponse(existing);
    }

    const requestedRole = roleForWorkspace(normalized.workspace);
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const emailToken = issueRegistrationEmailToken();
    const now = new Date();
    const applicationExpiresAt = new Date(now.getTime() + REGISTRATION_APPLICATION_TTL_MS);
    const emailExpiresAt = new Date(now.getTime() + REGISTRATION_EMAIL_TTL_MS);
    const applicationId = `reg_${randomUUID()}`;
    const userId = `user_${randomUUID()}`;
    const membershipId = `membership_${randomUUID()}`;
    const statusToken = deriveRegistrationStatusToken(applicationId, idempotencyKey);
    const statusTokenHash = hashRegistrationStatusToken(statusToken);

    const result = await this.prisma.$transaction(async (tx) => {
      await this.lockRegistrationKeys(tx, [
        `registration-idempotency:${idempotencyKey}`,
        `registration-email:${normalized.email}`,
        `registration-inn:${normalized.orgInn}`,
      ]);

      const concurrent = await this.findByIdempotency(idempotencyKey, tx);
      if (concurrent) {
        if (!registrationTokenHashMatches(concurrent.request_hash, requestHash)) {
          throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD' });
        }
        return { existing: concurrent } as const;
      }

      const existingUser = await tx.user.findUnique({
        where: { email: normalized.email },
        select: { id: true },
      });
      if (existingUser) {
        const suppressed = {
          id: null,
          request_hash: requestHash,
          status: 'EMAIL_VERIFICATION_REQUIRED',
          correlation_id: context.correlationId,
          idempotency_key: idempotencyKey,
          outcome: 'SUPPRESSED_EXISTING_ACCOUNT',
        } satisfies ExistingSubmissionRow;
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO auth.registration_public_attempts (
            id, idempotency_key, request_hash, correlation_id, outcome, application_id
          ) VALUES (
            ${`reg_attempt_${randomUUID()}`}, ${idempotencyKey}, ${requestHash},
            ${context.correlationId}, 'SUPPRESSED_EXISTING_ACCOUNT', NULL
          )
        `);
        await this.audit(tx, {
          action: 'auth.registration.submit',
          outcome: 'SUCCESS',
          reason: 'PUBLIC_REQUEST_ACCEPTED',
          metadata: { correlationId: context.correlationId, requestHash },
        });
        return { existing: suppressed } as const;
      }

      const existingOrganization = await tx.organization.findUnique({
        where: { inn: normalized.orgInn },
        select: { id: true, tenantId: true },
      });
      const kind = existingOrganization ? 'JOIN_EXISTING_ORGANIZATION' : 'NEW_ORGANIZATION';
      const organizationId = existingOrganization?.id ?? `org_${randomUUID()}`;
      const tenantId = existingOrganization?.tenantId ?? `tenant_${randomUUID()}`;

      if (!existingOrganization) {
        await tx.organization.create({
          data: {
            id: organizationId,
            inn: normalized.orgInn,
            ogrn: normalized.orgOgrn,
            name: normalized.orgLegalName,
            type: normalized.orgType,
            status: 'PENDING',
            tenantId,
            kycStatus: 'PENDING',
            amlStatus: 'CLEAR',
          },
        });
        await tx.$executeRaw(Prisma.sql`
          UPDATE public.organizations
          SET kpp = ${normalized.orgKpp}, region = ${normalized.region}
          WHERE id = ${organizationId}
        `);
      }

      await tx.user.create({
        data: {
          id: userId,
          email: normalized.email,
          phone: normalized.phone,
          passwordHash,
          fullName: normalized.fullName,
          status: 'PENDING_EMAIL_VERIFICATION',
        },
      });
      await tx.userOrg.create({
        data: {
          id: membershipId,
          userId,
          organizationId,
          role: Role.GUEST,
          status: 'PENDING',
          requestedWorkspace: normalized.workspace,
          isDefault: true,
        },
      });
      await this.authRepository.ensureCredentialState(
        tx,
        userId,
        `${normalized.termsVersion}|${normalized.privacyVersion}`,
        now,
      );

      await tx.$executeRaw(Prisma.sql`
        INSERT INTO auth.registration_applications (
          id, kind, user_id, organization_id, membership_id,
          requested_workspace, requested_role, status,
          correlation_id, idempotency_key, request_hash,
          legal_name, inn, kpp, ogrn, region, applicant_position,
          email, phone, terms_version, privacy_version,
          terms_accepted_at, privacy_accepted_at,
          consent_ip_hash, consent_user_agent_hash,
          status_token_hash, expires_at
        ) VALUES (
          ${applicationId}, ${kind}, ${userId}, ${organizationId}, ${membershipId},
          ${normalized.workspace}, ${requestedRole}, 'EMAIL_VERIFICATION_REQUIRED',
          ${context.correlationId}, ${idempotencyKey}, ${requestHash},
          ${normalized.orgLegalName}, ${normalized.orgInn}, ${normalized.orgKpp}, ${normalized.orgOgrn},
          ${normalized.region}, ${normalized.position}, ${normalized.email}, ${normalized.phone},
          ${normalized.termsVersion}, ${normalized.privacyVersion}, ${now}, ${now},
          ${hashClientValue(context.ip)}, ${hashClientValue(context.userAgent)},
          ${statusTokenHash}, ${applicationExpiresAt}
        )
      `);
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO auth.registration_email_challenges (
          id, application_id, user_id, token_hash, expires_at
        ) VALUES (
          ${emailToken.id}, ${applicationId}, ${userId}, ${emailToken.hash}, ${emailExpiresAt}
        )
      `);
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO auth.registration_public_attempts (
          id, idempotency_key, request_hash, correlation_id, outcome, application_id
        ) VALUES (
          ${`reg_attempt_${randomUUID()}`}, ${idempotencyKey}, ${requestHash},
          ${context.correlationId}, 'APPLICATION_CREATED', ${applicationId}
        )
      `);
      await this.insertEvent(tx, {
        applicationId,
        actorUserId: userId,
        actorKind: 'APPLICANT',
        previousStatus: null,
        newStatus: 'EMAIL_VERIFICATION_REQUIRED',
        reason: kind === 'NEW_ORGANIZATION' ? 'NEW_ORGANIZATION_SUBMITTED' : 'JOIN_REQUEST_SUBMITTED',
        correlationId: context.correlationId,
        idempotencyKey: `submit:${idempotencyKey}`,
        applicationVersion: 0n,
        metadata: { workspace: normalized.workspace, requestedRole },
      });
      await this.audit(tx, {
        userId,
        membershipId,
        organizationId,
        tenantId,
        action: 'auth.registration.submit',
        outcome: 'SUCCESS',
        reason: 'PUBLIC_REQUEST_ACCEPTED',
        metadata: { applicationId, correlationId: context.correlationId },
      });

      return {
        existing: {
          id: applicationId,
          request_hash: requestHash,
          status: 'EMAIL_VERIFICATION_REQUIRED',
          correlation_id: context.correlationId,
          idempotency_key: idempotencyKey,
          outcome: 'APPLICATION_CREATED',
        } satisfies ExistingSubmissionRow,
        emailDelivery: deliveryAuthorized(context.deliveryKey)
          ? { email: normalized.email, token: emailToken.token, expiresInSeconds: Math.floor(REGISTRATION_EMAIL_TTL_MS / 1000) }
          : undefined,
      } as const;
    });

    return this.submissionResponse(result.existing, result.emailDelivery);
  }
'''
registration = registration[:submit_start] + new_submit + registration[submit_end:]
status_query_old = '''      SELECT
        id, kind, status, correlation_id, requested_workspace,
        submitted_at, updated_at, expires_at, decision_reason, version
'''
status_query_new = '''      SELECT
        id, status, correlation_id,
        submitted_at, updated_at, expires_at, decision_reason, version
'''
assert registration.count(status_query_old) == 1
registration = registration.replace(status_query_old, status_query_new, 1)
registration = registration.replace('      kind: application.kind,\n', '', 1)
registration = registration.replace('      requestedWorkspace: application.requested_workspace,\n', '', 1)
helpers_start = registration.index('  private async findByIdempotency(')
helpers_end = registration.index('  private async insertEvent(', helpers_start)
new_helpers = r'''  private async lockRegistrationKeys(client: AuthSqlClient, keys: string[]): Promise<void> {
    for (const key of [...new Set(keys)].sort()) {
      await client.$queryRaw<Array<{ acquired: number }>>(Prisma.sql`
        SELECT 1::int AS acquired
        FROM (
          SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))
        ) AS registration_lock
      `);
    }
  }

  private async findByIdempotency(
    idempotencyKey: string,
    client: AuthSqlClient = this.prisma,
  ): Promise<ExistingSubmissionRow | null> {
    const rows = await client.$queryRaw<ExistingSubmissionRow[]>(Prisma.sql`
      SELECT
        application.id,
        attempt.request_hash,
        COALESCE(application.status, 'EMAIL_VERIFICATION_REQUIRED') AS status,
        attempt.correlation_id,
        attempt.idempotency_key,
        attempt.outcome
      FROM auth.registration_public_attempts attempt
      LEFT JOIN auth.registration_applications application
        ON application.id = attempt.application_id
      WHERE attempt.idempotency_key = ${idempotencyKey}
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  private submissionResponse(
    submission: ExistingSubmissionRow,
    emailDelivery?: { email: string; token: string; expiresInSeconds: number },
  ) {
    const publicResponse = {
      accepted: true,
      status: 'EMAIL_VERIFICATION_REQUIRED',
      nextAction: 'VERIFY_EMAIL',
      correlationId: submission.correlation_id,
    };
    if (!emailDelivery || submission.outcome !== 'APPLICATION_CREATED' || !submission.id) {
      return publicResponse;
    }
    return {
      ...publicResponse,
      applicationId: submission.id,
      statusToken: deriveRegistrationStatusToken(submission.id, submission.idempotency_key),
      emailDelivery,
    };
  }


'''
registration = registration[:helpers_start] + new_helpers + registration[helpers_end:]
for leak in ['REGISTRATION_ACCOUNT_ALREADY_EXISTS', 'kind: application.kind', 'requestedWorkspace: application.requested_workspace']:
    assert leak not in registration, f'enumeration leak remains: {leak}'
registration_path.write_text(registration)

# 4. Public BFF always returns a generic accepted envelope and strips internal status authority.
route_path = Path('apps/web/app/api/auth/register/route.ts')
route = route_path.read_text()
route = route.replace('  kind?: string;\n', '', 1)
route = route.replace('  requestedWorkspace?: string;\n', '', 1)
public_return_old = '''    return json({
      accepted: true,
      applicationId: payload.applicationId,
      kind: payload.kind,
      status: payload.status,
      requestedWorkspace: payload.requestedWorkspace,
      nextAction: payload.nextAction,
      statusToken: payload.statusToken,
      correlationId: payload.correlationId || correlationId,
    }, 202);
'''
public_return_new = '''    return json({
      accepted: true,
      status: 'EMAIL_VERIFICATION_REQUIRED',
      nextAction: 'VERIFY_EMAIL',
      correlationId: payload.correlationId || correlationId,
    }, 202);
'''
assert route.count(public_return_old) == 1, 'public registration response anchor mismatch'
route = route.replace(public_return_old, public_return_new, 1)
route_path.write_text(route)

# 5. UI shows one generic check-email result and never branches on account existence.
client_path = Path('apps/web/app/platform-v7/register/RegisterFormClient.tsx')
client = client_path.read_text()
client = client.replace('  kind?: string;\n', '', 1)
client = client.replace('  requestedWorkspace?: string;\n', '', 1)
client = client.replace('  existingAccount: string;\n', '  submissionAccepted: string;\n', 1)
client = client.replace("    existingAccount: 'Учётная запись уже существует. Используй вход или восстановление доступа.',", "    submissionAccepted: 'Если адрес можно использовать для новой заявки, письмо отправлено. Если учётная запись уже существует, используй вход или восстановление доступа.',", 1)
client = client.replace("existingAccount: 'The account already exists. Use sign in or access recovery.'", "submissionAccepted: 'If the address can be used for a new application, an email has been sent. If an account already exists, use sign in or access recovery.'", 1)
client = client.replace("existingAccount: '该账户已存在。请登录或恢复访问权限。'", "submissionAccepted: '如果该地址可用于新申请，我们已发送邮件。如果账户已存在，请登录或恢复访问权限。'", 1)
state_anchor = "  const [verificationCompleted, setVerificationCompleted] = React.useState(false);\n"
assert client.count(state_anchor) == 1
client = client.replace(state_anchor, state_anchor + "  const [submissionAccepted, setSubmissionAccepted] = React.useState(false);\n", 1)
submit_old = '''      if (!response.ok || result.accepted !== true || !result.statusToken) {
        if (result.code === 'REGISTRATION_ACCOUNT_ALREADY_EXISTS') throw new Error('existing');
        if (response.status === 400) throw new Error('invalid');
        throw new Error('unavailable');
      }
      setStatusToken(result.statusToken);
      setStatus(result);
      window.history.replaceState(null, '', `/platform-v7/register?statusToken=${encodeURIComponent(result.statusToken)}&lang=${locale}`);
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : 'unavailable';
      setError(reason === 'existing' ? copy.existingAccount : reason === 'invalid' ? copy.invalid : copy.unavailable);
'''
submit_new = '''      if (!response.ok || result.accepted !== true) {
        if (response.status === 400) throw new Error('invalid');
        throw new Error('unavailable');
      }
      setSubmissionAccepted(true);
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : 'unavailable';
      setError(reason === 'invalid' ? copy.invalid : copy.unavailable);
'''
assert client.count(submit_old) == 1, 'client submit enumeration anchor mismatch'
client = client.replace(submit_old, submit_new, 1)
status_branch_anchor = "  if (statusToken || status) {\n"
generic_branch = '''  if (submissionAccepted) {
    return (
      <section className='p0-register-card p0-register-state' aria-labelledby='p0-register-status-title' aria-live='polite'>
        <ShieldCheck size={40} aria-hidden='true' />
        <h2 id='p0-register-status-title'>{copy.statusTitle}</h2>
        <p>{copy.submissionAccepted}</p>
        {correlationId ? <p className='p0-register-correlation'>ID: {correlationId}</p> : null}
        <div className='p0-register-actions'>
          <a className='p0-register-secondary' href='/platform-v7/login'>{copy.login}</a>
          <a className='p0-register-primary' href='/platform-v7/forgot-password'>{copy.recovery}</a>
        </div>
      </section>
    );
  }

'''
assert client.count(status_branch_anchor) == 1
client = client.replace(status_branch_anchor, generic_branch + status_branch_anchor, 1)
for leak in ['REGISTRATION_ACCOUNT_ALREADY_EXISTS', 'copy.existingAccount', 'existingAccount:']:
    assert leak not in client, f'client enumeration branch remains: {leak}'
client_path.write_text(client)

# 6. Static web boundary acceptance.
web_test_path = Path('apps/web/tests/unit/platformV7FirstCustomerRegistrationBoundary.test.ts')
web_test = web_test_path.read_text()
old_status_test = '''  it('does not create a session after registration and routes to application status', () => {
    expect(registerRoute).not.toContain('applyAuthenticatedSession');
    expect(registerRoute).not.toContain('cookies()');
    expect(registerClient).toContain('statusToken');
    expect(registerClient).toContain('/api/auth/registration/status');
    expect(registerClient).toContain('/api/auth/registration/verify');
  });
'''
new_status_test = '''  it('does not create a session and does not expose registration authority on public submission', () => {
    expect(registerRoute).not.toContain('applyAuthenticatedSession');
    expect(registerRoute).not.toContain('cookies()');
    expect(registerRoute).not.toContain('kind: payload.kind');
    expect(registerRoute).not.toContain('statusToken: payload.statusToken');
    expect(registerRoute).not.toContain('applicationId: payload.applicationId');
    expect(registerRoute).toContain("status: 'EMAIL_VERIFICATION_REQUIRED'");
    expect(registerClient).toContain('submissionAccepted');
    expect(registerClient).not.toContain('REGISTRATION_ACCOUNT_ALREADY_EXISTS');
    expect(registerClient).toContain('/api/auth/registration/status');
    expect(registerClient).toContain('/api/auth/registration/verify');
  });
'''
assert web_test.count(old_status_test) == 1
web_test = web_test.replace(old_status_test, new_status_test, 1)
web_test_path.write_text(web_test)

# 7. PostgreSQL E2E: identical public envelope for existing email/new org/existing org, durable replay, no pre-activation login.
e2e_path = Path('apps/api/test/auth/persistent-auth.e2e-spec.ts')
e2e = e2e_path.read_text()
import_anchor = "import { AuthService } from '../../src/modules/auth/auth.service';\n"
assert e2e.count(import_anchor) == 1
e2e = e2e.replace(import_anchor, import_anchor + "import { AuthPrismaService } from '../../src/modules/auth/auth-prisma.service';\nimport { RegistrationApplicationService } from '../../src/modules/auth/registration-application.service';\n", 1)
runtime_type_old = '''type Runtime = {
  prisma: PrismaService;
  repository: PersistentAuthRepository;
  auth: AuthService;
};

function runtime(): Runtime {
  const prisma = new PrismaService();
  const repository = new PersistentAuthRepository(prisma);
  return { prisma, repository, auth: new AuthService(repository) };
}
'''
runtime_type_new = '''type Runtime = {
  prisma: PrismaService;
  authPrisma: AuthPrismaService;
  repository: PersistentAuthRepository;
  auth: AuthService;
  registration: RegistrationApplicationService;
};

function runtime(): Runtime {
  const prisma = new PrismaService();
  const authPrisma = new AuthPrismaService();
  const repository = new PersistentAuthRepository(prisma);
  return {
    prisma,
    authPrisma,
    repository,
    auth: new AuthService(repository),
    registration: new RegistrationApplicationService(authPrisma, repository),
  };
}
'''
assert e2e.count(runtime_type_old) == 1
e2e = e2e.replace(runtime_type_old, runtime_type_new, 1)
connect_old = '''  beforeAll(async () => {
    await Promise.all([first.prisma.$connect(), second.prisma.$connect()]);
  });

  afterAll(async () => {
    await Promise.all([first.prisma.$disconnect(), second.prisma.$disconnect()]);
  });
'''
connect_new = '''  beforeAll(async () => {
    await Promise.all([
      first.prisma.$connect(),
      second.prisma.$connect(),
      first.authPrisma.$connect(),
      second.authPrisma.$connect(),
    ]);
  });

  afterAll(async () => {
    await Promise.all([
      first.prisma.$disconnect(),
      second.prisma.$disconnect(),
      first.authPrisma.$disconnect(),
      second.authPrisma.$disconnect(),
    ]);
  });
'''
assert e2e.count(connect_old) == 1
e2e = e2e.replace(connect_old, connect_new, 1)
old_direct_test_start = e2e.index("  it('ignores client orgId during self-registration and creates a pending organization'")
old_direct_test_end = e2e.index("  it('writes chained auth audit evidence'", old_direct_test_start)
anti_enum_test = r'''  it('prevents public email and organization enumeration with durable idempotency', async () => {
    const dto = (email: string, orgInn: string, orgLegalName: string) => ({
      email,
      phone: '+79990001122',
      fullName: 'Registration Applicant',
      position: 'Director',
      orgLegalName,
      orgInn,
      orgType: 'LEGAL' as const,
      region: 'Moscow',
      workspace: 'buyer' as const,
      password: PASSWORD,
      termsVersion: '2026-07-31',
      privacyVersion: '2026-07-31',
      acceptTerms: true as const,
      acceptPrivacy: true as const,
    });
    const publicKeys = ['accepted', 'correlationId', 'nextAction', 'status'];

    const existingAccount = await seedIdentity('enumeration-existing-account', Role.BUYER);
    const existingAccountDto = dto(
      existingAccount.email,
      '780000000011',
      'Enumeration Existing Account Probe',
    );
    const suppressed = await first.registration.submit(existingAccountDto, {
      idempotencyKey: 'registration-enumeration-existing-0001',
      correlationId: 'registration-enumeration-existing-correlation',
    });
    const suppressedReplay = await second.registration.submit(existingAccountDto, {
      idempotencyKey: 'registration-enumeration-existing-0001',
      correlationId: 'ignored-replay-correlation',
    });
    expect(Object.keys(suppressed).sort()).toEqual(publicKeys);
    expect(suppressedReplay).toEqual(suppressed);
    await expect(second.registration.submit({ ...existingAccountDto, phone: '+79990001123' }, {
      idempotencyKey: 'registration-enumeration-existing-0001',
      correlationId: 'registration-enumeration-conflict',
    })).rejects.toThrow(/IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD/);

    const newOrganizationEmail = 'enumeration-new-org@auth.test';
    const newOrganization = await first.registration.submit(
      dto(newOrganizationEmail, '780000000012', 'Enumeration New Organization'),
      {
        idempotencyKey: 'registration-enumeration-new-org-0001',
        correlationId: 'registration-enumeration-new-org-correlation',
      },
    );
    expect(Object.keys(newOrganization).sort()).toEqual(publicKeys);
    await expect(first.auth.login({ email: newOrganizationEmail, password: PASSWORD }))
      .rejects.toThrow(/USER_NOT_ACTIVE|ORGANIZATION_NOT_VERIFIED/);

    const existingOrganization = await seedIdentity('enumeration-existing-org', Role.FARMER);
    const joinOrganization = await first.registration.submit(
      dto('enumeration-join-org@auth.test', existingOrganization.organization.inn, 'Probe Legal Name'),
      {
        idempotencyKey: 'registration-enumeration-join-org-0001',
        correlationId: 'registration-enumeration-join-org-correlation',
      },
    );
    expect(Object.keys(joinOrganization).sort()).toEqual(publicKeys);

    const attempts = await first.prisma.$queryRaw<Array<{
      idempotency_key: string;
      outcome: string;
      application_id: string | null;
    }>>`
      SELECT idempotency_key, outcome, application_id
      FROM auth.registration_public_attempts
      WHERE idempotency_key IN (
        'registration-enumeration-existing-0001',
        'registration-enumeration-new-org-0001',
        'registration-enumeration-join-org-0001'
      )
      ORDER BY idempotency_key
    `;
    expect(attempts).toEqual([
      expect.objectContaining({
        idempotency_key: 'registration-enumeration-existing-0001',
        outcome: 'SUPPRESSED_EXISTING_ACCOUNT',
        application_id: null,
      }),
      expect.objectContaining({
        idempotency_key: 'registration-enumeration-join-org-0001',
        outcome: 'APPLICATION_CREATED',
        application_id: expect.any(String),
      }),
      expect.objectContaining({
        idempotency_key: 'registration-enumeration-new-org-0001',
        outcome: 'APPLICATION_CREATED',
        application_id: expect.any(String),
      }),
    ]);

    const previousDeliveryKey = process.env.REGISTRATION_DELIVERY_KEY;
    process.env.REGISTRATION_DELIVERY_KEY = 'registration-delivery-key-32-characters-minimum';
    try {
      const internal = await first.registration.submit(
        dto('enumeration-delivery@auth.test', '780000000013', 'Enumeration Delivery Organization'),
        {
          idempotencyKey: 'registration-enumeration-delivery-0001',
          correlationId: 'registration-enumeration-delivery-correlation',
          deliveryKey: process.env.REGISTRATION_DELIVERY_KEY,
        },
      ) as any;
      expect(internal.emailDelivery).toMatchObject({ email: 'enumeration-delivery@auth.test' });
      expect(internal.statusToken).toMatch(/^rst_reg_/);
      expect(internal).not.toHaveProperty('kind');
      expect(internal).not.toHaveProperty('requestedWorkspace');
      const publicStatus = await first.registration.status(internal.statusToken);
      expect(publicStatus).not.toHaveProperty('kind');
      expect(publicStatus).not.toHaveProperty('requestedWorkspace');
    } finally {
      if (previousDeliveryKey === undefined) delete process.env.REGISTRATION_DELIVERY_KEY;
      else process.env.REGISTRATION_DELIVERY_KEY = previousDeliveryKey;
    }
  });

'''
e2e = e2e[:old_direct_test_start] + anti_enum_test + e2e[old_direct_test_end:]
e2e = e2e.replace("await expect(second.auth.verifyAccessToken(accessLogin.accessToken)).rejects.toThrow(/not active/i);", "await expect(second.auth.verifyAccessToken(accessLogin.accessToken)).rejects.toThrow(/revoked|not active/i);", 1)
e2e_path.write_text(e2e)

# 8. Bounded scope/evidence update.
scope_path = Path('docs/platform-v7/autopilot/scopes/p0-first-customer-access-3563.json')
scope = json.loads(scope_path.read_text())
new_paths = [
  'apps/api/prisma/migrations/20260731201200_p0_registration_enumeration_guard/migration.sql',
  'apps/api/src/modules/auth/auth.service.spec.ts',
]
for path in new_paths:
    if path not in scope['allowedPaths']:
        scope['allowedPaths'].append(path)
scope['allowedPaths'] = sorted(scope['allowedPaths'])
scope['acceptance']['changedPathCount'] = len(scope['allowedPaths'])
assert scope['acceptance']['changedPathCount'] == 40
repair = scope.setdefault('repairEvidence', {})
repair['enumerationGuardSourceHead'] = '783d61131d94c3d147c3782f6d53f8126dfd0314'
repair['enumerationGuardHead'] = 'PENDING_EXACT_HEAD'
for defect in [
  'obsolete AuthService.register authority allowed client-selected role and immediate ACTIVE identity',
  'public registration disclosed existing email and organization existence',
]:
    if defect not in repair.setdefault('confirmedDefects', []):
        repair['confirmedDefects'].append(defect)
for item in [
  'remove obsolete direct registration and synthetic identity compatibility authority',
  'persist generic public registration attempts and return one enumeration-safe envelope',
]:
    if item not in repair.setdefault('repair', []):
        repair['repair'].append(item)
scope_path.write_text(json.dumps(scope, ensure_ascii=False, indent=2) + '\n')
