/**
 * Provider-neutral integration bindings and their evidence-backed maturity.
 *
 * A binding describes how a provider capability can be reached. Maturity is
 * never selected by the organization that owns the binding: it is derived
 * from server-held evidence, and real traffic is admitted only at
 * LIVE_ACCEPTED with a receipt issued by the external counterparty.
 */

export const INTEGRATION_BINDING_TYPES = [
  'REST',
  'WEBHOOK',
  '1C',
  'SFTP',
  'FILE',
  'DEEPLINK',
  'PLATFORM_UI',
  'MANUAL',
] as const;

export type IntegrationBindingType = (typeof INTEGRATION_BINDING_TYPES)[number];

export const IntegrationCapabilityMaturity = Object.freeze({
  DISCOVERED: 'DISCOVERED',
  PUBLIC_SPEC_VERIFIED: 'PUBLIC_SPEC_VERIFIED',
  CONTRACT_MAPPED: 'CONTRACT_MAPPED',
  ADAPTER_IMPLEMENTED: 'ADAPTER_IMPLEMENTED',
  CONTRACT_TESTED: 'CONTRACT_TESTED',
  EXTERNAL_ACCESS_PENDING: 'EXTERNAL_ACCESS_PENDING',
  CONTRACT_PENDING: 'CONTRACT_PENDING',
  LIVE_TESTING: 'LIVE_TESTING',
  LIVE_ACCEPTED: 'LIVE_ACCEPTED',
  DEGRADED: 'DEGRADED',
  SUSPENDED: 'SUSPENDED',
} as const);

export const INTEGRATION_CAPABILITY_MATURITIES = Object.freeze(
  Object.values(IntegrationCapabilityMaturity),
);

export type IntegrationCapabilityMaturity =
  (typeof INTEGRATION_CAPABILITY_MATURITIES)[number];

export type IntegrationBindingStatus =
  | 'PENDING_VERIFICATION'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'WITHDRAWN';

export type IntegrationCapabilityEvidenceFact = Readonly<{
  maturity: IntegrationCapabilityMaturity;
  evidenceReference: string;
  evidenceIssuer: string;
  externalReceiptId: string | null;
  checkedAt: string;
  expiresAt: string | null;
}>;

export type IntegrationCapabilityAssessment = Readonly<{
  maturity: IntegrationCapabilityMaturity;
  nextRequired: IntegrationCapabilityMaturity | null;
  mayCarryRealTraffic: boolean;
  evidenceMode: 'SERVER_HELD';
}>;

const PROGRESSIVE_MATURITIES = INTEGRATION_CAPABILITY_MATURITIES.slice(0, 9) as readonly IntegrationCapabilityMaturity[];
const OWN_RECEIPT_ISSUERS = new Set(['PC_CROP', 'PLATFORM', 'SELF', 'INTERNAL']);

function timestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function isCurrent(fact: IntegrationCapabilityEvidenceFact, at: Date): boolean {
  return fact.expiresAt === null || timestamp(fact.expiresAt) > at.getTime();
}

function isExternalLiveReceipt(fact: IntegrationCapabilityEvidenceFact): boolean {
  return fact.maturity === 'LIVE_ACCEPTED'
    && Boolean(fact.externalReceiptId?.trim())
    && Boolean(fact.evidenceIssuer.trim())
    && !OWN_RECEIPT_ISSUERS.has(fact.evidenceIssuer.trim().toUpperCase());
}

/**
 * Derive one honest maturity from append-only facts.
 *
 * Progressive stages must be contiguous. A higher fact with a missing lower
 * stage cannot promote the capability. DEGRADED and SUSPENDED are operational
 * observations and override the progression only while they are the newest
 * current fact. WITHDRAWN bindings are always suspended.
 */
export function assessIntegrationCapability(
  bindingStatus: IntegrationBindingStatus,
  evidence: readonly IntegrationCapabilityEvidenceFact[],
  at: Date = new Date(),
): IntegrationCapabilityAssessment {
  if (bindingStatus === 'WITHDRAWN' || bindingStatus === 'SUSPENDED') {
    return {
      maturity: 'SUSPENDED',
      nextRequired: null,
      mayCarryRealTraffic: false,
      evidenceMode: 'SERVER_HELD',
    };
  }

  const current = evidence
    .filter((fact) => isCurrent(fact, at))
    .sort((left, right) => timestamp(left.checkedAt) - timestamp(right.checkedAt));
  const newest = current.at(-1);
  if (newest?.maturity === 'SUSPENDED' || newest?.maturity === 'DEGRADED') {
    return {
      maturity: newest.maturity,
      nextRequired: newest.maturity === 'DEGRADED' ? 'LIVE_ACCEPTED' : null,
      mayCarryRealTraffic: false,
      evidenceMode: 'SERVER_HELD',
    };
  }

  const earned = new Set<IntegrationCapabilityMaturity>(['DISCOVERED']);
  for (const fact of current) {
    if (fact.maturity === 'LIVE_ACCEPTED' && !isExternalLiveReceipt(fact)) continue;
    earned.add(fact.maturity);
  }

  let maturity: IntegrationCapabilityMaturity = 'DISCOVERED';
  for (const candidate of PROGRESSIVE_MATURITIES.slice(1)) {
    if (!earned.has(candidate)) break;
    maturity = candidate;
  }
  const position = PROGRESSIVE_MATURITIES.indexOf(maturity);
  const nextRequired = PROGRESSIVE_MATURITIES[position + 1] ?? null;
  return {
    maturity,
    nextRequired,
    mayCarryRealTraffic: bindingStatus === 'ACTIVE' && maturity === 'LIVE_ACCEPTED',
    evidenceMode: 'SERVER_HELD',
  };
}

export function isIntegrationBindingType(value: string): value is IntegrationBindingType {
  return (INTEGRATION_BINDING_TYPES as readonly string[]).includes(value);
}

export function isIntegrationCapabilityMaturity(
  value: string,
): value is IntegrationCapabilityMaturity {
  return (INTEGRATION_CAPABILITY_MATURITIES as readonly string[]).includes(value);
}
