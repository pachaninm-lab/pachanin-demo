import { EntityId, IsoDateTime, PlatformRole, clampScore } from './core-types';
import { AntiLeakFinding } from './anti-leak-filter';

export type BypassRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type BypassSignalType =
  | 'phone_in_message'
  | 'email_in_message'
  | 'messenger_handle_in_message'
  | 'external_link_in_message'
  | 'inn_exchange_attempt'
  | 'exact_address_request'
  | 'document_download_before_offer'
  | 'repeated_views_without_offer'
  | 'document_request_without_progress'
  | 'deal_cancelled_after_contact_reveal'
  | 'contact_reveal_then_inactivity'
  | 'same_parties_reappeared_outside_flow'
  | 'suspicious_attachment'
  | 'operator_manual_flag'
  | 'carrier_contact_bridge_risk'
  | 'driver_contact_bridge_risk'
  | 'elevator_contact_bridge_risk';

export interface BypassSignal {
  id: EntityId;
  dealId?: EntityId;
  lotId?: EntityId;
  rfqId?: EntityId;
  actorId: EntityId;
  actorRole: PlatformRole;
  counterpartyId?: EntityId;
  signalType: BypassSignalType;
  riskLevel: BypassRiskLevel;
  source: 'chat' | 'document' | 'attachment' | 'download' | 'contact_reveal' | 'offer_flow' | 'operator' | 'system';
  description: string;
  rawValueMasked?: string;
  createdAt: IsoDateTime;
}

export interface BypassRestriction {
  id: EntityId;
  type: 'zero_direct_contact' | 'document_preview_only' | 'operator_approval_required' | 'cooldown' | 'manual_review';
  reason: string;
  createdAt: IsoDateTime;
}

export interface BypassRiskProfile {
  counterpartyId: EntityId;
  totalScore: number;
  riskLevel: BypassRiskLevel;
  signals: BypassSignal[];
  lastSignalAt?: IsoDateTime;
  restrictions: BypassRestriction[];
  manualReviewRequired: boolean;
  updatedAt: IsoDateTime;
}

const riskWeight: Record<BypassRiskLevel, number> = { low: 8, medium: 18, high: 34, critical: 55 };

export function riskLevelFromBypassScore(score: number): BypassRiskLevel {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

export function mapLeakFindingToSignal(finding: AntiLeakFinding, actorId: EntityId, actorRole: PlatformRole, counterpartyId?: EntityId): BypassSignal {
  const signalType: BypassSignalType = finding.type === 'phone'
    ? 'phone_in_message'
    : finding.type === 'email'
      ? 'email_in_message'
      : finding.type === 'messenger'
        ? 'messenger_handle_in_message'
        : finding.type === 'external_link'
          ? 'external_link_in_message'
          : finding.type === 'inn'
            ? 'inn_exchange_attempt'
            : finding.type === 'exact_address'
              ? 'exact_address_request'
              : 'operator_manual_flag';
  return {
    id: `BYP-${signalType}-${Date.now()}`,
    actorId,
    actorRole,
    counterpartyId,
    signalType,
    riskLevel: finding.riskLevel === 'critical' ? 'critical' : finding.riskLevel === 'high' ? 'high' : finding.riskLevel === 'medium' ? 'medium' : 'low',
    source: 'chat',
    description: finding.message,
    rawValueMasked: finding.rawValueMasked,
    createdAt: new Date().toISOString(),
  };
}

export function calculateBypassRiskProfile(counterpartyId: EntityId, signals: BypassSignal[], existingRestrictions: BypassRestriction[] = []): BypassRiskProfile {
  const rawScore = signals.reduce((sum, signal) => sum + riskWeight[signal.riskLevel], 0);
  const totalScore = clampScore(rawScore);
  const riskLevel = riskLevelFromBypassScore(totalScore);
  const restrictions = [...existingRestrictions];
  if (riskLevel === 'high' || riskLevel === 'critical') {
    restrictions.push({ id: `RST-zero-${Date.now()}`, type: 'zero_direct_contact', reason: 'Требуется ручная проверка: выявлены признаки вывода коммуникации во внешний контур.', createdAt: new Date().toISOString() });
    restrictions.push({ id: `RST-doc-${Date.now()}`, type: 'document_preview_only', reason: 'Документы доступны только в preview-режиме до проверки.', createdAt: new Date().toISOString() });
  }
  if (signals.some((signal) => signal.signalType === 'deal_cancelled_after_contact_reveal')) {
    restrictions.push({ id: `RST-cooldown-${Date.now()}`, type: 'cooldown', reason: 'Повторное взаимодействие требует проверки после отмены сделки.', createdAt: new Date().toISOString() });
  }
  return {
    counterpartyId,
    totalScore,
    riskLevel,
    signals,
    lastSignalAt: signals.at(-1)?.createdAt,
    restrictions,
    manualReviewRequired: totalScore >= 35,
    updatedAt: new Date().toISOString(),
  };
}

export function platformTrustScoreFromBypassRisk(bypassScore: number): number {
  return clampScore(100 - bypassScore);
}
