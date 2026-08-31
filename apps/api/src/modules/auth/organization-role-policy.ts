export const ORGANIZATION_HUMAN_ROLES = [
  'FARMER',
  'BUYER',
  'LOGISTICIAN',
  'DRIVER',
  'ELEVATOR',
  'LAB',
  'SURVEYOR',
  'ACCOUNTING',
  'GUEST',
] as const;

export type OrganizationHumanRole = typeof ORGANIZATION_HUMAN_ROLES[number];

const ROLE_CEILING: Readonly<Record<OrganizationHumanRole, ReadonlySet<OrganizationHumanRole>>> = {
  FARMER: new Set(['FARMER', 'GUEST']),
  BUYER: new Set(['BUYER', 'GUEST']),
  LOGISTICIAN: new Set(['LOGISTICIAN', 'DRIVER', 'GUEST']),
  DRIVER: new Set(['DRIVER', 'GUEST']),
  ELEVATOR: new Set(['ELEVATOR', 'LAB', 'GUEST']),
  LAB: new Set(['LAB', 'GUEST']),
  SURVEYOR: new Set(['SURVEYOR', 'GUEST']),
  ACCOUNTING: new Set(['ACCOUNTING', 'GUEST']),
  GUEST: new Set(['GUEST']),
};

export function isOrganizationHumanRole(value: unknown): value is OrganizationHumanRole {
  return typeof value === 'string'
    && Object.prototype.hasOwnProperty.call(ROLE_CEILING, value);
}

export function canAssignOrganizationRole(
  administratorRole: OrganizationHumanRole,
  requestedRole: OrganizationHumanRole,
): boolean {
  return ROLE_CEILING[administratorRole].has(requestedRole);
}
