import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildPlatformV7IdempotencyKey } from '@/lib/platform-v7/idempotency-key-helper';
import type { P7BankBasisDecision } from '@/lib/platform-v7/bank-basis';
import type { PlatformV7DocumentMatrix, PlatformV7DocumentRequirement } from '@/lib/platform-v7/document-matrix';
import type { PlatformV7MoneyTree } from '@/lib/platform-v7/money-tree';
import { createP7MockRuntimeStore } from '@/lib/platform-v7/runtime/mock-persistence-adapter';
import type { P7PersistedRecord, P7ResourceVersion } from '@/lib/platform-v7/runtime/persistence-ports';
import type {
  P7ActorScopeDto,
  P7ArbitrationBasisRequestDto,
  P7AuditMetadataDto,
  P7BankBasisRequestDto,
  P7BankBasisSendRequestDto,
  P7BankConfirmationRequestDto,
  P7DocumentActionRequestDto,
  P7ResourceScopeDto,
  P7RuntimeRequestBaseDto,
} from '@/lib/platform-v7/runtime/dto-schemas';
import { createP7RuntimeServerActions, executeP7RuntimeBankBasisWorkflowAction } from '@/app/platform-v7/actions/runtime-actions';

const now = '2026-05-24T12:00:00.000Z';
function version(resourceType: string, resourceId: string, value = `v-${resourceId}`): P7ResourceVersion { return { resourceType, resourceId, version: value, updatedAt: now }; }
function idempotencyKey(input: { readonly actorId: string; readonly entityId: string; readonly dealId: string; readonly amount?: number; readonly attempt?: string }): string {
  return buildPlatformV7IdempotencyKey({ boundaryId: 'confirm_bank_basis', actorId: input.actorId, entityId: input.entityId, dealId: input.dealId, amountMinor: input.amount ?? 1000, currency: 'RUB', attemptId: input.attempt ?? 'attempt-1' });
}

const sellerActor: P7ActorScopeDto = { actorId: 'seller-user-1', actorRole: 'seller', organizationId: 'org-seller' };
const bankActor: P7ActorScopeDto = { actorId: 'bank-user-1', actorRole: 'bank_officer', organizationId: 'org-bank' };
const operatorActor: P7ActorScopeDto = { actorId: 'operator-user-1', actorRole: 'operator', organizationId: 'org-ops' };
const arbitratorActor: P7ActorScopeDto = { actorId: 'arb-user-1', actorRole: 'arbitrator', organizationId: 'org-arb' };
const audit: P7AuditMetadataDto = { auditId: 'audit-1', correlationId: 'corr-1', reason: 'Runtime server action test.' };
const moneyResource: P7ResourceScopeDto = { resourceType: 'money', resourceId: 'money-deal-1', dealId: 'deal-1', sellerOrganizationId: 'org-seller', buyerOrganizationId: 'org-buyer', bankOrganizationId: 'org-bank' };
const bankResource: P7ResourceScopeDto = { ...moneyResource, resourceId: 'bank-basis-deal-1' };
const documentResource: P7ResourceScopeDto = { resourceType: 'document', resourceId: 'contract', dealId: 'deal-1', sellerOrganizationId: 'org-seller' };
const bankBasisReadyMoneyTree: PlatformV7MoneyTree = { dealId: 'deal-1', currency: 'RUB', totalDealAmount: 1000, reservedAmount: 1000, readyToReleaseAmount: 1000, heldAmount: 0, manualReviewAmount: 0, releasedAmount: 0, refundedAmount: 0, platformFee: 0, bankFee: 0, status: 'reserved' };
const bankBasisRequestedMoneyTree: PlatformV7MoneyTree = { ...bankBasisReadyMoneyTree, status: 'bank_basis_requested' };
const contractDocument: PlatformV7DocumentRequirement = { documentId: 'contract', dealId: 'deal-1', type: 'contract', title: 'Contract', ownerRole: 'seller', responsibleRole: 'seller', status: 'draft', source: 'edo', deadline: null, signatureStatus: 'not_required', blockStages: ['release'], affectsMoney: true, nextAction: 'Upload contract.', createdAt: now, updatedAt: now };
const bankDecision: P7BankBasisDecision = { dealId: 'deal-1', status: 'sent_to_bank', canSendToBank: false, blockerCodes: [], basisDocumentIds: ['contract', 'acceptance_act', 'lab_protocol', 'bank_basis'], amount: 1000, currency: 'RUB', correlationId: 'corr-1', auditId: 'audit-1', note: 'Sent for bank review.' };

function record<T>(recordId: string, dealId: string, resourceType: string, value: T): P7PersistedRecord<T> { return { recordId, dealId, value, version: version(resourceType, dealId), createdAt: now, updatedAt: now }; }
function moneyRecord(value: PlatformV7MoneyTree): P7PersistedRecord<PlatformV7MoneyTree> { return record(`money:${value.dealId}`, value.dealId, 'money_tree', value); }
function documentMatrixRecord(document: PlatformV7DocumentRequirement): P7PersistedRecord<PlatformV7DocumentMatrix> { return record(`matrix:${document.dealId}`, document.dealId, 'document_matrix', { dealId: document.dealId, documents: [document] }); }
function bankDecisionRecord(value: P7BankBasisDecision): P7PersistedRecord<P7BankBasisDecision> { return record(`bank:${value.dealId}`, value.dealId, 'bank_basis', value); }
function bankBasisDto(overrides: Partial<P7BankBasisRequestDto> = {}): P7BankBasisRequestDto {
  const actor = overrides.actor ?? sellerActor;
  const resource = overrides.resource ?? moneyResource;
  return { actor, resource, audit, idempotency: { idempotencyKey: idempotencyKey({ actorId: actor.actorId, entityId: resource.resourceId, dealId: resource.dealId, amount: overrides.amount ?? 1000 }), operationId: 'operation-bank-basis-1' }, amount: 1000, currency: 'RUB', ...overrides };
}
function documentDto(overrides: Partial<P7DocumentActionRequestDto> = {}): P7DocumentActionRequestDto { return { actor: sellerActor, resource: documentResource, audit, idempotency: { idempotencyKey: idempotencyKey({ actorId: sellerActor.actorId, entityId: 'contract', dealId: 'deal-1' }), operationId: 'operation-document-1' }, action: 'document_uploaded', documentId: 'contract', documentStatus: 'uploaded', ...overrides }; }
function bankDto(overrides: Partial<P7BankConfirmationRequestDto> = {}): P7BankConfirmationRequestDto {
  const actor = overrides.actor ?? bankActor;
  const resource = overrides.resource ?? bankResource;
  const bankEventId = overrides.bankEventId ?? 'bank-event-1';
  return { actor, resource, audit, idempotency: { idempotencyKey: idempotencyKey({ actorId: actor.actorId, entityId: resource.resourceId, dealId: resource.dealId }), operationId: 'operation-bank-1', bankEventId }, bankEventId, bankOrganizationId: 'org-bank', operationId: 'operation-bank-1', amount: 1000, currency: 'RUB', path: 'release', action: 'bank_basis_confirmed', ...overrides };
}
function basisDto(overrides: Partial<P7BankBasisSendRequestDto> = {}): P7BankBasisSendRequestDto { return { actor: operatorActor, resource: bankResource, audit, idempotency: { idempotencyKey: idempotencyKey({ actorId: operatorActor.actorId, entityId: bankResource.resourceId, dealId: bankResource.dealId }), operationId: 'operation-bank-basis-send-1' }, basisDocumentIds: ['contract', 'acceptance_act', 'lab_protocol', 'bank_basis'], ...overrides }; }
function arbitrationDto(): P7ArbitrationBasisRequestDto { return { actor: arbitratorActor, resource: { resourceType: 'dispute', resourceId: 'dispute-1', dealId: 'deal-1' }, audit, idempotency: { idempotencyKey: idempotencyKey({ actorId: arbitratorActor.actorId, entityId: 'arbitration-1', dealId: 'deal-1' }), operationId: 'operation-arbitration-1' }, arbitrationDecisionId: 'arbitration-1', basisDocumentIds: ['arbitration_decision'], uncontestedAmount: 100, disputedAmount: 900, releaseAmount: 500, refundAmount: 400, heldAmount: 0, feeAmount: 0, penaltyAmount: 0, currency: 'RUB' }; }
function malformedBaseDto(): P7RuntimeRequestBaseDto { return { actor: sellerActor, resource: moneyResource, audit } as unknown as P7RuntimeRequestBaseDto; }
function seededStore(overrides: { readonly money?: PlatformV7MoneyTree; readonly decision?: P7BankBasisDecision } = {}) { return createP7MockRuntimeStore({ now, moneyTrees: [moneyRecord(overrides.money ?? bankBasisReadyMoneyTree)], documentMatrices: [documentMatrixRecord(contractDocument)], bankBasisDecisions: [bankDecisionRecord(overrides.decision ?? bankDecision)] }); }

describe('platform-v7 runtime server actions', () => {
  it('returns serializable results from the money wrapper', async () => {
    const store = seededStore();
    const actions = createP7RuntimeServerActions({ store, now: () => now });
    const result = await actions.money({ action: 'request_bank_basis', dto: bankBasisDto() });
    expect(result.ok).toBe(true);
    expect(() => JSON.stringify(result)).not.toThrow();
    expect(JSON.parse(JSON.stringify(result))).toMatchObject({ ok: true, status: 'success' });
  });

  it('returns deterministic validation error before service execution', async () => {
    const store = seededStore();
    const before = store.snapshot();
    const actions = createP7RuntimeServerActions({ store, now: () => now });
    const result = await actions.money({ action: 'request_bank_basis', dto: bankBasisDto({ amount: 1.5 }) });
    expect(result).toMatchObject({ ok: false, status: 'validation_error', error: { code: 'VALIDATION_ERROR' } });
    if (result.ok === false) expect(result.validationErrors?.some((error) => error.field === 'amount')).toBe(true);
    expect(store.snapshot()).toEqual(before);
  });

  it('returns validation_error for malformed read-only runtime DTOs before store access', async () => {
    const store = seededStore();
    const before = store.snapshot();
    const actions = createP7RuntimeServerActions({ store, now: () => now });
    const results = [
      await actions.bankBasisWorkflow({ action: 'get_bank_basis_status', dto: malformedBaseDto() }),
      await actions.disputeSettlement({ action: 'open_dispute', dto: malformedBaseDto() }),
      await actions.disputeSettlement({ action: 'attach_evidence', dto: malformedBaseDto() }),
      await actions.disputeSettlement({ action: 'get_dispute_money_impact', dto: malformedBaseDto() }),
    ];
    results.forEach((result) => {
      expect(result).toMatchObject({ ok: false, status: 'validation_error', error: { code: 'VALIDATION_ERROR' } });
      if (result.ok === false) expect(result.validationErrors?.some((error) => error.field === 'idempotency')).toBe(true);
    });
    expect(store.snapshot()).toEqual(before);
  });

  it('successful money action goes through persistence and audit', async () => {
    const store = seededStore();
    const actions = createP7RuntimeServerActions({ store, now: () => now });
    const result = await actions.money({ action: 'request_bank_basis', dto: bankBasisDto() });
    const snapshot = store.snapshot();
    expect(result.ok).toBe(true);
    expect(snapshot.moneyTrees[0]?.value.status).toBe('bank_basis_requested');
    expect(snapshot.auditEvents.some((item) => item.value.action === 'bank_basis_requested')).toBe(true);
    expect(snapshot.idempotencyKeys).toHaveLength(1);
  });

  it('duplicate idempotency replays the previous result and does not mutate twice', async () => {
    const store = seededStore();
    const actions = createP7RuntimeServerActions({ store, now: () => now });
    const dto = bankBasisDto();
    const first = await actions.money({ action: 'request_bank_basis', dto });
    const afterFirst = store.snapshot();
    const second = await actions.money({ action: 'request_bank_basis', dto });
    const afterSecond = store.snapshot();
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.status).toBe('duplicate');
    expect(afterSecond.moneyTrees).toEqual(afterFirst.moneyTrees);
    expect(afterSecond.auditEvents).toEqual(afterFirst.auditEvents);
    expect(afterSecond.idempotencyKeys).toEqual(afterFirst.idempotencyKeys);
  });

  it('expectedVersion conflict returns deterministic conflict error', async () => {
    const store = seededStore();
    store.simulateNextConflict('money_tree');
    const actions = createP7RuntimeServerActions({ store, now: () => now });
    const result = await actions.money({ action: 'request_bank_basis', dto: bankBasisDto() });
    expect(result).toMatchObject({ ok: false, status: 'conflict', error: { code: 'CONFLICT' } });
  });

  it('document action persists Document Matrix changes', async () => {
    const store = seededStore();
    const actions = createP7RuntimeServerActions({ store, now: () => now });
    const result = await actions.document({ action: 'upload_document', dto: documentDto() });
    const snapshot = store.snapshot();
    expect(result.ok).toBe(true);
    expect(snapshot.documentMatrices[0]?.value.documents[0]?.status).toBe('uploaded');
    expect(snapshot.auditEvents.some((item) => item.value.action === 'document_uploaded')).toBe(true);
  });

  it('bank basis action persists basis decision without live bank call', async () => {
    const store = seededStore({ decision: { ...bankDecision, status: 'ready_for_bank_review', canSendToBank: true } });
    const actions = createP7RuntimeServerActions({ store, now: () => now });
    const result = await actions.bankBasis({ action: 'send_bank_basis', dto: basisDto() });
    const snapshot = store.snapshot();
    expect(result.ok).toBe(true);
    expect(snapshot.bankBasisDecisions[0]?.value.status).toBe('sent_to_bank');
    expect(snapshot.externalCalls).toEqual([]);
    expect(snapshot.auditEvents.some((item) => item.value.action === 'bank_basis_sent')).toBe(true);
  });

  it('bank basis workflow wrapper does not claim platform moves money itself', async () => {
    const store = seededStore();
    const actions = createP7RuntimeServerActions({ store, now: () => now });
    const result = await actions.bankBasisWorkflow({ action: 'request_bank_basis', dto: bankBasisDto() });
    const text = JSON.stringify(result);
    expect(result.ok).toBe(true);
    expect(text).not.toMatch(/platform releases money itself|платформа сама выпускает деньги|release_requested|bank_release_confirmed/i);
  });

  it('dispute settlement wrapper does not move money outside the service path', async () => {
    const store = seededStore();
    const actions = createP7RuntimeServerActions({ store, now: () => now });
    const opened = await actions.disputeSettlement({ action: 'open_dispute', dto: arbitrationDto() });
    const impact = await actions.disputeSettlement({ action: 'get_dispute_money_impact', dto: arbitrationDto() });
    const snapshot = store.snapshot();
    expect(opened.ok).toBe(true);
    expect(impact.ok).toBe(true);
    expect(snapshot.moneyTrees[0]?.value).toEqual(bankBasisReadyMoneyTree);
    expect(snapshot.arbitrationDecisions).toEqual([]);
  });

  it('exported server wrapper is callable and serializable', async () => {
    const result = await executeP7RuntimeBankBasisWorkflowAction({ action: 'request_bank_basis', dto: bankBasisDto() });
    expect(result.ok).toBe(false);
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it('source has no hidden store, live calls, direct domain mutation, apps/landing or UI imports', () => {
    const source = readFileSync(join(process.cwd(), 'app/platform-v7/actions/runtime-actions.ts'), 'utf8');
    ['platformV7ApplyMoneyOperation', 'platformV7ReleaseGate', 'p7ConfirmBankRelease', 'p7ConfirmBankRefund', 'p7ConfirmBankHold', 'p7MarkBankBasisSent', 'p7BuildBankBasisPayload', 'p7BuildArbitrationBasisPayload', 'platformV7DocumentsBlockingStage', 'isBankBasisReady', 'platformV7DocumentMatrixReadiness', 'apps/landing', 'components/platform-v7', 'components/v7r', 'fetch('].forEach((forbidden) => expect(source).not.toContain(forbidden));
    expect(source).toContain('createP7MoneyExecutionService');
    expect(source).toContain('createP7DocumentExecutionService');
    expect(source).toContain('createP7BankBasisExecutionService');
    expect(source).toContain('createP7BankBasisWorkflowService');
    expect(source).not.toMatch(/(?:const|let|var)\s+\w*store\w*\s*=\s*createP7MockRuntimeStore/);
    expect(source).not.toMatch(/\bnew Map\b/);
    expect(source).not.toMatch(/\bnew Set\b/);
  });
});
