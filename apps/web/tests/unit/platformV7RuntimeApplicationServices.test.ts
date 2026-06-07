import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildPlatformV7IdempotencyKey } from '@/lib/platform-v7/idempotency-key-helper';
import type {
  P7ActionIdempotencyContext,
  PlatformV7ActionBoundaryResult,
} from '@/lib/platform-v7/action-boundary';
import type { P7BankBasisDecision } from '@/lib/platform-v7/bank-basis';
import type { PlatformV7DocumentMatrix, PlatformV7DocumentRequirement } from '@/lib/platform-v7/document-matrix';
import type { PlatformV7MoneyTree } from '@/lib/platform-v7/money-tree';
import {
  createP7BankBasisExecutionService,
  createP7DisputeSettlementService,
  createP7DocumentExecutionService,
  createP7MoneyExecutionService,
  createP7ReleaseWorkflowService,
} from '@/lib/platform-v7/runtime/application-service';
import type {
  P7ActionExecutionRepository,
  P7AuditEventSink,
  P7AuditPayload,
  P7BankBasisRepository,
  P7DisputeSettlementRepository,
  P7DocumentMatrixRepository,
  P7ExternalCallRepository,
  P7IdempotencyScope,
  P7IdempotencyStore,
  P7MoneyTreeRepository,
  P7PersistedRecord,
  P7RepositoryResult,
  P7ResourceVersion,
  P7RuntimeResult,
  P7RuntimeTransactionalPorts,
  P7RuntimeTransactionContext,
  P7RuntimeUnitOfWork,
} from '@/lib/platform-v7/runtime/persistence-ports';
import type {
  P7ActorScopeDto,
  P7ArbitrationBasisRequestDto,
  P7AuditMetadataDto,
  P7BankBasisSendRequestDto,
  P7BankConfirmationRequestDto,
  P7DocumentActionRequestDto,
  P7ReleaseRequestDto,
  P7ResourceScopeDto,
} from '@/lib/platform-v7/runtime/dto-schemas';

const now = '2026-05-24T12:00:00.000Z';

function version(resourceType: string, resourceId: string): P7ResourceVersion {
  return { resourceType, resourceId, version: `v-${resourceId}`, updatedAt: now };
}

function okRepo<T>(value: T): P7RepositoryResult<T> {
  return { ok: true, status: 'ok', value };
}

function okRuntime<T>(value: T): P7RuntimeResult<T> {
  return { ok: true, value };
}

function key(input: {
  readonly boundaryId?: 'confirm_money_released' | 'upload_document' | 'accept_document';
  readonly actorId: string;
  readonly entityId: string;
  readonly dealId: string;
  readonly amount?: number;
  readonly attempt?: string;
}): string {
  return buildPlatformV7IdempotencyKey({
    boundaryId: input.boundaryId ?? 'confirm_money_released',
    actorId: input.actorId,
    entityId: input.entityId,
    dealId: input.dealId,
    amountMinor: input.amount ?? 1000,
    currency: 'RUB',
    attemptId: input.attempt ?? 'attempt-1',
  });
}

const sellerActor: P7ActorScopeDto = { actorId: 'seller-user-1', actorRole: 'seller', organizationId: 'org-seller' };
const bankActor: P7ActorScopeDto = { actorId: 'bank-user-1', actorRole: 'bank_officer', organizationId: 'org-bank' };
const arbitratorActor: P7ActorScopeDto = { actorId: 'arb-user-1', actorRole: 'arbitrator', organizationId: 'org-arb' };

const audit: P7AuditMetadataDto = {
  auditId: 'audit-1',
  correlationId: 'corr-1',
  reason: 'Service boundary test.',
};

const moneyResource: P7ResourceScopeDto = {
  resourceType: 'money',
  resourceId: 'money-deal-1',
  dealId: 'deal-1',
  sellerOrganizationId: 'org-seller',
  buyerOrganizationId: 'org-buyer',
  bankOrganizationId: 'org-bank',
};

const bankResource: P7ResourceScopeDto = {
  ...moneyResource,
  resourceId: 'bank-basis-deal-1',
};

const releaseReadyMoneyTree: PlatformV7MoneyTree = {
  dealId: 'deal-1',
  currency: 'RUB',
  totalDealAmount: 1000,
  reservedAmount: 1000,
  readyToReleaseAmount: 1000,
  heldAmount: 0,
  manualReviewAmount: 0,
  releasedAmount: 0,
  refundedAmount: 0,
  platformFee: 0,
  bankFee: 0,
  status: 'reserved',
};

const releaseRequestedMoneyTree: PlatformV7MoneyTree = {
  ...releaseReadyMoneyTree,
  status: 'release_requested',
};

const bankDecision: P7BankBasisDecision = {
  dealId: 'deal-1',
  status: 'sent_to_bank',
  canSendToBank: false,
  blockerCodes: [],
  basisDocumentIds: ['contract', 'acceptance_act', 'lab_protocol', 'bank_basis'],
  amount: 1000,
  currency: 'RUB',
  correlationId: 'corr-1',
  auditId: 'audit-1',
  note: 'Sent for bank review.',
};

const contractDocument: PlatformV7DocumentRequirement = {
  documentId: 'contract',
  dealId: 'deal-1',
  type: 'contract',
  title: 'Договор',
  ownerRole: 'seller',
  responsibleRole: 'seller',
  status: 'draft',
  source: 'edo',
  deadline: null,
  signatureStatus: 'not_required',
  blockStages: ['release'],
  affectsMoney: true,
  nextAction: 'Upload contract.',
  createdAt: now,
  updatedAt: now,
};

function moneyRecord(value: PlatformV7MoneyTree): P7PersistedRecord<PlatformV7MoneyTree> {
  return {
    recordId: 'money-record-1',
    dealId: value.dealId,
    value,
    version: version('money', value.dealId),
    createdAt: now,
    updatedAt: now,
  };
}

function bankDecisionRecord(value: P7BankBasisDecision): P7PersistedRecord<P7BankBasisDecision> {
  return {
    recordId: 'bank-decision-1',
    dealId: value.dealId,
    value,
    version: version('bank_basis', value.dealId),
    createdAt: now,
    updatedAt: now,
  };
}

function matrixRecord(document: PlatformV7DocumentRequirement): P7PersistedRecord<PlatformV7DocumentMatrix> {
  return {
    recordId: 'matrix-1',
    dealId: document.dealId,
    value: { dealId: document.dealId, documents: [document] },
    version: version('document_matrix', document.dealId),
    createdAt: now,
    updatedAt: now,
  };
}

type Calls = {
  readonly loadContext: string[];
  readonly loadDuplicateResult: string[];
  readonly reserveKey: string[];
  readonly recordResult: string[];
  readonly auditPayloads: P7AuditPayload[];
  readonly saveMoneyExpectedVersions: string[];
  readonly saveDocumentExpectedVersions: string[];
  readonly saveBankDecisionExpectedVersions: string[];
  readonly saveBankConfirmations: string[];
  readonly saveArbitrationDecisions: string[];
  transactionCount: number;
};

function createHarness(options: {
  readonly money?: PlatformV7MoneyTree;
  readonly decision?: P7BankBasisDecision;
  readonly document?: PlatformV7DocumentRequirement;
  readonly context?: P7ActionIdempotencyContext;
  readonly duplicateResult?: PlatformV7ActionBoundaryResult;
} = {}): { readonly unitOfWork: P7RuntimeUnitOfWork; readonly calls: Calls } {
  const calls: Calls = {
    loadContext: [],
    loadDuplicateResult: [],
    reserveKey: [],
    recordResult: [],
    auditPayloads: [],
    saveMoneyExpectedVersions: [],
    saveDocumentExpectedVersions: [],
    saveBankDecisionExpectedVersions: [],
    saveBankConfirmations: [],
    saveArbitrationDecisions: [],
    transactionCount: 0,
  };

  let currentMoney = moneyRecord(options.money ?? releaseReadyMoneyTree);
  let currentDecision = bankDecisionRecord(options.decision ?? bankDecision);
  let currentMatrix = matrixRecord(options.document ?? contractDocument);
  const context = options.context ?? { processedKeys: [], processedBankEventIds: [], processedOperationIds: [] };

  const moneyTree: P7MoneyTreeRepository = {
    async loadByDealId() {
      return okRepo(currentMoney);
    },
    async saveMoneyTree(record, saveOptions) {
      calls.saveMoneyExpectedVersions.push(saveOptions.expectedVersion ?? '');
      currentMoney = record;
      return okRepo(record);
    },
    async getVersion() {
      return okRepo(currentMoney.version);
    },
  };

  const documentMatrix: P7DocumentMatrixRepository = {
    async loadByDealId() {
      return okRepo(currentMatrix);
    },
    async saveDocumentMatrix(record, saveOptions) {
      calls.saveDocumentExpectedVersions.push(saveOptions.expectedVersion ?? '');
      currentMatrix = record;
      return okRepo(record);
    },
    async saveDocumentRequirement(dealId, document, saveOptions) {
      calls.saveDocumentExpectedVersions.push(saveOptions.expectedVersion ?? '');
      return okRepo({
        recordId: `${dealId}:${document.documentId}`,
        dealId,
        value: document,
        version: version('document_requirement', document.documentId),
        createdAt: now,
        updatedAt: now,
      });
    },
  };

  const bankBasis: P7BankBasisRepository = {
    async loadByDealId() {
      return okRepo(currentDecision);
    },
    async saveBankBasisDecision(record, saveOptions) {
      calls.saveBankDecisionExpectedVersions.push(saveOptions.expectedVersion ?? '');
      currentDecision = record;
      return okRepo(record);
    },
    async saveBankConfirmation(record, saveOptions) {
      calls.saveBankConfirmations.push(saveOptions.expectedVersion ?? '');
      return okRepo(record);
    },
  };

  const idempotency: P7IdempotencyStore = {
    async loadContext(scope: P7IdempotencyScope) {
      calls.loadContext.push(`${scope.resourceType}:${scope.resourceId}:${scope.dealId}`);
      return context;
    },
    async hasProcessedKey() {
      return okRuntime(false);
    },
    async hasProcessedBankEventId() {
      return okRuntime(false);
    },
    async hasProcessedOperationId() {
      return okRuntime(false);
    },
    async reserveKey(input) {
      calls.reserveKey.push(input.key);
      return okRuntime(version('idempotency', input.key));
    },
    async recordResult(input) {
      calls.recordResult.push(input.key);
      return okRuntime({
        recordId: input.key,
        value: input.result,
        version: version('idempotency_result', input.key),
        createdAt: now,
        updatedAt: now,
      });
    },
    async loadDuplicateResult(key) {
      calls.loadDuplicateResult.push(key);
      if (options.duplicateResult) {
        return okRepo({
          recordId: key,
          value: options.duplicateResult,
          version: version('idempotency_result', key),
          createdAt: now,
          updatedAt: now,
        });
      }

      return { ok: false, status: 'not_found', error: { code: 'not_found', message: 'No duplicate result recorded.' } };
    },
  };

  const auditSink: P7AuditEventSink = {
    async append(payload) {
      calls.auditPayloads.push(payload);
      return okRuntime({ recordId: payload.auditId, value: payload, version: version('audit', payload.auditId), createdAt: now, updatedAt: now });
    },
    async appendMany(payloads) {
      calls.auditPayloads.push(...payloads);
      return okRuntime(payloads.map((payload) => ({
        recordId: `${payload.auditId}:${payload.action}`,
        value: payload,
        version: version('audit', `${payload.auditId}:${payload.action}`),
        createdAt: now,
        updatedAt: now,
      })));
    },
    async listByCorrelationId() {
      return okRepo([]);
    },
    async listByResource() {
      return okRepo([]);
    },
  };

  const actionExecution: P7ActionExecutionRepository = {
    async loadByActionId() {
      return { ok: false, status: 'not_found', error: { code: 'not_found', message: 'Not used.' } };
    },
    async saveActionExecution(record) {
      return okRepo(record);
    },
    async listByDealId() {
      return okRepo([]);
    },
  };

  const disputeSettlement: P7DisputeSettlementRepository = {
    async loadByDealId() {
      return { ok: false, status: 'not_found', error: { code: 'not_found', message: 'Not used.' } };
    },
    async saveArbitrationDecision(record, saveOptions) {
      calls.saveArbitrationDecisions.push(saveOptions.expectedVersion ?? '');
      return okRepo(record);
    },
    async saveSettlementSplit(record) {
      return okRepo(record);
    },
  };

  const externalCalls: P7ExternalCallRepository = {
    async saveExternalCallEnvelope(record) {
      return okRepo(record);
    },
    async loadByCorrelationId() {
      return okRepo([]);
    },
  };

  const transaction: P7RuntimeTransactionContext = {
    transactionId: 'tx-1',
    startedAt: now,
    correlationId: 'corr-1',
    auditId: 'audit-1',
    actorId: 'actor-1',
  };

  const ports: P7RuntimeTransactionalPorts = {
    transaction,
    moneyTree,
    documentMatrix,
    bankBasis,
    disputeSettlement,
    actionExecution,
    idempotency,
    audit: auditSink,
    externalCalls,
  };

  const unitOfWork: P7RuntimeUnitOfWork = {
    moneyTree,
    documentMatrix,
    bankBasis,
    disputeSettlement,
    actionExecution,
    idempotency,
    audit: auditSink,
    externalCalls,
    async runInTransaction(fn) {
      calls.transactionCount += 1;
      return fn(ports);
    },
  };

  return { unitOfWork, calls };
}

function releaseDto(overrides: Partial<P7ReleaseRequestDto> = {}): P7ReleaseRequestDto {
  const actor = overrides.actor ?? sellerActor;
  const resource = overrides.resource ?? moneyResource;
  return {
    actor,
    resource,
    audit,
    idempotency: {
      idempotencyKey: key({ actorId: actor.actorId, entityId: resource.resourceId, dealId: resource.dealId, amount: overrides.amount ?? 1000 }),
      operationId: 'operation-release-1',
    },
    amount: 1000,
    currency: 'RUB',
    ...overrides,
  };
}

function bankDto(overrides: Partial<P7BankConfirmationRequestDto> = {}): P7BankConfirmationRequestDto {
  const actor = overrides.actor ?? bankActor;
  const resource = overrides.resource ?? bankResource;
  const bankEventId = overrides.bankEventId ?? 'bank-event-1';
  return {
    actor,
    resource,
    audit,
    idempotency: {
      idempotencyKey: key({ actorId: actor.actorId, entityId: resource.resourceId, dealId: resource.dealId, amount: overrides.amount ?? 1000 }),
      operationId: 'operation-bank-1',
      bankEventId,
    },
    bankEventId,
    bankOrganizationId: 'org-bank',
    operationId: 'operation-bank-1',
    amount: 1000,
    currency: 'RUB',
    path: 'release',
    action: 'bank_release_confirmed',
    ...overrides,
  };
}

function basisDto(overrides: Partial<P7BankBasisSendRequestDto> = {}): P7BankBasisSendRequestDto {
  return {
    actor: { actorId: 'operator-1', actorRole: 'operator', organizationId: 'org-ops' },
    resource: bankResource,
    audit,
    idempotency: {
      idempotencyKey: key({ actorId: 'operator-1', entityId: bankResource.resourceId, dealId: bankResource.dealId }),
      operationId: 'operation-basis-1',
    },
    basisDocumentIds: ['contract', 'acceptance_act', 'lab_protocol', 'bank_basis'],
    ...overrides,
  };
}

function documentDto(overrides: Partial<P7DocumentActionRequestDto> = {}): P7DocumentActionRequestDto {
  return {
    actor: sellerActor,
    resource: { resourceType: 'document', resourceId: 'contract', dealId: 'deal-1', sellerOrganizationId: 'org-seller' },
    audit,
    idempotency: {
      idempotencyKey: key({ boundaryId: 'upload_document', actorId: sellerActor.actorId, entityId: 'contract', dealId: 'deal-1' }),
      operationId: 'operation-document-1',
    },
    action: 'document_uploaded',
    documentId: 'contract',
    documentStatus: 'uploaded',
    ...overrides,
  };
}

function arbitrationDto(): P7ArbitrationBasisRequestDto {
  return {
    actor: arbitratorActor,
    resource: { resourceType: 'dispute', resourceId: 'dispute-1', dealId: 'deal-1' },
    audit,
    idempotency: {
      idempotencyKey: key({ actorId: arbitratorActor.actorId, entityId: 'arbitration-1', dealId: 'deal-1' }),
      operationId: 'operation-arbitration-1',
    },
    arbitrationDecisionId: 'arbitration-1',
    basisDocumentIds: ['arbitration_decision'],
    uncontestedAmount: 100,
    disputedAmount: 900,
    releaseAmount: 500,
    refundAmount: 400,
    heldAmount: 0,
    feeAmount: 0,
    penaltyAmount: 0,
    currency: 'RUB',
  };
}

function previousReleaseBoundary(idempotencyKey: string): PlatformV7ActionBoundaryResult<PlatformV7MoneyTree> {
  return {
    ok: true,
    status: 'applied',
    code: 'OK',
    reason: 'Previous release request result.',
    beforeState: releaseReadyMoneyTree,
    afterState: releaseRequestedMoneyTree,
    auditPayload: {
      auditId: 'audit-previous',
      correlationId: 'corr-previous',
      actorId: sellerActor.actorId,
      actorRole: sellerActor.actorRole,
      organizationId: sellerActor.organizationId,
      resourceType: 'money',
      resourceId: moneyResource.resourceId,
      action: 'release_requested',
      beforeState: releaseReadyMoneyTree,
      afterState: releaseRequestedMoneyTree,
      reason: 'Previous release request result.',
      idempotencyKey,
      createdAt: now,
      duplicate: false,
      auditCode: 'OK',
    },
  };
}

describe('platform-v7 runtime application services', () => {
  it('money service happy path saves after action and appends audit', async () => {
    const harness = createHarness();
    const service = createP7MoneyExecutionService({ unitOfWork: harness.unitOfWork, now: () => now });

    const result = await service.requestRelease(releaseDto());

    expect(result.ok).toBe(true);
    expect(result.status).toBe('persisted');
    expect(harness.calls.loadContext).toEqual(['money:money-deal-1:deal-1']);
    expect(harness.calls.reserveKey).toHaveLength(1);
    expect(harness.calls.saveMoneyExpectedVersions).toEqual(['v-deal-1']);
    expect(harness.calls.recordResult).toHaveLength(1);
    expect(harness.calls.auditPayloads.some((payload) => payload.action === 'release_requested')).toBe(true);
  });

  it('document service happy path saves document matrix with expectedVersion', async () => {
    const harness = createHarness();
    const service = createP7DocumentExecutionService({ unitOfWork: harness.unitOfWork, now: () => now });

    const result = await service.uploadDocument(documentDto());

    expect(result.ok).toBe(true);
    expect(result.status).toBe('persisted');
    expect(result.ok && result.value.documents[0]?.status).toBe('uploaded');
    expect(harness.calls.saveDocumentExpectedVersions).toEqual(['v-deal-1']);
    expect(harness.calls.auditPayloads.some((payload) => payload.action === 'document_uploaded')).toBe(true);
  });

  it('bank basis service happy path persists MoneyTree and BankBasis through unit of work', async () => {
    const harness = createHarness({ money: releaseRequestedMoneyTree });
    const service = createP7BankBasisExecutionService({ unitOfWork: harness.unitOfWork, now: () => now });

    const result = await service.confirmBankRelease(bankDto());

    expect(result.ok).toBe(true);
    expect(result.ok && result.value.releasedAmount).toBe(1000);
    expect(harness.calls.transactionCount).toBe(1);
    expect(harness.calls.saveMoneyExpectedVersions).toEqual(['v-deal-1']);
    expect(harness.calls.saveBankDecisionExpectedVersions).toEqual(['v-deal-1']);
    expect(harness.calls.saveBankConfirmations).toEqual(['v-deal-1']);
    expect(harness.calls.auditPayloads.some((payload) => payload.action === 'bank_release_confirmed')).toBe(true);
  });

  it('send bank basis persists decision and audit without money bucket movement', async () => {
    const harness = createHarness({
      decision: { ...bankDecision, status: 'ready_for_bank_review', canSendToBank: true },
    });
    const service = createP7BankBasisExecutionService({ unitOfWork: harness.unitOfWork, now: () => now });

    const result = await service.sendBankBasis(basisDto());

    expect(result.ok).toBe(true);
    expect(harness.calls.saveBankDecisionExpectedVersions).toEqual(['v-deal-1']);
    expect(harness.calls.saveMoneyExpectedVersions).toEqual([]);
    expect(harness.calls.auditPayloads.some((payload) => payload.action === 'bank_basis_sent')).toBe(true);
  });

  it('duplicate idempotency replays previous stored result without mutating or recording again', async () => {
    const dto = releaseDto();
    const previous = previousReleaseBoundary(dto.idempotency.idempotencyKey);
    const harness = createHarness({
      context: { processedKeys: [dto.idempotency.idempotencyKey], processedBankEventIds: [], processedOperationIds: [] },
      duplicateResult: previous,
    });
    const service = createP7MoneyExecutionService({ unitOfWork: harness.unitOfWork, now: () => now });

    const result = await service.requestRelease(dto);

    expect(result.ok).toBe(true);
    expect(result.status).toBe('persisted');
    expect(result.boundaryResult).toBe(previous);
    expect(result.ok && result.value).toBe(previous.afterState);
    expect(harness.calls.loadDuplicateResult).toEqual([dto.idempotency.idempotencyKey]);
    expect(harness.calls.reserveKey).toEqual([]);
    expect(harness.calls.recordResult).toEqual([]);
    expect(harness.calls.saveMoneyExpectedVersions).toEqual([]);
    expect(harness.calls.auditPayloads).toEqual([]);
  });

  it('denied role/action returns typed denial and writes audit without saving money', async () => {
    const harness = createHarness({ money: releaseRequestedMoneyTree });
    const service = createP7BankBasisExecutionService({ unitOfWork: harness.unitOfWork, now: () => now });

    const result = await service.confirmBankRelease(bankDto({
      actor: sellerActor,
      idempotency: {
        idempotencyKey: key({ actorId: sellerActor.actorId, entityId: bankResource.resourceId, dealId: bankResource.dealId }),
        operationId: 'operation-denied-bank-release',
        bankEventId: 'bank-event-denied',
      },
      bankEventId: 'bank-event-denied',
      operationId: 'operation-denied-bank-release',
    }));

    expect(result.ok).toBe(false);
    expect(result.status).toBe('denied');
    expect(harness.calls.saveMoneyExpectedVersions).toEqual([]);
    expect(harness.calls.auditPayloads.some((payload) => 'auditCode' in payload && payload.auditCode !== 'OK')).toBe(true);
  });

  it('release workflow delegates to services and does not own domain mutation', async () => {
    const harness = createHarness({ money: releaseRequestedMoneyTree });
    const workflow = createP7ReleaseWorkflowService({ unitOfWork: harness.unitOfWork, now: () => now });

    const result = await workflow.handleBankEvent(bankDto());

    expect(result.ok).toBe(true);
    expect(harness.calls.saveMoneyExpectedVersions).toEqual(['v-deal-1']);
    expect(harness.calls.auditPayloads.some((payload) => payload.action === 'bank_release_confirmed')).toBe(true);
  });

  it('dispute service prepares arbitration basis without direct money movement', async () => {
    const harness = createHarness();
    const dispute = createP7DisputeSettlementService({ unitOfWork: harness.unitOfWork, now: () => now });

    const opened = await dispute.openDispute(arbitrationDto());
    const prepared = await dispute.prepareArbitrationBasis(arbitrationDto());

    expect(opened.ok).toBe(true);
    expect(prepared.ok).toBe(true);
    expect(harness.calls.saveArbitrationDecisions).toEqual(['operation-arbitration-1']);
    expect(harness.calls.saveMoneyExpectedVersions).toEqual([]);
  });

  it('service source uses only action-boundary executors and has no hidden runtime state', () => {
    const source = readFileSync(join(process.cwd(), 'apps/web/lib/platform-v7/runtime/application-service.ts'), 'utf8');

    [
      'platformV7ApplyMoneyOperation',
      'platformV7ReleaseGate',
      'p7ConfirmBankRelease',
      'p7ConfirmBankRefund',
      'p7ConfirmBankHold',
      'p7MarkBankBasisSent',
      'p7BuildBankBasisPayload',
      'p7BuildArbitrationBasisPayload',
      'platformV7DocumentsBlockingStage',
      'isBankBasisReady',
      'platformV7DocumentMatrixReadiness',
    ].forEach((forbidden) => {
      expect(source).not.toContain(forbidden);
    });

    expect(source).toContain('executePlatformV7MoneyAction');
    expect(source).toContain('executePlatformV7DocumentAction');
    expect(source).toContain('executePlatformV7BankBasisAction');
    expect(source).not.toMatch(/\bnew Map\b/);
    expect(source).not.toMatch(/\bnew Set\b/);
    expect(source).not.toContain("'use server'");
    expect(source).not.toContain('fetch(');
  });
});
