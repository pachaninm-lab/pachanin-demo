import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { hashPassword, upgradePasswordHashIfNeeded, verifyPassword } from './password-hashing';
import {
  isStrongPassword,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from '../../common/validators/strong-password.validator';
import { randomUUID } from 'crypto';
import { appendAuthAudit } from './auth-audit';
import { hashAuthMaterial, hashClientValue, secureEqual } from './auth-crypto';
import { CURRENT_CONSENT_EVIDENCE } from './consent-policy';
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

const MAX_EMAIL_LENGTH = 320;
const MAX_NAME_LENGTH = 120;
const MAX_PHONE_LENGTH = 32;
const MAX_FAILED_LOGINS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;
const EMAIL_RESEND_COOLDOWN_MS = 60 * 1000;

export type GektaRegistrationInput = {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  acceptedServiceTerms: boolean;
  acceptedPersonalData: boolean;
};

function assertPasswordPolicy(password: string): void {
  // Delegates to the one policy in strong-password.validator.ts. This used to
  // be a private copy, and the copy had already lost the all-same and
  // sequential checks the shared rule applies.
  if (!isStrongPassword(password)) {
    throw new BadRequestException({
      code: 'PASSWORD_POLICY_FAILED',
      message: `Пароль должен быть от ${MIN_PASSWORD_LENGTH} до ${MAX_PASSWORD_LENGTH} символов, содержать минимум три класса символов и не быть простой последовательностью.`,
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

function deliveryAuthorized(provided?: string): boolean {
  const expected = String(process.env.REGISTRATION_DELIVERY_KEY ?? '').trim();
  const candidate = String(provided ?? '').trim();
  return expected.length >= 32 && candidate.length >= 32 && secureEqual(candidate, expected);
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
  async register(
    input: GektaRegistrationInput,
    deliveryKey?: string,
    userAgent?: string,
    ip?: string,
  ) {
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

    const passwordHash = await hashPassword(input.password);
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

      await this.repository.ensureCredentialState(
        tx,
        prepared.user_id,
        `${CURRENT_CONSENT_EVIDENCE.terms.version}|${CURRENT_CONSENT_EVIDENCE.privacy.version}`,
        now,
      );
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
          consent: CURRENT_CONSENT_EVIDENCE,
          acceptedServiceTerms: true,
          acceptedPersonalData: true,
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
      ...(result.kind === 'created' && deliveryAuthorized(deliveryKey)
        ? { emailDelivery: { email, token: emailToken.token } }
        : {}),
    };
  }

  /**
   * Повторная доставка подтверждения email.
   *
   * Публичный ответ одинаков для неизвестного, уже занятого и ожидающего
   * подтверждения адреса. Сам одноразовый bearer-токен возвращается только
   * доверенному web-BFF, доказавшему внутренний delivery key.
   */
  async resendEmail(
    emailInput: string,
    deliveryKey?: string,
    userAgent?: string,
    ip?: string,
  ) {
    const email = String(emailInput ?? '').trim().toLowerCase();
    if (email.length < 3 || email.length > MAX_EMAIL_LENGTH || !email.includes('@')) {
      throw new BadRequestException({ code: 'EMAIL_INVALID' });
    }

    const emailToken = issueRegistrationEmailToken();
    const now = new Date();
    const result = await this.repository.transaction(async (tx) => {
      await this.repository.lockGektaRegistrationEmail(tx, email);
      const credential = await this.repository.findGektaLoginCredential(tx, email);
      if (!credential || credential.user_status !== 'PENDING_EMAIL_VERIFICATION') {
        await appendAuthAudit(this.repository, tx, {
          action: 'auth.gekta.email_resend',
          outcome: 'SUCCESS',
          reason: 'PUBLIC_REQUEST_ACCEPTED',
          metadata: this.clientMetadata(userAgent, ip, {
            accountHash: hashAuthMaterial(`account:${email}`),
          }),
        });
        return { kind: 'suppressed' as const };
      }

      const latest = await this.repository.getLatestGektaEmailChallengeForUpdate(
        tx,
        credential.user_id,
      );
      if (latest && now.getTime() - latest.created_at.getTime() < EMAIL_RESEND_COOLDOWN_MS) {
        return { kind: 'cooldown' as const };
      }

      await this.repository.revokePendingGektaEmailChallenges(tx, credential.user_id);
      await this.repository.createGektaEmailChallenge(tx, {
        id: emailToken.id,
        userId: credential.user_id,
        tokenHash: emailToken.hash,
        expiresAt: new Date(now.getTime() + REGISTRATION_EMAIL_TTL_MS),
      });
      await appendAuthAudit(this.repository, tx, {
        userId: credential.user_id,
        action: 'auth.gekta.email_resend',
        outcome: 'SUCCESS',
        reason: 'EMAIL_VERIFICATION_RESENT',
        metadata: this.clientMetadata(userAgent, ip),
      });
      return { kind: 'created' as const };
    });

    return {
      accepted: true as const,
      cooldownSeconds: Math.floor(EMAIL_RESEND_COOLDOWN_MS / 1000),
      ...(result.kind === 'created' && deliveryAuthorized(deliveryKey)
        ? { emailDelivery: { email, token: emailToken.token } }
        : {}),
    };
  }

  /**
   * Подтверждение email.
   *
   * Токен потребляется один раз, пользователь становится ACTIVE, и тут же
   * создаётся сессия, ожидающая MFA. Активных токенов до прохождения MFA не
   * выдаётся ни одного.
   */
  async verifyEmail(tokenInput: string, userAgent?: string, ip?: string, deliveryKey?: string) {
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

      const enrollment = await this.productSessions.issueMfaSession(tx, {
        userId: challenge.user_id,
        email: identity.email,
        credentialVersion: credential.credential_version,
        enrollment: true,
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
      return {
        kind: 'verified' as const,
        enrollment,
        email: identity.email,
        declaredPhone: identity.phone,
      };
    });

    if (result.kind === 'invalid') throw new BadRequestException({ code: 'REGISTRATION_EMAIL_TOKEN_INVALID' });
    return {
      status: 'MFA_ENROLLMENT_REQUIRED' as const,
      challengeToken: result.enrollment.challengeToken,
      expiresAt: result.enrollment.expiresAt,
      setupSecret: result.enrollment.setupSecret,
      otpAuthUri: result.enrollment.otpAuthUri,
      ...(deliveryAuthorized(deliveryKey) && result.declaredPhone
        ? { email: result.email, declaredPhone: result.declaredPhone }
        : {}),
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
    const accountHash = hashAuthMaterial(`account:${email}`);
    const credential = await this.repository.findGektaLoginCredential(this.repository.prisma, email);
    // Same opportunistic upgrade as the platform pathway, from the same
    // function. Two login paths with two different rehash rules would leave one
    // population truncated at 72 bytes forever.
    const validPassword = await verifyPassword(String(password ?? ''), credential?.password_hash);
    const result = await this.repository.transaction(async (tx) => {
      await this.repository.ensureLoginThrottle(tx, accountHash);
      const throttle = await this.repository.getLoginThrottle(tx, accountHash, true);
      const now = new Date();
      if (throttle?.locked_until && throttle.locked_until > now) {
        await appendAuthAudit(this.repository, tx, {
          userId: credential?.user_id,
          action: 'auth.gekta.login',
          outcome: 'DENIED',
          reason: 'ACCOUNT_TEMPORARILY_LOCKED',
          metadata: this.clientMetadata(userAgent, ip, { accountHash }),
        });
        return { kind: 'invalid' as const };
      }

      if (!credential || !validPassword || credential.user_status !== 'ACTIVE') {
        const failures = (throttle?.failures ?? 0) + 1;
        const lockedUntil = failures >= MAX_FAILED_LOGINS
          ? new Date(now.getTime() + LOGIN_LOCKOUT_MS)
          : null;
        await this.repository.setLoginThrottle(
          tx,
          accountHash,
          lockedUntil ? 0 : failures,
          lockedUntil,
        );
        await appendAuthAudit(this.repository, tx, {
          userId: credential?.user_id,
          action: 'auth.gekta.login',
          outcome: 'FAILURE',
          reason: 'INVALID_CREDENTIALS',
          metadata: this.clientMetadata(userAgent, ip, {
            accountHash,
            locked: Boolean(lockedUntil),
          }),
        });
        return { kind: 'invalid' as const };
      }

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
      const enrollment = await this.productSessions.issueMfaSession(tx, {
        userId: current.user_id,
        email: identity.email,
        credentialVersion: state.credential_version,
        // Once MFA has been enabled, password login may only verify the
        // existing factor (TOTP or a one-time backup code). Missing/corrupt
        // ciphertext is not permission to silently replace that factor.
        enrollment: !state.mfa_enabled,
        userAgent,
        ip,
      });
      await this.repository.clearLoginThrottle(tx, accountHash);
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

    // Перезапись legacy-хеша — после решения о входе и только при успехе.
    // Между доказательством пароля и перечитыванием в транзакции её быть не
    // может: перечитывание для того и существует, чтобы отказать, если хеш
    // изменился, а перезапись — это ровно такое изменение. Так первый же вход
    // каждой учётной записи с bcrypt-хешем и получал отказ.
    if (credential && validPassword && result.kind !== 'invalid') {
      await upgradePasswordHashIfNeeded(
        String(password ?? ''),
        credential.password_hash,
        (next, conditionalOn) => this.repository.upgradePasswordHashFormat(
          this.repository.prisma,
          credential.user_id,
          next,
          conditionalOn,
        ),
      );
    }

    if (result.kind === 'invalid') throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS' });
    return {
      status: 'MFA_REQUIRED' as const,
      challengeToken: result.enrollment.challengeToken,
      expiresAt: result.enrollment.expiresAt,
      setupSecret: result.enrollment.setupSecret,
      otpAuthUri: result.enrollment.otpAuthUri,
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

