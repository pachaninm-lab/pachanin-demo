import { getAuthProfile, type AuthProfileSnapshot } from './auth-profile-server';
import { getOrganizationTeam, type OrganizationTeamSnapshot } from './organization-team-server';
import { serverApiUrl, serverAuthHeaders } from './server-api';

export type FirstCustomerSurface =
  | 'seller' | 'buyer' | 'logistics' | 'driver'
  | 'elevator' | 'lab' | 'surveyor' | 'bank';

export type FirstCustomerQueueItem = Readonly<{
  id: string;
  dealId: string | null;
  status: string;
  nextAction: string | null;
  href: string | null;
}>;

export type FirstCustomerWorkspaceSnapshot = Readonly<{
  available: boolean;
  forbidden: boolean;
  correlationId: string | null;
  profile: AuthProfileSnapshot;
  organization: OrganizationTeamSnapshot;
  items: readonly FirstCustomerQueueItem[];
}>;

const EXPECTED_API_ROLE: Readonly<Record<FirstCustomerSurface, string>> = {
  seller: 'FARMER', buyer: 'BUYER', logistics: 'LOGISTICIAN', driver: 'DRIVER',
  elevator: 'ELEVATOR', lab: 'LAB', surveyor: 'SURVEYOR', bank: 'ACCOUNTING',
};

const QUEUE_ENDPOINT: Readonly<Record<FirstCustomerSurface, string>> = {
  seller: '/deals', buyer: '/deals', bank: '/deals',
  logistics: '/logistics/shipments', driver: '/logistics/shipments', elevator: '/logistics/shipments',
  lab: '/labs/samples', surveyor: '/labs/samples',
};

export function firstCustomerWorkspaceRequired(env: NodeJS.ProcessEnv = process.env): boolean {
  if (String(env.NODE_ENV || '').toLowerCase() === 'production') return true;
  return String(env.P0_ALLOW_LEGACY_ROLE_DEMO || '').toLowerCase() !== 'true';
}

export async function getFirstCustomerWorkspace(
  surface: FirstCustomerSurface,
): Promise<FirstCustomerWorkspaceSnapshot> {
  const [profile, organization] = await Promise.all([getAuthProfile(), getOrganizationTeam()]);
  if (!profile.available || profile.role !== EXPECTED_API_ROLE[surface]) {
    return Object.freeze({
      available: false,
      forbidden: profile.available,
      correlationId: null,
      profile,
      organization,
      items: Object.freeze([]),
    });
  }

  try {
    const response = await fetch(serverApiUrl(QUEUE_ENDPOINT[surface]), {
      cache: 'no-store',
      headers: await serverAuthHeaders(),
    });
    const correlationId = response.headers.get('x-correlation-id');
    if (!response.ok) {
      return Object.freeze({
        available: false, forbidden: response.status === 403, correlationId,
        profile, organization, items: Object.freeze([]),
      });
    }
    const payload: unknown = await response.json();
    if (!Array.isArray(payload) || payload.length > 100) throw new Error('Invalid workspace queue');
    const items = payload.map((item) => queueItem(item, surface)).filter((item): item is FirstCustomerQueueItem => item !== null);
    if (items.length !== payload.length) throw new Error('Invalid workspace item');
    return Object.freeze({
      available: true,
      forbidden: false,
      correlationId,
      profile,
      organization,
      items: Object.freeze(items),
    });
  } catch {
    return Object.freeze({
      available: false, forbidden: false, correlationId: null,
      profile, organization, items: Object.freeze([]),
    });
  }
}

function queueItem(value: unknown, surface: FirstCustomerSurface): FirstCustomerQueueItem | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const id = text(item.id, 200);
  const dealId = surface === 'seller' || surface === 'buyer' || surface === 'bank'
    ? id
    : text(item.dealId, 200);
  const status = text(item.status, 100);
  if (!id || !dealId || !status) return null;
  const blockers = Array.isArray(item.blockers)
    ? item.blockers.map((entry) => text(entry, 500)).filter(Boolean)
    : [];
  const nextAction = text(item.nextAction, 500) || blockers[0] || null;
  return Object.freeze({
    id,
    dealId,
    status,
    nextAction,
    href: dealId ? `/platform-v7/deals/${encodeURIComponent(dealId)}/execution` : null,
  });
}

function text(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const normalized = String(value).replace(/[\u0000-\u001F\u007F]/g, ' ').trim();
  return normalized && normalized.length <= maxLength ? normalized : null;
}
