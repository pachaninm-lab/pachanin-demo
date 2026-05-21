export type P7BypassSignal =
  | 'direct_phone_visible'
  | 'direct_email_visible'
  | 'external_chat_visible'
  | 'unmasked_counterparty_before_reserve'
  | 'unmasked_driver_before_trip_assignment'
  | 'off_platform_payment_instruction'
  | 'manual_document_exchange_without_audit';

export type P7BypassRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface P7BypassCheckInput {
  readonly dealId: string;
  readonly role: string;
  readonly stage: 'pre_offer' | 'offer' | 'reserve_pending' | 'reserved' | 'in_execution' | 'closed';
  readonly visibleSignals: readonly P7BypassSignal[];
}

export interface P7BypassDecision {
  readonly blocked: boolean;
  readonly riskLevel: P7BypassRiskLevel;
  readonly reasons: readonly string[];
  readonly requiredAction: string;
}

const criticalSignals: readonly P7BypassSignal[] = [
  'off_platform_payment_instruction',
  'direct_phone_visible',
  'direct_email_visible',
  'external_chat_visible',
];

export function p7EvaluateBypassRisk(input: P7BypassCheckInput): P7BypassDecision {
  const reasons: string[] = [];

  for (const signal of input.visibleSignals) {
    if (criticalSignals.includes(signal)) reasons.push(signal);
  }

  if (input.stage !== 'reserved' && input.stage !== 'in_execution' && input.stage !== 'closed') {
    if (input.visibleSignals.includes('unmasked_counterparty_before_reserve')) reasons.push('unmasked_counterparty_before_reserve');
  }

  if (input.stage !== 'in_execution' && input.visibleSignals.includes('unmasked_driver_before_trip_assignment')) {
    reasons.push('unmasked_driver_before_trip_assignment');
  }

  if (input.visibleSignals.includes('manual_document_exchange_without_audit')) {
    reasons.push('manual_document_exchange_without_audit');
  }

  const uniqueReasons = Array.from(new Set(reasons));
  const blocked = uniqueReasons.length > 0;
  const riskLevel: P7BypassRiskLevel = uniqueReasons.includes('off_platform_payment_instruction')
    ? 'critical'
    : uniqueReasons.length >= 2
      ? 'high'
      : uniqueReasons.length === 1
        ? 'medium'
        : 'low';

  return {
    blocked,
    riskLevel,
    reasons: uniqueReasons,
    requiredAction: blocked ? 'Скрыть контактные данные и провести действие через контур сделки' : 'Продолжить в контуре сделки',
  };
}

export function p7CanRevealCounterparty(stage: P7BypassCheckInput['stage']): boolean {
  return stage === 'reserved' || stage === 'in_execution' || stage === 'closed';
}

export function p7CanRevealDriver(stage: P7BypassCheckInput['stage']): boolean {
  return stage === 'in_execution' || stage === 'closed';
}
