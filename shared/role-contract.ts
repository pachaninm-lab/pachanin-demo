export const SURFACE_ROLE_KEYS = [
  'GUEST',
  'FARMER',
  'BUYER',
  'LOGISTICIAN',
  'DRIVER',
  'LAB',
  'ELEVATOR',
  'ACCOUNTING',
  'EXECUTIVE',
  'SUPPORT_MANAGER',
  'ADMIN',
] as const;

export type SurfaceRoleKey = typeof SURFACE_ROLE_KEYS[number];

const ROLE_ALIASES: Record<string, SurfaceRoleKey> = {
  guest: 'GUEST',
  farmer: 'FARMER',
  seller: 'FARMER',
  buyer: 'BUYER',
  logistics: 'LOGISTICIAN',
  logistician: 'LOGISTICIAN',
  driver: 'DRIVER',
  lab: 'LAB',
  laboratory: 'LAB',
  elevator: 'ELEVATOR',
  receiving: 'ELEVATOR',
  accounting: 'ACCOUNTING',
  finance: 'ACCOUNTING',
  executive: 'EXECUTIVE',
  support_manager: 'SUPPORT_MANAGER',
  operator: 'SUPPORT_MANAGER',
  ops: 'SUPPORT_MANAGER',
  admin: 'ADMIN',
};

export const PRIVILEGED_ROLES: readonly SurfaceRoleKey[] = [
  'SUPPORT_MANAGER',
  'ADMIN',
  'EXECUTIVE',
];

export const MFA_REQUIRED_ROLES: readonly SurfaceRoleKey[] = [
  'ADMIN',
];

export function toSurfaceRole(input?: string | null): SurfaceRoleKey {
  const normalized = String(input || '').trim();
  if (!normalized) return 'GUEST';
  if ((SURFACE_ROLE_KEYS as readonly string[]).includes(normalized)) return normalized as SurfaceRoleKey;
  const alias = ROLE_ALIASES[normalized.toLowerCase()];
  return alias || 'GUEST';
}

export function isPrivilegedSurfaceRole(role: SurfaceRoleKey | string | null | undefined) {
  const normalized = toSurfaceRole(String(role || ''));
  return (PRIVILEGED_ROLES as string[]).includes(normalized);
}

export function isMfaRequiredRole(role: SurfaceRoleKey | string | null | undefined) {
  const normalized = toSurfaceRole(String(role || ''));
  return (MFA_REQUIRED_ROLES as string[]).includes(normalized);
}

export function roleMatches(role: SurfaceRoleKey | string | null | undefined, allowedRoles: string[]) {
  const normalized = toSurfaceRole(String(role || ''));
  return allowedRoles.map((item) => toSurfaceRole(item)).includes(normalized);
}

export function canSelfAssignRole(role: SurfaceRoleKey | string): boolean {
  const normalized = toSurfaceRole(String(role));
  return !isPrivilegedSurfaceRole(normalized);
}
