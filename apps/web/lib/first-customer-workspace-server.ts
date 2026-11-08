import { getAuthProfile, type AuthProfileSnapshot } from './auth-profile-server';
import { getOrganizationTeam, type OrganizationTeamSnapshot } from './organization-team-server';
import { getVerifiedOwnerControlledCabinet } from './platform-v7/owner-controlled-cabinet-server';
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
  ownerControlled: boolean;
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

const OWNER_CONTROLLED_NEXT: Readonly<Record<FirstCustomerSurface, string>> = {
  seller: '/platform-v7/seller/lots',
  buyer: '/platform-v7/buyer/lots',
  logistics: '/platform-v7/logistics',
  driver: '/platform-v7/driver/field',
  elevator: '/platform-v7/elevator',
  lab: '/platform-v7/lab',
  surveyor: '/platform-v7/surveyor',
  bank: '/platform-v7/bank',
};

export function firstCustomerWorkspaceRequired(env: NodeJS.ProcessEnv = process.env): boolean {
  if (String(env.NODE_ENV || '').toLowerCase() === 'production') return true;
  return String(env.P0_ALLOW_LEGACY_ROLE_DEMO || '').toLowerCase() !== 'true';
}

function controlledProfile(
  surface: FirstCustomerSurface,
  owner: NonNullable<Awaited<ReturnType<typeof getVerifiedOwnerControlledCabinet>>>,
): AuthProfileSnapshot {
  const membershipId = `owner-controlled-${surface}`;
  return Object.freeze({
    available: true,
    id: owner.ownerId,
    email: owner.ownerEmail,
    role: owner.apiRole,
    surfaceRole: surface,
    orgId: owner.organizationId,
    tenantId: owner.tenantId,
    membershipId,
    isOrgAdmin: false,
    fullName: 'Владелец платформы',
    mfaVerified: true,
    mfaVerifiedAt: new Date().toISOString(),
  });
}

function controlledOrganization(
  surface: FirstCustomerSurface,
  owner: NonNullable<Awaited<ReturnType<typeof getVerifiedOwnerControlledCabinet>>>,
): OrganizationTeamSnapshot {
  return Object.freeze({
    available: true,
    organizationId: owner.organizationId,
    tenantId: owner.tenantId,
    currentMembershipId: `owner-controlled-${surface}`,
    organizationName: owner.organizationName,
    currentRole: owner.apiRole,
    isOrganizationAdmin: false,
    hasFreshMfa: true,
    members: Object.freeze([]),
  });
}

async function getOwnerControlledWorkspace(surface: FirstCustomerSurface): Promise<FirstCustomerWorkspaceSnapshot | null> {
  const owner = await getVerifiedOwnerControlledCabinet(surface);
  if (!owner) return null;

  return Object.freeze({
    available: true,
    forbidden: false,
    ownerControlled: true,
    correlationId: null,
    profile: controlledProfile(surface, owner),
    organization: controlledOrganization(surface, owner),
    items: Object.freeze([Object.freeze({
      id: `OWNER-${surface.toUpperCase()}-CONTROLLED`,
      dealId: null,
      status: 'CONTROLLED_TEST',
      nextAction: 'Открыть полный рабочий раздел кабинета. Боевые записи не изменяются.',
      href: OWNER_CONTROLLED_NEXT[surface],
    })]),
  });
}

export async function getFirstCustomerWorkspace(
  surface: FirstCustomerSurface,
): Promise<FirstCustomerWorkspaceSnapshot> {
  // A PLATFORM_OWNER cabinet session is a presentation/read-only context bound
  // to a fixed controlled organization. Do not query customer queues with the
  // owner's bearer token and do not fabricate a business membership in the API.
  const ownerControlled = await getOwnerControlledWorkspace(surface);
  if (ownerControlled) return ownerControlled;

  const [profile, organization] = await Promise.all([getAuthProfile(), getOrganizationTeam()]);
  if (!profile.available || profile.role !== EXPECTED_API_ROLE[surface]) {
    return Object.freeze({
      available: false,
      forbidden: profile.available,
      ownerControlled: false,
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
        available: false, forbidden: response.status === 403, ownerControlled: false, correlationId,
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
      ownerControlled: false,
      correlationId,
      profile,
      organization,
      items: Object.freeze(items),
    });
  } catch {
    return Object.freeze({
      available: false, forbidden: false, ownerControlled: false, correlationId: null,
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
