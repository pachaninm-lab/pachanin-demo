// Cabinet-level RBAC: какие кабинеты доступны активной роли.
//
// Дополняет action-level RBAC (access-control.ts, применяется в рантайме к
// операциям) гейтингом на уровне маршрутов-кабинетов. Для controlled pilot
// route access must be strict: participant roles cannot walk through shared
// workspaces such as deals/disputes into another cabinet.

import type { PlatformRole } from '@/stores/usePlatformV7RStore';
import { platformV7RoleCanOpenHref, platformV7RoleRoute } from './shellRoutes';

export const PLATFORM_V7_RBAC_FLAG = 'NEXT_PUBLIC_PLATFORM_V7_RBAC';

// Надзорные роли с доступом ко всем кабинетам (операторский/управленческий просмотр).
const OVERSIGHT_ROLES: ReadonlySet<PlatformRole> = new Set(['operator', 'executive']);

// Маршруты, открытые без выбора роли: главная, открытая карточка, вход, регистрация, демо и вопрос.
const SHARED_PATHS = ['/platform-v7/open', '/platform-v7/login', '/platform-v7/register', '/platform-v7/demo', '/platform-v7/contact'];

// Внутренний контур поддержки. `support` — это внутренняя роль поддержки, а НЕ
// кабинет участника: его открывают только надзорные роли (operator/executive).
// Участники подают/отслеживают обращения через action-level `support.create_case`
// (см. action-permission-boundary.ts), а не через вход в этот кабинет. `support`
// не входит в перечень PlatformRole и не выбирается как кабинет сделки.
const INTERNAL_OVERSIGHT_ROUTES = ['/platform-v7/support'];

// Non-core маршрут. `investor` НЕ является исполнительной ролью platform-v7 — это
// read-only агрегатный режим, доступный только надзорным ролям. Он не входит в
// перечень PlatformRole, не является кабинетом сделки и никогда не добавляется как
// полноценная роль сделки. Маршрут остаётся зарегистрированным (надзорный обзор),
// но классифицирован как non-core и закрыт для участников.
const NON_CORE_OVERSIGHT_ROUTES = ['/platform-v7/investor'];

export function platformV7RbacEnforced(): boolean {
  // Controlled pilot now requires strict route boundaries by default. The old
  // pilot-open mode allowed participants to enter shared cross-role surfaces.
  return true;
}

function normalize(pathname: string): string {
  return pathname.split('?')[0].replace(/\/$/, '') || '/platform-v7';
}

function matchesPath(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function isSharedPath(pathname: string): boolean {
  const clean = normalize(pathname);
  if (clean === '/platform-v7') return true;
  return SHARED_PATHS.some((p) => matchesPath(clean, p));
}

// Внутренний контур поддержки (support) — оверсайт-онли.
export function isPlatformV7InternalRoute(pathname: string): boolean {
  const clean = normalize(pathname);
  return INTERNAL_OVERSIGHT_ROUTES.some((route) => matchesPath(clean, route));
}

// Non-core маршрут (investor) — оверсайт-онли, не исполнительная роль.
export function isPlatformV7NonCoreRoute(pathname: string): boolean {
  const clean = normalize(pathname);
  return NON_CORE_OVERSIGHT_ROUTES.some((route) => matchesPath(clean, route));
}

export function canRoleAccessCabinet(role: PlatformRole, pathname: string): boolean {
  const clean = normalize(pathname);
  if (!clean.startsWith('/platform-v7')) return true;
  if (isSharedPath(clean)) return true;
  if (OVERSIGHT_ROLES.has(role)) return true;
  // support (внутренний) и investor (non-core) — только надзорные роли. Явный
  // запрет для участников, без неявного провала сквозь allowedPrefixes.
  if (isPlatformV7InternalRoute(clean) || isPlatformV7NonCoreRoute(clean)) return false;
  return platformV7RoleCanOpenHref(role, clean);
}

export interface CabinetAccessDecision {
  readonly allowed: boolean;
  readonly enforced: boolean;
  readonly redirectTo: string | null;
  readonly reason: string;
}

export function cabinetAccessDecision(
  role: PlatformRole,
  pathname: string,
): CabinetAccessDecision {
  const enforced = platformV7RbacEnforced();
  const clean = normalize(pathname);
  if (canRoleAccessCabinet(role, clean)) {
    return { allowed: true, enforced, redirectTo: null, reason: `Роль «${role}» имеет доступ к маршруту.` };
  }
  return {
    allowed: false,
    enforced,
    redirectTo: platformV7RoleRoute(role) ?? '/platform-v7/login',
    reason: `Роль «${role}» не имеет доступа к ${clean}; возврат в свой кабинет.`,
  };
}
