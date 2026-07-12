import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { OwnerAccessCenter } from '@/components/platform-v7/staff/OwnerAccessCenter';
import { StaffOperationalWorkspacesDeferred } from '@/components/platform-v7/staff/StaffOperationalWorkspacesDeferred';
import { StaffPlatformShell } from '@/components/platform-v7/staff/StaffPlatformShell';
import { ACCESS_COOKIE } from '@/lib/auth-cookies';
import { verifyHs256Jwt } from '@/lib/platform-v7/verified-session';
import { staffAccessTaskCatalog } from '@/lib/platform-v7/staff-access-task-catalog';
import { DEFAULT_LOCALE, isAppLocale, LOCALE_COOKIE, type AppLocale } from '@/i18n/locale';
import { ownerAccessCenterMessages } from '@/i18n/owner-access-center-messages';
import { staffOperationalWorkspaceMessages } from '@/i18n/staff-operational-workspace-messages';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Доступ владельца — Прозрачная Цена',
  robots: { index: false, follow: false, nocache: true },
};

function readEnv(name: string): string {
  return String(process.env[name] || '').trim();
}

function controlledFixtureEnabled(): boolean {
  if (readEnv('PC_STAFF_TEST_FIXTURE').toLowerCase() !== 'true') return false;
  if (readEnv('PC_CABINET_TEST_ACCESS').toLowerCase() !== 'true') return false;
  const expiresAt = readEnv('PC_CABINET_TEST_ACCESS_EXPIRES_AT');
  if (!expiresAt) return false;
  const expiry = Date.parse(expiresAt);
  return Number.isFinite(expiry) && expiry > Date.now();
}

function controlledSessionSecret(): string {
  return readEnv('JWT_SECRET') || readEnv('PC_CABINET_SESSION_SECRET');
}

function resolveApiOrigin(): string {
  const configured = String(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '').trim();
  if (!configured) return '';
  try {
    const url = new URL(configured);
    if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') return '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

const API_ORIGIN = resolveApiOrigin();

type VerifiedIdentity = {
  id?: string;
  email?: string;
  fullName?: string;
  role?: string;
  organizationId?: string;
  tenantId?: string;
  staffOwner?: boolean;
};

type Verification =
  | { status: 'verified'; identity: VerifiedIdentity }
  | { status: 'unauthenticated' }
  | { status: 'unavailable' };

async function verifyControlledIdentity(accessToken: string): Promise<Verification | null> {
  if (!controlledFixtureEnabled()) return null;
  const secret = controlledSessionSecret();
  if (!secret) return { status: 'unavailable' };

  const claims = await verifyHs256Jwt(accessToken, secret);
  const expiresAt = typeof claims?.exp === 'number' ? claims.exp : 0;
  if (!claims || claims.testAccess !== true) return null;
  if (
    expiresAt <= Math.floor(Date.now() / 1000)
    || typeof claims.sub !== 'string'
    || typeof claims.email !== 'string'
    || typeof claims.role !== 'string'
  ) {
    return { status: 'unauthenticated' };
  }

  const owner = claims.owner === true;
  return {
    status: 'verified',
    identity: {
      id: claims.sub,
      email: claims.email,
      fullName: typeof claims.fullName === 'string'
        ? claims.fullName
        : owner ? 'Максим — владелец платформы' : 'Тестовый пользователь',
      role: owner ? 'ADMIN' : claims.role,
      organizationId: typeof claims.organizationId === 'string'
        ? claims.organizationId
        : 'org-canonical-platform',
      tenantId: typeof claims.tenantId === 'string'
        ? claims.tenantId
        : 'tenant-canonical-test',
      staffOwner: owner,
    },
  };
}

function resolveLocale(): AppLocale {
  const headerLocale = headers().get('x-pc-locale');
  if (isAppLocale(headerLocale)) return headerLocale;
  const cookieLocale = cookies().get(LOCALE_COOKIE)?.value;
  return isAppLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;
}

async function verifyIdentity(accessToken: string): Promise<Verification> {
  const controlled = await verifyControlledIdentity(accessToken);
  if (controlled) return controlled;
  if (!API_ORIGIN) return { status: 'unavailable' };
  try {
    const response = await fetch(`${API_ORIGIN}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(6_000),
    });
    if (response.status === 401 || response.status === 403) return { status: 'unauthenticated' };
    if (response.status >= 300 && response.status < 400) return { status: 'unavailable' };
    if (!response.ok) return { status: 'unavailable' };
    const identity = await response.json().catch(() => null) as VerifiedIdentity | null;
    if (!identity || typeof identity !== 'object' || typeof identity.id !== 'string') {
      return { status: 'unauthenticated' };
    }
    return { status: 'verified', identity };
  } catch {
    return { status: 'unavailable' };
  }
}

export default async function StaffControlCenterPage() {
  const locale = resolveLocale();
  const accessToken = cookies().get(ACCESS_COOKIE)?.value;
  if (!accessToken) redirect('/platform-v7/login?next=%2Fplatform-v7%2Fstaff');

  const verification = await verifyIdentity(accessToken);
  if (verification.status === 'unauthenticated') {
    redirect('/platform-v7/login?next=%2Fplatform-v7%2Fstaff');
  }

  return (
    <StaffPlatformShell locale={locale}>
      <OwnerAccessCenter
        locale={locale}
        copy={ownerAccessCenterMessages[locale]}
        identity={verification.status === 'verified' ? verification.identity : null}
        apiAvailable={verification.status === 'verified'}
        accessCatalog={staffAccessTaskCatalog()}
      />
      {verification.status === 'verified' ? (
        <StaffOperationalWorkspacesDeferred
          locale={locale}
          copy={staffOperationalWorkspaceMessages[locale]}
        />
      ) : null}
    </StaffPlatformShell>
  );
}
