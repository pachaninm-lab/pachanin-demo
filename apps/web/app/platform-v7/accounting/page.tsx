import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ACCESS_COOKIE } from '@/lib/auth-cookies';
import { AccountingTaskBoardClient } from './AccountingTaskBoardClient';
import styles from './accounting.module.css';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Бухгалтерия — Прозрачная Цена',
  robots: { index: false, follow: false, nocache: true },
};

/**
 * The accounting home.
 *
 * Not a table of everything: a list of what needs doing. Every figure on it is
 * fetched from the server through the BFF, and the page renders nothing of its
 * own invention — there is no seeded example row and no local storage behind it.
 */
export default async function AccountingPage() {
  const cookieStore = await cookies();
  if (!cookieStore.get(ACCESS_COOKIE)?.value) {
    redirect('/platform-v7/login?next=%2Fplatform-v7%2Faccounting');
  }

  return (
    <main className={styles.page} aria-labelledby="accounting-heading">
      <h1 id="accounting-heading">Бухгалтерия</h1>
      <AccountingTaskBoardClient />
    </main>
  );
}
