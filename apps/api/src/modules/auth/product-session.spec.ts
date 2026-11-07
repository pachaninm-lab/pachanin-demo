import { UnauthorizedException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { signAccessToken } from './access-token';
import { encryptMfaSecret, generateTotpSecret } from './auth-crypto';
import { PersistentAuthRepository, type ProductSessionContextRow } from './persistent-auth.repository';
import { ProductSessionService } from './product-session.service';
import {
  digestMfaBackupCode,
  issueMfaChallengeCredential,
  issueRefreshCredential,
  makeOpaqueToken,
} from './opaque-token-authority';

const migration = fs.readFileSync(
  path.join(process.cwd(), 'prisma/migrations/20260813060000_gekta_product_session_scope/migration.sql'),
  'utf8',
);
const repositorySource = fs.readFileSync(
  path.join(process.cwd(), 'src/modules/auth/persistent-auth.repository.ts'),
  'utf8',
);

const USER_ID = 'user-gekta-1';
const SESSION_ID = 'ses-gekta-1';

function productSession(overrides: Partial<ProductSessionContextRow> = {}): ProductSessionContextRow {
  return {
    user_id: USER_ID,
    email: 'agronom@example.test',
    full_name: 'Агроном',
    user_status: 'ACTIVE',
    session_id: SESSION_ID,
    session_scope: 'GEKTA',
    session_status: 'ACTIVE',
    refresh_family_id: 'fam-gekta-1',
    session_credential_version: 1,
    mfa_level: 'TOTP',
    mfa_verified_at: new Date('2026-08-13T05:00:00.000Z'),
    session_expires_at: new Date(Date.now() + 60_000),
    // Fresh by default: these fixtures exercise other reasons a session can be
    // invalid, and an idle one would mask them.
    session_last_seen_at: new Date(),
    revoked_at: null,
    revocation_reason: null,
    current_credential_version: 1,
    current_mfa_enabled: true,
    ...overrides,
  };
}

function repository(row: ProductSessionContextRow | null = productSession()) {
  return {
    prisma: {},
    transaction: jest.fn(async (work: (tx: unknown) => Promise<unknown>) => work({})),
    getProductSessionContext: jest.fn().mockResolvedValue(row),
    getProductRefreshContextForUpdate: jest.fn(),
    getProductMfaChallengeForUpdate: jest.fn(),
    getCredentialState: jest.fn(),
    createProductSession: jest.fn(),
    setMfaSecret: jest.fn(),
    createMfaChallenge: jest.fn(),
    recordMfaFailure: jest.fn(),
    activateMfaSession: jest.fn(),
    createRefreshToken: jest.fn(),
    rotateRefreshToken: jest.fn(),
    revokeFamily: jest.fn(),
    revokeSession: jest.fn(),
    touchSession: jest.fn(),
    latestAuditChainPosition: jest.fn().mockResolvedValue({ chainKey: 'auth-global', prevHash: null, nextSequence: 1n }),
    insertAudit: jest.fn(),
  };
}

function service(repo: ReturnType<typeof repository>) {
  return new ProductSessionService(repo as unknown as PersistentAuthRepository);
}

const token = () => signAccessToken(USER_ID, SESSION_ID, 1);

describe('Продуктовая сессия не является платформенной', () => {
  it('отдаёт актора без организации, тенанта, членства и роли', async () => {
    const repo = repository();
    const actor = await service(repo).tryVerifyAccessToken(token());

    expect(actor).toMatchObject({ id: USER_ID, sessionId: SESSION_ID, scope: 'GEKTA', mfaVerified: true });
    // Организационных полей нет вовсе, а не просто пусты.
    expect(actor).not.toHaveProperty('orgId');
    expect(actor).not.toHaveProperty('tenantId');
    expect(actor).not.toHaveProperty('membershipId');
    expect(actor).not.toHaveProperty('role');
  });

  it('возвращает пусто, если сессия не продуктовая, и решение остаётся за платформой', async () => {
    const repo = repository(null);
    await expect(service(repo).tryVerifyAccessToken(token())).resolves.toBeNull();
    expect(repo.revokeSession).not.toHaveBeenCalled();
  });

  it('читает область действия из базы, а не из токена', () => {
    // В подписываемых claim'ах нет ни scope, ни роли: подменить область
    // действия на стороне клиента нечем.
    const [, payload] = token().split('.');
    const claims = JSON.parse(Buffer.from(payload as string, 'base64url').toString('utf8'));
    expect(Object.keys(claims).sort()).toEqual(['aud', 'cv', 'exp', 'iat', 'iss', 'jti', 'sid', 'sub', 'typ']);
  });
});

describe('Продуктовая сессия перестаёт действовать по тем же причинам, что и платформенная', () => {
  const cases: Array<[string, Partial<ProductSessionContextRow>, string]> = [
    ['отозвана', { session_status: 'REVOKED' }, 'SESSION_REVOKED'],
    ['истекла по статусу', { session_status: 'EXPIRED' }, 'SESSION_EXPIRED'],
    ['истекла по времени', { session_expires_at: new Date(Date.now() - 1) }, 'SESSION_EXPIRED'],
    ['не активна', { session_status: 'MFA_PENDING' }, 'SESSION_NOT_ACTIVE'],
    ['пользователь не активен', { user_status: 'SUSPENDED' }, 'USER_NOT_ACTIVE'],
    ['MFA выключена', { current_mfa_enabled: false }, 'MFA_REQUIRED'],
    ['MFA не подтверждена сессией', { mfa_verified_at: null }, 'MFA_REQUIRED'],
    ['метод MFA не зафиксирован', { mfa_level: 'NONE' }, 'MFA_REQUIRED'],
    ['пароль сменился', { current_credential_version: 2 }, 'CREDENTIAL_VERSION_CHANGED'],
  ];

  it.each(cases)('%s — доступ закрывается и сессия отзывается', async (_name, overrides, reason) => {
    const repo = repository(productSession(overrides));
    await expect(service(repo).tryVerifyAccessToken(token())).rejects.toBeInstanceOf(UnauthorizedException);
    expect(repo.revokeSession).toHaveBeenCalledWith(expect.anything(), SESSION_ID, reason);
    expect(repo.touchSession).not.toHaveBeenCalled();
  });

  it('не считает продуктовой сессию с неизвестной областью действия', async () => {
    const repo = repository(productSession({ session_scope: 'PLATFORM' }));
    await expect(service(repo).tryVerifyAccessToken(token())).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('Повторный вход проверяет существующий MFA, а не заменяет его', () => {
  it('создаёт секрет только для первоначального enrollment', async () => {
    const enrollmentRepo = repository();
    const enrollment = await service(enrollmentRepo).issueMfaSession(enrollmentRepo.prisma as never, {
      userId: USER_ID,
      email: 'agronom@example.test',
      credentialVersion: 1,
      enrollment: true,
    });

    expect(enrollmentRepo.setMfaSecret).toHaveBeenCalledTimes(1);
    expect(enrollment).toHaveProperty('setupSecret');
    expect(enrollment).toHaveProperty('otpAuthUri');
    expect(enrollmentRepo.createMfaChallenge).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'TOTP_ENROLL' }),
    );

    const loginRepo = repository();
    const login = await service(loginRepo).issueMfaSession(loginRepo.prisma as never, {
      userId: USER_ID,
      email: 'agronom@example.test',
      credentialVersion: 1,
      enrollment: false,
    });

    expect(loginRepo.setMfaSecret).not.toHaveBeenCalled();
    expect(login).not.toHaveProperty('setupSecret');
    expect(login).not.toHaveProperty('otpAuthUri');
    expect(loginRepo.createMfaChallenge).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'TOTP_VERIFY' }),
    );
  });

  it('поглощает один backup-код при login и не генерирует новый набор', async () => {
    const issued = issueMfaChallengeCredential();
    const backupCode = 'ABCD-EF12-3456';
    const repo = repository();
    repo.getProductMfaChallengeForUpdate.mockResolvedValue({
      ...productSession({ session_status: 'MFA_PENDING', mfa_verified_at: null }),
      challenge_id: issued.credentialId,
      challenge_token_hash: issued.storedDigest,
      challenge_type: 'TOTP_VERIFY',
      challenge_status: 'PENDING',
      challenge_attempts: 0,
      challenge_max_attempts: 5,
      challenge_expires_at: new Date(Date.now() + 60_000),
    });
    repo.getCredentialState.mockResolvedValue({
      user_id: USER_ID,
      credential_version: 1,
      mfa_enabled: true,
      // Повреждённый TOTP не должен блокировать одноразовый recovery-код и
      // тем более не должен запускать переинициализацию второго фактора.
      mfa_secret_ciphertext: 'corrupt-ciphertext',
      mfa_backup_hashes: [digestMfaBackupCode(backupCode)],
    });

    const result = await service(repo).verifyMfa(issued.rawToken, backupCode);

    expect(result).not.toHaveProperty('backupCodes');
    expect(repo.activateMfaSession).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      method: 'BACKUP',
      enableMfa: false,
      backupHashes: [],
    }));
  });

  it('не разрешает старому backup-коду подтвердить новый authenticator', async () => {
    const issued = issueMfaChallengeCredential();
    const backupCode = 'ABCD-EF12-3456';
    const repo = repository();
    repo.getProductMfaChallengeForUpdate.mockResolvedValue({
      ...productSession({ session_status: 'MFA_PENDING', mfa_verified_at: null }),
      challenge_id: issued.credentialId,
      challenge_token_hash: issued.storedDigest,
      challenge_type: 'TOTP_ENROLL',
      challenge_status: 'PENDING',
      challenge_attempts: 0,
      challenge_max_attempts: 5,
      challenge_expires_at: new Date(Date.now() + 60_000),
    });
    repo.getCredentialState.mockResolvedValue({
      user_id: USER_ID,
      credential_version: 1,
      mfa_enabled: false,
      mfa_secret_ciphertext: encryptMfaSecret(generateTotpSecret()).ciphertext,
      mfa_backup_hashes: [digestMfaBackupCode(backupCode)],
    });

    await expect(service(repo).verifyMfa(issued.rawToken, backupCode))
      .rejects.toBeInstanceOf(UnauthorizedException);
    expect(repo.activateMfaSession).not.toHaveBeenCalled();
    expect(repo.recordMfaFailure).toHaveBeenCalledTimes(1);
  });
});

describe('Продуктовая сессия пользуется существующей ротацией refresh-токенов', () => {
  it('закрывает всё семейство при повторном предъявлении токена', async () => {
    const issued = issueRefreshCredential();
    const repo = repository();
    repo.getProductRefreshContextForUpdate.mockResolvedValue({
      ...productSession(),
      refresh_token_id: issued.credentialId,
      refresh_token_hash: issued.storedDigest,
      refresh_token_status: 'ROTATED',
      refresh_token_expires_at: new Date(Date.now() + 60_000),
      refresh_token_consumed_at: new Date(),
      refresh_token_family_id: 'fam-gekta-1',
    });

    await expect(service(repo).refresh(issued.rawToken)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(repo.revokeFamily).toHaveBeenCalledWith(
      expect.anything(),
      'fam-gekta-1',
      'REFRESH_TOKEN_REUSE_DETECTED',
      issued.credentialId,
    );
  });

  it('выдаёт новый токен и вращает старый, когда всё в порядке', async () => {
    const issued = issueRefreshCredential();
    const repo = repository();
    repo.getProductRefreshContextForUpdate.mockResolvedValue({
      ...productSession(),
      refresh_token_id: issued.credentialId,
      refresh_token_hash: issued.storedDigest,
      refresh_token_status: 'ACTIVE',
      refresh_token_expires_at: new Date(Date.now() + 60_000),
      refresh_token_consumed_at: null,
      refresh_token_family_id: 'fam-gekta-1',
    });

    const result = await service(repo).refresh(issued.rawToken);
    expect(result.kind).toBe('success');
    expect(repo.rotateRefreshToken).toHaveBeenCalledTimes(1);
    expect(repo.revokeFamily).not.toHaveBeenCalled();
  });

  it('не принимает чужой префикс токена', async () => {
    const repo = repository();
    await expect(service(repo).refresh(makeOpaqueToken('mc').token)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(repo.getProductRefreshContextForUpdate).not.toHaveBeenCalled();
  });
});

describe('Схема, а не код, запрещает продуктовой сессии нести организацию', () => {
  it('сохраняет прежние NOT NULL для платформенной сессии', () => {
    expect(migration).toContain("scope = 'PLATFORM'");
    expect(migration).toContain('AND membership_id IS NOT NULL');
    expect(migration).toContain('AND organization_id IS NOT NULL');
    expect(migration).toContain('AND tenant_id IS NOT NULL');
  });

  it('требует пустую принадлежность для продуктовой сессии', () => {
    expect(migration).toContain("scope = 'GEKTA'");
    expect(migration).toContain('AND membership_id IS NULL');
    expect(migration).toContain('AND organization_id IS NULL');
    expect(migration).toContain('AND tenant_id IS NULL');
  });

  it('оставляет уже существующие сессии платформенными', () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'PLATFORM'");
  });

  it('не выдаёт продуктовому резолверу ни одного организационного поля', () => {
    const returns = migration.slice(
      migration.indexOf('auth.resolve_product_session_identity_v1'),
      migration.indexOf('$function$;', migration.indexOf('auth.resolve_product_session_identity_v1')),
    );
    expect(returns).toContain('RETURNS TABLE (');
    for (const forbidden of ['organization_id', 'tenant_id', 'membership_id', 'role']) {
      expect(returns).not.toContain(forbidden);
    }
  });

  it('оставляет продуктовый резолвер таким же ограниченным, как платформенный', () => {
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain('SET search_path = public, pg_temp');
    expect(migration).toContain('SET row_security = on');
    expect(migration).toContain('OWNER TO pc_identity_bootstrap');
    expect(migration).toContain('REVOKE ALL ON FUNCTION auth.resolve_product_session_identity_v1(text) FROM PUBLIC');
  });

  it('не читает закрытую RLS таблицу пользователей напрямую', () => {
    // Личность приходит только из ограниченной функции: прямой SELECT из
    // public."users" вернул бы пусто под RLS и был бы обходом контура.
    expect(repositorySource).toContain('auth.resolve_product_session_identity_v1(s.user_id) subject');
    expect(repositorySource).not.toContain('JOIN public."users" subject ON subject."id" = s.user_id');
  });

  it('ограничивает каждое продуктовое чтение областью действия прямо в запросе', () => {
    // Утверждение о свойстве, а не о количестве: любой новый продуктовый
    // запрос обязан нести ограничение по scope, иначе платформенную сессию
    // можно было бы прочитать как продуктовую.
    const productQueries = repositorySource
      .split('Prisma.sql`')
      .filter((query) => query.includes('auth.resolve_product_session_identity_v1(s.user_id)'));
    expect(productQueries.length).toBeGreaterThanOrEqual(3);
    for (const query of productQueries) {
      expect(query.slice(0, query.indexOf('`'))).toContain("s.scope = 'GEKTA'");
    }
  });
});
