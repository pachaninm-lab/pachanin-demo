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

export type OrganizationCapabilityCode = (typeof ORGANIZATION_CAPABILITY_CODES)[number];
export type OrganizationCapabilityStatus = 'ACTIVE' | 'PENDING_VERIFICATION' | 'REVOKED';
export type OrganizationCapabilityAction = 'DECLARE' | 'REVOKE';

const SELF_ACTIVATABLE = new Set<OrganizationCapabilityCode>([
  'SELL_CROP',
  'BUY_CROP',
  'OWN_TRANSPORT',
  'STORE_CROP',
]);

const CODE_SET = new Set<string>(ORGANIZATION_CAPABILITY_CODES);

export function isOrganizationCapabilityCode(value: string): value is OrganizationCapabilityCode {
  return CODE_SET.has(value);
}

export function organizationCapabilityRequiresVerification(
  code: OrganizationCapabilityCode,
): boolean {
  return !SELF_ACTIVATABLE.has(code);
}

export function declaredOrganizationCapabilityStatus(
  code: OrganizationCapabilityCode,
): OrganizationCapabilityStatus {
  return organizationCapabilityRequiresVerification(code) ? 'PENDING_VERIFICATION' : 'ACTIVE';
}

export const ORGANIZATION_CAPABILITY_REGISTRY = Object.freeze(
  ORGANIZATION_CAPABILITY_CODES.map((code) => Object.freeze({
    code,
    requiresVerification: organizationCapabilityRequiresVerification(code),
    selfDeclarationStatus: declaredOrganizationCapabilityStatus(code),
  })),
);
