import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { CommodityProfileRegistryClient } from '@/components/crop-platform/CommodityProfileRegistryClient';
import { ACCESS_COOKIE, CSRF_COOKIE } from '@/lib/auth-cookies';
import styles from '../commodity-profiles.module.css';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Товарный профиль — Прозрачная Цена',
  robots: { index: false, follow: false, nocache: true },
};

export default async function CommodityProfilePage({
  params,
}: Readonly<{ params: Promise<{ profileId: string }> }>) {
  const { profileId } = await params;
  const cookieStore = await cookies();
  if (!cookieStore.get(ACCESS_COOKIE)?.value) {
    const next = encodeURIComponent(`/platform-v7/commodity-profiles/${profileId}`);
    redirect(`/platform-v7/login?next=${next}`);
  }

  return (
    <main
      className={styles.page}
      data-testid='commodity-profile-detail-page'
      data-authority='postgresql-private-bff'
      data-static-authority-fallback='false'
      data-profile-id={profileId}
    >
      <CommodityProfileRegistryClient
        locale={await getLocale()}
        csrfToken={cookieStore.get(CSRF_COOKIE)?.value || ''}
        initialProfileId={profileId}
      />
    </main>
  );
}
