import { serverApiUrl, serverAuthHeaders } from './server-api';

export type OrganizationTeamMember = Readonly<{
  membershipId: string;
  userId: string;
  fullName: string;
  email: string;
  role: string;
  userStatus: string;
  isDefault: boolean;
  joinedAt: string;
  current: boolean;
}>;

export type OrganizationTeamSnapshot = Readonly<{
  available: boolean;
  organizationId: string | null;
  tenantId: string | null;
  currentMembershipId: string | null;
  members: readonly OrganizationTeamMember[];
}>;

const UNAVAILABLE: OrganizationTeamSnapshot = Object.freeze({
  available: false,
  organizationId: null,
  tenantId: null,
  currentMembershipId: null,
  members: Object.freeze([]),
});

export async function getOrganizationTeam(): Promise<OrganizationTeamSnapshot> {
  try {
    const response = await fetch(serverApiUrl('/auth/organization-team'), {
      cache: 'no-store',
      headers: await serverAuthHeaders(),
    });
    if (!response.ok) return UNAVAILABLE;
    return parseSnapshot(await response.json());
  } catch {
    return UNAVAILABLE;
  }
}

function parseSnapshot(value: unknown): OrganizationTeamSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return UNAVAILABLE;
  const record = value as Record<string, unknown>;
  const organizationId = requiredText(record.organizationId);
  const tenantId = requiredText(record.tenantId);
  const currentMembershipId = requiredText(record.currentMembershipId);
  if (!organizationId || !tenantId || !currentMembershipId || !Array.isArray(record.members) || record.members.length > 100) return UNAVAILABLE;

  const members: OrganizationTeamMember[] = [];
  for (const item of record.members) {
    const member = parseMember(item, currentMembershipId);
    if (!member) return UNAVAILABLE;
    members.push(member);
  }
  if (!members.some((member) => member.membershipId === currentMembershipId && member.current)) return UNAVAILABLE;

  return Object.freeze({ available: true, organizationId, tenantId, currentMembershipId, members: Object.freeze(members) });
}

function parseMember(value: unknown, currentMembershipId: string): OrganizationTeamMember | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const membershipId = requiredText(record.membershipId);
  const userId = requiredText(record.userId);
  const fullName = requiredText(record.fullName);
  const email = requiredText(record.email);
  const role = requiredText(record.role);
  const userStatus = requiredText(record.userStatus);
  const joinedAt = requiredDate(record.joinedAt);
  if (!membershipId || !userId || !fullName || !email || !role || !userStatus || !joinedAt) return null;
  if (typeof record.isDefault !== 'boolean' || typeof record.current !== 'boolean') return null;
  if (record.current !== (membershipId === currentMembershipId)) return null;
  return Object.freeze({ membershipId, userId, fullName, email, role, userStatus, isDefault: record.isDefault, joinedAt, current: record.current });
}

function requiredText(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function requiredDate(value: unknown): string | null {
  const normalized = requiredText(value);
  if (!normalized || Number.isNaN(Date.parse(normalized))) return null;
  return normalized;
}
