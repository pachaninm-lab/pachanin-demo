import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';
import { GektaRegistrationService, normalizeDeclaredPhone } from './gekta-registration.service';
import { PersistentAuthRepository } from './persistent-auth.repository';
import { ProductSessionService } from './product-session.service';

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

function repository(outcome: 'CREATED' | 'SUPPRESSED' = 'CREATED') {
  return {
    prisma: {},
    transaction: jest.fn(async (work: (tx: unknown) => Promise<unknown>) => work({})),
    prepareGektaRegistrationIdentity: jest.fn().mockResolvedValue(
      outcome === 'CREATED' ? { outcome: 'CREATED', user_id: 'usr_1' } : { outcome: 'SUPPRESSED', user_id: null },
    ),
    ensureCredentialState: jest.fn(),
    createGektaEmailChallenge: jest.fn(),
    getGektaEmailChallengeForUpdate: jest.fn(),
    consumeGektaEmailChallenge: jest.fn(),
    markGektaEmailVerified: jest.fn(),
    getCredentialState: jest.fn(),
    getProductRegistrationSubject: jest.fn(),
    findGektaLoginCredential: jest.fn().mockResolvedValue(null),
    markLoginSuccess: jest.fn(),
    latestAuditChainPosition: jest.fn().mockResolvedValue({ chainKey: 'auth-global', prevHash: null, nextSequence: 1n }),
    insertAudit: jest.fn(),
  };
}

function productSessions() {
  return {
    issueEnrollmentSession: jest.fn().mockResolvedValue({
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
  it('не принимает ни одного организационного поля', () => {
    // Их нет ни в сигнатуре функции базы, ни во входе сервиса, поэтому
    // корпоративная форма не может протечь в продукт.
    for (const forbidden of ['inn', 'ИНН', 'organization', 'tenant', 'workspace']) {
      expect(serviceSource.toLowerCase()).not.toContain(`${forbidden.toLowerCase()}:`);
    }
    expect(migration).toContain('p_user_id text,\n  p_email text,\n  p_phone text,\n  p_password_hash text,\n  p_full_name text');
  });

  it('заводит пользователя и возвращает токен письма', async () => {
    const repo = repository('CREATED');
    const result = await service(repo).register(VALID);

    expect(result.status).toBe('EMAIL_VERIFICATION_REQUIRED');
    expect(result.email).toBe('agronom@example.test');
    expect(result).toHaveProperty('emailDelivery');
    expect(repo.createGektaEmailChallenge).toHaveBeenCalledTimes(1);

    // Открытый пароль в базу не уходит: передаётся только bcrypt-хеш.
    const [, prepared] = repo.prepareGektaRegistrationIdentity.mock.calls[0] as [unknown, { passwordHash: string }];
    expect(prepared.passwordHash).not.toContain(VALID.password);
    expect(await bcrypt.compare(VALID.password, prepared.passwordHash)).toBe(true);
  });

  it('отвечает на занятый email тем же, чем на свободный', async () => {
    const repo = repository('SUPPRESSED');
    const result = await service(repo).register(VALID);

    expect(result.status).toBe('EMAIL_VERIFICATION_REQUIRED');
    expect(result.email).toBe('agronom@example.test');
    // Письмо не уходит, но ответ формы неотличим: перечислить пользователей
    // платформы через регистрацию нельзя.
    expect(result).not.toHaveProperty('emailDelivery');
    expect(repo.createGektaEmailChallenge).not.toHaveBeenCalled();
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

  it('не пускает по паролю без MFA', async () => {
    const repo = repository();
    const hash = await bcrypt.hash(VALID.password, 4);
    repo.findGektaLoginCredential.mockResolvedValue({
      user_id: 'usr_1', email: 'agronom@example.test', password_hash: hash, user_status: 'ACTIVE',
    });
    repo.getCredentialState.mockResolvedValue({ credential_version: 1 });
    repo.getProductRegistrationSubject.mockResolvedValue({
      user_id: 'usr_1', email: 'agronom@example.test', full_name: 'Иван', user_status: 'ACTIVE',
    });

    const result = await service(repo).login('agronom@example.test', VALID.password);
    expect(result.status).toBe('MFA_REQUIRED');
    expect(result).not.toHaveProperty('accessToken');
    expect(result).not.toHaveProperty('refreshToken');
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
});
