import type { PlatformV7EntityId, PlatformV7ExecutionRole, PlatformV7IsoDateTime, PlatformV7NextAction, PlatformV7RubAmount } from './execution-model';

export type PlatformV7SupportStatus = 'open' | 'in_progress' | 'waiting_external' | 'resolved' | 'closed';
export type PlatformV7SupportPriority = 'P0' | 'P1' | 'P2' | 'P3';
export type PlatformV7SupportCategory = 'money' | 'documents' | 'logistics' | 'acceptance' | 'quality' | 'dispute' | 'access' | 'integration' | 'other';
export type PlatformV7SupportEntityType = 'deal' | 'lot' | 'batch' | 'trip' | 'document' | 'money_operation' | 'dispute';

export interface PlatformV7SupportCase {
  id: PlatformV7EntityId;
  title: string;
  description: string;
  status: PlatformV7SupportStatus;
  priority: PlatformV7SupportPriority;
  category: PlatformV7SupportCategory;
  requesterRole: PlatformV7ExecutionRole;
  relatedEntityType: PlatformV7SupportEntityType;
  relatedEntityId: PlatformV7EntityId;
  dealId?: PlatformV7EntityId;
  lotId?: PlatformV7EntityId;
  tripId?: PlatformV7EntityId;
  moneyAtRiskRub?: PlatformV7RubAmount;
  ownerId?: PlatformV7EntityId;
  nextAction?: PlatformV7NextAction;
  slaDueAt: PlatformV7IsoDateTime;
  createdAt: PlatformV7IsoDateTime;
  updatedAt: PlatformV7IsoDateTime;
}

export function isPlatformV7SupportCaseLinked(caseItem: PlatformV7SupportCase): boolean {
  return Boolean(caseItem.relatedEntityType && caseItem.relatedEntityId);
}

export function isPlatformV7SupportCaseOverdue(caseItem: PlatformV7SupportCase, nowIso: PlatformV7IsoDateTime): boolean {
  if (caseItem.status === 'resolved' || caseItem.status === 'closed') return false;
  return new Date(caseItem.slaDueAt).getTime() < new Date(nowIso).getTime();
}

export function isPlatformV7SupportCaseOperatorOwned(caseItem: PlatformV7SupportCase): boolean {
  return Boolean(caseItem.ownerId);
}

export function doesPlatformV7SupportCaseNeedMoneyEscalation(caseItem: PlatformV7SupportCase): boolean {
  return caseItem.priority === 'P0' || (caseItem.category === 'money' && (caseItem.moneyAtRiskRub ?? 0) > 0);
}
