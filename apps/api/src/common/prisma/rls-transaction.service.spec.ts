import { Prisma } from '@prisma/client';
import type { RequestUser } from '../types/request-user';
import { Role } from '../types/request-user';
import { PrismaService } from './prisma.service';
import {
  deriveTrustedRlsContext,
  normalizeTrustedRlsContext,
  RlsContextError,
  RlsTransactionService,
  type TrustedRlsContext,
} from './rls-transaction.service';

const TRUSTED_USER: RequestUser = {
  id: 'user-rls-001',
  email: 'operator@example.test',
  role: Role.SUPPORT_MANAGER,
  orgId: 'org-rls-001',
  tenantId: 'tenant-rls-001',
  sessionId: 'session-rls-001',
};

const TRUSTED_CONTEXT: TrustedRlsContext = {
  userId: TRUSTED_USER.id,
  orgId: TRUSTED_USER.orgId!,
  tenantId: TRUSTED_USER.tenantId!,
  role: TRUSTED_USER.role,
  sessionId: TRUSTED_USER.sessionId!,
};

function fixture() {
  const queryRaw = jest.fn().mockResolvedValue([{ set_config: 'session-rls-001' }]);
  const tx = { $queryRaw: queryRaw } as unknown as Prisma.TransactionClient;
  const transaction = jest.fn(
    async (
      callback: (client: Prisma.TransactionClient) => Promise<unknown>,
      _options: unknown,
    ) => callback(tx),
  );
  const prisma = { $transaction: transaction } as unknown as PrismaService;

  return {
    tx,
    queryRaw,
    transaction,
    service: new RlsTransactionService(prisma),
  };
}

describe('RlsTransactionService', () => {
  it('derives the complete context only from trusted RequestUser fields', () => {
    expect(deriveTrustedRlsContext(TRUSTED_USER)).toEqual(TRUSTED_CONTEXT);
  });

  it.each([
    ['authenticated_user_required', undefined],
    ['authenticated_user_required', { ...TRUSTED_USER, id: ' ' }],
    ['session_required', { ...TRUSTED_USER, sessionId: undefined }],
    ['organization_required', { ...TRUSTED_USER, orgId: '' }],
    ['tenant_required', { ...TRUSTED_USER, tenantId: ' ' }],
    ['guest_role_forbidden', { ...TRUSTED_USER, role: Role.GUEST }],
  ] as const)('fails closed with %s before opening a transaction', async (expectedCode, user) => {
    const test = fixture();

    await expect(
      test.service.withTrustedContext(user as RequestUser | undefined, async () => 'unreachable'),
    ).rejects.toEqual(
      expect.objectContaining<Partial<RlsContextError>>({
        name: 'RlsContextError',
        code: expectedCode,
        message: 'Trusted PostgreSQL RLS context is incomplete.',
      }),
    );
    expect(test.transaction).not.toHaveBeenCalled();
  });

  it('normalizes and freezes a trusted internal context', () => {
    const normalized = normalizeTrustedRlsContext(TRUSTED_CONTEXT);
    expect(normalized).toEqual(TRUSTED_CONTEXT);
    expect(Object.isFrozen(normalized)).toBe(true);
  });

  it('sets parameterized transaction-local context before trusted user work', async () => {
    const test = fixture();
    const work = jest.fn(
      async (_tx: Prisma.TransactionClient, context: TrustedRlsContext) => context.userId,
    );

    await expect(test.service.withTrustedContext(TRUSTED_USER, work)).resolves.toBe(TRUSTED_USER.id);

    expect(test.transaction).toHaveBeenCalledTimes(1);
    expect(test.queryRaw).toHaveBeenCalledTimes(1);
    expect(work).toHaveBeenCalledWith(test.tx, TRUSTED_CONTEXT);

    const statement = test.queryRaw.mock.calls[0][0] as {
      strings: string[];
      values: unknown[];
    };
    const sql = statement.strings.join(' ');
    expect(sql).toContain("set_config('app.current_user_id'");
    expect(sql).toContain("set_config('app.current_org_id'");
    expect(sql).toContain("set_config('app.current_tenant_id'");
    expect(sql).toContain("set_config('app.current_role'");
    expect(sql).toContain("set_config('app.current_session_id'");
    expect(sql.match(/true/g)).toHaveLength(5);
    expect(statement.values).toEqual([
      TRUSTED_USER.id,
      TRUSTED_USER.orgId,
      TRUSTED_USER.tenantId,
      TRUSTED_USER.role,
      TRUSTED_USER.sessionId,
    ]);
  });

  it('uses the same parameterized transaction boundary for trusted internal context', async () => {
    const test = fixture();
    const work = jest.fn(async () => 'internal-ok');

    await expect(test.service.withContext(TRUSTED_CONTEXT, work)).resolves.toBe('internal-ok');
    expect(test.transaction).toHaveBeenCalledTimes(1);
    expect(test.queryRaw).toHaveBeenCalledTimes(1);
    expect(work).toHaveBeenCalledWith(test.tx, TRUSTED_CONTEXT);
  });

  it('uses bounded transaction defaults and accepts an explicit isolation level', async () => {
    const test = fixture();

    await test.service.withTrustedContext(TRUSTED_USER, async () => 'ok', {
      maxWait: 1_000,
      timeout: 2_000,
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });

    expect(test.transaction).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 1_000,
      timeout: 2_000,
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it('does not execute business work when RLS context initialization fails', async () => {
    const test = fixture();
    const databaseError = new Error('set_config failed');
    test.queryRaw.mockRejectedValueOnce(databaseError);
    const work = jest.fn(async () => 'must-not-run');

    await expect(test.service.withContext(TRUSTED_CONTEXT, work)).rejects.toBe(databaseError);
    expect(work).not.toHaveBeenCalled();
  });
});
