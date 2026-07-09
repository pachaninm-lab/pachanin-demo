import { describe, expect, it } from 'vitest';
import { buildPlatformV7IdempotencyKey } from '@/lib/platform-v7/idempotency-key-helper';
import type { P7BankBasisDecision } from '@/lib/platform-v7/bank-basis';
import type { PlatformV7DocumentMatrix, PlatformV7DocumentRequirement } from '@/lib/platform-v7/document-matrix';
import type { PlatformV7MoneyTree } from '@/lib/platform-v7/money-tree';
import { createP7MockRuntimeStore } from '@/lib/platform-v7/runtime/mock-persistence-adapter';
import type { P7PersistedRecord, P7ResourceVersion } from '@/lib/platform-v7/runtime/persistence-ports';
import type { P7ActorScopeDto, P7ArbitrationBasisRequestDto, P7AuditMetadataDto, P7BankBasisRequestDto, P7BankBasisSendRequestDto, P7DocumentActionRequestDto, P7ResourceScopeDto, P7RuntimeRequestBaseDto } from '@/lib/platform-v7/runtime/dto-schemas';
import { createP7RuntimeServerActions } from '@/app/platform-v7/actions/runtime-actions';

const now = '2026-05-24T12:00:00.000Z';
const sellerActor: P7ActorScopeDto = { actorId: 'seller-user-1', actorRole: 'seller', organizationId: 'org-seller' };
const operatorActor: P7ActorScopeDto = { actorId: 'operator-user-1', actorRole: 'operator', organizationId: 'org-ops' };
const arbitratorActor: P7ActorScopeDto = { actorId: 'arb-user-1', actorRole: 'arbitrator', organizationId: 'org-arb' };
const audit: P7AuditMetadataDto = { auditId: 'audit-runtime-integration-1', correlationId: 'corr-runtime-integration-1', reason: 'Runtime integration test.' };
const moneyResource: P7ResourceScopeDto = { resourceType: 'money', resourceId: 'money-deal-1', dealId: 'deal-1', sellerOrganizationId: 'org-seller', buyerOrganizationId: 'org-buyer', bankOrganizationId: 'org-bank' };
const documentResource: P7ResourceScopeDto = { resourceType: 'document', resourceId: 'contract', dealId: 'deal-1', sellerOrganizationId: 'org-seller', buyerOrganizationId: 'org-buyer' };
const bankResource: P7ResourceScopeDto = { ...moneyResource, resourceId: 'bank-basis-deal-1' };
const bankBasisReadyMoneyTree: PlatformV7MoneyTree = { dealId: 'deal-1', currency: 'RUB', totalDealAmount: 1000, reservedAmount: 1000, readyToReleaseAmount: 1000, heldAmount: 0, manualReviewAmount: 0, releasedAmount: 0, refundedAmount: 0, platformFee: 0, bankFee: 0, status: 'reserved' };
const contractDocument: PlatformV7DocumentRequirement = { documentId: 'contract', dealId: 'deal-1', type: 'contract', title: 'Contract', ownerRole: 'seller', responsibleRole: 'seller', status: 'draft', source: 'edo', deadline: null, signatureStatus: 'not_required', blockStages: ['release'], affectsMoney: true, nextAction: 'Upload contract.', createdAt: now, updatedAt: now };
const bankDecision: P7BankBasisDecision = { dealId: 'deal-1', status: 'ready_for_bank_review', canSendToBank: true, blockerCodes: [], basisDocumentIds: ['contract', 'acceptance_act', 'lab_protocol', 'bank_basis'], amount: 1000, currency: 'RUB', correlationId: 'corr-runtime-integration-1', auditId: 'audit-runtime-integration-1', note: 'Ready for bank review.' };

function version(resourceType: string, resourceId: string): P7ResourceVersion { return { resourceType, resourceId, version: `v-${resourceId}`, updatedAt: now }; }
function idempotencyKey(input: { readonly actorId: string; readonly entityId: string; readonly dealId: string; readonly amount?: number; readonly attempt?: string }): string { return buildPlatformV7IdempotencyKey({ boundaryId: 'confirm_bank_basis', actorId: input.actorId, entityId: input.entityId, dealId: input.dealId, amountMinor: input.amount ?? 1000, currency: 'RUB', attemptId: input.attempt ?? 'attempt-1' }); }
function record<T>(recordId: string, dealId: string, resourceType: string, value: T): P7PersistedRecord<T> { return { recordId, dealId, value, version: version(resourceType, dealId), createdAt: now, updatedAt: now }; }
function moneyRecord(value: PlatformV7MoneyTree): P7PersistedRecord<PlatformV7MoneyTree> { return record(`money:${value.dealId}`, value.dealId, 'money_tree', value); }
function documentMatrixRecord(document: PlatformV7DocumentRequirement): P7PersistedRecord<PlatformV7DocumentMatrix> { return record(`matrix:${document.dealId}`, document.dealId, 'document_matrix', { dealId: document.dealId, documents: [document] }); }
function bankDecisionRecord(value: P7BankBasisDecision): P7PersistedRecord<P7BankBasisDecision> { return record(`bank:${value.dealId}`, value.dealId, 'bank_basis', value); }
function bankBasisDto(overrides: Partial<P7BankBasisRequestDto> = {}): P7BankBasisRequestDto { const actor = overrides.actor ?? sellerActor; const resource = overrides.resource ?? moneyResource; const amount = overrides.amount ?? 1000; return { actor, resource, audit, idempotency: { idempotencyKey: idempotencyKey({ actorId: actor.actorId, entityId: resource.resourceId, dealId: resource.dealId, amount }), operationId: 'operation-bank-basis-1' }, amount, currency: 'RUB', ...overrides }; }
function documentDto(overrides: Partial<P7DocumentActionRequestDto> = {}): P7DocumentActionRequestDto { return { actor: sellerActor, resource: documentResource, audit, idempotency: { idempotencyKey: idempotencyKey({ actorId: sellerActor.actorId, entityId: 'contract', dealId: 'deal-1' }), operationId: 'operation-document-1' }, action: 'document_uploaded', documentId: 'contract', documentStatus: 'uploaded', ...overrides }; }
function basisDto(overrides: Partial<P7BankBasisSendRequestDto> = {}): P7BankBasisSendRequestDto { return { actor: operatorActor, resource: bankResource, audit, idempotency: { idempotencyKey: idempotencyKey({ actorId: operatorActor.actorId, entityId: bankResource.resourceId, dealId: bankResource.dealId }), operationId: 'operation-bank-basis-send-1' }, basisDocumentIds: ['contract', 'acceptance_act', 'lab_protocol', 'bank_basis'], ...overrides }; }
function arbitrationDto(): P7ArbitrationBasisRequestDto { return { actor: arbitratorActor, resource: { resourceType: 'dispute', resourceId: 'dispute-1', dealId: 'deal-1' }, audit, idempotency: { idempotencyKey: idempotencyKey({ actorId: arbitratorActor.actorId, entityId: 'arbitration-1', dealId: 'deal-1' }), operationId: 'operation-arbitration-1' }, arbitrationDecisionId: 'arbitration-1', basisDocumentIds: ['arbitration_decision'], uncontestedAmount: 100, disputedAmount: 900, releaseAmount: 500, refundAmount: 400, heldAmount: 0, feeAmount: 0, penaltyAmount: 0, currency: 'RUB' }; }
function malformedBaseDto(): P7RuntimeRequestBaseDto { return { actor: sellerActor, resource: moneyResource, audit } as unknown as P7RuntimeRequestBaseDto; }
function seededStore() { return createP7MockRuntimeStore({ now, moneyTrees: [moneyRecord(bankBasisReadyMoneyTree)], documentMatrices: [documentMatrixRecord(contractDocument)], bankBasisDecisions: [bankDecisionRecord(bankDecision)] }); }

describe('platform-v7 runtime integration path', () => {
  it('runs money DTO through server wrapper, application service, persistence, audit and idempotency', async () => {
    const store = seededStore();
    const actions = createP7RuntimeServerActions({ store, now: () => now });
    const result = await actions.money({ action: 'request_bank_basis', dto: bankBasisDto() });
    const snapshot = store.snapshot();
    expect(result).toMatchObject({ ok: true, status: 'success', duplicate: false });
    expect(() => JSON.stringify(result)).not.toThrow();
    expect(snapshot.moneyTrees[0]?.value.status).toBe('bank_basis_requested');
    expect(snapshot.auditEvents.map((item) => item.value.action)).toContain('bank_basis_requested');
    expect(snapshot.idempotencyKeys).toHaveLength(1);
    expect(snapshot.externalCalls).toEqual([]);
  });

  it('replays duplicate idempotency without mutating money, audit or keys twice', async () => {
    const store = seededStore();
    const actions = createP7RuntimeServerActions({ store, now: () => now });
    const dto = bankBasisDto();
    const first = await actions.money({ action: 'request_bank_basis', dto });
    const afterFirst = store.snapshot();
    const second = await actions.money({ action: 'request_bank_basis', dto });
    const afterSecond = store.snapshot();
    expect(first).toMatchObject({ ok: true, status: 'success' });
    expect(second).toMatchObject({ ok: true, status: 'duplicate', duplicate: true });
    expect(afterSecond.moneyTrees).toEqual(afterFirst.moneyTrees);
    expect(afterSecond.auditEvents).toEqual(afterFirst.auditEvents);
    expect(afterSecond.idempotencyKeys).toEqual(afterFirst.idempotencyKeys);
  });

  it('persists document and bank-basis changes through runtime services without external calls', async () => {
    const store = seededStore();
    const actions = createP7RuntimeServerActions({ store, now: () => now });
    const documentResult = await actions.document({ action: 'upload_document', dto: documentDto() });
    const bankResult = await actions.bankBasis({ action: 'send_bank_basis', dto: basisDto() });
    const snapshot = store.snapshot();
    expect(documentResult.ok).toBe(true);
    expect(bankResult.ok).toBe(true);
    expect(snapshot.documentMatrices[0]?.value.documents[0]?.status).toBe('uploaded');
    expect(snapshot.bankBasisDecisions[0]?.value.status).toBe('sent_to_bank');
    expect(snapshot.externalCalls).toEqual([]);
    expect(snapshot.auditEvents.map((item) => item.value.action)).toEqual(expect.arrayContaining(['document_uploaded', 'bank_basis_sent']));
  });

  it('keeps bank basis workflow honest and does not directly move money', async () => {
    const store = seededStore();
    const actions = createP7RuntimeServerActions({ store, now: () => now });
    const basisRequest = await actions.bankBasisWorkflow({ action: 'request_bank_basis', dto: bankBasisDto() });
    const basisResult = await actions.bankBasisWorkflow({ action: 'send_basis_to_bank', dto: basisDto({ idempotency: { idempotencyKey: idempotencyKey({ actorId: operatorActor.actorId, entityId: 'bank-basis-workflow', dealId: 'deal-1' }), operationId: 'operation-bank-basis-workflow' } }) });
    const snapshot = store.snapshot();
    const serialized = JSON.stringify([basisRequest, basisResult]);
    expect(basisRequest.ok).toBe(true);
    expect(basisResult.ok).toBe(true);
    expect(snapshot.moneyTrees[0]?.value.releasedAmount).toBe(0);
    expect(snapshot.externalCalls).toEqual([]);
    expect(serialized).not.toMatch(/platform releases money itself|платформа сама выпускает деньги|release_requested|bank_release_confirmed/i);
  });

  it('keeps dispute money impact read-only in the integrated runtime path', async () => {
    const store = seededStore();
    const actions = createP7RuntimeServerActions({ store, now: () => now });
    const before = store.snapshot();
    const opened = await actions.disputeSettlement({ action: 'open_dispute', dto: arbitrationDto() });
    const impact = await actions.disputeSettlement({ action: 'get_dispute_money_impact', dto: { ...arbitrationDto(), idempotency: { idempotencyKey: idempotencyKey({ actorId: arbitratorActor.actorId, entityId: 'dispute-impact-1', dealId: 'deal-1' }), operationId: 'operation-dispute-impact-1' } } });
    const after = store.snapshot();
    expect(opened.ok).toBe(true);
    expect(impact.ok).toBe(true);
    expect(after.moneyTrees).toEqual(before.moneyTrees);
    expect(after.arbitrationDecisions).toEqual(before.arbitrationDecisions);
  });

  it('returns deterministic validation_error for malformed read-only DTOs before store access', async () => {
    const store = seededStore();
    const before = store.snapshot();
    const actions = createP7RuntimeServerActions({ store, now: () => now });
    const results = [
      await actions.bankBasisWorkflow({ action: 'get_bank_basis_status', dto: malformedBaseDto() }),
      await actions.disputeSettlement({ action: 'open_dispute', dto: malformedBaseDto() }),
      await actions.disputeSettlement({ action: 'attach_evidence', dto: malformedBaseDto() }),
      await actions.disputeSettlement({ action: 'get_dispute_money_impact', dto: malformedBaseDto() }),
    ];
    results.forEach((result) => { expect(result).toMatchObject({ ok: false, status: 'validation_error', error: { code: 'VALIDATION_ERROR' } }); expect(() => JSON.stringify(result)).not.toThrow(); });
    expect(store.snapshot()).toEqual(before);
  });

  it('maps persistence conflicts to a deterministic runtime action result', async () => {
    const store = seededStore();
    store.simulateNextConflict('money_tree');
    const actions = createP7RuntimeServerActions({ store, now: () => now });
    const result = await actions.money({ action: 'request_bank_basis', dto: bankBasisDto() });
    expect(result).toMatchObject({ ok: false, status: 'conflict', error: { code: 'CONFLICT' } });
    expect(() => JSON.stringify(result)).not.toThrow();
  });
});
