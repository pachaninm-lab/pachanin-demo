'use server';

import { selectDealById, selectDisputesByDealId } from '@/lib/domain/selectors';
import { buildPlatformV7IdempotencyKey } from '@/lib/platform-v7/idempotency-key-helper';
import type { PlatformV7MoneyTree } from '@/lib/platform-v7/money-tree';
import { platformV7CreateDocumentMatrix } from '@/lib/platform-v7/document-matrix';
import { createP7MockRuntimeStore } from '@/lib/platform-v7/runtime/mock-persistence-adapter';
import type { P7PersistedRecord } from '@/lib/platform-v7/runtime/persistence-ports';
import { createP7RuntimeServerActions, type P7RuntimeActionResult } from './runtime-actions';
import type { P7DealWorkspaceRuntimeIntentId } from '@/lib/platform-v7/deal-workspace-runtime-intents';

export interface P7DealWorkspaceRuntimeIntentActionInput {
  readonly dealId: string;
  readonly intentId: P7DealWorkspaceRuntimeIntentId;
}

export interface P7DealWorkspaceRuntimeIntentActionResult {
  readonly ok: boolean;
  readonly status: string;
  readonly message: string;
  readonly auditPayloadCount: number;
  readonly duplicate: boolean;
  readonly boundaryStatus?: string;
  readonly boundaryCode?: string;
  readonly boundaryReason?: string;
}

const ACTOR = {
  actorId: 'vp3-operator-runtime',
  actorRole: 'operator',
  organizationId: 'platform',
} as const;

function now(): string {
  return '2026-07-09T12:00:00.000Z';
}

function recordVersion(resourceType: string, resourceId: string) {
  return { resourceType, resourceId, version: `vp3-${resourceType}-${resourceId}`, updatedAt: now() };
}

function toActionResult(result: P7RuntimeActionResult, successMessage: string): P7DealWorkspaceRuntimeIntentActionResult {
  if (result.ok === true) {
    return {
      ok: true,
      status: result.status,
      message: successMessage,
      auditPayloadCount: result.auditPayloads.length,
      duplicate: result.duplicate,
      boundaryStatus: result.meta.boundaryStatus,
      boundaryCode: result.meta.boundaryCode,
      boundaryReason: result.meta.boundaryReason,
    };
  }

  return {
    ok: false,
    status: result.status,
    message: result.error.message,
    auditPayloadCount: result.auditPayloads.length,
    duplicate: result.duplicate,
    boundaryStatus: result.meta.boundaryStatus,
    boundaryCode: result.meta.boundaryCode,
    boundaryReason: result.meta.boundaryReason,
  };
}

function failure(status: string, message: string): P7DealWorkspaceRuntimeIntentActionResult {
  return { ok: false, status, message, auditPayloadCount: 0, duplicate: false };
}

function moneyTreeRecord(dealId: string, reservedAmount: number, holdAmount: number, totalDealAmount?: number): P7PersistedRecord<PlatformV7MoneyTree> {
  const readyToReleaseAmount = Math.max(reservedAmount - holdAmount, 0);
  const moneyTree: PlatformV7MoneyTree = {
    dealId,
    currency: 'RUB',
    totalDealAmount,
    reservedAmount,
    readyToReleaseAmount,
    heldAmount: holdAmount,
    manualReviewAmount: 0,
    releasedAmount: 0,
    refundedAmount: 0,
    platformFee: 0,
    bankFee: 0,
    status: 'reserved',
  };

  return {
    recordId: `money:${dealId}`,
    dealId,
    value: moneyTree,
    version: recordVersion('money_tree', dealId),
    createdAt: now(),
    updatedAt: now(),
  };
}

function documentMatrixRecord(dealId: string) {
  const matrix = platformV7CreateDocumentMatrix(dealId).documents.map((document) => ({
    ...document,
    status: document.documentId === 'bank_basis' ? 'missing' as const : 'confirmed' as const,
    signatureStatus: document.documentId === 'bank_basis' ? 'pending' as const : 'signed' as const,
    createdAt: now(),
    updatedAt: now(),
  }));

  return {
    recordId: `documents:${dealId}`,
    dealId,
    value: { dealId, documents: matrix },
    version: recordVersion('document_matrix', dealId),
    createdAt: now(),
    updatedAt: now(),
  };
}

function baseDto(dealId: string, resourceType: 'money' | 'document' | 'dispute', resourceId: string, boundaryId: 'mark_bank_basis_ready' | 'upload_document' | 'open_dispute', amountMinor: number) {
  const auditId = `audit-vp3-${boundaryId}-${dealId}`;
  const correlationId = `corr-vp3-${boundaryId}-${dealId}`;
  const operationId = `op-vp3-${boundaryId}-${dealId}`;

  return {
    actor: ACTOR,
    resource: {
      resourceType,
      resourceId,
      dealId,
      ownerOrganizationId: 'platform',
      buyerOrganizationId: 'platform',
      sellerOrganizationId: 'platform',
      assignedOrganizationId: 'platform',
      bankOrganizationId: 'platform-bank',
    },
    audit: {
      auditId,
      correlationId,
      reason: `VP-3 deal workspace runtime intent: ${boundaryId}`,
    },
    idempotency: {
      idempotencyKey: buildPlatformV7IdempotencyKey({ boundaryId, actorId: ACTOR.actorId, entityId: resourceId, dealId, amountMinor, currency: 'RUB', attemptId: operationId }),
      operationId,
    },
  } as const;
}

export async function executeP7DealWorkspaceRuntimeIntentAction(input: P7DealWorkspaceRuntimeIntentActionInput): Promise<P7DealWorkspaceRuntimeIntentActionResult> {
  const deal = selectDealById(input.dealId);
  if (!deal) return failure('not_found', `Сделка ${input.dealId} не найдена.`);

  const disputes = selectDisputesByDealId(deal.id);
  const hasOpenDispute = disputes.some((dispute) => dispute.status === 'open');
  const amount = Math.max(deal.releaseAmount ?? deal.reservedAmount - deal.holdAmount, 0);
  const store = createP7MockRuntimeStore({
    now: now(),
    moneyTrees: [moneyTreeRecord(deal.id, deal.reservedAmount, deal.holdAmount, deal.totalAmount)],
    documentMatrices: [documentMatrixRecord(deal.id)],
  });
  const actions = createP7RuntimeServerActions({ store, now });

  if (input.intentId === 'request_bank_basis') {
    if (amount <= 0) return failure('domain_blocked', 'Нет положительной суммы для банковского основания.');
    if (deal.holdAmount > 0) return failure('domain_blocked', 'Есть удержание. Нельзя готовить банковское основание без решения по удержанию.');
    if (deal.blockers.length > 0) return failure('domain_blocked', `Есть блокеры сделки: ${deal.blockers.join(' · ')}.`);
    if (hasOpenDispute) return failure('domain_blocked', 'Есть открытый спор. Сначала нужно решение и доказательства.');

    const dto = {
      ...baseDto(deal.id, 'money', `bank-basis:${deal.id}`, 'mark_bank_basis_ready', amount),
      amount,
      currency: 'RUB' as const,
    };
    const result = await actions.money({ action: 'request_bank_basis', dto });
    return toActionResult(result, 'Основание прошло через runtime/application service. Деньги напрямую не двигались.');
  }

  if (input.intentId === 'start_document_review') {
    const dto = {
      ...baseDto(deal.id, 'document', 'bank_basis', 'upload_document', 0),
      action: 'document_manual_review_started' as const,
      documentId: 'bank_basis',
      documentStatus: 'manual_review' as const,
      documentMetadata: { type: 'bank_basis', source: 'manual' as const, signatureStatus: 'pending' as const, ownerRole: 'operator' },
    };
    const result = await actions.document({ action: 'mark_manual_review', dto });
    return toActionResult(result, 'Документный runtime зафиксировал проверку банковского основания.');
  }

  if (input.intentId === 'open_dispute') {
    if (hasOpenDispute) return failure('domain_blocked', 'По сделке уже есть открытый спор.');
    const dto = baseDto(deal.id, 'dispute', `dispute:${deal.id}`, 'open_dispute', 0);
    const result = await actions.disputeSettlement({ action: 'open_dispute', dto });
    return toActionResult(result, 'Спор прошёл через dispute service без прямого движения денег.');
  }

  return failure('validation_error', `Неизвестное действие: ${input.intentId}.`);
}
