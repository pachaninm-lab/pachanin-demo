import { describe, expect, it } from 'vitest';
import {
  executePlatformV7BankBasisAction,
  executePlatformV7DocumentAction,
  executePlatformV7MoneyAction,
  type P7ActionIdempotencyContext,
} from '@/lib/platform-v7/action-boundary';
import {
  p7BuildBankBasis,
  p7MarkBankBasisSent,
  type P7BankConfirmationEvent,
  type P7BankConfirmationOperationType,
  type P7BankConfirmationPath,
} from '@/lib/platform-v7/bank-basis';
import { buildPlatformV7IdempotencyKey } from '@/lib/platform-v7/idempotency-key-helper';
import type { PlatformV7AccessActor, PlatformV7ResourceScope } from '@/lib/platform-v7/access-control';
import type { PlatformV7DocumentRequirement, PlatformV7DocumentSource, PlatformV7DocumentStatus } from '@/lib/platform-v7/document-matrix';
import type { PlatformV7MoneyOperation, PlatformV7MoneyOperationType, PlatformV7MoneyTree, PlatformV7ReleaseGateInput } from '@/lib/platform-v7/money-tree';
import type { PlatformV7CanonicalRole } from '@/lib/platform-v7/role-canonical';

const emptyContext: P7ActionIdempotencyContext = {
  processedKeys: [],
  processedBankEventIds: [],
};

const operationTypeByPath: Record<P7BankConfirmationPath, P7BankConfirmationOperationType> = {
  release: 'release_confirmed',
  refund: 'refund_confirmed',
  hold: 'hold_created',
  reject: 'release_failed',
  manual_review: 'manual_review_started',
};

const reservedTree: PlatformV7MoneyTree = {
  dealId: 'deal-1',
  currency: 'RUB',
  totalDealAmount: 1000,
  reservedAmount: 1000,
  readyToReleaseAmount: 800,
  heldAmount: 100,
  manualReviewAmount: 0,
  releasedAmount: 50,
  refundedAmount: 50,
  platformFee: 10,
  bankFee: 5,
  status: 'reserved',
};

const releaseRequestedTree: PlatformV7MoneyTree = {
  ...reservedTree,
  status: 'release_requested',
};

const releaseGate: PlatformV7ReleaseGateInput = {
  operationType: 'release_requested',
  bankConfirmationExists: false,
  dealStatus: 'release_basis_ready',
  moneyStatus: 'reserved',
  requiredDocumentsConfirmed: true,
  tripStatus: 'completed',
  acceptanceStatus: 'confirmed',
  disputeStatus: 'none',
  bankReviewStatus: 'clear',
};

const moneyResource: PlatformV7ResourceScope = {
  resourceType: 'money',
  resourceId: 'money-1',
  sellerOrganizationId: 'org-seller',
  buyerOrganizationId: 'org-buyer',
  bankOrganizationId: 'org-bank',
  linkedOrganizationIds: ['org-seller', 'org-buyer', 'org-bank'],
};

const documentResource: PlatformV7ResourceScope = {
  resourceType: 'document',
  resourceId: 'doc-1',
  sellerOrganizationId: 'org-seller',
  buyerOrganizationId: 'org-buyer',
  assignedLabOrganizationId: 'org-lab',
  assignedElevatorOrganizationId: 'org-elevator',
  linkedOrganizationIds: ['org-seller', 'org-buyer', 'org-lab', 'org-elevator'],
};

function actor(role: PlatformV7CanonicalRole, organizationId = `org-${role}`): PlatformV7AccessActor {
  return {
    userId: `${role}-1`,
    organizationId,
    roles: [role],
    activeRole: role,
  };
}

function key(boundaryId = 'confirm_money_released', attemptId = 'attempt-1', actorId = 'actor-1', amountMinor = 300): string {
  return buildPlatformV7IdempotencyKey({
    boundaryId: boundaryId as Parameters<typeof buildPlatformV7IdempotencyKey>[0]['boundaryId'],
    actorId,
    entityId: 'money-1',
    dealId: 'deal-1',
    amountMinor,
    currency: 'RUB',
    attemptId,
  });
}

function moneyOperation(type: PlatformV7MoneyOperationType, idempotencyKey: string, overrides: Partial<PlatformV7MoneyOperation> = {}): PlatformV7MoneyOperation {
  return {
    operationId: `op-${type}-${overrides.amount ?? 300}`,
    dealId: 'deal-1',
    type,
    amount: overrides.amount ?? 300,
    currency: 'RUB',
    basisDocumentIds: ['contract', 'acceptance_act', 'lab_protocol', 'bank_basis'],
    actorId: overrides.actorId ?? 'actor-1',
    actorRole: overrides.actorRole ?? 'seller',
    occurredAt: '2026-05-23T09:00:00.000Z',
    idempotencyKey,
    correlationId: 'corr-1',
    auditId: 'audit-1',
    ...overrides,
  };
}

function doc(
  documentId: string,
  ownerRole: PlatformV7CanonicalRole,
  status: PlatformV7DocumentStatus,
  source: PlatformV7DocumentSource,
): PlatformV7DocumentRequirement {
  return {
    documentId,
    dealId: 'deal-1',
    type: documentId,
    title: documentId,
    ownerRole,
    responsibleRole: ownerRole,
    status,
    source,
    deadline: null,
    signatureStatus: 'not_required',
    blockStages: ['release'],
    affectsMoney: true,
    nextAction: 'next',
    createdAt: '2026-05-23T08:00:00.000Z',
    updatedAt: '2026-05-23T08:00:00.000Z',
  };
}

const bankBasisDocuments: readonly PlatformV7DocumentRequirement[] = [
  doc('contract', 'seller', 'confirmed', 'edo'),
  doc('sdiz', 'seller', 'confirmed', 'fgis'),
  doc('acceptance_act', 'elevator_operator', 'signed', 'elevator'),
  doc('lab_protocol', 'lab_specialist', 'confirmed', 'lab'),
  doc('bank_basis', 'operator', 'confirmed', 'bank'),
];

function sentBankBasis() {
  const decision = p7BuildBankBasis({
    dealId: 'deal-1',
    releaseGate: { allowed: true, reason: 'ready', nextStatus: 'release_requested' },
    documents: bankBasisDocuments,
    disputeResolved: true,
    amount: 300,
    currency: 'RUB',
    correlationId: 'corr-basis',
    auditId: 'audit-basis',
  });

  return p7MarkBankBasisSent({
    decision,
    moneyTree: releaseRequestedTree,
    actorId: 'operator-1',
    actorRole: 'operator',
    organizationId: 'org-operator',
    createdAt: '2026-05-23T08:55:00.000Z',
  }).decision;
}

function confirmation<Path extends P7BankConfirmationPath>(
  path: Path,
  overrides: Partial<P7BankConfirmationEvent<Path>> = {},
): P7BankConfirmationEvent<Path> {
  const amount = overrides.amount ?? (path === 'reject' ? 0 : 300);
  const bankEventId = overrides.bankEventId ?? `bank-event-${path}`;
  const actorId = overrides.actorId ?? 'bank-1';

  return {
    bankEventId,
    idempotencyKey: overrides.idempotencyKey ?? key('confirm_money_released', bankEventId, actorId, amount),
    path,
    operationType: operationTypeByPath[path] as P7BankConfirmationOperationType<Path>,
    amount,
    actorId,
    actorRole: overrides.actorRole ?? 'bank_officer',
    organizationId: overrides.organizationId ?? 'org-bank',
    bankOrganizationId: overrides.bankOrganizationId ?? 'org-bank',
    bankReference: overrides.bankReference ?? `BR-${path}`,
    confirmedAt: overrides.confirmedAt ?? '2026-05-23T09:10:00.000Z',
    auditId: overrides.auditId ?? 'audit-bank-1',
    correlationId: overrides.correlationId ?? 'corr-bank-1',
  };
}

describe('platform-v7 RBAC audit idempotency action boundary', () => {
  it('lets seller request release when scoped and release gate is ready', () => {
    const idempotencyKey = key('confirm_money_released', 'seller-release-request', 'seller-1');
    const result = executePlatformV7MoneyAction({
      actor: actor('seller', 'org-seller'),
      resource: moneyResource,
      action: 'release_requested',
      payload: {
        beforeMoneyTree: reservedTree,
        operation: moneyOperation('release_requested', idempotencyKey, { actorId: 'seller-1', actorRole: 'seller' }),
        releaseGate,
        bankConfirmationExists: false,
      },
      idempotencyContext: emptyContext,
      idempotencyKey,
      correlationId: 'corr-seller-release-request',
      auditId: 'audit-seller-release-request',
      reason: 'Seller requested release after release gate readiness.',
      createdAt: '2026-05-23T09:00:00.000Z',
    });

    expect(result.status).toBe('applied');
    expect(result.afterState.status).toBe('release_requested');
    expect(result.afterState.releasedAmount).toBe(reservedTree.releasedAmount);
    expect(result.auditPayload).toMatchObject({
      action: 'release_requested',
      actorRole: 'seller',
      correlationId: 'corr-seller-release-request',
      auditId: 'audit-seller-release-request',
      duplicate: false,
    });
  });

  it('denies seller bank release confirmation before any MoneyTree mutation', () => {
    const bankEvent = confirmation('release', { actorRole: 'seller', actorId: 'seller-1', organizationId: 'org-seller' });
    const result = executePlatformV7BankBasisAction({
      actor: actor('seller', 'org-seller'),
      resource: moneyResource,
      action: 'bank_release_confirmed',
      payload: { decision: sentBankBasis(), moneyTree: releaseRequestedTree, confirmation: bankEvent },
      idempotencyContext: emptyContext,
      idempotencyKey: bankEvent.idempotencyKey,
      correlationId: 'corr-seller-denied',
      auditId: 'audit-seller-denied',
      reason: 'Seller cannot confirm bank movement.',
    });

    expect(result.status).toBe('denied');
    expect(result.afterState).toBe(releaseRequestedTree);
    expect(result.auditPayload).toMatchObject({
      auditCode: 'EXPLICIT_DENY',
      action: 'bank_release_confirmed',
      beforeState: releaseRequestedTree,
      afterState: releaseRequestedTree,
    });
    expect(result.deniedPayload).toMatchObject({
      auditCode: 'EXPLICIT_DENY',
      role: 'seller',
      action: 'CONFIRM_BANK_RELEASE',
    });
  });

  it('denies buyer bank reserve confirmation', () => {
    const idempotencyKey = key('confirm_money_reserved', 'buyer-reserve-confirm', 'buyer-1');
    const result = executePlatformV7MoneyAction({
      actor: actor('buyer', 'org-buyer'),
      resource: moneyResource,
      action: 'reserve_confirmed',
      payload: {
        beforeMoneyTree: { ...reservedTree, reservedAmount: 0, readyToReleaseAmount: 0, heldAmount: 0, releasedAmount: 0, refundedAmount: 0, status: 'reserve_requested' },
        operation: moneyOperation('reserve_confirmed', idempotencyKey, { actorId: 'buyer-1', actorRole: 'buyer' }),
        bankConfirmationExists: true,
      },
      idempotencyContext: emptyContext,
      idempotencyKey,
      correlationId: 'corr-buyer-reserve-denied',
      auditId: 'audit-buyer-reserve-denied',
      reason: 'Buyer cannot confirm bank reserve.',
    });

    expect(result.status).toBe('denied');
    expect(result.afterState.reservedAmount).toBe(0);
    expect(result.deniedPayload?.auditCode).toBe('EXPLICIT_DENY');
  });

  it('lets bank_officer confirm release when bank organization scope matches', () => {
    const bankEvent = confirmation('release');
    const result = executePlatformV7BankBasisAction({
      actor: actor('bank_officer', 'org-bank'),
      resource: moneyResource,
      action: 'bank_release_confirmed',
      payload: { decision: sentBankBasis(), moneyTree: releaseRequestedTree, confirmation: bankEvent },
      idempotencyContext: emptyContext,
      idempotencyKey: bankEvent.idempotencyKey,
      correlationId: 'corr-bank-release',
      auditId: 'audit-bank-release',
      reason: 'Bank officer confirmed release.',
    });

    expect(result.status).toBe('applied');
    expect(result.afterState.releasedAmount).toBe(350);
    expect(result.domainResult).toMatchObject({
      valid: true,
      auditPayload: { action: 'bank_release_confirmed', bankEventId: 'bank-event-release' },
    });
    expect(result.auditPayload).toMatchObject({
      action: 'bank_release_confirmed',
      beforeState: releaseRequestedTree,
      afterState: result.afterState,
      idempotencyKey: bankEvent.idempotencyKey,
    });
  });

  it('denies bank_officer release confirmation when bank organization scope mismatches', () => {
    const bankEvent = confirmation('release', { organizationId: 'org-bank-other' });
    const result = executePlatformV7BankBasisAction({
      actor: actor('bank_officer', 'org-bank-other'),
      resource: moneyResource,
      action: 'bank_release_confirmed',
      payload: { decision: sentBankBasis(), moneyTree: releaseRequestedTree, confirmation: bankEvent },
      idempotencyContext: emptyContext,
      idempotencyKey: bankEvent.idempotencyKey,
      correlationId: 'corr-bank-scope-denied',
      auditId: 'audit-bank-scope-denied',
      reason: 'Wrong bank organization.',
    });

    expect(result.status).toBe('denied');
    expect(result.afterState).toBe(releaseRequestedTree);
    expect(result.deniedPayload).toMatchObject({
      auditCode: 'DENY_BY_DEFAULT',
      role: 'bank_officer',
      resourceType: 'money',
    });
  });

  it('lets operator send bank basis but not confirm bank release', () => {
    const basisKey = key('mark_money_ready_to_release', 'operator-send-basis', 'operator-1');
    const readyDecision = p7BuildBankBasis({
      dealId: 'deal-1',
      releaseGate: { allowed: true, reason: 'ready', nextStatus: 'release_requested' },
      documents: bankBasisDocuments,
      disputeResolved: true,
      amount: 300,
      currency: 'RUB',
      correlationId: 'corr-ready-basis',
      auditId: 'audit-ready-basis',
    });

    const sent = executePlatformV7BankBasisAction({
      actor: actor('operator', 'org-operator'),
      resource: documentResource,
      action: 'bank_basis_sent',
      payload: { decision: readyDecision, moneyTree: releaseRequestedTree },
      idempotencyContext: emptyContext,
      idempotencyKey: basisKey,
      correlationId: 'corr-operator-basis',
      auditId: 'audit-operator-basis',
      reason: 'Operator sent basis to bank.',
    });
    const bankEvent = confirmation('release', { actorRole: 'operator', actorId: 'operator-1', organizationId: 'org-operator' });
    const confirm = executePlatformV7BankBasisAction({
      actor: actor('operator', 'org-operator'),
      resource: moneyResource,
      action: 'bank_release_confirmed',
      payload: { decision: sentBankBasis(), moneyTree: releaseRequestedTree, confirmation: bankEvent },
      idempotencyContext: emptyContext,
      idempotencyKey: bankEvent.idempotencyKey,
      correlationId: 'corr-operator-confirm-denied',
      auditId: 'audit-operator-confirm-denied',
      reason: 'Operator cannot confirm bank release.',
    });

    expect(sent.status).toBe('applied');
    expect(sent.domainResult).toMatchObject({ auditPayload: { action: 'bank_basis_sent' } });
    expect(confirm.status).toBe('denied');
    expect(confirm.afterState).toBe(releaseRequestedTree);
  });

  it.each([
    ['arbitrator', 'org-arbitration'],
    ['support_agent', 'org-support'],
    ['executive_viewer', 'org-exec'],
    ['lab_specialist', 'org-lab'],
  ] as const)('denies %s money movement before mutation', (role, organizationId) => {
    const idempotencyKey = key('confirm_money_released', `${role}-money-denied`, `${role}-1`);
    const result = executePlatformV7MoneyAction({
      actor: actor(role, organizationId),
      resource: moneyResource,
      action: 'release_confirmed',
      payload: {
        beforeMoneyTree: releaseRequestedTree,
        operation: moneyOperation('release_confirmed', idempotencyKey, { actorId: `${role}-1`, actorRole: role }),
        bankConfirmationExists: true,
      },
      idempotencyContext: emptyContext,
      idempotencyKey,
      correlationId: `corr-${role}-denied`,
      auditId: `audit-${role}-denied`,
      reason: `${role} cannot move money.`,
    });

    expect(result.status).toBe('denied');
    expect(result.afterState).toBe(releaseRequestedTree);
    expect(result.auditPayload.beforeState).toBe(releaseRequestedTree);
    expect(result.auditPayload.afterState).toBe(releaseRequestedTree);
  });

  it('lets lab_specialist confirm assigned lab protocol and denies elevator lab protocol mutation', () => {
    const document = doc('lab_protocol', 'lab_specialist', 'uploaded', 'lab');
    const labKey = key('accept_document', 'lab-confirm', 'lab-specialist-1');
    const elevatorKey = key('accept_document', 'elevator-lab-denied', 'elevator-operator-1');

    const lab = executePlatformV7DocumentAction({
      actor: actor('lab_specialist', 'org-lab'),
      resource: { ...documentResource, resourceId: 'lab-protocol-1' },
      action: 'document_confirmed',
      payload: { document },
      idempotencyContext: emptyContext,
      idempotencyKey: labKey,
      correlationId: 'corr-lab-doc',
      auditId: 'audit-lab-doc',
      reason: 'Lab confirms assigned protocol.',
    });
    const elevator = executePlatformV7DocumentAction({
      actor: actor('elevator_operator', 'org-elevator'),
      resource: { ...documentResource, resourceId: 'lab-protocol-1' },
      action: 'document_confirmed',
      payload: { document },
      idempotencyContext: emptyContext,
      idempotencyKey: elevatorKey,
      correlationId: 'corr-elevator-lab-denied',
      auditId: 'audit-elevator-lab-denied',
      reason: 'Elevator cannot confirm lab protocol.',
    });

    expect(lab.status).toBe('applied');
    expect(lab.afterState.status).toBe('confirmed');
    expect(lab.auditPayload).toMatchObject({ action: 'document_confirmed', beforeState: document });
    expect(elevator.status).toBe('denied');
    expect(elevator.auditPayload.auditCode).toBe('LAB_PROTOCOL_ROLE_REQUIRED');
    expect(elevator.afterState).toBe(document);
  });

  it('lets elevator_operator confirm acceptance document and denies driver bank basis access', () => {
    const acceptance = doc('acceptance_act', 'elevator_operator', 'uploaded', 'elevator');
    const elevatorKey = key('accept_document', 'elevator-acceptance', 'elevator-operator-1');
    const driverKey = key('mark_money_ready_to_release', 'driver-bank-basis', 'driver-1');

    const elevator = executePlatformV7DocumentAction({
      actor: actor('elevator_operator', 'org-elevator'),
      resource: { ...documentResource, resourceId: 'acceptance-act-1' },
      action: 'document_confirmed',
      payload: { document: acceptance },
      idempotencyContext: emptyContext,
      idempotencyKey: elevatorKey,
      correlationId: 'corr-elevator-acceptance',
      auditId: 'audit-elevator-acceptance',
      reason: 'Elevator confirms acceptance document.',
    });
    const driver = executePlatformV7BankBasisAction({
      actor: { ...actor('driver', 'org-carrier'), userId: 'driver-1' },
      resource: { ...documentResource, resourceId: 'bank-basis-1', assignedDriverUserId: 'driver-1' },
      action: 'bank_basis_sent',
      payload: { decision: sentBankBasis(), moneyTree: releaseRequestedTree },
      idempotencyContext: emptyContext,
      idempotencyKey: driverKey,
      correlationId: 'corr-driver-bank-denied',
      auditId: 'audit-driver-bank-denied',
      reason: 'Driver cannot access bank basis.',
    });

    expect(elevator.status).toBe('applied');
    expect(elevator.afterState.status).toBe('confirmed');
    expect(driver.status).toBe('denied');
    expect(driver.afterState).toBe(releaseRequestedTree);
  });

  it('creates audit payloads for allowed money document and bank actions', () => {
    const moneyKey = key('confirm_money_released', 'audit-money', 'bank-1');
    const documentKey = key('accept_document', 'audit-document', 'lab-specialist-1');
    const bankEvent = confirmation('hold', { amount: 100, bankEventId: 'bank-event-hold-audit' });

    const money = executePlatformV7MoneyAction({
      actor: actor('bank_officer', 'org-bank'),
      resource: moneyResource,
      action: 'release_confirmed',
      payload: {
        beforeMoneyTree: releaseRequestedTree,
        operation: moneyOperation('release_confirmed', moneyKey, { actorId: 'bank-1', actorRole: 'bank_officer' }),
        bankConfirmationExists: true,
      },
      idempotencyContext: emptyContext,
      idempotencyKey: moneyKey,
      correlationId: 'corr-audit-money',
      auditId: 'audit-audit-money',
      reason: 'Audit money action.',
    });
    const document = executePlatformV7DocumentAction({
      actor: actor('lab_specialist', 'org-lab'),
      resource: { ...documentResource, resourceId: 'lab-protocol-audit' },
      action: 'document_confirmed',
      payload: { document: doc('lab_protocol', 'lab_specialist', 'uploaded', 'lab') },
      idempotencyContext: emptyContext,
      idempotencyKey: documentKey,
      correlationId: 'corr-audit-document',
      auditId: 'audit-audit-document',
      reason: 'Audit document action.',
    });
    const bank = executePlatformV7BankBasisAction({
      actor: actor('bank_officer', 'org-bank'),
      resource: moneyResource,
      action: 'bank_hold_confirmed',
      payload: { decision: sentBankBasis(), moneyTree: releaseRequestedTree, confirmation: bankEvent },
      idempotencyContext: emptyContext,
      idempotencyKey: bankEvent.idempotencyKey,
      correlationId: 'corr-audit-bank',
      auditId: 'audit-audit-bank',
      reason: 'Audit bank action.',
    });

    for (const result of [money, document, bank]) {
      expect(result.status).toBe('applied');
      expect(result.auditPayload.beforeState).toBeDefined();
      expect(result.auditPayload.afterState).toBeDefined();
      expect(result.auditPayload.correlationId).toMatch(/^corr-audit-/);
      expect(result.auditPayload.auditId).toMatch(/^audit-audit-/);
    }
  });

  it('blocks duplicate release/refund keys and duplicate bank event without second mutation', () => {
    const releaseKey = key('confirm_money_released', 'duplicate-release', 'bank-1');
    const refundKey = key('confirm_money_released', 'duplicate-refund', 'bank-1');
    const duplicateBankEvent = confirmation('release', { bankEventId: 'bank-event-dup' });
    const releaseDuplicate = executePlatformV7MoneyAction({
      actor: actor('bank_officer', 'org-bank'),
      resource: moneyResource,
      action: 'release_confirmed',
      payload: {
        beforeMoneyTree: releaseRequestedTree,
        operation: moneyOperation('release_confirmed', releaseKey, { actorId: 'bank-1', actorRole: 'bank_officer' }),
        bankConfirmationExists: true,
      },
      idempotencyContext: { processedKeys: [releaseKey], processedBankEventIds: [] },
      idempotencyKey: releaseKey,
      correlationId: 'corr-dup-release',
      auditId: 'audit-dup-release',
      reason: 'Duplicate release.',
    });
    const refundDuplicate = executePlatformV7MoneyAction({
      actor: actor('bank_officer', 'org-bank'),
      resource: moneyResource,
      action: 'refund_confirmed',
      payload: {
        beforeMoneyTree: releaseRequestedTree,
        operation: moneyOperation('refund_confirmed', refundKey, { actorId: 'bank-1', actorRole: 'bank_officer' }),
        bankConfirmationExists: true,
      },
      idempotencyContext: { processedKeys: [refundKey], processedBankEventIds: [] },
      idempotencyKey: refundKey,
      correlationId: 'corr-dup-refund',
      auditId: 'audit-dup-refund',
      reason: 'Duplicate refund.',
    });
    const bankDuplicate = executePlatformV7BankBasisAction({
      actor: actor('bank_officer', 'org-bank'),
      resource: moneyResource,
      action: 'bank_release_confirmed',
      payload: { decision: sentBankBasis(), moneyTree: releaseRequestedTree, confirmation: duplicateBankEvent },
      idempotencyContext: { processedKeys: [], processedBankEventIds: [duplicateBankEvent.bankEventId] },
      idempotencyKey: duplicateBankEvent.idempotencyKey,
      correlationId: 'corr-dup-bank',
      auditId: 'audit-dup-bank',
      reason: 'Duplicate bank event.',
    });

    for (const result of [releaseDuplicate, refundDuplicate, bankDuplicate]) {
      expect(result.status).toBe('duplicate');
      expect(result.auditPayload.duplicate).toBe(true);
      expect(result.beforeState).toBe(releaseRequestedTree);
      expect(result.afterState).toBe(releaseRequestedTree);
    }
  });

  it('blocks invalid idempotency and denied permission before mutation', () => {
    const invalid = executePlatformV7MoneyAction({
      actor: actor('bank_officer', 'org-bank'),
      resource: moneyResource,
      action: 'release_confirmed',
      payload: {
        beforeMoneyTree: releaseRequestedTree,
        operation: moneyOperation('release_confirmed', 'bad-key', { actorId: 'bank-1', actorRole: 'bank_officer', idempotencyKey: 'bad-key' }),
        bankConfirmationExists: true,
      },
      idempotencyContext: emptyContext,
      idempotencyKey: 'bad-key',
      correlationId: 'corr-invalid-key',
      auditId: 'audit-invalid-key',
      reason: 'Invalid key blocks before mutation.',
    });
    const denied = executePlatformV7MoneyAction({
      actor: actor('support_agent', 'org-support'),
      resource: moneyResource,
      action: 'release_confirmed',
      payload: {
        beforeMoneyTree: releaseRequestedTree,
        operation: moneyOperation('release_confirmed', key('confirm_money_released', 'support-denied', 'support-agent-1'), { actorId: 'support-agent-1', actorRole: 'support_agent' }),
        bankConfirmationExists: true,
      },
      idempotencyContext: emptyContext,
      idempotencyKey: key('confirm_money_released', 'support-denied', 'support-agent-1'),
      correlationId: 'corr-denied-before-mutation',
      auditId: 'audit-denied-before-mutation',
      reason: 'Denied permission blocks before mutation.',
    });

    expect(invalid.status).toBe('blocked');
    expect(invalid.code).toBe('INVALID_IDEMPOTENCY_KEY');
    expect(invalid.afterState).toBe(releaseRequestedTree);
    expect(denied.status).toBe('denied');
    expect(denied.afterState).toBe(releaseRequestedTree);
  });

  it('creates stable idempotency keys from the same inputs and different keys for different attempts', () => {
    const first = key('confirm_money_released', 'stable-attempt', 'bank-1');
    const second = key('confirm_money_released', 'stable-attempt', 'bank-1');
    const third = key('confirm_money_released', 'different-attempt', 'bank-1');

    expect(first).toBe(second);
    expect(first).not.toBe(third);
  });

  it('does not contain forbidden external maturity or payment claims in boundary reasons', () => {
    const text = [
      'Seller requested release after release gate readiness.',
      'Bank officer confirmed release.',
      'Operator sent basis to bank.',
      'Duplicate bank event.',
    ].join(' ');

    expect(text).not.toMatch(/production-ready|fully live|fully integrated|platform guarantees payment|platform itself releases money|платформа гарантирует оплату|платформа сама выпускает деньги/i);
  });
});
