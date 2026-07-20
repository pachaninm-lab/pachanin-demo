// Package version — bump this on every breaking or notable change
export const DOMAIN_CORE_VERSION = '0.3.0';

export { Money, MoneyError } from './money';
export type { CurrencyCode as MoneyCurrencyCode } from './money';
export { Weight, PricePerTon, QualityAdjustment } from './measures';
export type { QualityAdjustmentDirection } from './measures';
export * from './canonical-models';
export * from './canonical-reason-codes';
export * from './source-of-truth';
export * from './document-requirements';
export * from './scoring';
export * from '../../../shared/role-contract';
export * from './status-policy-engine';
export * from './action-decision-engine';
export * from './execution-scores-v2';
export * from './feature-policy-registry';
export * from './commodity-profile';

export * from './service-provider-registry';

export * from './deadline-protection';
export * from './operator-case-center';
export * from './integration-contracts';
export * from './risk-scoring';

export * from './problem-closure-matrix';
export * from './provider-compliance-gates';
export * from './document-correction-workflow';
export * from './browser-access-policy';
export * from './integration-hardening';
export * from './unified-deal-passport';
export * from './execution-simulation';
export * from './deal-event-chain';
export * from './saga-orchestrator';
export * from './double-entry-ledger';
export * from './audit-log';
export * from './deal-signing-service';
