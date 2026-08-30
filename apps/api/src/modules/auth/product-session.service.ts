import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RequestProductUser, isProductSessionScope } from '../../common/types/product-session';
import { signAccessToken, verifyAccessClaims } from './access-token';
import { SESSION_IDLE_TIMEOUT_MS } from './auth.service';
import { appendAuthAudit } from './auth-audit';
import {
  buildOtpAuthUri,
  decryptMfaSecret,
  encryptMfaSecret,
  generateBackupCodes,
  generateTotpSecret,
  hashClientValue,
  secureEqual,
  verifyTotp,
} from './auth-crypto';
import {
  digestMfaBackupCode,
  issueMfaChallengeCredential,
  issueRefreshCredential,
  resolvePresentedCredential,
} from './opaque-token-authority';
import {
  AuthSqlClient,
  CredentialStateRow,
  PersistentAuthRepository,
  ProductSessionContextRow,
} from './persistent-auth.repository';

/**
 * Сессия продукта: тот же пользователь, тот же пароль, тот же MFA, но без
 * организации и тенанта.
 *
 * Здесь нет ни второй системы аккаунтов, ни второго формата токена, ни второго
 * журнала аудита — используются существующие access-токен, opaque refresh с
 * ротацией и обнаружением повторного использования, и та же цепочка
 * auth-аудита. Отличается ровно одно: у сессии нет организационной
 * принадлежности, поэтому она разрешается напрямую, без
 * auth.resolve_session_identity_v2, и по этой же причине не проходит ни один
 * платформенный маршрут.
 */

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MFA_CHALLENGE_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class ProductSessionService {
  constructor(private readonly repository: PersistentAuthRepository) {}

  /**
   * Сессия, ожидающая подтверждения MFA.
   *
   * MFA у Гекты обязателен, поэтому сессия создаётся сразу в MFA_PENDING и до
   * успешной проверки кода не выдаёт ни одного токена. Секрет TOTP шифруется
   * тем же ключом и той же функцией, что и у платформы.
   */
  async issueMfaSession(
    tx: AuthSqlClient,
    input: {
      userId: string;
      email: string;
      credentialVersion: number;
      enrollment: boolean;
      userAgent?: string;
      ip?: string;
    },
  ): Promise<{
    sessionId: string;
    challengeToken: string;
    expiresAt: string;
    setupSecret?: string;
    otpAuthUri?: string;
  }> {
    const sessionId = `ses_${randomUUID()}`;
    await this.repository.createProductSession(tx, {
      id: sessionId,
      userId: input.userId,
      scope: 'GEKTA',
      status: 'MFA_PENDING',
      refreshFamilyId: `rf_${randomUUID()}`,
      credentialVersion: input.credentialVersion,
      userAgentHash: hashClientValue(input.userAgent),
      ipHash: hashClientValue(input.ip),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    });

    let setupSecret: string | undefined;
    if (input.enrollment) {
      setupSecret = generateTotpSecret();
      const encrypted = encryptMfaSecret(setupSecret);
      await this.repository.setMfaSecret(tx, input.userId, encrypted.ciphertext, encrypted.keyVersion);
    }

    const issuedChallenge = issueMfaChallengeCredential();
    const expiresAt = new Date(Date.now() + MFA_CHALLENGE_TTL_MS);
    await this.repository.createMfaChallenge(tx, {
      id: issuedChallenge.credentialId,
      sessionId,
      userId: input.userId,
      challengeTokenHash: issuedChallenge.storedDigest,
      type: input.enrollment ? 'TOTP_ENROLL' : 'TOTP_VERIFY',
      expiresAt,
    });
    await appendAuthAudit(this.repository, tx, {
      userId: input.userId,
      sessionId,
      action: 'auth.product_session.mfa_required',
      outcome: 'SUCCESS',
      metadata: this.clientMetadata(input.userAgent, input.ip, {
        scope: 'GEKTA',
        enrollment: input.enrollment,
      }),
    });

    return {
      sessionId,
      challengeToken: issuedChallenge.rawToken,
      expiresAt: expiresAt.toISOString(),
      ...(setupSecret
        ? { setupSecret, otpAuthUri: buildOtpAuthUri(input.email, setupSecret) }
        : {}),
    };
  }

  /**
   * Проверка кода MFA для продуктовой сессии.
   *
   * Отличается от платформенной только разрешением личности: та же таблица
   * challenge'ей, тот же счётчик попыток, та же активация сессии и та же
   * выдача резервных кодов.
   */
  async verifyMfa(
    challengeToken: string,
    code: string,
    userAgent?: string,
    ip?: string,
  ) {
    const parsed = resolvePresentedCredential(challengeToken, 'mc');
    if (!parsed) throw new UnauthorizedException('Invalid MFA challenge');

    const result = await this.repository.transaction(async (tx) => {
      const context = await this.repository.getProductMfaChallengeForUpdate(tx, parsed.credentialId);
      if (
        !context
        || !secureEqual(context.challenge_token_hash, parsed.storedDigest)
        || !['TOTP_ENROLL', 'TOTP_VERIFY'].includes(context.challenge_type)
        || context.challenge_status !== 'PENDING'
        || context.challenge_expires_at <= new Date()
        || context.session_status !== 'MFA_PENDING'
        || context.user_status !== 'ACTIVE'
      ) {
        return { kind: 'invalid' as const };
      }

      const credential = await this.repository.getCredentialState(tx, context.user_id, true);
      const enrollment = context.challenge_type === 'TOTP_ENROLL';
      const credentialMatchesChallenge = credential
        && (enrollment ? !credential.mfa_enabled : credential.mfa_enabled);
      const verification = credentialMatchesChallenge
        ? this.verifyMfaCode(credential, code, !enrollment)
        : null;
      if (!verification) {
        // Попытка последняя, если счётчик уже достиг предела: тот же порог и
        // та же терминальность, что у платформенной проверки.
        const terminal = context.challenge_attempts + 1 >= context.challenge_max_attempts;
        await this.repository.recordMfaFailure(tx, context.challenge_id, terminal);
        if (terminal) {
          await this.repository.revokeSession(tx, context.session_id, 'MFA_ATTEMPTS_EXHAUSTED');
        }
        await appendAuthAudit(this.repository, tx, {
          userId: context.user_id,
          sessionId: context.session_id,
          action: 'auth.product_session.mfa',
          outcome: 'FAILURE',
          reason: terminal ? 'MFA_ATTEMPTS_EXHAUSTED' : 'MFA_CODE_INVALID',
          metadata: this.clientMetadata(userAgent, ip, {
            attempts: context.challenge_attempts + 1,
          }),
        });
        return { kind: 'invalid' as const };
      }

      const backup = enrollment ? generateBackupCodes() : null;
      const persistedBackupHashes = enrollment
        ? backup?.hashes
        : verification.method === 'BACKUP'
          ? verification.remainingBackupHashes
          : undefined;
      await this.repository.activateMfaSession(tx, {
        challengeId: context.challenge_id,
        sessionId: context.session_id,
        userId: context.user_id,
        method: verification.method,
        enableMfa: enrollment,
        backupHashes: persistedBackupHashes,
      });

      const issuedRefresh = issueRefreshCredential();
      await this.repository.createRefreshToken(tx, {
        id: issuedRefresh.credentialId,
        sessionId: context.session_id,
        familyId: context.refresh_family_id,
        tokenHash: issuedRefresh.storedDigest,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        userAgentHash: hashClientValue(userAgent),
        ipHash: hashClientValue(ip),
      });
      await appendAuthAudit(this.repository, tx, {
        userId: context.user_id,
        sessionId: context.session_id,
        action: 'auth.product_session.mfa',
        outcome: 'SUCCESS',
        metadata: this.clientMetadata(userAgent, ip, {
          scope: 'GEKTA',
          method: verification.method,
          enrollment,
        }),
      });

      return {
        kind: 'active' as const,
        sessionId: context.session_id,
        accessToken: signAccessToken(
          context.user_id,
          context.session_id,
          context.current_credential_version,
        ),
        refreshToken: issuedRefresh.rawToken,
        ...(backup ? { backupCodes: backup.codes } : {}),
        user: { id: context.user_id, email: context.email, fullName: context.full_name },
      };
    });

    if (result.kind === 'invalid') throw new UnauthorizedException('Invalid MFA challenge or code');
    return result;
  }

  /**
   * Проверка access-токена продуктовой сессии.
   *
   * Область действия читается из базы, а не из токена: клиент не может
   * объявить свою сессию платформенной. Запрос строкой ограничен
   * scope = 'GEKTA', поэтому платформенная сессия здесь не разрешается.
   */
  async tryVerifyAccessToken(token: string): Promise<RequestProductUser | null> {
    const claims = verifyAccessClaims(token);
    const context = await this.repository.getProductSessionContext(
      this.repository.prisma,
      claims.sid,
      claims.sub,
    );
    // Пусто — значит это не продуктовая сессия. Решение о ней принимает
    // платформенная проверка, включая случай несуществующей сессии.
    if (!context) return null;

    const reason = this.invalidReason(context);
    if (reason) {
      await this.repository.transaction(async (tx) => {
        await this.repository.revokeSession(tx, context.session_id, reason);
        await appendAuthAudit(this.repository, tx, {
          userId: context.user_id,
          sessionId: context.session_id,
          action: 'auth.product_session.access',
          outcome: 'DENIED',
          reason,
        });
      });
      throw new UnauthorizedException(
        reason === 'SESSION_REVOKED' ? 'Session has been revoked' : 'Session is not active',
      );
    }
    await this.repository.touchSession(this.repository.prisma, context.session_id);
    return this.projection(context);
  }

  /**
   * Обновление продуктовой сессии. Ротация, обнаружение повторного
   * использования и отзыв всего семейства работают точно так же, как у
   * платформенной сессии: повторно предъявленный refresh закрывает семью.
   */
  async refresh(refreshToken: string, userAgent?: string, ip?: string) {
    const parsed = resolvePresentedCredential(refreshToken, 'rt');
    if (!parsed) throw new UnauthorizedException('Invalid refresh token');

    const result = await this.repository.transaction(async (tx) => {
      const context = await this.repository.getProductRefreshContextForUpdate(tx, parsed.credentialId);
      if (!context || !secureEqual(context.refresh_token_hash, parsed.storedDigest)) {
        await appendAuthAudit(this.repository, tx, {
          action: 'auth.product_session.refresh',
          outcome: 'DENIED',
          reason: 'REFRESH_TOKEN_NOT_FOUND',
          metadata: this.clientMetadata(userAgent, ip, { tokenId: parsed.credentialId }),
        });
        return { kind: 'invalid' as const };
      }

      if (context.refresh_token_status !== 'ACTIVE' || context.refresh_token_consumed_at) {
        await this.repository.revokeFamily(
          tx,
          context.refresh_token_family_id,
          'REFRESH_TOKEN_REUSE_DETECTED',
          context.refresh_token_id,
        );
        await appendAuthAudit(this.repository, tx, {
          userId: context.user_id,
          sessionId: context.session_id,
          action: 'auth.product_session.refresh.reuse',
          outcome: 'DENIED',
          reason: 'REFRESH_TOKEN_REUSE_DETECTED',
          metadata: this.clientMetadata(userAgent, ip, { tokenId: parsed.credentialId }),
        });
        return { kind: 'reuse' as const };
      }

      const invalidReason = this.invalidReason(context);
      if (invalidReason || context.refresh_token_expires_at <= new Date()) {
        await this.repository.revokeFamily(
          tx,
          context.refresh_token_family_id,
          invalidReason ?? 'REFRESH_TOKEN_EXPIRED',
        );
        await appendAuthAudit(this.repository, tx, {
          userId: context.user_id,
          sessionId: context.session_id,
          action: 'auth.product_session.refresh',
          outcome: 'DENIED',
          reason: invalidReason ?? 'REFRESH_TOKEN_EXPIRED',
          metadata: this.clientMetadata(userAgent, ip),
        });
        return { kind: 'invalid' as const };
      }

      const issuedReplacement = issueRefreshCredential();
      await this.repository.rotateRefreshToken(tx, {
        currentTokenId: context.refresh_token_id,
        replacementTokenId: issuedReplacement.credentialId,
        replacementTokenHash: issuedReplacement.storedDigest,
        sessionId: context.session_id,
        familyId: context.refresh_token_family_id,
        replacementExpiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        userAgentHash: hashClientValue(userAgent),
        ipHash: hashClientValue(ip),
      });
      await appendAuthAudit(this.repository, tx, {
        userId: context.user_id,
        sessionId: context.session_id,
        action: 'auth.product_session.refresh',
        outcome: 'SUCCESS',
        metadata: this.clientMetadata(userAgent, ip, {
          rotatedFrom: context.refresh_token_id,
          rotatedTo: issuedReplacement.credentialId,
        }),
      });
      return {
        kind: 'success' as const,
        accessToken: signAccessToken(
          context.user_id,
          context.session_id,
          context.current_credential_version,
        ),
        refreshToken: issuedReplacement.rawToken,
        user: {
          id: context.user_id,
          email: context.email,
          fullName: context.full_name,
        },
      };
    });

    if (result.kind === 'reuse') {
      throw new UnauthorizedException('Refresh token reuse detected; session family revoked.');
    }
    if (result.kind === 'invalid') throw new UnauthorizedException('Invalid or expired refresh token');
    return result;
  }

  /** Выход закрывает семью refresh-токенов целиком, а не один токен. */
  async logout(refreshToken: string, userAgent?: string, ip?: string): Promise<{ revoked: boolean }> {
    const parsed = resolvePresentedCredential(refreshToken, 'rt');
    if (!parsed) return { revoked: false };
    return this.repository.transaction(async (tx) => {
      const context = await this.repository.getProductRefreshContextForUpdate(tx, parsed.credentialId);
      if (!context || !secureEqual(context.refresh_token_hash, parsed.storedDigest)) {
        return { revoked: false };
      }
      await this.repository.revokeFamily(tx, context.refresh_token_family_id, 'USER_LOGOUT');
      await appendAuthAudit(this.repository, tx, {
        userId: context.user_id,
        sessionId: context.session_id,
        action: 'auth.product_session.logout',
        outcome: 'SUCCESS',
        metadata: this.clientMetadata(userAgent, ip),
      });
      return { revoked: true };
    });
  }

  private projection(context: ProductSessionContextRow): RequestProductUser {
    if (!isProductSessionScope(context.session_scope)) {
      // Недостижимо при текущем ограничении auth_sessions_scope_check, но
      // неизвестная область действия не должна молча стать доступом.
      throw new UnauthorizedException('Session scope is not a product scope');
    }
    return {
      id: context.user_id,
      email: context.email,
      fullName: context.full_name,
      sessionId: context.session_id,
      scope: context.session_scope,
      credentialVersion: context.current_credential_version,
      mfaVerified: Boolean(context.mfa_verified_at),
      ...(context.mfa_verified_at ? { mfaVerifiedAt: context.mfa_verified_at.toISOString() } : {}),
    };
  }

  /**
   * У продуктовой сессии нет членства и организации, поэтому и проверять их
   * нечего. Всё остальное проверяется ровно как у платформенной: отзыв, срок,
   * состояние пользователя и смена версии учётных данных.
   */
  private invalidReason(context: ProductSessionContextRow): string | null {
    if (context.session_status === 'REVOKED') return 'SESSION_REVOKED';
    if (context.session_status === 'EXPIRED' || context.session_expires_at <= new Date()) {
      return 'SESSION_EXPIRED';
    }
    // The same idle limit as the platform pathway, from the same constant. Two
    // session stores with two different idle rules would be the inconsistency
    // V6.3.4 is about, and the number is not worth having in two places.
    //
    // The privileged fifteen-minute tier does not apply here and is not faked:
    // a product session carries a scope, not a platform role, so there is no
    // role on this row to decide it from. Reaching for staffRoles to invent one
    // would be a second authority for who is privileged, which is the thing
    // that consistency requirement forbids.
    if (context.session_last_seen_at.getTime() + SESSION_IDLE_TIMEOUT_MS <= Date.now()) {
      return 'SESSION_IDLE_TIMEOUT';
    }
    if (context.session_status !== 'ACTIVE') return 'SESSION_NOT_ACTIVE';
    if (context.user_status !== 'ACTIVE') return 'USER_NOT_ACTIVE';
    if (
      !context.current_mfa_enabled
      || !context.mfa_verified_at
      || !['TOTP', 'BACKUP'].includes(context.mfa_level)
    ) return 'MFA_REQUIRED';
    if (context.session_credential_version !== context.current_credential_version) {
      return 'CREDENTIAL_VERSION_CHANGED';
    }
    return null;
  }

  private verifyMfaCode(
    credential: CredentialStateRow,
    code: string,
    allowBackup: boolean,
  ): { method: 'TOTP' } | { method: 'BACKUP'; remainingBackupHashes: string[] } | null {
    let secret: string | null = null;
    if (credential.mfa_secret_ciphertext) {
      try {
        secret = decryptMfaSecret(credential.mfa_secret_ciphertext);
      } catch {
        // A damaged TOTP ciphertext must not turn into factor replacement.
        // Existing one-time backup codes remain a valid recovery path.
        secret = null;
      }
    }
    if (secret && verifyTotp(secret, code)) return { method: 'TOTP' };

    // Enrollment proves possession of the newly presented TOTP secret. An old
    // recovery code must never be able to approve a replacement authenticator.
    if (!allowBackup) return null;

    const hashes = Array.isArray(credential.mfa_backup_hashes)
      ? credential.mfa_backup_hashes.filter((item): item is string => typeof item === 'string')
      : [];
    const candidate = digestMfaBackupCode(code);
    const matchedIndex = hashes.findIndex((item) => secureEqual(item, candidate));
    if (matchedIndex < 0) return null;
    return {
      method: 'BACKUP',
      remainingBackupHashes: hashes.filter((_, index) => index !== matchedIndex),
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
