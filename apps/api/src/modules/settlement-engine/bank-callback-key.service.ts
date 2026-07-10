import { ForbiddenException, Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, createHmac } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import { RequestUser, Role } from '../../common/types/request-user';
import {
  BANK_CALLBACK_TOLERANCE_SECONDS,
  buildBankSignaturePayload,
  JsonRecord,
  secureSignatureMatch,
} from './bank-callback-signature';

type LifecycleStatus = 'ACTIVE' | 'UNKNOWN' | 'REVOKED' | 'NOT_YET_VALID' | 'EXPIRED';

type ResolveRow = {
  lifecycle_status: LifecycleStatus;
  secret_ref: string | null;
  valid_from: Date | null;
  valid_until: Date | null;
  revoked_at: Date | null;
};

export type BankCallbackKeyMetadata = Readonly<{
  partnerId: string;
  keyId: string;
  secretRef: string;
  validFrom: string;
  validUntil?: string;
  revokedAt?: string;
  createdBy: string;
  createdAt: string;
}>;

@Injectable()
export class BankCallbackKeyService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rls: RlsTransactionService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!isProduction()) return;
    const rows = await this.prisma.$queryRaw<Array<{
      can_resolve: boolean;
      can_register: boolean;
      can_revoke: boolean;
      can_list: boolean;
      can_read_keys: boolean;
      can_read_audit: boolean;
    }>>(Prisma.sql`
      SELECT
        has_function_privilege(current_user, 'finance_security.resolve_bank_callback_key(text,text,timestamptz)', 'EXECUTE') AS can_resolve,
        has_function_privilege(current_user, 'finance_security.register_bank_callback_key(text,text,text,timestamptz,timestamptz,text)', 'EXECUTE') AS can_register,
        has_function_privilege(current_user, 'finance_security.revoke_bank_callback_key(text,text,text,text)', 'EXECUTE') AS can_revoke,
        has_function_privilege(current_user, 'finance_security.list_bank_callback_keys(text)', 'EXECUTE') AS can_list,
        has_table_privilege(current_user, 'finance_security.bank_callback_keys', 'SELECT') AS can_read_keys,
        has_table_privilege(current_user, 'finance_security.bank_callback_key_audit', 'SELECT') AS can_read_audit
    `);
    const row = rows[0];
    if (
      !row
      || !row.can_resolve
      || !row.can_register
      || !row.can_revoke
      || !row.can_list
      || row.can_read_keys
      || row.can_read_audit
    ) {
      throw new Error('Bank callback key function boundary is not ready for production enforcement.');
    }
  }

  async verifyCallback(input: {
    partnerId: string | undefined;
    keyId: string | undefined;
    timestampHeader: string | undefined;
    eventIdHeader: string | undefined;
    signature: string | undefined;
    body: JsonRecord;
    now?: Date;
  }): Promise<{ partnerId: string; keyId: string; eventId: string; timestamp: number }> {
    const partnerId = normalizeIdentifier(input.partnerId, 'partner');
    const keyId = normalizeIdentifier(input.keyId, 'key');
    const eventId = normalizeEventId(input.eventIdHeader);
    const bodyEventId = typeof input.body.eventId === 'string' ? input.body.eventId : '';
    if (eventId !== bodyEventId) throw genericUnauthorized();

    const timestamp = Number(input.timestampHeader);
    const now = input.now ?? new Date();
    const nowSeconds = Math.floor(now.getTime() / 1000);
    if (!Number.isInteger(timestamp) || Math.abs(nowSeconds - timestamp) > BANK_CALLBACK_TOLERANCE_SECONDS) {
      throw genericUnauthorized();
    }

    const metadata = await this.resolve(partnerId, keyId, new Date(timestamp * 1000));
    if (metadata.lifecycle_status !== 'ACTIVE' || !metadata.secret_ref) {
      throw genericUnauthorized();
    }
    const secret = resolveSecret(metadata.secret_ref);
    const signedPayload = buildBankSignaturePayload({ partnerId, keyId, timestamp, eventId, body: input.body });
    const expected = `hmac-sha256=${createHmac('sha256', secret).update(signedPayload).digest('hex')}`;
    if (!secureSignatureMatch(input.signature, expected)) throw genericUnauthorized();
    return { partnerId, keyId, eventId, timestamp };
  }

  async registerKey(
    input: {
      partnerId: string;
      keyId: string;
      secretRef: string;
      validFrom: string;
      validUntil?: string;
    },
    user: RequestUser,
  ): Promise<{ registered: true; partnerId: string; keyId: string }> {
    assertAdminMfa(user);
    const partnerId = normalizeIdentifier(input.partnerId, 'partner');
    const keyId = normalizeIdentifier(input.keyId, 'key');
    const secretRef = normalizeSecretRef(input.secretRef);
    resolveSecret(secretRef);
    const validFrom = parseRequiredDate(input.validFrom, 'validFrom');
    const validUntil = input.validUntil ? parseRequiredDate(input.validUntil, 'validUntil') : null;
    if (validUntil && validUntil <= validFrom) throw new Error('BANK_KEY_VALIDITY_INVALID');

    const registered = await this.rls.withTrustedContext(user, async (tx) => {
      const rows = await tx.$queryRaw<Array<{ registered: boolean }>>(Prisma.sql`
        SELECT finance_security.register_bank_callback_key(
          ${partnerId}::text,
          ${keyId}::text,
          ${secretRef}::text,
          ${validFrom}::timestamptz,
          ${validUntil}::timestamptz,
          ${user.id}::text
        ) AS registered
      `);
      return Boolean(rows[0]?.registered);
    });
    if (!registered) throw new Error('BANK_KEY_REGISTRATION_FAILED');
    return { registered: true, partnerId, keyId };
  }

  async revokeKey(
    partnerIdInput: string,
    keyIdInput: string,
    reason: string,
    user: RequestUser,
  ): Promise<{ revoked: true; partnerId: string; keyId: string }> {
    assertAdminMfa(user);
    const partnerId = normalizeIdentifier(partnerIdInput, 'partner');
    const keyId = normalizeIdentifier(keyIdInput, 'key');
    const normalizedReason = String(reason ?? '').trim();
    if (normalizedReason.length < 5 || normalizedReason.length > 2000) {
      throw new Error('BANK_KEY_REVOCATION_REASON_REQUIRED');
    }
    const reasonHash = createHash('sha256').update(normalizedReason).digest('hex');
    const revoked = await this.rls.withTrustedContext(user, async (tx) => {
      const rows = await tx.$queryRaw<Array<{ revoked: boolean }>>(Prisma.sql`
        SELECT finance_security.revoke_bank_callback_key(
          ${partnerId}::text,
          ${keyId}::text,
          ${user.id}::text,
          ${reasonHash}::text
        ) AS revoked
      `);
      return Boolean(rows[0]?.revoked);
    });
    if (!revoked) throw new Error('BANK_KEY_NOT_ACTIVE');
    return { revoked: true, partnerId, keyId };
  }

  async listKeys(partnerIdInput: string, user: RequestUser): Promise<BankCallbackKeyMetadata[]> {
    if (user.role !== Role.ADMIN && user.role !== Role.COMPLIANCE_OFFICER) {
      throw new ForbiddenException('Bank callback key metadata is restricted.');
    }
    const partnerId = normalizeIdentifier(partnerIdInput, 'partner');
    const rows = await this.prisma.$queryRaw<Array<{
      partner_id: string;
      key_id: string;
      secret_ref: string;
      valid_from: Date;
      valid_until: Date | null;
      revoked_at: Date | null;
      created_by: string;
      created_at: Date;
    }>>(Prisma.sql`
      SELECT * FROM finance_security.list_bank_callback_keys(${partnerId}::text)
    `);
    return rows.map((row) => ({
      partnerId: row.partner_id,
      keyId: row.key_id,
      secretRef: row.secret_ref,
      validFrom: row.valid_from.toISOString(),
      validUntil: row.valid_until?.toISOString(),
      revokedAt: row.revoked_at?.toISOString(),
      createdBy: row.created_by,
      createdAt: row.created_at.toISOString(),
    }));
  }

  private async resolve(partnerId: string, keyId: string, at: Date): Promise<ResolveRow> {
    const rows = await this.prisma.$queryRaw<ResolveRow[]>(Prisma.sql`
      SELECT *
      FROM finance_security.resolve_bank_callback_key(
        ${partnerId}::text,
        ${keyId}::text,
        ${at}::timestamptz
      )
    `);
    return rows[0] ?? {
      lifecycle_status: 'UNKNOWN',
      secret_ref: null,
      valid_from: null,
      valid_until: null,
      revoked_at: null,
    };
  }
}

function assertAdminMfa(user: RequestUser): void {
  if (user.role !== Role.ADMIN) throw new ForbiddenException('Only ADMIN can rotate bank callback keys.');
  if (!user.mfaVerified) throw new ForbiddenException('Verified MFA is required for bank callback key rotation.');
}

function normalizeIdentifier(value: string | undefined, label: string): string {
  const normalized = String(value ?? '').trim();
  if (!/^[A-Za-z0-9:_-]{1,96}$/.test(normalized)) throw genericUnauthorized();
  return normalized;
}

function normalizeEventId(value: string | undefined): string {
  const normalized = String(value ?? '').trim();
  if (!/^[A-Za-z0-9:_.-]{1,160}$/.test(normalized)) throw genericUnauthorized();
  return normalized;
}

function normalizeSecretRef(value: string): string {
  const normalized = String(value ?? '').trim();
  if (!/^BANK_[A-Z0-9_]{1,120}$/.test(normalized)) throw new Error('BANK_KEY_SECRET_REF_INVALID');
  return normalized;
}

function resolveSecret(secretRef: string): string {
  const value = String(process.env[secretRef] ?? '').trim();
  if (value.length < 32) throw new Error('BANK_CALLBACK_SECRET_UNAVAILABLE');
  return value;
}

function parseRequiredDate(value: string, label: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`BANK_KEY_${label.toUpperCase()}_INVALID`);
  return date;
}

function genericUnauthorized(): UnauthorizedException {
  return new UnauthorizedException({
    code: 'BANK_CALLBACK_AUTHENTICATION_FAILED',
    message: 'Bank callback authentication failed.',
  });
}

function isProduction(): boolean {
  return String(process.env.NODE_ENV ?? '').toLowerCase() === 'production';
}
