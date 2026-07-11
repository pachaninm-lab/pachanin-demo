import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { StaffControlCenter } from '@/components/platform-v7/staff/StaffControlCenter';
import { StaffOperationalWorkspaces } from '@/components/platform-v7/staff/StaffOperationalWorkspaces';
import { StaffPlatformShell } from '@/components/platform-v7/staff/StaffPlatformShell';
import { ACCESS_COOKIE } from '@/lib/auth-cookies';
import { DEFAULT_LOCALE, isAppLocale, LOCALE_COOKIE, type AppLocale } from '@/i18n/locale';
import { staffControlCenterMessages } from '@/i18n/staff-control-center-messages';
import { staffOperationalWorkspaceMessages } from '@/i18n/staff-operational-workspace-messages';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Центр управления доступом — Прозрачная Цена',
  robots: { index: false, follow: false, nocache: true },
};

const API_URL = String(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');

type VerifiedIdentity = {
  id?: string;
  email?: string;
  fullName?: string;
  role?: string;
  organizationId?: string;
  tenantId?: string;
};

function resolveLocale(): AppLocale {
  const headerLocale = headers().get('x-pc-locale');
  if (isAppLocale(headerLocale)) return headerLocale;
  const cookieLocale = cookies().get(LOCALE_COOKIE)?.value;
  return isAppLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;
}

async function verifyIdentity(accessToken: string): Promise<
  | { status: 'verified'; identity: VerifiedIdentity }
  | { status: 'unauthenticated' }
  | { status: 'unavailable' }
> {
  if (!API_URL) return { status: 'unavailable' };
  try {
    const response = await fetch(`${API_URL}/auth/me`, {
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
      <StaffControlCenter
        locale={locale}
        copy={staffControlCenterMessages[locale]}
        identity={verification.status === 'verified' ? verification.identity : null}
        apiAvailable={verification.status === 'verified'}
      />
      {verification.status === 'verified' ? (
        <StaffOperationalWorkspaces locale={locale} copy={staffOperationalWorkspaceMessages[locale]} />
      ) : null}
    </StaffPlatformShell>
  );
}
