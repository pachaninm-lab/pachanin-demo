import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { appendAuthAudit } from './auth-audit';
import { hashAuthMaterial, hashClientValue, secureEqual } from './auth-crypto';
import { CURRENT_CONSENT_VERSION } from './consent-policy';
import { PersistentAuthRepository } from './persistent-auth.repository';
import { ProductSessionService } from './product-session.service';
import {
  REGISTRATION_EMAIL_TTL_MS,
  issueRegistrationEmailToken,
  parseRegistrationEmailToken,
  registrationTokenHashMatches,
} from './registration-token';

/**
 * Регистрация в Гекте.
 *
 * Корпоративная регистрация «Прозрачной Цены» здесь неприменима: она требует
 * ИНН, создаёт организацию и ставит заявку в очередь на проверку. Пользователю
 * Гекты нечего проверять — он покупает доступ себе.
 *
 * Вторая система аккаунтов при этом не создаётся: те же public.users, тот же
 * bcrypt, та же таблица одноразовых токенов подтверждения email, тот же MFA и
 * тот же журнал аудита. Разница ровно одна — у пользователя нет организации,
 * поэтому и сессия у него ограниченная.
 *
 * Шаги: заявка → подтверждение email → обязательный MFA → активная сессия.
 * Пробный период выдаётся не здесь: его выдаёт GektaAccessService при первом
 * обращении к кабинету, один раз на пользователя.
 */

const BCRYPT_ROUNDS = 12;
const MAX_EMAIL_LENGTH = 320;
const MAX_NAME_LENGTH = 120;
const MAX_PHONE_LENGTH = 32;

export type GektaRegistrationInput = {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  acceptedServiceTerms: boolean;
  acceptedPersonalData: boolean;
};

function assertPasswordPolicy(password: string): void {
  const classes = [/[a-z]/u, /[A-Z]/u, /\d/u, /[^A-Za-z0-9]/u].filter((pattern) => pattern.test(password)).length;
  if (password.length < 12 || password.length > 128 || classes < 3) {
    throw new BadRequestException({
      code: 'PASSWORD_POLICY_FAILED',
      message: 'Пароль должен быть от 12 до 128 символов и содержать минимум три класса символов.',
    });
  }
}

/**
 * Телефон нормализуется, но не проверяется владением: SMS не отправляется, и
 * ни один экран не называет такой номер подтверждённым.
 */
export function normalizeDeclaredPhone(input: string): string {
  const trimmed = String(input ?? '').trim();
  const digits = trimmed.replace(/\D/gu, '');
  if (digits.length < 10 || digits.length > 15 || trimmed.length > MAX_PHONE_LENGTH) {
    throw new BadRequestException({
      code: 'PHONE_REQUIRED',
      message: 'Укажи телефон в международном формате.',
    });
  }
  return trimmed;
}

@Injectable()
export class GektaRegistrationService {
  constructor(
    private readonly repository: PersistentAuthRepository,
    private readonly productSessions: ProductSessionService,
  ) {}

  /**
   * Заявка на регистрацию.
   *
   * Ответ на занятый email не отличается от ответа на свободный: иначе форма
   * стала бы способом перечислять пользователей платформы. Токен возвращается
   * вызывающему только для доставки письма — он не является сессией и сам по
   * себе не даёт доступа.
   */
  async register(input: GektaRegistrationInput, userAgent?: string, ip?: string) {
    const email = String(input.email ?? '').trim().toLowerCase();
    const fullName = String(input.fullName ?? '').trim();
    if (email.length < 3 || email.length > MAX_EMAIL_LENGTH || !email.includes('@')) {
      throw new BadRequestException({ code: 'EMAIL_INVALID' });
    }
    if (fullName.length < 2 || fullName.length > MAX_NAME_LENGTH) {
      throw new BadRequestException({ code: 'NAME_REQUIRED' });
    }
    if (!input.acceptedServiceTerms || !input.acceptedPersonalData) {
      // Согласие на обработку персональных данных — отдельный факт, а не
      // галочка внутри пользовательского соглашения.
      throw new BadRequestException({ code: 'CONSENT_REQUIRED' });
    }
    assertPasswordPolicy(String(input.password ?? ''));
    const phone = normalizeDeclaredPhone(input.phone);

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const userId = `usr_${randomUUID()}`;
    const emailToken = issueRegistrationEmailToken();
    const now = new Date();

    const result = await this.repository.transaction(async (tx) => {
      const prepared = await this.repository.prepareGektaRegistrationIdentity(tx, {
        userId,
        email,
        phone,
        passwordHash,
        fullName,
      });
      if (!prepared || prepared.outcome !== 'CREATED' || !prepared.user_id) {
        await appendAuthAudit(this.repository, tx, {
          action: 'auth.gekta.register',
          outcome: 'DENIED',
          reason: 'EMAIL_ALREADY_REGISTERED',
          metadata: this.clientMetadata(userAgent, ip, { accountHash: hashAuthMaterial(`account:${email}`) }),
        });
        return { kind: 'suppressed' as const };
      }

      await this.repository.ensureCredentialState(tx, prepared.user_id, CURRENT_CONSENT_VERSION, now);
      await this.repository.createGektaEmailChallenge(tx, {
        id: emailToken.id,
        userId: prepared.user_id,
        tokenHash: emailToken.hash,
        expiresAt: new Date(now.getTime() + REGISTRATION_EMAIL_TTL_MS),
      });
      await appendAuthAudit(this.repository, tx, {
        userId: prepared.user_id,
        action: 'auth.gekta.register',
        outcome: 'SUCCESS',
        metadata: this.clientMetadata(userAgent, ip, {
          consentVersion: CURRENT_CONSENT_VERSION,
          phoneState: 'DECLARED',
        }),
      });
      return { kind: 'created' as const, userId: prepared.user_id };
    });

    // Форма отвечает одинаково в обоих случаях. Письмо уходит только на
    // действительно созданный аккаунт.
    return {
      status: 'EMAIL_VERIFICATION_REQUIRED' as const,
      email,
      expiresInSeconds: Math.floor(REGISTRATION_EMAIL_TTL_MS / 1000),
      ...(result.kind === 'created' ? { emailDelivery: { email, token: emailToken.token } } : {}),
    };
  }

  /**
   * Подтверждение email.
   *
   * Токен потребляется один раз, пользователь становится ACTIVE, и тут же
   * создаётся сессия, ожидающая MFA. Активных токенов до прохождения MFA не
   * выдаётся ни одного.
   */
  async verifyEmail(tokenInput: string, userAgent?: string, ip?: string) {
    const parsed = parseRegistrationEmailToken(tokenInput);
    if (!parsed) throw new BadRequestException({ code: 'REGISTRATION_EMAIL_TOKEN_INVALID' });
    const now = new Date();

    const result = await this.repository.transaction(async (tx) => {
      const challenge = await this.repository.getGektaEmailChallengeForUpdate(tx, parsed.id);
      if (
        !challenge
        || challenge.status !== 'PENDING'
        || challenge.expires_at <= now
        || !registrationTokenHashMatches(challenge.token_hash, parsed.hash)
      ) {
        return { kind: 'invalid' as const };
      }

      const consumed = await this.repository.consumeGektaEmailChallenge(tx, challenge.id, now);
      if (consumed !== 1) return { kind: 'invalid' as const };

      const verified = await this.repository.markGektaEmailVerified(tx, challenge.id, challenge.user_id);
      if (!verified) return { kind: 'invalid' as const };

      const credential = await this.repository.getCredentialState(tx, challenge.user_id, true);
      if (!credential) return { kind: 'invalid' as const };

      const identity = await this.repository.getProductRegistrationSubject(tx, challenge.user_id);
      if (!identity) return { kind: 'invalid' as const };

      const enrollment = await this.productSessions.issueEnrollmentSession(tx, {
        userId: challenge.user_id,
        email: identity.email,
        credentialVersion: credential.credential_version,
        userAgent,
        ip,
      });
      await appendAuthAudit(this.repository, tx, {
        userId: challenge.user_id,
        sessionId: enrollment.sessionId,
        action: 'auth.gekta.email_verified',
        outcome: 'SUCCESS',
        metadata: this.clientMetadata(userAgent, ip),
      });
      return { kind: 'verified' as const, enrollment };
    });

    if (result.kind === 'invalid') throw new BadRequestException({ code: 'REGISTRATION_EMAIL_TOKEN_INVALID' });
    return {
      status: 'MFA_ENROLLMENT_REQUIRED' as const,
      challengeToken: result.enrollment.challengeToken,
      expiresAt: result.enrollment.expiresAt,
      setupSecret: result.enrollment.setupSecret,
      otpAuthUri: result.enrollment.otpAuthUri,
    };
  }

  /** Завершение регистрации: проверка кода MFA и выдача активной сессии. */
  async verifyMfa(challengeToken: string, code: string, userAgent?: string, ip?: string) {
    const activated = await this.productSessions.verifyMfa(challengeToken, code, userAgent, ip);
    return {
      status: 'ACTIVE' as const,
      accessToken: activated.accessToken,
      refreshToken: activated.refreshToken,
      backupCodes: activated.backupCodes,
      user: activated.user,
    };
  }

  /**
   * Повторный вход пользователя Гекты.
   *
   * Тот же порядок, что у платформы: сначала доказательство пароля, и только
   * потом любое состояние аккаунта. Ответ на несуществующий email не
   * отличается от ответа на неверный пароль.
   */
  async login(emailInput: string, password: string, userAgent?: string, ip?: string) {
    const email = String(emailInput ?? '').trim().toLowerCase();
    const credential = await this.repository.findGektaLoginCredential(this.repository.prisma, email);
    const validPassword = await bcrypt.compare(
      String(password ?? ''),
      credential?.password_hash ?? DUMMY_PASSWORD_HASH,
    );
    if (!credential || !validPassword || credential.user_status !== 'ACTIVE') {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS' });
    }

    const result = await this.repository.transaction(async (tx) => {
      // Пароль перечитывается в той же сериализуемой транзакции: смена пароля
      // между bcrypt и выдачей сессии обесценивает доказательство.
      const current = await this.repository.findGektaLoginCredential(tx, email);
      if (
        !current
        || current.user_id !== credential.user_id
        || !secureEqual(current.password_hash, credential.password_hash)
      ) {
        return { kind: 'invalid' as const };
      }
      const state = await this.repository.getCredentialState(tx, current.user_id, true);
      if (!state) return { kind: 'invalid' as const };
      const identity = await this.repository.getProductRegistrationSubject(tx, current.user_id);
      if (!identity) return { kind: 'invalid' as const };

      // MFA у Гекты обязателен, поэтому вход всегда идёт через проверку кода:
      // активных токенов на этом шаге не выдаётся.
      const enrollment = await this.productSessions.issueEnrollmentSession(tx, {
        userId: current.user_id,
        email: identity.email,
        credentialVersion: state.credential_version,
        userAgent,
        ip,
      });
      await this.repository.markLoginSuccess(tx, current.user_id);
      await appendAuthAudit(this.repository, tx, {
        userId: current.user_id,
        sessionId: enrollment.sessionId,
        action: 'auth.gekta.login',
        outcome: 'SUCCESS',
        metadata: this.clientMetadata(userAgent, ip),
      });
      return { kind: 'mfa' as const, enrollment };
    });

    if (result.kind === 'invalid') throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS' });
    return {
      status: 'MFA_REQUIRED' as const,
      challengeToken: result.enrollment.challengeToken,
      expiresAt: result.enrollment.expiresAt,
    };
  }

  private clientMetadata(
    userAgent?: string,
    ip?: string,
    extra: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      userAgentHash: hashClientValue(userAgent),
      ipHash: hashClientValue(ip),
      ...extra,
    };
  }
}

// Сравнение выполняется всегда, даже когда пользователя нет: иначе время
// ответа сообщало бы, зарегистрирован ли email.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('invalid-password-sentinel', 10);
