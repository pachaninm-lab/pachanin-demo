import { serverApiUrl, serverAuthHeaders } from './server-api';

export type AuthProfileSnapshot = Readonly<{
  available: boolean;
  id: string | null;
  email: string | null;
  role: string | null;
  surfaceRole: string | null;
  orgId: string | null;
  tenantId: string | null;
  membershipId: string | null;
  fullName: string | null;
  mfaVerified: boolean | null;
  mfaVerifiedAt: string | null;
}>;

const UNAVAILABLE: AuthProfileSnapshot = Object.freeze({
  available: false,
  id: null,
  email: null,
  role: null,
  surfaceRole: null,
  orgId: null,
  tenantId: null,
  membershipId: null,
  fullName: null,
  mfaVerified: null,
  mfaVerifiedAt: null,
});

export async function getAuthProfile(): Promise<AuthProfileSnapshot> {
  try {
    const response = await fetch(serverApiUrl('/auth/me'), {
      cache: 'no-store',
      headers: serverAuthHeaders(),
    });
    if (!response.ok) return UNAVAILABLE;
    return parseProfile(await response.json());
  } catch {
    return UNAVAILABLE;
  }
}

function parseProfile(value: unknown): AuthProfileSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return UNAVAILABLE;
  const record = value as Record<string, unknown>;
  const id = requiredText(record.id);
  const role = requiredText(record.role);
  const orgId = requiredText(record.orgId);
  const tenantId = requiredText(record.tenantId);
  const membershipId = requiredText(record.membershipId);
  if (!id || !role || !orgId || !tenantId || !membershipId) return UNAVAILABLE;

  const mfaVerified = optionalBoolean(record.mfaVerified);
  if (record.mfaVerified !== null && record.mfaVerified !== undefined && mfaVerified === null) return UNAVAILABLE;

  const mfaVerifiedAt = optionalDate(record.mfaVerifiedAt);
  if (record.mfaVerifiedAt !== null && record.mfaVerifiedAt !== undefined && record.mfaVerifiedAt !== '' && !mfaVerifiedAt) {
    return UNAVAILABLE;
  }

  return Object.freeze({
    available: true,
    id,
    email: optionalText(record.email),
    role,
    surfaceRole: optionalText(record.surfaceRole),
    orgId,
    tenantId,
    membershipId,
    fullName: optionalText(record.fullName),
    mfaVerified,
    mfaVerifiedAt,
  });
}

function requiredText(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function optionalText(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return requiredText(value);
}

function optionalBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'boolean' ? value : null;
}

function optionalDate(value: unknown): string | null {
  const normalized = optionalText(value);
  if (!normalized) return null;
  return Number.isNaN(Date.parse(normalized)) ? null : normalized;
}
