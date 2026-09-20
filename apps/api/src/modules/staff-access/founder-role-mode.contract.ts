import { Role } from '../../common/types/request-user';

export const FOUNDER_ROLE_MODE_SCHEMA = 'pc-crop.founder-role-mode.v1' as const;
export const FOUNDER_ROLE_MODE_RETURN_PATH = '/platform-v7/staff' as const;
export const FOUNDER_ROLE_MODE_DEFAULT_DURATION_SECONDS = 15 * 60;
export const FOUNDER_ROLE_MODE_MAX_DURATION_SECONDS = 60 * 60;

export const FOUNDER_ROLE_MODE_RESTRICTIONS = [
  'READ_ONLY',
  'NO_PAYMENT_RELEASE',
  'NO_BANK_CALLBACK_CONFIRM',
  'NO_DOCUMENT_SIGN',
  'NO_LAB_FINALIZE',
  'NO_ACCEPTANCE_SIGN',
  'NO_ARBITRATION_DECIDE',
  'NO_EVIDENCE_DELETE',
] as const;

export const FOUNDER_ROLE_MODE_CABINETS = [
  { key: 'operator', canonicalPath: '/platform-v7/operator', effectiveRole: Role.SUPPORT_MANAGER },
  { key: 'buyer', canonicalPath: '/platform-v7/buyer', effectiveRole: Role.BUYER },
  { key: 'seller', canonicalPath: '/platform-v7/seller', effectiveRole: Role.FARMER },
  { key: 'logistics', canonicalPath: '/platform-v7/logistics', effectiveRole: Role.LOGISTICIAN },
  { key: 'driver', canonicalPath: '/platform-v7/driver/field', effectiveRole: Role.DRIVER },
  { key: 'surveyor', canonicalPath: '/platform-v7/surveyor', effectiveRole: Role.SURVEYOR },
  { key: 'elevator', canonicalPath: '/platform-v7/elevator', effectiveRole: Role.ELEVATOR },
  { key: 'lab', canonicalPath: '/platform-v7/lab', effectiveRole: Role.LAB },
  { key: 'bank', canonicalPath: '/platform-v7/bank', effectiveRole: Role.ACCOUNTING },
  { key: 'organization', canonicalPath: '/platform-v7/profile', effectiveRole: Role.GUEST },
  { key: 'arbitrator', canonicalPath: '/platform-v7/arbitrator', effectiveRole: Role.ARBITRATOR },
  { key: 'compliance', canonicalPath: '/platform-v7/compliance', effectiveRole: Role.COMPLIANCE_OFFICER },
  { key: 'executive', canonicalPath: '/platform-v7/executive', effectiveRole: Role.EXECUTIVE },
] as const;

export type FounderRoleModeCabinetKey = (typeof FOUNDER_ROLE_MODE_CABINETS)[number]['key'];
export type FounderRoleModeCabinet = (typeof FOUNDER_ROLE_MODE_CABINETS)[number];

const CABINET_BY_KEY = new Map<string, FounderRoleModeCabinet>(
  FOUNDER_ROLE_MODE_CABINETS.map((cabinet) => [cabinet.key, cabinet]),
);

const CABINET_BY_EFFECTIVE_ROLE = new Map<string, FounderRoleModeCabinet>(
  FOUNDER_ROLE_MODE_CABINETS.map((cabinet) => [cabinet.effectiveRole, cabinet]),
);

export function founderRoleModeCabinetByKey(value: unknown): FounderRoleModeCabinet | null {
  return typeof value === 'string' ? CABINET_BY_KEY.get(value) ?? null : null;
}

export function founderRoleModeCabinetByEffectiveRole(value: unknown): FounderRoleModeCabinet | null {
  return typeof value === 'string' ? CABINET_BY_EFFECTIVE_ROLE.get(value) ?? null : null;
}
