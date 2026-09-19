import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
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
    redirect('/platform-v7/login?next=%2Fplatform-v7%2Fintegrations');
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
