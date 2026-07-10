import { Prisma } from '@prisma/client';

export interface TrustedRlsContext {
  readonly userId: string;
  readonly organizationId: string;
  readonly tenantId: string;
  readonly role: string;
  readonly sessionId?: string;
}

export interface RlsTransactionClient {
  $queryRaw<T = unknown>(query: Prisma.Sql): Promise<T>;
}

export interface RlsTransactionHost<TClient extends RlsTransactionClient> {
  $transaction<TResult>(work: (transaction: TClient) => Promise<TResult>): Promise<TResult>;
}

export class TrustedRlsContextError extends Error {
  readonly code = 'TRUSTED_RLS_CONTEXT_REQUIRED';

  constructor() {
    super('Trusted transaction RLS context is incomplete.');
    this.name = 'TrustedRlsContextError';
  }
}

function required(value: string | undefined): string {
  const normalized = value?.trim();
  if (!normalized) throw new TrustedRlsContextError();
  return normalized;
}

export function normalizeTrustedRlsContext(context: TrustedRlsContext): Required<TrustedRlsContext> {
  return {
    userId: required(context.userId),
    organizationId: required(context.organizationId),
    tenantId: required(context.tenantId),
    role: required(context.role),
    sessionId: required(context.sessionId ?? 'internal-service'),
  };
}

export async function setTransactionLocalRlsContext(
  transaction: RlsTransactionClient,
  context: TrustedRlsContext,
): Promise<void> {
  const trusted = normalizeTrustedRlsContext(context);

  await transaction.$queryRaw(Prisma.sql`
    SELECT
      set_config('app.current_user_id', ${trusted.userId}, true),
      set_config('app.current_org_id', ${trusted.organizationId}, true),
      set_config('app.current_tenant_id', ${trusted.tenantId}, true),
      set_config('app.current_role', ${trusted.role}, true),
      set_config('app.current_session_id', ${trusted.sessionId}, true)
  `);
}

export async function withTrustedRlsTransaction<TClient extends RlsTransactionClient, TResult>(
  prisma: RlsTransactionHost<TClient>,
  context: TrustedRlsContext,
  work: (transaction: TClient) => Promise<TResult>,
): Promise<TResult> {
  const trusted = normalizeTrustedRlsContext(context);

  return prisma.$transaction(async (transaction) => {
    await setTransactionLocalRlsContext(transaction, trusted);
    return work(transaction);
  });
}
