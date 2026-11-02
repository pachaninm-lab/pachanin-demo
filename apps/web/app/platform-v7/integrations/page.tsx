import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { isAppLocale } from '@/i18n/locale';
import { IntegrationControlTowerClient } from '@/components/crop-platform/IntegrationControlTowerClient';
import { ACCESS_COOKIE, CSRF_COOKIE } from '@/lib/auth-cookies';
import styles from './integrations.module.css';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Integration Control Tower — Прозрачная Цена',
  robots: { index: false, follow: false, nocache: true },
};

export default async function IntegrationsPage() {
  const cookieStore = await cookies();
  if (!cookieStore.get(ACCESS_COOKIE)?.value) {
    const requestHeaders = await headers();
    const search = requestHeaders.get('x-pc-search') || '';
    const queryLocale = new URLSearchParams(search).get('lang');
    const target = new URLSearchParams({
      next: `/platform-v7/integrations${search}`,
    });
    if (isAppLocale(queryLocale)) target.set('lang', queryLocale);
    redirect(`/platform-v7/login?${target.toString()}`);
  }
  return (
    <main
      className={styles.page}
      data-testid='integration-control-tower-page'
      data-authority='postgresql-private-bff'
      data-static-authority-fallback='false'
    >
      <IntegrationControlTowerClient
        locale={await getLocale()}
        csrfToken={cookieStore.get(CSRF_COOKIE)?.value || ''}
      />
    </main>
  );
}
