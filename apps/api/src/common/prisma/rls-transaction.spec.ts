import {
  TrustedRlsContextError,
  normalizeTrustedRlsContext,
  setTransactionLocalRlsContext,
  withTrustedRlsTransaction,
} from './rls-transaction';

const CONTEXT = {
  userId: 'user-1',
  organizationId: 'org-1',
  tenantId: 'tenant-1',
  role: 'SUPPORT_MANAGER',
  sessionId: 'session-1',
} as const;

describe('transaction-local RLS context', () => {
  it('sets parameterized local context before application work', async () => {
    const calls: string[] = [];
    const transaction = {
      $queryRaw: jest.fn(async (query: { strings?: readonly string[]; values?: readonly unknown[] }) => {
        calls.push('context');
        expect(query.values).toEqual([
          CONTEXT.userId,
          CONTEXT.organizationId,
          CONTEXT.tenantId,
          CONTEXT.role,
          CONTEXT.sessionId,
        ]);
        expect(query.strings?.join('')).toContain("set_config('app.current_user_id'");
        expect(query.strings?.join('')).toContain("set_config('app.current_org_id'");
        expect(query.strings?.join('')).toContain("set_config('app.current_tenant_id'");
        expect(query.strings?.join('')).toContain("set_config('app.current_role'");
        expect(query.strings?.join('')).toContain("set_config('app.current_session_id'");
        expect(query.strings?.join('')).toContain(', true)');
        return [];
      }),
    };
    const prisma = {
      $transaction: jest.fn(async (work: (client: typeof transaction) => Promise<string>) => work(transaction)),
    };

    const result = await withTrustedRlsTransaction(prisma, CONTEXT, async () => {
      calls.push('work');
      return 'ok';
    });

    expect(result).toBe('ok');
    expect(calls).toEqual(['context', 'work']);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(transaction.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('fails closed before opening a transaction when trusted fields are missing', async () => {
    const prisma = { $transaction: jest.fn() };

    await expect(withTrustedRlsTransaction(
      prisma as never,
      { ...CONTEXT, tenantId: '  ' },
      async () => 'unreachable',
    )).rejects.toBeInstanceOf(TrustedRlsContextError);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('uses an explicit internal session marker when no request session is supplied', () => {
    expect(normalizeTrustedRlsContext({ ...CONTEXT, sessionId: undefined })).toEqual({
      ...CONTEXT,
      sessionId: 'internal-service',
    });
  });

  it('does not expose an unsafe raw execution path', async () => {
    const transaction = { $queryRaw: jest.fn().mockResolvedValue([]) };
    await setTransactionLocalRlsContext(transaction, CONTEXT);

    expect(transaction).not.toHaveProperty('$executeRawUnsafe');
    expect(transaction.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
