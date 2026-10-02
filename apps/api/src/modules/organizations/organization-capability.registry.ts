export const ORGANIZATION_CAPABILITY_CODES = [
  'SELL_CROP',
  'BUY_CROP',
  'OWN_TRANSPORT',
  'PROVIDE_LOGISTICS',
  'PROVIDE_EXPEDITION',
  'STORE_CROP',
  'PROVIDE_ELEVATOR_SERVICES',
  'PROVIDE_LAB_TESTING',
  'PROVIDE_SURVEYING',
  'PROVIDE_FINANCING',
  'PROVIDE_INSURANCE',
  'ACCOUNTING_INTEGRATION',
  'API_INTEGRATION',
] as const;

export type OrganizationCapabilityCode = typeof ORGANIZATION_CAPABILITY_CODES[number];

export type OrganizationCapabilityEvidencePolicy =
  | Readonly<{ kind: 'DECLARATION_ONLY' }>
  | Readonly<{ kind: 'ROLE_ELIGIBILITY'; requestedRole: string }>
  | Readonly<{ kind: 'SERVER_EVIDENCE_REQUIRED' }>;

export type OrganizationCapabilityDefinition = Readonly<{
  code: OrganizationCapabilityCode;
  evidencePolicy: OrganizationCapabilityEvidencePolicy;
}>;

/**
 * W1-A is deliberately conservative. A declaration-only capability may become
 * ACTIVE because it describes an organization's own operating choice; it is
 * never presented as independent verification. Capabilities whose safe use
 * depends on organization eligibility or a future specialized authority stay
 * PENDING until server-held evidence exists.
 *
 * requestedRole uses the immutable internal role stored by Role Eligibility,
 * not the semantic/public workspace label.
 */
export const ORGANIZATION_CAPABILITY_REGISTRY: Readonly<Record<OrganizationCapabilityCode, OrganizationCapabilityDefinition>> =
  Object.freeze({
    SELL_CROP: Object.freeze({
      code: 'SELL_CROP',
      evidencePolicy: Object.freeze({ kind: 'ROLE_ELIGIBILITY', requestedRole: 'FARMER' }),
    }),
    BUY_CROP: Object.freeze({
      code: 'BUY_CROP',
      evidencePolicy: Object.freeze({ kind: 'ROLE_ELIGIBILITY', requestedRole: 'BUYER' }),
    }),
    OWN_TRANSPORT: Object.freeze({
      code: 'OWN_TRANSPORT',
      evidencePolicy: Object.freeze({ kind: 'DECLARATION_ONLY' }),
    }),
    PROVIDE_LOGISTICS: Object.freeze({
      code: 'PROVIDE_LOGISTICS',
      evidencePolicy: Object.freeze({ kind: 'ROLE_ELIGIBILITY', requestedRole: 'LOGISTICIAN' }),
    }),
    PROVIDE_EXPEDITION: Object.freeze({
      code: 'PROVIDE_EXPEDITION',
      evidencePolicy: Object.freeze({ kind: 'ROLE_ELIGIBILITY', requestedRole: 'LOGISTICIAN' }),
    }),
    STORE_CROP: Object.freeze({
      code: 'STORE_CROP',
      evidencePolicy: Object.freeze({ kind: 'DECLARATION_ONLY' }),
    }),
    PROVIDE_ELEVATOR_SERVICES: Object.freeze({
      code: 'PROVIDE_ELEVATOR_SERVICES',
      evidencePolicy: Object.freeze({ kind: 'ROLE_ELIGIBILITY', requestedRole: 'ELEVATOR' }),
    }),
    PROVIDE_LAB_TESTING: Object.freeze({
      code: 'PROVIDE_LAB_TESTING',
      evidencePolicy: Object.freeze({ kind: 'ROLE_ELIGIBILITY', requestedRole: 'LAB' }),
    }),
    PROVIDE_SURVEYING: Object.freeze({
      code: 'PROVIDE_SURVEYING',
      evidencePolicy: Object.freeze({ kind: 'ROLE_ELIGIBILITY', requestedRole: 'SURVEYOR' }),
    }),
    PROVIDE_FINANCING: Object.freeze({
      code: 'PROVIDE_FINANCING',
      evidencePolicy: Object.freeze({ kind: 'ROLE_ELIGIBILITY', requestedRole: 'ACCOUNTING' }),
    }),
    PROVIDE_INSURANCE: Object.freeze({
      code: 'PROVIDE_INSURANCE',
      evidencePolicy: Object.freeze({ kind: 'SERVER_EVIDENCE_REQUIRED' }),
    }),
    ACCOUNTING_INTEGRATION: Object.freeze({
      code: 'ACCOUNTING_INTEGRATION',
      evidencePolicy: Object.freeze({ kind: 'DECLARATION_ONLY' }),
    }),
    API_INTEGRATION: Object.freeze({
      code: 'API_INTEGRATION',
      evidencePolicy: Object.freeze({ kind: 'DECLARATION_ONLY' }),
    }),
  });

const ORGANIZATION_CAPABILITY_CODE_SET = new Set<string>(ORGANIZATION_CAPABILITY_CODES);

export function isOrganizationCapabilityCode(value: unknown): value is OrganizationCapabilityCode {
  return typeof value === 'string' && ORGANIZATION_CAPABILITY_CODE_SET.has(value);
}

export function requireOrganizationCapabilityCode(value: unknown): OrganizationCapabilityCode {
  if (!isOrganizationCapabilityCode(value)) {
    throw new Error('ORGANIZATION_CAPABILITY_CODE_UNSUPPORTED');
  }
  return value;
}

export function organizationCapabilityDefinition(
  code: OrganizationCapabilityCode,
): OrganizationCapabilityDefinition {
  return ORGANIZATION_CAPABILITY_REGISTRY[code];
}
