'use client';

import { useTranslations } from 'next-intl';
import styles from './public-status.module.css';

export default function PlatformPublicLoading() {
  const t = useTranslations('publicEntry.system');

  return (
    <main className={styles.surface} aria-busy='true' aria-live='polite'>
      <section className={styles.card}>
        <span className={styles.loader} aria-hidden='true' />
        <h1>{t('loadingTitle')}</h1>
        <p>{t('loadingText')}</p>
      </section>
    </main>
  );
}
