import type { DomainDeal } from '@/lib/domain/types';
import type { PlatformV7ActionTarget } from './action-targets';
import type { PlatformV7DealWorkspaceActionId } from './deal-workspace-actions';
import type {
  P7BankBasisRequestDto,
  P7BankBasisSendRequestDto,
  P7DocumentActionRequestDto,
  P7RuntimeRequestBaseDto,
} from './runtime/dto-schemas';

export type P7DealWorkspaceRuntimeChannel = 'money' | 'document' | 'bankBasisWorkflow' | 'disputeSettlement' | 'navigation';
export type P7DealWorkspaceRuntimeActionStatus = 'ready' | 'blocked' | 'navigation_only';

export type P7DealWorkspaceRuntimeActionRequest =
  | {
      readonly status: 'ready';
      readonly targetId: string;
      readonly workspaceActionId: PlatformV7DealWorkspaceActionId;
      readonly channel: 'money';
      readonly action: 'request_bank_basis';
      readonly dto: P7BankBasisRequestDto;
      readonly safePath: string;
    }
  | {
      readonly status: 'ready';
      readonly targetId: string;
      readonly workspaceActionId: PlatformV7DealWorkspaceActionId;
      readonly channel: 'bankBasisWorkflow';
      readonly action: 'send_basis_to_bank';
      readonly dto: P7BankBasisSendRequestDto;
      readonly safePath: string;
    }
  | {
      readonly status: 'ready';
      readonly targetId: string;
      readonly workspaceActionId: PlatformV7DealWorkspaceActionId;
      readonly channel: 'document';
      readonly action: 'upload_document' | 'confirm_document' | 'mark_manual_review';
      readonly dto: P7DocumentActionRequestDto;
      readonly safePath: string;
    }
  | {
      readonly status: 'ready';
      readonly targetId: string;
      readonly workspaceActionId: PlatformV7DealWorkspaceActionId;
      readonly channel: 'disputeSettlement';
      readonly action: 'open_dispute' | 'attach_evidence';
      readonly dto: P7RuntimeRequestBaseDto;
      readonly safePath: string;
    }
  | {
      readonly status: 'navigation_only';
      readonly targetId: string;
      readonly workspaceActionId: PlatformV7DealWorkspaceActionId;
      readonly channel: 'navigation';
      readonly href: string;
      readonly safePath: string;
    }
  | {
      readonly status: 'blocked';
      readonly targetId: string;
      readonly workspaceActionId: PlatformV7DealWorkspaceActionId | null;
      readonly channel: P7DealWorkspaceRuntimeChannel;
      readonly reason: string;
      readonly safePath: string;
    };

export interface P7DealWorkspaceRuntimeActorInput {
  readonly actorId: string;
  readonly actorRole: string;
  readonly organizationId: string;
}

export interface P7DealWorkspaceRuntimeActionBuildInput {
  readonly deal: Pick<DomainDeal, 'id' | 'seller' | 'buyer' | 'reservedAmount' | 'holdAmount' | 'releaseAmount' | 'blockers'>;
  readonly target: PlatformV7ActionTarget;
  readonly actor: P7DealWorkspaceRuntimeActorInput;
  readonly nowIso: string;
  readonly basisDocumentIds?: readonly string[];
}

function bankBasisAmount(deal: Pick<DomainDeal, 'reservedAmount' | 'holdAmount' | 'releaseAmount'>): number {
  return Math.max(deal.releaseAmount ?? deal.reservedAmount - deal.holdAmount, 0);
}

function stableToken(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9а-яё]+/giu, '-').replace(/^-+|-+$/g, '') || 'unknown';
}

function baseDto(input: P7DealWorkspaceRuntimeActionBuildInput, operation: string): P7RuntimeRequestBaseDto {
  const dealToken = stableToken(input.deal.id);
  const targetToken = stableToken(input.target.id);
  const opToken = stableToken(operation);

  return {
    actor: input.actor,
    resource: {
      resourceType: input.target.scope === 'dispute' ? 'dispute' : input.target.scope === 'bank' ? 'bank' : 'deal',
      resourceId: input.deal.id,
      dealId: input.deal.id,
      buyerOrganizationId: input.deal.buyer.inn,
      sellerOrganizationId: input.deal.seller.inn,
      ownerOrganizationId: input.actor.organizationId,
      assignedOrganizationId: input.actor.organizationId,
    },
    audit: {
      auditId: `audit-${dealToken}-${targetToken}-${opToken}`,
      correlationId: `corr-${dealToken}-${targetToken}`,
      reason: `deal-workspace-runtime:${input.target.id}:${operation}`,
    },
    idempotency: {
      idempotencyKey: `p7-${dealToken}-${targetToken}-${opToken}`,
      operationId: `op-${dealToken}-${targetToken}-${opToken}`,
    },
  };
}

function blocked(input: P7DealWorkspaceRuntimeActionBuildInput, channel: P7DealWorkspaceRuntimeChannel, reason: string): P7DealWorkspaceRuntimeActionRequest {
  return {
    status: 'blocked',
    targetId: input.target.id,
    workspaceActionId: input.target.workspaceActionId ?? null,
    channel,
    reason,
    safePath: 'UI → guarded button → action boundary → application service → audit/event log. Direct client-side state mutation is forbidden.',
  };
}

export function buildP7DealWorkspaceRuntimeActionRequest(input: P7DealWorkspaceRuntimeActionBuildInput): P7DealWorkspaceRuntimeActionRequest {
  const workspaceActionId = input.target.workspaceActionId;
  if (!workspaceActionId) return blocked(input, 'navigation', 'Target is not connected to a workspace action.');

  if (workspaceActionId === 'open-bank' || workspaceActionId === 'open-disputes') {
    if (!input.target.href) return blocked(input, 'navigation', 'Navigation action has no href.');
    return {
      status: 'navigation_only',
      targetId: input.target.id,
      workspaceActionId,
      channel: 'navigation',
      href: input.target.href,
      safePath: 'Navigation only. No runtime write is performed.',
    };
  }

  if (workspaceActionId === 'request-release') {
    const amount = bankBasisAmount(input.deal);
    if (amount <= 0) return blocked(input, 'money', 'Bank basis amount must be positive before a request is created.');
    if (input.deal.holdAmount > 0) return blocked(input, 'money', 'Active hold blocks bank basis request.');
    if (input.deal.blockers.length > 0) return blocked(input, 'money', `Deal blockers must be resolved first: ${input.deal.blockers.join(' · ')}.`);

    return {
      status: 'ready',
      targetId: input.target.id,
      workspaceActionId,
      channel: 'money',
      action: 'request_bank_basis',
      dto: { ...baseDto(input, 'request_bank_basis'), amount, currency: 'RUB' },
      safePath: 'UI → executeP7RuntimeMoneyAction(request_bank_basis) → money execution service → action boundary → audit/event log.',
    };
  }

  if (workspaceActionId === 'release-funds') {
    const basisDocumentIds = input.basisDocumentIds ?? [`${input.deal.id}-basis-package`];
    if (basisDocumentIds.length === 0) return blocked(input, 'bankBasisWorkflow', 'At least one basis document is required.');

    return {
      status: 'ready',
      targetId: input.target.id,
      workspaceActionId,
      channel: 'bankBasisWorkflow',
      action: 'send_basis_to_bank',
      dto: { ...baseDto(input, 'send_basis_to_bank'), basisDocumentIds },
      safePath: 'UI → executeP7RuntimeBankBasisWorkflowAction(send_basis_to_bank) → bank basis workflow service → audit/event log. The platform does not release money directly.',
    };
  }

  if (workspaceActionId === 'start-documents' || workspaceActionId === 'complete-documents') {
    const operation = workspaceActionId === 'start-documents' ? 'mark_manual_review' : 'confirm_document';
    return {
      status: 'ready',
      targetId: input.target.id,
      workspaceActionId,
      channel: 'document',
      action: operation,
      dto: {
        ...baseDto(input, operation),
        action: workspaceActionId === 'start-documents' ? 'document_manual_review_started' : 'document_confirmed',
        documentId: `${input.deal.id}-document-package`,
        documentStatus: workspaceActionId === 'start-documents' ? 'manual_review' : 'confirmed',
        documentMetadata: { type: 'deal-document-package', source: 'manual', ownerRole: input.actor.actorRole },
      },
      safePath: 'UI → executeP7RuntimeDocumentAction → document execution service → action boundary → audit/event log.',
    };
  }

  if (workspaceActionId === 'open-dispute' || workspaceActionId === 'resolve-dispute') {
    const operation = workspaceActionId === 'open-dispute' ? 'open_dispute' : 'attach_evidence';
    return {
      status: 'ready',
      targetId: input.target.id,
      workspaceActionId,
      channel: 'disputeSettlement',
      action: operation,
      dto: baseDto(input, operation),
      safePath: 'UI → executeP7RuntimeDisputeSettlementAction → dispute settlement service → action boundary → audit/event log.',
    };
  }

  return blocked(input, 'navigation', `Unsupported workspace action: ${workspaceActionId}.`);
}

export function p7DealWorkspaceRuntimeActionIsWritable(request: P7DealWorkspaceRuntimeActionRequest): boolean {
  return request.status === 'ready' && request.channel !== 'navigation';
}

export function p7DealWorkspaceRuntimeActionRequiresServerAction(request: P7DealWorkspaceRuntimeActionRequest): boolean {
  return request.status === 'ready' && request.channel !== 'navigation';
}
