import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { LiveCommodityProfileRegistry } from '@/components/crop-platform/LiveCommodityProfileRegistry';
import { ACCESS_COOKIE, CSRF_COOKIE } from '@/lib/auth-cookies';
import styles from './commodity-profiles.module.css';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Товарные профили — Прозрачная Цена',
  robots: { index: false, follow: false, nocache: true },
};

export default async function CommodityProfilesPage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  if (!accessToken) {
    redirect('/platform-v7/login?next=%2Fplatform-v7%2Fcommodity-profiles');
  }

  return (
    <main
      className={styles.page}
      data-testid='commodity-profile-registry-page'
      data-authority='postgresql-private-bff'
    >
      <LiveCommodityProfileRegistry
        locale={await getLocale()}
        csrfToken={cookieStore.get(CSRF_COOKIE)?.value || ''}
      />
    </main>
  );
}
