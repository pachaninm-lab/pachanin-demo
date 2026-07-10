import type { Prisma } from '@prisma/client';
import {
  RlsContextError,
  type TrustedRlsContext,
  RlsTransactionService,
} from '../../common/prisma/rls-transaction.service';
import { RequestUser, Role } from '../../common/types/request-user';
import {
  RuntimePersistenceCommandService,
  type RuntimePersistenceAuthenticatedCommandInput,
} from './runtime-persistence-command.service';
import type { RuntimePersistenceWriteReceipt } from './runtime-persistence.repository';
import { RuntimePersistenceService } from './runtime-persistence.service';

const TRUSTED_USER: RequestUser = {
  id: 'user-authenticated-001',
  email: 'operator@example.test',
  role: Role.SUPPORT_MANAGER,
  orgId: 'organization-trusted-001',
  tenantId: 'tenant-trusted-001',
  sessionId: 'session-trusted-001',
};

const COMMAND: RuntimePersistenceAuthenticatedCommandInput = {
  runtimeSnapshotId: 'runtime-snapshot:deal-canonical-001:start_document_review:v2',
  idempotencyKey: 'runtime-persistence:deal-canonical-001:start_document_review:v2',
  transactionId: 'runtime-transaction:deal-canonical-001:start_document_review:v2',
  dealId: 'deal-canonical-001',
  intentId: 'start_document_review',
  snapshotState: 'updated',
  statusLabel: 'document_review_started',
  runtimeStoreRecordId: 'runtime-store:deal-canonical-001:start_document_review:v2',
  runtimeStoreVersion: 'v2',
  correlationId: 'correlation-canonical-002',
  auditId: 'audit-canonical-002',
  contractHash: 'sha256:canonical-runtime-contract-002',
  payload: {
    dealId: 'deal-canonical-001',
    intentId: 'start_document_review',
    state: 'updated',
  },
};

const RECEIPT: RuntimePersistenceWriteReceipt = {
  status: 'persisted',
  runtimeSnapshotId: COMMAND.runtimeSnapshotId,
  idempotencyKey: COMMAND.idempotencyKey,
  state: 'fully_linked',
  recordId: 'runtime-record-canonical-002',
};

const DUPLICATE: RuntimePersistenceWriteReceipt = {
  status: 'duplicate',
  runtimeSnapshotId: COMMAND.runtimeSnapshotId,
  idempotencyKey: COMMAND.idempotencyKey,
  state: 'fully_linked',
  recordId: 'runtime-record-canonical-002',
};

function fixture() {
  const tx = { trusted: true } as unknown as Prisma.TransactionClient;
  const context: TrustedRlsContext = {
    userId: TRUSTED_USER.id,
    orgId: TRUSTED_USER.orgId!,
    tenantId: TRUSTED_USER.tenantId!,
    role: TRUSTED_USER.role,
    sessionId: TRUSTED_USER.sessionId!,
  };
  const persistence = {
    persistWithinTransaction: jest.fn().mockResolvedValue(RECEIPT),
    classifyExistingWithinTransaction: jest.fn().mockResolvedValue(null),
  } as unknown as RuntimePersistenceService;
  const rlsTransactions = {
    withTrustedContext: jest.fn(
      async (
        _user: RequestUser,
        work: (client: Prisma.TransactionClient, trusted: TrustedRlsContext) => Promise<unknown>,
      ) => work(tx, context),
    ),
  } as unknown as RlsTransactionService;

  return {
    tx,
    persistence,
    rlsTransactions,
    service: new RuntimePersistenceCommandService(persistence, rlsTransactions),
  };
}

describe('RuntimePersistenceCommandService', () => {
  it('derives identity only from trusted RequestUser and uses the RLS transaction client', async () => {
    const test = fixture();

    await expect(test.service.persistAuthenticated(TRUSTED_USER, COMMAND)).resolves.toBe(RECEIPT);

    expect(test.rlsTransactions.withTrustedContext).toHaveBeenCalledTimes(1);
    expect(test.rlsTransactions.withTrustedContext).toHaveBeenCalledWith(
      TRUSTED_USER,
      expect.any(Function),
    );
    expect(test.persistence.persistWithinTransaction).toHaveBeenCalledTimes(1);
    expect(test.persistence.persistWithinTransaction).toHaveBeenCalledWith(test.tx, {
      ...COMMAND,
      actorId: TRUSTED_USER.id,
      actorRole: TRUSTED_USER.role,
      tenantId: TRUSTED_USER.tenantId,
      organizationId: TRUSTED_USER.orgId,
    });
  });

  it('overrides malicious identity fields supplied through an untyped payload', async () => {
    const test = fixture();
    const maliciousCommand = {
      ...COMMAND,
      actorId: 'attacker-user',
      actorRole: Role.ADMIN,
      tenantId: 'attacker-tenant',
      organizationId: 'attacker-org',
      outboxEntryId: 'attacker-outbox',
      auditEventId: 'attacker-audit',
    } as unknown as RuntimePersistenceAuthenticatedCommandInput;

    await test.service.persistAuthenticated(TRUSTED_USER, maliciousCommand);

    const delegated = (test.persistence.persistWithinTransaction as jest.Mock).mock.calls[0][1];
    expect(delegated).toMatchObject({
      actorId: TRUSTED_USER.id,
      actorRole: TRUSTED_USER.role,
      tenantId: TRUSTED_USER.tenantId,
      organizationId: TRUSTED_USER.orgId,
    });
    expect(delegated.actorId).not.toBe('attacker-user');
    expect(delegated.actorRole).not.toBe(Role.ADMIN);
    expect(delegated.tenantId).not.toBe('attacker-tenant');
    expect(delegated.organizationId).not.toBe('attacker-org');
  });

  it.each([
    ['authenticated_user_required', undefined],
    ['session_required', { ...TRUSTED_USER, sessionId: undefined }],
    ['organization_required', { ...TRUSTED_USER, orgId: '' }],
    ['tenant_required', { ...TRUSTED_USER, tenantId: undefined }],
    ['guest_role_forbidden', { ...TRUSTED_USER, role: Role.GUEST }],
  ] as const)('blocks %s before opening an RLS transaction', async (expectedCode, user) => {
    const test = fixture();

    await expect(test.service.persistAuthenticated(user, COMMAND)).rejects.toMatchObject({
      name: 'RuntimePersistenceCommandContextError',
      code: expectedCode,
      message: 'Trusted runtime persistence context is incomplete.',
    });
    expect(test.rlsTransactions.withTrustedContext).not.toHaveBeenCalled();
    expect(test.persistence.persistWithinTransaction).not.toHaveBeenCalled();
  });

  it('returns failed repository receipts unchanged', async () => {
    const test = fixture();
    const failed: RuntimePersistenceWriteReceipt = {
      status: 'failed',
      runtimeSnapshotId: COMMAND.runtimeSnapshotId,
      idempotencyKey: COMMAND.idempotencyKey,
      state: 'ready_to_persist',
      reasonCode: 'repository_not_enabled',
    };
    (test.persistence.persistWithinTransaction as jest.Mock).mockResolvedValueOnce(failed);

    await expect(test.service.persistAuthenticated(TRUSTED_USER, COMMAND)).resolves.toBe(failed);
  });

  it('does not execute persistence when RLS initialization fails', async () => {
    const test = fixture();
    (test.rlsTransactions.withTrustedContext as jest.Mock).mockRejectedValueOnce(
      new Error('sensitive set_config failure'),
    );

    await expect(test.service.persistAuthenticated(TRUSTED_USER, COMMAND)).resolves.toEqual({
      status: 'failed',
      runtimeSnapshotId: COMMAND.runtimeSnapshotId,
      idempotencyKey: COMMAND.idempotencyKey,
      state: 'ready_to_persist',
      reasonCode: 'database_write_failed',
    });
    expect(test.persistence.persistWithinTransaction).not.toHaveBeenCalled();
  });

  it('re-enters a trusted transaction to classify a concurrent P2002 winner', async () => {
    const test = fixture();
    (test.persistence.persistWithinTransaction as jest.Mock).mockRejectedValueOnce({ code: 'P2002' });
    (test.persistence.classifyExistingWithinTransaction as jest.Mock).mockResolvedValueOnce(DUPLICATE);

    await expect(test.service.persistAuthenticated(TRUSTED_USER, COMMAND)).resolves.toBe(DUPLICATE);

    expect(test.rlsTransactions.withTrustedContext).toHaveBeenCalledTimes(2);
    expect(test.persistence.classifyExistingWithinTransaction).toHaveBeenCalledWith(test.tx, {
      ...COMMAND,
      actorId: TRUSTED_USER.id,
      actorRole: TRUSTED_USER.role,
      tenantId: TRUSTED_USER.tenantId,
      organizationId: TRUSTED_USER.orgId,
    });
  });

  it('returns a sanitized failure when a P2002 winner cannot be classified', async () => {
    const test = fixture();
    (test.persistence.persistWithinTransaction as jest.Mock).mockRejectedValueOnce({ code: 'P2002' });
    (test.persistence.classifyExistingWithinTransaction as jest.Mock).mockResolvedValueOnce(null);

    const receipt = await test.service.persistAuthenticated(TRUSTED_USER, COMMAND);

    expect(receipt).toMatchObject({ status: 'failed', reasonCode: 'database_write_failed' });
    expect(JSON.stringify(receipt)).not.toContain('P2002');
  });

  it('maps trusted-context failures without opening repository work', async () => {
    const test = fixture();
    (test.rlsTransactions.withTrustedContext as jest.Mock).mockRejectedValueOnce(
      new RlsContextError('tenant_required'),
    );

    await expect(test.service.persistAuthenticated(TRUSTED_USER, COMMAND)).rejects.toMatchObject({
      name: 'RuntimePersistenceCommandContextError',
      code: 'tenant_required',
    });
    expect(test.persistence.persistWithinTransaction).not.toHaveBeenCalled();
  });
});
