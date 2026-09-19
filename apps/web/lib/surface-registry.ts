import { SURFACE_ROLE_KEYS, type SurfaceRoleKey, toSurfaceRole } from '../../../shared/role-contract';

export type RunMode = 'demo' | 'pilot' | 'live' | 'internal';
export type RoleKey = SurfaceRoleKey;
export type SurfaceAudience = 'product' | 'operator' | 'internal';
export type SurfaceGroup = 'main' | 'market' | 'control' | 'service';
export type SurfaceWeight = 'primary' | 'secondary' | 'utility';

export type SurfaceDefinition = {
  href: string;
  label: string;
  icon?: string;
  audience: SurfaceAudience;
  group: SurfaceGroup;
  roles: RoleKey[];
  priority: number;
  weight?: SurfaceWeight;
  hideFromSidebar?: boolean;
  internalPreviewOnly?: boolean;
  allowedRunModes?: RunMode[];
};

export const ROLE_LABELS: Record<RoleKey, string> = {
  GUEST: 'Гость',
  FARMER: 'Фермер / продавец',
  BUYER: 'Покупатель',
  LOGISTICIAN: 'Логист',
  DRIVER: 'Водитель',
  LAB: 'Лаборатория',
  ELEVATOR: 'Приёмка / элеватор',
  ACCOUNTING: 'Бухгалтерия',
  EXECUTIVE: 'Руководитель',
  SUPPORT_MANAGER: 'Оператор',
  ADMIN: 'Администратор',
};

export const ROLE_INITIALS: Record<RoleKey, string> = {
  GUEST: 'Г', FARMER: 'Ф', BUYER: 'П', LOGISTICIAN: 'Л', DRIVER: 'В', LAB: 'ЛБ', ELEVATOR: 'Э', ACCOUNTING: 'Б', EXECUTIVE: 'Р', SUPPORT_MANAGER: 'ОП', ADMIN: 'АД',
};

const ALL_PRODUCT_ROLES: RoleKey[] = SURFACE_ROLE_KEYS.filter((role) => role !== 'GUEST') as RoleKey[];
const OPS_ONLY: RoleKey[] = ['SUPPORT_MANAGER', 'ADMIN'];
const EXEC_ONLY: RoleKey[] = ['EXECUTIVE', 'ADMIN'];

export const SURFACES: SurfaceDefinition[] = [
  { href: '/', label: 'Старт', icon: '◌', audience: 'product', group: 'main', roles: ['GUEST'], priority: 1, weight: 'primary' },
  { href: '/cabinet', label: 'Роли и кабинеты', icon: '▣', audience: 'product', group: 'main', roles: ['GUEST', ...ALL_PRODUCT_ROLES], priority: 10, weight: 'primary' },
  { href: '/login', label: 'Вход', icon: '→', audience: 'product', group: 'main', roles: ['GUEST'], priority: 20, weight: 'secondary' },
  { href: '/register', label: 'Регистрация', icon: '+', audience: 'product', group: 'service', roles: ['GUEST'], priority: 30, weight: 'utility' },
  { href: '/vitrina', label: 'Публичная витрина', icon: '◌', audience: 'product', group: 'market', roles: ['GUEST'], priority: 40, weight: 'secondary' },

  { href: '/lots', label: 'Лоты и торги', icon: '◌', audience: 'product', group: 'main', roles: ['FARMER', 'BUYER', 'SUPPORT_MANAGER', 'ADMIN'], priority: 60, weight: 'primary' },
  { href: '/create-lot', label: 'Создать лот', icon: '+', audience: 'product', group: 'main', roles: ['FARMER', 'SUPPORT_MANAGER', 'ADMIN'], priority: 65, weight: 'secondary' },
  { href: '/auctions', label: 'Аукционы', icon: '◔', audience: 'product', group: 'market', roles: ['FARMER', 'BUYER', 'SUPPORT_MANAGER', 'ADMIN'], priority: 70, weight: 'secondary' },
  { href: '/market-center', label: 'Цены и netback', icon: '₿', audience: 'product', group: 'market', roles: ['FARMER', 'BUYER', 'EXECUTIVE', 'SUPPORT_MANAGER', 'ADMIN'], priority: 80, weight: 'secondary' },
  { href: '/deals', label: 'Сделки', icon: '≣', audience: 'product', group: 'main', roles: ALL_PRODUCT_ROLES, priority: 90, weight: 'primary' },
  { href: '/documents', label: 'Документы', icon: '⌁', audience: 'product', group: 'service', roles: ['FARMER', 'BUYER', 'LOGISTICIAN', 'LAB', 'ELEVATOR', 'ACCOUNTING', 'SUPPORT_MANAGER', 'ADMIN'], priority: 100, weight: 'secondary' },
  { href: '/payments', label: 'Выплаты и расчёты', icon: '₽', audience: 'product', group: 'service', roles: ['BUYER', 'ACCOUNTING', 'EXECUTIVE', 'SUPPORT_MANAGER', 'ADMIN'], priority: 110, weight: 'primary' },
  { href: '/logistics', label: 'Логистика', icon: '→', audience: 'product', group: 'main', roles: ['LOGISTICIAN', 'SUPPORT_MANAGER', 'ADMIN', 'BUYER', 'FARMER'], priority: 120, weight: 'primary' },
  { href: '/dispatch', label: 'Dispatch', icon: '⇄', audience: 'operator', group: 'control', roles: ['LOGISTICIAN', 'SUPPORT_MANAGER', 'ADMIN'], priority: 130, weight: 'primary' },
  { href: '/receiving', label: 'Приёмка', icon: '◫', audience: 'product', group: 'main', roles: ['ELEVATOR', 'LOGISTICIAN', 'SUPPORT_MANAGER', 'ADMIN'], priority: 140, weight: 'primary' },
  { href: '/lab', label: 'Лаборатория', icon: '∴', audience: 'product', group: 'service', roles: ['LAB', 'ELEVATOR', 'SUPPORT_MANAGER', 'ADMIN'], priority: 150, weight: 'primary' },
  { href: '/support', label: 'Support', icon: '!', audience: 'operator', group: 'control', roles: OPS_ONLY, priority: 160, weight: 'secondary' },
  { href: '/operator-cockpit', label: 'Operator cockpit', icon: '⌘', audience: 'operator', group: 'control', roles: OPS_ONLY, priority: 170, weight: 'primary' },
  { href: '/anti-fraud', label: 'Anti-fraud', icon: '⛶', audience: 'internal', group: 'control', roles: OPS_ONLY, priority: 180, weight: 'secondary', internalPreviewOnly: true },
  { href: '/audit', label: 'Audit', icon: '≡', audience: 'internal', group: 'control', roles: OPS_ONLY, priority: 190, weight: 'secondary', internalPreviewOnly: true },
  { href: '/execution-studio', label: 'Execution studio', icon: '⋯', audience: 'operator', group: 'control', roles: OPS_ONLY, priority: 200, weight: 'secondary' },
  { href: '/deal-console', label: 'Deal desk', icon: '◫', audience: 'operator', group: 'control', roles: ['LOGISTICIAN', 'ACCOUNTING', 'SUPPORT_MANAGER', 'ADMIN', 'BUYER', 'FARMER'], priority: 210, weight: 'secondary' },
  { href: '/finance', label: 'Финансы', icon: '₽', audience: 'product', group: 'service', roles: ['ACCOUNTING', 'EXECUTIVE', 'SUPPORT_MANAGER', 'ADMIN'], priority: 220, weight: 'secondary' },
  { href: '/companies', label: 'Компании', icon: '⌂', audience: 'product', group: 'service', roles: ['SUPPORT_MANAGER', 'ADMIN', 'EXECUTIVE'], priority: 230, weight: 'secondary' },
  { href: '/service-providers', label: 'Провайдеры', icon: '☷', audience: 'operator', group: 'service', roles: OPS_ONLY, priority: 240, weight: 'secondary' },
  { href: '/driver-mobile', label: 'Режим водителя', icon: '📱', audience: 'product', group: 'main', roles: ['DRIVER', 'SUPPORT_MANAGER', 'ADMIN'], priority: 250, weight: 'primary' },
  { href: '/field-mobile', label: 'Поле', icon: '⌂', audience: 'product', group: 'main', roles: ['FARMER', 'DRIVER', 'SUPPORT_MANAGER', 'ADMIN'], priority: 260, weight: 'secondary' },
  { href: '/railway', label: 'Railway', icon: '≋', audience: 'operator', group: 'service', roles: ['LOGISTICIAN', 'SUPPORT_MANAGER', 'ADMIN'], priority: 270, weight: 'secondary' },
  { href: '/sber', label: 'Sber', icon: '₽', audience: 'internal', group: 'service', roles: ['ACCOUNTING', 'EXECUTIVE', 'SUPPORT_MANAGER', 'ADMIN'], priority: 280, weight: 'secondary', internalPreviewOnly: true },
  { href: '/readiness-center', label: 'Readiness center', icon: '◔', audience: 'internal', group: 'control', roles: OPS_ONLY, priority: 290, weight: 'secondary', internalPreviewOnly: true },
  { href: '/runtime-ops', label: 'Runtime ops', icon: '∎', audience: 'internal', group: 'control', roles: OPS_ONLY, priority: 300, weight: 'secondary', internalPreviewOnly: true },
  { href: '/connectors', label: 'Коннекторы', icon: '⤳', audience: 'internal', group: 'service', roles: OPS_ONLY, priority: 310, weight: 'secondary', internalPreviewOnly: true },
  { href: '/notifications', label: 'Уведомления', icon: '✦', audience: 'product', group: 'service', roles: ALL_PRODUCT_ROLES, priority: 320, weight: 'utility' },
  { href: '/assistant', label: 'Помощник', icon: '✦', audience: 'product', group: 'service', roles: ALL_PRODUCT_ROLES, priority: 330, weight: 'secondary' },
  { href: '/liquidity-layer', label: 'Ликвидность', icon: '≈', audience: 'product', group: 'market', roles: ['FARMER', 'BUYER', 'EXECUTIVE', 'SUPPORT_MANAGER', 'ADMIN'], priority: 340, weight: 'secondary' },
  { href: '/knowledge', label: 'Knowledge', icon: '⌁', audience: 'operator', group: 'service', roles: OPS_ONLY, priority: 350, weight: 'secondary' },
  { href: '/survey', label: 'Survey', icon: '□', audience: 'operator', group: 'service', roles: OPS_ONLY, priority: 360, weight: 'secondary' },
  { href: '/insurance', label: 'Страхование', icon: '◍', audience: 'product', group: 'service', roles: ['BUYER', 'EXECUTIVE', 'SUPPORT_MANAGER', 'ADMIN'], priority: 370, weight: 'secondary' },
  { href: '/inventory', label: 'Инвентарь', icon: '□', audience: 'operator', group: 'service', roles: ['ELEVATOR', 'SUPPORT_MANAGER', 'ADMIN'], priority: 380, weight: 'secondary' },
  { href: '/weighbridge', label: 'Весовая', icon: '⚖', audience: 'operator', group: 'service', roles: ['ELEVATOR', 'SUPPORT_MANAGER', 'ADMIN'], priority: 390, weight: 'secondary' },
  { href: '/market-news', label: 'Новости рынка', icon: '✦', audience: 'product', group: 'market', roles: ALL_PRODUCT_ROLES, priority: 400, weight: 'utility' },
  { href: '/pilot-mode', label: 'Pilot mode', icon: '⊙', audience: 'internal', group: 'control', roles: OPS_ONLY, priority: 410, weight: 'utility', internalPreviewOnly: true },
  { href: '/roles', label: 'Роли', icon: '▣', audience: 'internal', group: 'service', roles: OPS_ONLY, priority: 420, weight: 'utility', internalPreviewOnly: true },
  { href: '/trust-center', label: 'Trust center', icon: '◔', audience: 'internal', group: 'control', roles: OPS_ONLY, priority: 430, weight: 'utility', internalPreviewOnly: true },
  { href: '/uat', label: 'UAT', icon: '✓', audience: 'internal', group: 'control', roles: OPS_ONLY, priority: 440, weight: 'utility', internalPreviewOnly: true },
];

export function resolveClientRunMode(): RunMode {
  const raw = String(process.env.NEXT_PUBLIC_RUN_MODE || process.env.NEXT_PUBLIC_APP_MODE || 'demo').toLowerCase();
  if (raw === 'pilot') return 'pilot';
  if (raw === 'live' || raw === 'prod' || raw === 'production') return 'live';
  if (raw === 'internal') return 'internal';
  return 'demo';
}

export function normalizeSurfaceRole(role: string | null | undefined): RoleKey {
  return toSurfaceRole(role || 'GUEST') as RoleKey;
}

export function isSurfaceAllowedForRunMode(surface: SurfaceDefinition, runMode: RunMode) {
  return !surface.allowedRunModes || surface.allowedRunModes.includes(runMode);
}

export function getVisibleSurfaces(role: RoleKey, options?: { includeInternalPreview?: boolean }) {
  const runMode = resolveClientRunMode();
  return SURFACES
    .filter((surface) => surface.roles.includes(role))
    .filter((surface) => isSurfaceAllowedForRunMode(surface, runMode))
    .filter((surface) => options?.includeInternalPreview || !surface.internalPreviewOnly)
    .sort((a, b) => a.priority - b.priority);
}

export function getNavigationGroups(role: RoleKey, options?: { includeInternalPreview?: boolean }) {
  const titleByGroup: Record<SurfaceGroup, string> = { main: 'Основное', market: 'Рынок', control: 'Контроль', service: 'Сервисы' };
  const visible = getVisibleSurfaces(role, options).filter((surface) => !surface.hideFromSidebar);
  return (['main', 'market', 'control', 'service'] as SurfaceGroup[])
    .map((group) => ({ title: titleByGroup[group], items: visible.filter((item) => item.group === group) }))
    .filter((group) => group.items.length > 0);
}

export function getRoleLandingSurface(role: RoleKey) {
  const visible = getVisibleSurfaces(role);
  return visible.find((item) => item.weight === 'primary') || visible[0] || SURFACES[0];
}

export function getSurfaceByPath(pathname: string) {
  return SURFACES
    .filter((item) => pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0] || null;
}

export function isSurfaceActive(pathname: string, href: string) {
  return pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
}

export function isInternalSurface(pathname: string) {
  return getSurfaceByPath(pathname)?.audience === 'internal';
}

export function isOperatorSurface(pathname: string) {
  return getSurfaceByPath(pathname)?.audience === 'operator';
}
