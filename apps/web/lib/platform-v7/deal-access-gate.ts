import { PlatformRole } from './core-types';
import { BypassRiskProfile } from './bypass-risk-score';
import { DealStage } from './contact-vault';

export type SensitiveField =
  | 'phone'
  | 'email'
  | 'exact_address'
  | 'full_legal_name'
  | 'bank_details'
  | 'full_documents'
  | 'responsible_person'
  | 'driver_contact'
  | 'carrier_contact'
  | 'closed_offer_terms';

export interface DealAccessContext {
  role: PlatformRole;
  stage: DealStage;
  hasOffer: boolean;
  hasDealDraft: boolean;
  trustScore: number;
  bypassRiskProfile?: BypassRiskProfile;
  manualRestriction?: boolean;
  documentsReady?: boolean;
  counterpartyAdmitted?: boolean;
}

const minimumStage: Record<SensitiveField, DealStage> = {
  phone: 'deal_confirmed',
  email: 'deal_confirmed',
  exact_address: 'execution_started',
  full_legal_name: 'deal_draft',
  bank_details: 'deal_confirmed',
  full_documents: 'deal_draft',
  responsible_person: 'deal_confirmed',
  driver_contact: 'execution_started',
  carrier_contact: 'execution_started',
  closed_offer_terms: 'deal_draft',
};

const stageRank: Record<DealStage, number> = {
  interest: 1,
  offer_sent: 2,
  counter_offer: 3,
  deal_draft: 4,
  deal_confirmed: 5,
  execution_started: 6,
};

export function canAccessSensitiveField(field: SensitiveField, context: DealAccessContext): { allowed: boolean; reason?: string } {
  if (context.manualRestriction) return { allowed: false, reason: 'manual_restriction' };
  if ((context.bypassRiskProfile?.totalScore ?? 0) >= 60) return { allowed: false, reason: 'bypass_risk' };
  if (context.trustScore < 40) return { allowed: false, reason: 'low_trust_score' };
  if (field === 'closed_offer_terms' && context.role !== 'seller' && context.role !== 'buyer' && context.role !== 'operator') return { allowed: false, reason: 'role_not_allowed' };
  if (field === 'bank_details' && context.role !== 'bank' && context.role !== 'operator') return { allowed: false, reason: 'role_not_allowed' };
  if (field === 'driver_contact' && context.role !== 'logistics' && context.role !== 'operator') return { allowed: false, reason: 'role_not_allowed' };
  if (stageRank[context.stage] < stageRank[minimumStage[field]]) return { allowed: false, reason: 'stage_too_early' };
  if (field === 'full_documents' && !context.documentsReady) return { allowed: false, reason: 'documents_not_ready' };
  if (!context.counterpartyAdmitted) return { allowed: false, reason: 'counterparty_not_admitted' };
  return { allowed: true };
}

export function maskSensitiveValue(value: string, allowed: boolean): string {
  if (allowed) return value;
  if (value.length <= 4) return '••••';
  return `${value.slice(0, 2)}••••${value.slice(-2)}`;
}
