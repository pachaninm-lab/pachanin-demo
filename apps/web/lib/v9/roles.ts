/**
 * Role + Permission matrix — §4 ТЗ v9.1
 */

export type Role =
  | 'operator'
  | 'buyer'
  | 'seller'
  | 'driver'
  | 'surveyor'
  | 'elevator'
  | 'lab'
  | 'bank'
  | 'compliance'
  | 'admin'
  | 'arbitrator';

export type Permission =
  | 'deal.view'
  | 'deal.edit'
  | 'release.request'
  | 'release.approve'
  | 'doc.upload'
  | 'doc.verify'
  | 'dispute.open'
  | 'dispute.resolve'
  | 'field.submit'
  | 'audit.view';

const matrix: Record<Role, Permission[]> = {
  operator: [
    'deal.view', 'deal.edit',
    'release.request',
    'doc.upload', 'doc.verify',
    'dispute.open',
    'audit.view',
  ],
  buyer: [
    'deal.view',
    'release.request', 'release.approve',
    'doc.upload',
    'dispute.open',
  ],
  seller: [
    'deal.view',
    'release.request',
    'doc.upload',
    'dispute.open',
  ],
  driver: [
    'deal.view',
    'field.submit',
    'doc.upload',
  ],
  surveyor: [
    'deal.view',
    'field.submit',
    'doc.upload', 'doc.verify',
  ],
  elevator: [
    'deal.view',
    'field.submit',
    'doc.upload',
  ],
  lab: [
    'deal.view',
    'field.submit',
    'doc.upload', 'doc.verify',
  ],
  bank: [
    'deal.view',
    'release.approve',
    'doc.verify',
    'audit.view',
  ],
  compliance: [
    'deal.view',
    'doc.verify',
    'audit.view',
  ],
  admin: [
    'deal.view', 'deal.edit',
    'release.request', 'release.approve',
    'doc.upload', 'doc.verify',
    'dispute.open', 'dispute.resolve',
    'field.submit',
    'audit.view',
  ],
  arbitrator: [
    'deal.view',
    'dispute.resolve',
    'doc.verify',
    'audit.view',
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return matrix[role]?.includes(permission) ?? false;
}

export function getPermissions(role: Role): Permission[] {
  return matrix[role] ?? [];
}

export const roleLabels: Record<Role, string> = {
  operator: 'Оператор',
  buyer: 'Покупатель',
  seller: 'Продавец',
  driver: 'Водитель',
  surveyor: 'Сюрвейер',
  elevator: 'Элеватор',
  lab: 'Лаборант',
  bank: 'Банк',
  compliance: 'Комплаенс',
  admin: 'Администратор',
  arbitrator: 'Арбитражный управляющий',
};

/** Nav items visible per role */
export type NavItem = {
  href: string;
  label: string;
  icon: string;
  requiredPermission?: Permission;
};

const allNavItems: NavItem[] = [
  { href: '/platform-v9/control-tower', label: 'Control Tower', icon: 'LayoutDashboard' },
  { href: '/platform-v9/deals', label: 'Сделки', icon: 'FileText', requiredPermission: 'deal.view' },
  { href: '/platform-v9/buyer', label: 'Покупатель', icon: 'ShoppingCart', requiredPermission: 'release.approve' },
  { href: '/platform-v9/seller', label: 'Продавец', icon: 'Wheat' },
  { href: '/platform-v9/bank', label: 'Банк', icon: 'Landmark', requiredPermission: 'release.approve' },
  { href: '/platform-v9/disputes', label: 'Споры', icon: 'Scale', requiredPermission: 'dispute.open' },
  { href: '/platform-v9/field', label: 'Поле', icon: 'MapPin', requiredPermission: 'field.submit' },
  { href: '/platform-v9/compliance', label: 'Комплаенс', icon: 'Shield', requiredPermission: 'audit.view' },
  { href: '/platform-v9/admin', label: 'Администрирование', icon: 'Settings' },
];

export function getNavItems(role: Role): NavItem[] {
  if (role === 'admin') return allNavItems;
  return allNavItems.filter(item =>
    !item.requiredPermission || hasPermission(role, item.requiredPermission)
  );
}
