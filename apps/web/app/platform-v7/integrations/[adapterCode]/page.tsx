import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { IntegrationControlTowerClient } from '@/components/crop-platform/IntegrationControlTowerClient';
import { ACCESS_COOKIE, CSRF_COOKIE } from '@/lib/auth-cookies';
import styles from '../integrations.module.css';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Интеграция — Прозрачная Цена',
  robots: { index: false, follow: false, nocache: true },
};

const SAFE_ADAPTER_CODE = /^[A-Za-z0-9][A-Za-z0-9_.-]{1,63}$/;

export default async function IntegrationDetailPage({
  params,
}: Readonly<{ params: Promise<{ adapterCode: string }> }>) {
  const { adapterCode } = await params;
  if (!SAFE_ADAPTER_CODE.test(adapterCode)) notFound();
  const cookieStore = await cookies();
  if (!cookieStore.get(ACCESS_COOKIE)?.value) {
    redirect(`/platform-v7/login?next=${encodeURIComponent(`/platform-v7/integrations/${adapterCode}`)}`);
  }
  return (
    <main
      className={styles.page}
      data-testid='integration-control-tower-detail-page'
      data-authority='postgresql-private-bff'
      data-static-authority-fallback='false'
    >
      <IntegrationControlTowerClient
        locale={await getLocale()}
        csrfToken={cookieStore.get(CSRF_COOKIE)?.value || ''}
        initialAdapterCode={adapterCode}
      />
    </main>
  );
}
