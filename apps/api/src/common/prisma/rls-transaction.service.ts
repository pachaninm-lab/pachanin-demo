import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestUser } from '../types/request-user';
import { Role } from '../types/request-user';
import { PrismaService } from './prisma.service';

export type RlsContextErrorCode =
  | 'authenticated_user_required'
  | 'session_required'
  | 'organization_required'
  | 'tenant_required'
  | 'guest_role_forbidden'
  | 'organization_membership_required';

export class RlsContextError extends Error {
  constructor(readonly code: RlsContextErrorCode) {
    super('Trusted PostgreSQL RLS context is incomplete.');
    this.name = 'RlsContextError';
  }
}

export type TrustedRlsContext = Readonly<{
  userId: string;
  orgId: string;
  tenantId: string;
  role: string;
  sessionId: string;
  /**
   * Platform authority, resolved server-side from durable staff assignments.
   *
   * Available to application code, and deliberately **not** written into a
   * PostgreSQL setting. An earlier revision passed it as
   * `app.current_staff_roles` for the identity policies to read, which measured
   * as no boundary at all: the runtime principal can execute
   * `SET LOCAL app.current_staff_roles = 'PLATFORM_ADMIN'` itself, and did —
   * reading every organization and every user in the isolation harness. A
   * setting the confined principal can write is not an authority.
   *
   * The database now establishes platform authority from its own rows: an
   * ACTIVE staff assignment inside its validity window whose session is live,
   * unexpired and MFA-verified. See public.app_identity_is_reviewer().
   *
   * Optional only for source compatibility with callers that construct the
   * context shape directly (primarily legacy tests). The production derivation
   * below always supplies the normalized array, and PostgreSQL authority never
   * depends on this field.
   */
  staffRoles?: readonly string[];
}>;

export type RlsTransactionOptions = Readonly<{
  maxWait?: number;
  timeout?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
  /**
   * Override the retry count for PostgreSQL serialization failures and deadlocks.
   * Serializable transactions default to three retries; other isolation levels
   * default to none. Callbacks must keep non-database side effects outside the
   * transaction because PostgreSQL can require the callback to execute again.
   */
  maxConflictRetries?: number;
  retryDelayMs?: number;
}>;

function deriveBaseRlsContext(user: RequestUser | undefined): TrustedRlsContext {
  if (!user?.id?.trim()) {
    throw new RlsContextError('authenticated_user_required');
  }
  if (!user.sessionId?.trim()) {
    throw new RlsContextError('session_required');
  }
  if (!user.orgId?.trim()) {
    throw new RlsContextError('organization_required');
  }
  if (!user.tenantId?.trim()) {
    throw new RlsContextError('tenant_required');
  }

  // Only well-formed labels travel into application code. They are never
  // PostgreSQL authority; see the TrustedRlsContext note above.
  const staffRoles = Object.freeze(
    (user.staffRoles ?? [])
      .map((label) => label.trim())
      .filter((label) => /^[A-Z][A-Z0-9_]*$/.test(label)),
  );

  return Object.freeze({
    userId: user.id,
    orgId: user.orgId,
    tenantId: user.tenantId,
    role: user.role,
    sessionId: user.sessionId,
    staffRoles,
  });
}

/**
 * Generic trusted context for the rest of the platform.
 *
 * GUEST remains forbidden here. Several non-accounting contours use GUEST as a
 * compatibility/organization-shell role and were never reviewed to accept it.
 * Widening this function would widen all of them at once.
 */
export function deriveTrustedRlsContext(user: RequestUser | undefined): TrustedRlsContext {
  const context = deriveBaseRlsContext(user);
  if (user?.role === Role.GUEST) {
    throw new RlsContextError('guest_role_forbidden');
  }
  return context;
}

/**
 * Candidate context for an organization-member contour.
 *
 * This deliberately does not make GUEST trusted. It only supplies the identity
 * coordinates required to enter a transaction. `withOrganizationMemberContext`
 * then proves an ACTIVE membership from PostgreSQL before application work is
 * allowed to run. The database proof, not the role label, is the authority.
 */
export function deriveOrganizationMemberRlsContext(
  user: RequestUser | undefined,
): TrustedRlsContext {
  return deriveBaseRlsContext(user);
}

@Injectable()
export class RlsTransactionService {
  constructor(private readonly prisma: PrismaService) {}

  async withTrustedContext<T>(
    user: RequestUser | undefined,
    work: (tx: Prisma.TransactionClient, context: TrustedRlsContext) => Promise<T>,
    options: RlsTransactionOptions = {},
  ): Promise<T> {
    return this.withContext(deriveTrustedRlsContext(user), work, options, false);
  }

  /**
   * Narrow organization-member transaction path for contours that intentionally
   * support `role=GUEST` plus a server-resolved `job_profile` (the organization
   * accountant compatibility model).
   *
   * The role is not enough. After the usual identity settings are established,
   * PostgreSQL resolves `app_pc_crop_membership_id()` from durable user_orgs and
   * the authenticated identity. A forged organization/tenant or an inactive/
   * revoked membership therefore yields no membership and the callback never
   * runs.
   */
  async withOrganizationMemberContext<T>(
    user: RequestUser | undefined,
    work: (tx: Prisma.TransactionClient, context: TrustedRlsContext) => Promise<T>,
    options: RlsTransactionOptions = {},
  ): Promise<T> {
    return this.withContext(
      deriveOrganizationMemberRlsContext(user),
      work,
      options,
      true,
    );
  }

  private async withContext<T>(
    context: TrustedRlsContext,
    work: (tx: Prisma.TransactionClient, context: TrustedRlsContext) => Promise<T>,
    options: RlsTransactionOptions,
    requireOrganizationMembership: boolean,
  ): Promise<T> {
    const isolationLevel = options.isolationLevel ?? Prisma.TransactionIsolationLevel.ReadCommitted;
    const defaultConflictRetries = isolationLevel === Prisma.TransactionIsolationLevel.Serializable ? 3 : 0;
    const maxConflictRetries = boundedInteger(
      options.maxConflictRetries,
      0,
      5,
      defaultConflictRetries,
    );
    const retryDelayMs = boundedInteger(options.retryDelayMs, 0, 1_000, 10);
    const transactionOptions = {
      maxWait: options.maxWait ?? 5_000,
      timeout: options.timeout ?? 15_000,
      isolationLevel,
    };

    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            await tx.$queryRaw(
              Prisma.sql`
                SELECT
                  set_config('app.current_user_id', ${context.userId}, true),
                  set_config('app.current_org_id', ${context.orgId}, true),
                  set_config('app.current_tenant_id', ${context.tenantId}, true),
                  set_config('app.current_role', ${context.role}, true),
                  set_config('app.current_session_id', ${context.sessionId}, true)
              `,
            );

            if (requireOrganizationMembership) {
              const memberships = await tx.$queryRaw<{ membership: string | null }[]>(
                Prisma.sql`SELECT public.app_pc_crop_membership_id() AS membership`,
              );
              if (!memberships[0]?.membership) {
                throw new RlsContextError('organization_membership_required');
              }
            }

            return work(tx, context);
          },
          transactionOptions,
        );
      } catch (error) {
        if (!isRetryableTransactionConflict(error) || attempt >= maxConflictRetries) throw error;
        await conflictBackoff(retryDelayMs, attempt);
      }
    }
  }
}

export function isRetryableTransactionConflict(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2034') return true;
    const databaseCode = readDatabaseCode(error.meta);
    return databaseCode === '40001' || databaseCode === '40P01';
  }
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; meta?: unknown };
  if (candidate.code === 'P2034' || candidate.code === '40001' || candidate.code === '40P01') return true;
  const databaseCode = readDatabaseCode(candidate.meta);
  return databaseCode === '40001' || databaseCode === '40P01';
}

function readDatabaseCode(meta: unknown): string | null {
  if (!meta || typeof meta !== 'object') return null;
  const record = meta as Record<string, unknown>;
  for (const key of ['code', 'database_error_code', 'dbErrorCode', 'sqlState']) {
    if (typeof record[key] === 'string') return record[key];
  }
  return null;
}

async function conflictBackoff(baseDelayMs: number, attempt: number): Promise<void> {
  if (baseDelayMs <= 0) return;
  const exponential = Math.min(baseDelayMs * 2 ** attempt, 1_000);
  const jitter = Math.floor(Math.random() * Math.max(1, baseDelayMs));
  await new Promise((resolve) => setTimeout(resolve, exponential + jitter));
}

function boundedInteger(
  value: number | undefined,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`Transaction option must be an integer between ${minimum} and ${maximum}.`);
  }
  return value;
}
