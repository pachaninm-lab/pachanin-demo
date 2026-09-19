export const CANONICAL_DEAL_GATES = [
  { code: 'COMMERCIAL_CONFIRMED', title: 'Коммерческие условия подтверждены', lane: 'deal' },
  { code: 'SHIPMENT_ASSIGNED', title: 'Назначен рейс и окно', lane: 'transport' },
  { code: 'RECEIVING_DECISION', title: 'Есть решение по приёмке', lane: 'receiving' },
  { code: 'LAB_PROTOCOL_FINAL', title: 'Есть финальный protocol / retest outcome', lane: 'lab' },
  { code: 'DOCS_COMPLETE', title: 'Обязательный пакет документов complete', lane: 'docs' },
  { code: 'PAYMENT_READY', title: 'Money contour допускает release', lane: 'payments' },
  { code: 'DISPUTE_RESOLVED', title: 'Активный спор закрыт или переведён в частичный outcome', lane: 'dispute' },
  { code: 'EVIDENCE_MINIMUM', title: 'Собран минимум доказательств по execution', lane: 'evidence' },
  { code: 'TRUST_ALLOWED', title: 'Контрагент допущен по trust/admission', lane: 'trust' },
] as const;

export const BLOCKER_REASON_CODES = [
  'DOCS_MISSING',
  'DOCS_UNSIGNED',
  'DOCS_SIGNATORY_INVALID',
  'PAYMENT_HOLD',
  'PAYMENT_CALLBACK_MISSING',
  'DISPUTE_OPEN',
  'QUALITY_RETEST_REQUIRED',
  'RECEIVING_REJECTED',
  'ROUTE_DEVIATION_UNCONFIRMED',
  'OFFLINE_SYNC_CONFLICT',
  'TRUST_REVIEW_REQUIRED',
  'BYPASS_RISK_HIGH',
  'NO_SHOW_RISK',
] as const;

export const MANUAL_OVERRIDE_REASON_CODES = [
  'OVERRIDE_TRUST_ADMISSION',
  'OVERRIDE_PAYOUT_RELEASE',
  'OVERRIDE_DOC_COMPLETENESS',
  'OVERRIDE_RECEIVING_DECISION',
  'OVERRIDE_LAB_OUTCOME',
  'OVERRIDE_OPERATOR_ROUTING',
] as const;

export const DISPUTE_REASON_CODES = [
  'QUALITY_MISMATCH',
  'WEIGHT_MISMATCH',
  'DOCUMENT_MISMATCH',
  'LATE_DELIVERY',
  'DAMAGE_OR_CONTAMINATION',
  'PAYMENT_DELAY',
  'UNAUTHORISED_ACTION',
] as const;

export const FALLBACK_REASON_CODES = [
  'DEGRADED_DOC_REVIEW',
  'DEGRADED_OFFLINE_CAPTURE',
  'DEGRADED_BANK_CALLBACK',
  'DEGRADED_QUALITY_RETEST',
] as const;
