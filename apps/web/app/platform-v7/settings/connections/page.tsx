import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ACCESS_COOKIE } from '@/lib/auth-cookies';
import { ConnectionCenterClient } from './ConnectionCenterClient';
import styles from './connections.module.css';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Подключения — Прозрачная Цена',
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Organization Connection Center.
 *
 * The page itself owns no connection state. Everything factual comes from the
 * server through the bounded accounting BFF. The protected platform layout
 * verifies the cabinet role/session before this screen reaches the user, while
 * the API remains the authority for organization membership, capability and RLS.
 */
export default async function ConnectionCenterPage() {
  const cookieStore = await cookies();
  if (!cookieStore.get(ACCESS_COOKIE)?.value) {
    redirect(
      '/platform-v7/login?next=%2Fplatform-v7%2Fsettings%2Fconnections',
    );
  }

  return (
    <main className={styles.page} aria-labelledby="connection-center-heading">
      <header className={styles.hero}>
        <p className={styles.kicker}>Настройки организации</p>
        <h1 id="connection-center-heading">Подключения</h1>
        <p className={styles.lead}>
          1С, ЭДО и другие внешние системы — одним понятным списком. Здесь нет
          паролей, токенов и технических настроек по умолчанию: только то, что
          подтверждено сервером, и что требуется дальше.
        </p>
      </header>
      <ConnectionCenterClient />
    </main>
  );
}
