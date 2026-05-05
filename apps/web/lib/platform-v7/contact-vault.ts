import { EntityId, PlatformRole } from './core-types';
import { BypassRiskProfile } from './bypass-risk-score';
import { createAuditEvent } from './audit-events';

export type ContactType = 'phone' | 'email' | 'person' | 'address' | 'bank_details';
export type DealStage = 'interest' | 'offer_sent' | 'counter_offer' | 'deal_draft' | 'deal_confirmed' | 'execution_started';

export interface ContactRevealPolicy {
  minStage: DealStage;
  allowedRoles: PlatformRole[];
  requireOperatorApproval: boolean;
  blockIfBypassRiskAbove: number;
}

export interface ContactVaultEntry {
  id: EntityId;
  counterpartyId: EntityId;
  contactType: ContactType;
  encryptedValue: string;
  revealPolicy: ContactRevealPolicy;
  createdAt: string;
}

const stageRank: Record<DealStage, number> = {
  interest: 1,
  offer_sent: 2,
  counter_offer: 3,
  deal_draft: 4,
  deal_confirmed: 5,
  execution_started: 6,
};

export interface ContactRevealContext {
  role: PlatformRole;
  stage: DealStage;
  bypassRiskProfile?: BypassRiskProfile;
  operatorApproved?: boolean;
  actorId: EntityId;
}

export function canRevealContact(entry: ContactVaultEntry, context: ContactRevealContext): { allowed: boolean; reason?: string } {
  if (!entry.revealPolicy.allowedRoles.includes(context.role)) return { allowed: false, reason: 'role_not_allowed' };
  if (stageRank[context.stage] < stageRank[entry.revealPolicy.minStage]) return { allowed: false, reason: 'stage_too_early' };
  if ((context.bypassRiskProfile?.totalScore ?? 0) > entry.revealPolicy.blockIfBypassRiskAbove) return { allowed: false, reason: 'bypass_risk_too_high' };
  if (entry.revealPolicy.requireOperatorApproval && !context.operatorApproved) return { allowed: false, reason: 'operator_approval_required' };
  return { allowed: true };
}

export function revealContact(entry: ContactVaultEntry, context: ContactRevealContext): { maskedValue: string; auditEvent: ReturnType<typeof createAuditEvent> } {
  const admission = canRevealContact(entry, context);
  if (!admission.allowed) throw new Error(`Contact reveal denied: ${admission.reason}`);
  return {
    maskedValue: entry.encryptedValue,
    auditEvent: createAuditEvent({
      entityType: 'contact_vault',
      entityId: entry.id,
      actorRole: context.role,
      actorId: context.actorId,
      action: 'contact_revealed',
      reason: 'Контакт раскрыт по политике доступа',
      after: { contactType: entry.contactType, stage: context.stage },
    }),
  };
}
