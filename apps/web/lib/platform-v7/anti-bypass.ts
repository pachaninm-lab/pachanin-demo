export type P7BypassRiskSignal =
  | 'early_direct_contact_requested'
  | 'off_platform_payment_terms'
  | 'missing_document_basis'
  | 'external_chat_channel'
  | 'counterparty_details_exposed_before_reserve'
  | 'repeat_unmatched_deals';

export type P7BypassRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface P7BypassCheckInput {
  readonly dealId: string;
  readonly reserveConfirmed: boolean;
  readonly documentBasisReady: boolean;
  readonly counterpartyContactsVisible: boolean;
  readonly offPlatformPaymentMentioned: boolean;
  readonly externalChatMentioned: boolean;
  readonly repeatUnmatchedDeals: number;
}

export interface P7BypassRiskDecision {
  readonly level: P7BypassRiskLevel;
  readonly signals: readonly P7BypassRiskSignal[];
  readonly platformLockReason: string;
  readonly nextAction: string;
}

export function p7EvaluateBypassRisk(input: P7BypassCheckInput): P7BypassRiskDecision {
  const signals: P7BypassRiskSignal[] = [];

  if (input.counterpartyContactsVisible && !input.reserveConfirmed) signals.push('counterparty_details_exposed_before_reserve');
  if (input.offPlatformPaymentMentioned) signals.push('off_platform_payment_terms');
  if (input.externalChatMentioned) signals.push('external_chat_channel');
  if (!input.documentBasisReady) signals.push('missing_document_basis');
  if (input.repeatUnmatchedDeals >= 3) signals.push('repeat_unmatched_deals');
  if (!input.reserveConfirmed && (input.offPlatformPaymentMentioned || input.externalChatMentioned)) signals.push('early_direct_contact_requested');

  const level: P7BypassRiskLevel = signals.includes('counterparty_details_exposed_before_reserve') || signals.includes('early_direct_contact_requested')
    ? 'critical'
    : signals.length >= 3
      ? 'high'
      : signals.length > 0
        ? 'medium'
        : 'low';

  return {
    level,
    signals,
    platformLockReason: level === 'low'
      ? 'Execution value remains inside the platform through reserve, documents and evidence.'
      : 'Deal requires platform lock through reserve, documents, evidence and audit before wider disclosure.',
    nextAction: level === 'low' ? 'Continue execution inside platform.' : 'Limit disclosure and require next controlled execution action.',
  };
}

export function p7CanExposeCounterpartyContacts(input: Pick<P7BypassCheckInput, 'reserveConfirmed' | 'documentBasisReady'>): boolean {
  return input.reserveConfirmed && input.documentBasisReady;
}
