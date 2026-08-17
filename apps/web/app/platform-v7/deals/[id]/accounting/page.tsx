import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ACCESS_COOKIE } from '@/lib/auth-cookies';
import { DealAccountingClient } from './DealAccountingClient';
import styles from '../../../accounting/accounting.module.css';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Бухгалтерия сделки — Прозрачная Цена',
  robots: { index: false, follow: false, nocache: true },
};

/**
 * What the platform would put in a document for this deal, and what is missing
 * if it cannot.
 *
 * The missing-sources list is the point: a screen that only says "нельзя"
 * leaves somebody guessing which of nine sources to chase.
 */
export default async function DealAccountingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cookieStore = await cookies();
  if (!cookieStore.get(ACCESS_COOKIE)?.value) {
    redirect(
      `/platform-v7/login?next=${encodeURIComponent(`/platform-v7/deals/${id}/accounting`)}`,
    );
  }

  return (
    <main className={styles.page} aria-labelledby="deal-accounting-heading">
      <h1 id="deal-accounting-heading">Бухгалтерия сделки</h1>
      <DealAccountingClient dealId={id} />
    </main>
  );
}
