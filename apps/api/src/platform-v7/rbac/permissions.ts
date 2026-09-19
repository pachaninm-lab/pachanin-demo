export type PlatformV7Role =
  | 'seller'
  | 'buyer'
  | 'bank'
  | 'logistics'
  | 'driver'
  | 'elevator'
  | 'lab'
  | 'arbitrator'
  | 'compliance'
  | 'executive'
  | 'operator'
  | 'support';

export type PlatformV7Action =
  | 'deal.read'
  | 'deal.write'
  | 'logistics.read'
  | 'logistics.write'
  | 'quality.read'
  | 'quality.write'
  | 'money.read'
  | 'money.basis.review'
  | 'money.release.request'
  | 'dispute.read'
  | 'dispute.write'
  | 'audit.read'
  | 'support.read';

export type PlatformV7PermissionScope = 'own-object' | 'tenant' | 'platform-readonly';

export type PlatformV7Permission = Readonly<{
  action: PlatformV7Action;
  scope: PlatformV7PermissionScope;
}>;

export const PLATFORM_V7_ROLES: readonly PlatformV7Role[] = [
  'seller',
  'buyer',
  'bank',
  'logistics',
  'driver',
  'elevator',
  'lab',
  'arbitrator',
  'compliance',
  'executive',
  'operator',
  'support',
] as const;

export const PLATFORM_V7_PERMISSION_MATRIX: Readonly<Record<PlatformV7Role, readonly PlatformV7Permission[]>> = {
  seller: [
    { action: 'deal.read', scope: 'own-object' },
    { action: 'deal.write', scope: 'own-object' },
    { action: 'logistics.read', scope: 'own-object' },
    { action: 'quality.read', scope: 'own-object' },
    { action: 'money.read', scope: 'own-object' },
    { action: 'dispute.read', scope: 'own-object' },
    { action: 'dispute.write', scope: 'own-object' },
  ],
  buyer: [
    { action: 'deal.read', scope: 'own-object' },
    { action: 'deal.write', scope: 'own-object' },
    { action: 'logistics.read', scope: 'own-object' },
    { action: 'quality.read', scope: 'own-object' },
    { action: 'money.read', scope: 'own-object' },
    { action: 'money.release.request', scope: 'own-object' },
    { action: 'dispute.read', scope: 'own-object' },
    { action: 'dispute.write', scope: 'own-object' },
  ],
  bank: [
    { action: 'deal.read', scope: 'tenant' },
    { action: 'money.read', scope: 'tenant' },
    { action: 'money.basis.review', scope: 'tenant' },
    { action: 'audit.read', scope: 'tenant' },
  ],
  logistics: [
    { action: 'deal.read', scope: 'tenant' },
    { action: 'logistics.read', scope: 'tenant' },
    { action: 'logistics.write', scope: 'tenant' },
  ],
  driver: [
    { action: 'deal.read', scope: 'own-object' },
    { action: 'logistics.read', scope: 'own-object' },
    { action: 'logistics.write', scope: 'own-object' },
  ],
  elevator: [
    { action: 'deal.read', scope: 'tenant' },
    { action: 'logistics.read', scope: 'tenant' },
    { action: 'quality.read', scope: 'tenant' },
    { action: 'quality.write', scope: 'tenant' },
  ],
  lab: [
    { action: 'deal.read', scope: 'tenant' },
    { action: 'quality.read', scope: 'tenant' },
    { action: 'quality.write', scope: 'tenant' },
  ],
  arbitrator: [
    { action: 'dispute.read', scope: 'tenant' },
    { action: 'dispute.write', scope: 'tenant' },
    { action: 'audit.read', scope: 'tenant' },
  ],
  compliance: [
    { action: 'deal.read', scope: 'tenant' },
    { action: 'money.read', scope: 'tenant' },
    { action: 'audit.read', scope: 'tenant' },
  ],
  executive: [
    { action: 'deal.read', scope: 'platform-readonly' },
    { action: 'logistics.read', scope: 'platform-readonly' },
    { action: 'quality.read', scope: 'platform-readonly' },
    { action: 'money.read', scope: 'platform-readonly' },
    { action: 'dispute.read', scope: 'platform-readonly' },
    { action: 'audit.read', scope: 'platform-readonly' },
  ],
  operator: [
    { action: 'deal.read', scope: 'tenant' },
    { action: 'deal.write', scope: 'tenant' },
    { action: 'logistics.read', scope: 'tenant' },
    { action: 'logistics.write', scope: 'tenant' },
    { action: 'quality.read', scope: 'tenant' },
    { action: 'dispute.read', scope: 'tenant' },
    { action: 'audit.read', scope: 'tenant' },
  ],
  support: [
    { action: 'deal.read', scope: 'tenant' },
    { action: 'support.read', scope: 'tenant' },
    { action: 'audit.read', scope: 'tenant' },
  ],
} as const;

export function platformV7PermissionFor(
  role: PlatformV7Role,
  action: PlatformV7Action,
): PlatformV7Permission | null {
  return PLATFORM_V7_PERMISSION_MATRIX[role].find((permission) => permission.action === action) ?? null;
}

export function platformV7Can(role: PlatformV7Role, action: PlatformV7Action): boolean {
  return platformV7PermissionFor(role, action) !== null;
}
