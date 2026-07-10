import { RequestUser, Role } from '../../common/types/request-user';
import {
  RuntimePersistenceCommandContextError,
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

function fixture() {
  const persistence = {
    persist: jest.fn().mockResolvedValue(RECEIPT),
  } as unknown as RuntimePersistenceService;
  return {
    persistence,
    service: new RuntimePersistenceCommandService(persistence),
  };
}

describe('RuntimePersistenceCommandService', () => {
  it('derives actor, role, tenant and organization only from trusted RequestUser', async () => {
    const test = fixture();

    await expect(test.service.persistAuthenticated(TRUSTED_USER, COMMAND)).resolves.toBe(RECEIPT);
    expect(test.persistence.persist).toHaveBeenCalledTimes(1);
    expect(test.persistence.persist).toHaveBeenCalledWith({
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

    const delegated = (test.persistence.persist as jest.Mock).mock.calls[0][0];
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
  ] as const)('blocks %s before repository delegation', async (expectedCode, user) => {
    const test = fixture();

    await expect(test.service.persistAuthenticated(user, COMMAND)).rejects.toEqual(
      expect.objectContaining<Partial<RuntimePersistenceCommandContextError>>({
        name: 'RuntimePersistenceCommandContextError',
        code: expectedCode,
        message: 'Trusted runtime persistence context is incomplete.',
      }),
    );
    expect(test.persistence.persist).not.toHaveBeenCalled();
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
    (test.persistence.persist as jest.Mock).mockResolvedValueOnce(failed);

    await expect(test.service.persistAuthenticated(TRUSTED_USER, COMMAND)).resolves.toBe(failed);
  });
});
