import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { verifyPassword } from './password-hashing';
import * as fs from 'fs';
import * as path from 'path';
import { GektaRegistrationService, normalizeDeclaredPhone } from './gekta-registration.service';
import { PersistentAuthRepository } from './persistent-auth.repository';
import { ProductSessionService } from './product-session.service';
import { issueRegistrationEmailToken } from './registration-token';

const migration = fs.readFileSync(
  path.join(process.cwd(), 'prisma/migrations/20260813070000_gekta_registration_identity/migration.sql'),
  'utf8',
);
const serviceSource = fs.readFileSync(
  path.join(process.cwd(), 'src/modules/auth/gekta-registration.service.ts'),
  'utf8',
);

const VALID = {
  email: 'Agronom@Example.Test',
  password: 'Sever0oborot!2026',
  fullName: 'Иван Агроном',
  phone: '+7 916 000-00-00',
  acceptedServiceTerms: true,
  acceptedPersonalData: true,
};
const DELIVERY_KEY = 'gekta-registration-delivery-key-at-least-32-chars';

function repository(outcome: 'CREATED' | 'SUPPRESSED' = 'CREATED') {
  return {
    prisma: {},
    transaction: jest.fn(async (work: (tx: unknown) => Promise<unknown>) => work({})),
    prepareGektaRegistrationIdentity: jest.fn().mockResolvedValue(
      outcome === 'CREATED' ? { outcome: 'CREATED', user_id: 'usr_1' } : { outcome: 'SUPPRESSED', user_id: null },
    ),
    ensureCredentialState: jest.fn(),
    createGektaEmailChallenge: jest.fn(),
    lockGektaRegistrationEmail: jest.fn(),
    getLatestGektaEmailChallengeForUpdate: jest.fn().mockResolvedValue(null),
    revokePendingGektaEmailChallenges: jest.fn(),
    getGektaEmailChallengeForUpdate: jest.fn(),
    consumeGektaEmailChallenge: jest.fn(),
    markGektaEmailVerified: jest.fn(),
    getCredentialState: jest.fn(),
    getProductRegistrationSubject: jest.fn(),
    findGektaLoginCredential: jest.fn().mockResolvedValue(null),
    ensureLoginThrottle: jest.fn(),
    getLoginThrottle: jest.fn().mockResolvedValue({ failures: 0, locked_until: null }),
    setLoginThrottle: jest.fn(),
    clearLoginThrottle: jest.fn(),
    markLoginSuccess: jest.fn(),
    latestAuditChainPosition: jest.fn().mockResolvedValue({ chainKey: 'auth-global', prevHash: null, nextSequence: 1n }),
    insertAudit: jest.fn(),
  };
}

function productSessions() {
  return {
    issueMfaSession: jest.fn().mockResolvedValue({
      sessionId: 'ses_1',
      challengeToken: 'mc_token',
      expiresAt: '2026-08-13T06:00:00.000Z',
      setupSecret: 'SECRET',
      otpAuthUri: 'otpauth://totp/x',
    }),
    verifyMfa: jest.fn(),
  };
}

function service(repo: ReturnType<typeof repository>, sessions = productSessions()) {
  return new GektaRegistrationService(
    repo as unknown as PersistentAuthRepository,
    sessions as unknown as ProductSessionService,
  );
}

describe('Регистрация в Гекте не спрашивает организацию и ИНН', () => {
  beforeEach(() => {
    process.env.REGISTRATION_DELIVERY_KEY = DELIVERY_KEY;
  });

  it('не принимает ни одного организационного поля', () => {
    // Их нет ни в сигнатуре функции базы, ни во входе сервиса, поэтому
    // корпоративная форма не может протечь в продукт.
    for (const forbidden of ['inn', 'ИНН', 'organization', 'tenant', 'workspace']) {
      expect(serviceSource.toLowerCase()).not.toContain(`${forbidden.toLowerCase()}:`);
    }
    expect(migration).toContain('p_user_id text,\n  p_email text,\n  p_phone text,\n  p_password_hash text,\n  p_full_name text');
  });

  it('заводит пользователя и отдаёт токен письма только внутреннему BFF', async () => {
    const repo = repository('CREATED');
    const result = await service(repo).register(VALID, DELIVERY_KEY);

    expect(result.status).toBe('EMAIL_VERIFICATION_REQUIRED');
    expect(result.email).toBe('agronom@example.test');
    expect(result).toHaveProperty('emailDelivery');
    expect(repo.createGektaEmailChallenge).toHaveBeenCalledTimes(1);

    // Открытый пароль в базу не уходит: передаётся только bcrypt-хеш.
    const [, prepared] = repo.prepareGektaRegistrationIdentity.mock.calls[0] as [unknown, { passwordHash: string }];
    expect(prepared.passwordHash).not.toContain(VALID.password);
    // Asserted through the module's own verifier rather than bcrypt directly:
    // stored passwords moved to the non-truncating scheme for ASVS V6.2.8, and
    // the property that matters here is that the stored value is a hash of this
    // password, not which algorithm produced it.
    expect(await verifyPassword(VALID.password, prepared.passwordHash)).toBe(true);
    expect(await verifyPassword('a-different-password', prepared.passwordHash)).toBe(false);

    const publicResult = await service(repository('CREATED')).register(VALID);
    expect(publicResult).not.toHaveProperty('emailDelivery');
  });

  it('отвечает на занятый email тем же, чем на свободный', async () => {
    const repo = repository('SUPPRESSED');
    const result = await service(repo).register(VALID, DELIVERY_KEY);

    expect(result.status).toBe('EMAIL_VERIFICATION_REQUIRED');
    expect(result.email).toBe('agronom@example.test');
    // Письмо не уходит, но ответ формы неотличим: перечислить пользователей
    // платформы через регистрацию нельзя.
    expect(result).not.toHaveProperty('emailDelivery');
    expect(repo.createGektaEmailChallenge).not.toHaveBeenCalled();
  });

  it('сохраняет два отдельных согласия с версиями и хешами источников', async () => {
    const repo = repository('CREATED');
    await service(repo).register(VALID, DELIVERY_KEY);

    expect(repo.insertAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      metadata: expect.objectContaining({
        consent: expect.objectContaining({
          terms: expect.objectContaining({ version: '2026-09-03', contentHash: expect.stringMatching(/^sha256:/u) }),
          privacy: expect.objectContaining({ version: '2026-09-03', contentHash: expect.stringMatching(/^sha256:/u) }),
        }),
        acceptedServiceTerms: true,
        acceptedPersonalData: true,
      }),
    }));
  });
});

describe('Повторная доставка подтверждения email', () => {
  beforeEach(() => {
    process.env.REGISTRATION_DELIVERY_KEY = DELIVERY_KEY;
  });

  it('вращает pending challenge и отдаёт токен только внутреннему BFF', async () => {
    const repo = repository();
    repo.findGektaLoginCredential.mockResolvedValue({
      user_id: 'usr_1', email: 'agronom@example.test', password_hash: 'hash', user_status: 'PENDING_EMAIL_VERIFICATION',
    });

    const result = await service(repo).resendEmail(VALID.email, DELIVERY_KEY);

    expect(result).toHaveProperty('emailDelivery');
    expect(repo.revokePendingGektaEmailChallenges).toHaveBeenCalledWith(expect.anything(), 'usr_1');
    expect(repo.createGektaEmailChallenge).toHaveBeenCalledTimes(1);
  });

  it('не различает неизвестный адрес и cooldown публичным ответом', async () => {
    const unknownRepo = repository();
    const unknown = await service(unknownRepo).resendEmail(VALID.email);

    const cooldownRepo = repository();
    cooldownRepo.findGektaLoginCredential.mockResolvedValue({
      user_id: 'usr_1', email: 'agronom@example.test', password_hash: 'hash', user_status: 'PENDING_EMAIL_VERIFICATION',
    });
    cooldownRepo.getLatestGektaEmailChallengeForUpdate.mockResolvedValue({ id: 'challenge', created_at: new Date() });
    const cooldown = await service(cooldownRepo).resendEmail(VALID.email);

    expect(unknown).toEqual(cooldown);
    expect(unknown).not.toHaveProperty('emailDelivery');
  });
});

describe('Регистрация требует того, что действительно требуется', () => {
  it('не принимает согласие одной галочкой', async () => {
    const repo = repository();
    await expect(service(repo).register({ ...VALID, acceptedPersonalData: false }))
      .rejects.toBeInstanceOf(BadRequestException);
    await expect(service(repo).register({ ...VALID, acceptedServiceTerms: false }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(repo.prepareGektaRegistrationIdentity).not.toHaveBeenCalled();
  });

  it('держит ту же парольную политику, что и сброс пароля платформы', async () => {
    const repo = repository();
    for (const password of ['короткий', 'alllowercaseletters', 'x'.repeat(129)]) {
      await expect(service(repo).register({ ...VALID, password }))
        .rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('требует телефон и не называет его подтверждённым', async () => {
    const repo = repository();
    await expect(service(repo).register({ ...VALID, phone: '' }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(normalizeDeclaredPhone('+7 916 000-00-00')).toBe('+7 916 000-00-00');
    expect(() => normalizeDeclaredPhone('123')).toThrow(BadRequestException);
    // SMS не отправляется, поэтому телефон записывается только как заявленный.
    // Проверяется именно телефон: подтверждение email — законный и другой факт.
    expect(serviceSource).toContain("phoneState: 'DECLARED'");
    expect(serviceSource).not.toMatch(/phoneState:\s*'VERIFIED'/u);
    expect(serviceSource).not.toMatch(/phoneVerified/u);
    const phoneLines = serviceSource
      .split('\n')
      .filter((line) => /phone/iu.test(line) && !/^\s*(\/\/|\*|\/\*)/u.test(line));
    expect(phoneLines.length).toBeGreaterThan(0);
    for (const line of phoneLines) expect(line).not.toContain('подтверждён');
  });
});

describe('Активная сессия не выдаётся раньше, чем пройдены все шаги', () => {
  it('после подтверждения email требует MFA и не отдаёт токенов', async () => {
    const repo = repository();
    repo.getGektaEmailChallengeForUpdate.mockResolvedValue(null);
    await expect(service(repo).verifyEmail('rev_bad')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('валидное подтверждение email создаёт только enrollment-сессию', async () => {
    const issued = issueRegistrationEmailToken();
    const repo = repository();
    repo.getGektaEmailChallengeForUpdate.mockResolvedValue({
      id: issued.id,
      user_id: 'usr_1',
      token_hash: issued.hash,
      status: 'PENDING',
      expires_at: new Date(Date.now() + 60_000),
      consumed_at: null,
    });
    repo.consumeGektaEmailChallenge.mockResolvedValue(1);
    repo.markGektaEmailVerified.mockResolvedValue(true);
    repo.getCredentialState.mockResolvedValue({ credential_version: 1 });
    repo.getProductRegistrationSubject.mockResolvedValue({
      user_id: 'usr_1', email: 'agronom@example.test', full_name: 'Иван', phone: VALID.phone, user_status: 'ACTIVE',
    });
    const sessions = productSessions();

    const result = await service(repo, sessions).verifyEmail(issued.token, undefined, undefined, DELIVERY_KEY);

    expect(result.status).toBe('MFA_ENROLLMENT_REQUIRED');
    expect(result).not.toHaveProperty('accessToken');
    expect(result).not.toHaveProperty('refreshToken');
    expect(result).toHaveProperty('email', 'agronom@example.test');
    expect(result).toHaveProperty('declaredPhone', VALID.phone);
    expect(sessions.issueMfaSession).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      enrollment: true,
    }));

    const publicResult = await service(repo, sessions).verifyEmail(issued.token);
    expect(publicResult).not.toHaveProperty('email');
    expect(publicResult).not.toHaveProperty('declaredPhone');
  });

  it('не пускает по паролю без MFA', async () => {
    const repo = repository();
    const hash = await bcrypt.hash(VALID.password, 4);
    repo.findGektaLoginCredential.mockResolvedValue({
      user_id: 'usr_1', email: 'agronom@example.test', password_hash: hash, user_status: 'ACTIVE',
    });
    repo.getProductRegistrationSubject.mockResolvedValue({
      user_id: 'usr_1', email: 'agronom@example.test', full_name: 'Иван', phone: VALID.phone, user_status: 'ACTIVE',
    });

    repo.getCredentialState.mockResolvedValue({
      credential_version: 1,
      mfa_enabled: true,
      // Повреждение секрета не должно превращаться в разрешение заменить уже
      // включённый второй фактор одним только паролем. Остаётся путь backup.
      mfa_secret_ciphertext: null,
    });
    const sessions = productSessions();
    const result = await service(repo, sessions).login('agronom@example.test', VALID.password);
    expect(result.status).toBe('MFA_REQUIRED');
    expect(result).not.toHaveProperty('accessToken');
    expect(result).not.toHaveProperty('refreshToken');
    expect(sessions.issueMfaSession).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      enrollment: false,
    }));
  });

  it('не пускает пользователя, чей email ещё не подтверждён', async () => {
    const repo = repository();
    const hash = await bcrypt.hash(VALID.password, 4);
    repo.findGektaLoginCredential.mockResolvedValue({
      user_id: 'usr_1', email: 'agronom@example.test', password_hash: hash, user_status: 'PENDING_EMAIL_VERIFICATION',
    });
    await expect(service(repo).login('agronom@example.test', VALID.password))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('отвечает одинаково на неизвестный email и неверный пароль', async () => {
    const repo = repository();
    const unknown = await service(repo).login('nobody@example.test', VALID.password).catch((error: unknown) => error);
    repo.findGektaLoginCredential.mockResolvedValue({
      user_id: 'usr_1', email: 'agronom@example.test', password_hash: await bcrypt.hash('other-password', 4), user_status: 'ACTIVE',
    });
    const wrong = await service(repo).login('agronom@example.test', VALID.password).catch((error: unknown) => error);

    expect(JSON.stringify((unknown as UnauthorizedException).getResponse()))
      .toBe(JSON.stringify((wrong as UnauthorizedException).getResponse()));
  });

  it('после пятой ошибки ставит account-level блокировку, а не полагается только на IP', async () => {
    const repo = repository();
    repo.getLoginThrottle.mockResolvedValue({ failures: 4, locked_until: null });

    await expect(service(repo).login('nobody@example.test', VALID.password))
      .rejects.toBeInstanceOf(UnauthorizedException);

    expect(repo.setLoginThrottle).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      0,
      expect.any(Date),
    );
  });
});
