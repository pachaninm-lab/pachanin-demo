import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Prisma } from '@prisma/client';
import type { RequestUser } from '../types/request-user';
import { Role } from '../types/request-user';
import { PrismaService } from './prisma.service';
import {
  deriveTrustedRlsContext,
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

function repositoryPath(...segments: string[]): string {
  const candidates = [
    path.resolve(process.cwd(), ...segments),
    path.resolve(process.cwd(), '../..', ...segments),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error(`Repository path not found: ${segments.join('/')}`);
  return found;
}

describe('RlsTransactionService', () => {
  it('derives the complete context only from trusted RequestUser fields', () => {
    expect(deriveTrustedRlsContext(TRUSTED_USER)).toEqual({
      userId: TRUSTED_USER.id,
      orgId: TRUSTED_USER.orgId,
      tenantId: TRUSTED_USER.tenantId,
      role: TRUSTED_USER.role,
      sessionId: TRUSTED_USER.sessionId,
    });
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

  it('sets parameterized transaction-local user, organization, tenant, role and session context', async () => {
    const test = fixture();
    const work = jest.fn(
      async (_tx: Prisma.TransactionClient, context: TrustedRlsContext) => context.userId,
    );

    await expect(test.service.withTrustedContext(TRUSTED_USER, work)).resolves.toBe(TRUSTED_USER.id);

    expect(test.transaction).toHaveBeenCalledTimes(1);
    expect(test.queryRaw).toHaveBeenCalledTimes(1);
    expect(work).toHaveBeenCalledWith(test.tx, {
      userId: TRUSTED_USER.id,
      orgId: TRUSTED_USER.orgId,
      tenantId: TRUSTED_USER.tenantId,
      role: TRUSTED_USER.role,
      sessionId: TRUSTED_USER.sessionId,
    });

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

  it('uses bounded transaction defaults and accepts an explicit isolation level', async () => {
    const test = fixture();

    await test.service.withTrustedContext(
      TRUSTED_USER,
      async () => 'ok',
      {
        maxWait: 1_000,
        timeout: 2_000,
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

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

    await expect(test.service.withTrustedContext(TRUSTED_USER, work)).rejects.toBe(databaseError);
    expect(work).not.toHaveBeenCalled();
  });
});

describe('platform-v7 database deployment artifacts', () => {
  it('passes canonical Prisma/RLS drift validation', () => {
    const validator = repositoryPath('scripts/platform-v7-rls-validate.mjs');
    const result = JSON.parse(execFileSync(process.execPath, [validator], { encoding: 'utf8' })) as {
      valid: boolean;
      errors: string[];
      policies: number;
    };

    expect(result).toMatchObject({ valid: true, errors: [] });
    expect(result.policies).toBeGreaterThanOrEqual(16);
  });

  it('keeps the apply rehearsal isolated and transactionally rolled back', () => {
    const source = readFileSync(repositoryPath('scripts/platform-v7-rls-apply-rehearsal.sh'), 'utf8');
    expect(source).toContain('RLS_REHEARSAL_DATABASE_URL');
    expect(source).toContain('NODE_ENV=production');
    expect(source).toContain('rehearsal URL equals DATABASE_URL');
    expect(source).toContain('ROLLBACK;');
    expect(source).not.toContain('COMMIT;');
  });

  it('replaces reverse RLS rollback with fail-closed backup/restore recovery', () => {
    const wrapper = readFileSync(repositoryPath('scripts/platform-v7-rls-rollback-rehearsal.sh'), 'utf8');
    const rehearsal = readFileSync(repositoryPath('scripts/platform-v7-database-dr-rehearsal.sh'), 'utf8');

    expect(wrapper).toContain('platform-v7-database-dr-rehearsal.sh');
    expect(wrapper).toContain('forward-compatible database');
    expect(rehearsal).toContain('pg_dump');
    expect(rehearsal).toContain('pg_restore');
    expect(rehearsal).toContain('sha256sum --check');
    expect(rehearsal).toContain('SOURCE_FINGERPRINT');
    expect(rehearsal).toContain('RESTORE_FINGERPRINT');

    const forbidden = [
      /ALTER\s+TABLE[\s\S]*DISABLE\s+ROW\s+LEVEL\s+SECURITY/i,
      /ALTER\s+TABLE[\s\S]*NO\s+FORCE\s+ROW\s+LEVEL\s+SECURITY/i,
      /DROP\s+POLICY/i,
    ];
    for (const pattern of forbidden) {
      expect(pattern.test(wrapper)).toBe(false);
      expect(pattern.test(rehearsal)).toBe(false);
    }
  });

  it('passes the forward-only migration gate', () => {
    const gate = repositoryPath('scripts/platform-v7-forward-only-migration-check.mjs');
    const result = JSON.parse(execFileSync(process.execPath, [gate], { encoding: 'utf8' })) as {
      forwardOnlyMigrationGate: string;
      rollbackScript: string;
    };
    expect(result).toMatchObject({
      forwardOnlyMigrationGate: 'passed',
      rollbackScript: 'safe-restore-only',
    });
  });
});
