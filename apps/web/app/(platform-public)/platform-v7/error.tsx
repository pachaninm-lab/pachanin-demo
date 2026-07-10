'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import styles from './public-status.module.css';

export default function PlatformPublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('publicEntry.system');

  useEffect(() => {
    console.error('platform_public_route_error', JSON.stringify({
      digest: error.digest || 'unavailable',
      name: error.name,
    }));
  }, [error]);

  return (
    <main className={styles.surface}>
      <section className={styles.card} role='alert' aria-live='assertive'>
        <h1>{t('errorTitle')}</h1>
        <p>{t('errorText')}</p>
        <div className={styles.actions}>
          <button type='button' onClick={reset}>{t('retry')}</button>
          <Link href='/platform-v7'>{t('home')}</Link>
        </div>
        {error.digest ? <p className={styles.correlation}>{t('correlation')}: {error.digest}</p> : null}
      </section>
    </main>
  );
}
