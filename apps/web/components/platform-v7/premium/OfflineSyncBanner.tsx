import type { ReactNode } from 'react';
import { PremiumIcon } from './icons';
import styles from './OfflineSyncBanner.module.css';

// Premium offline-sync banner (field roles). Honest copy: queued locally,
// sent when connection is back. No financial or cross-role context.
export function OfflineSyncBanner({
  title = 'Офлайн-синхронизация',
  detail = 'Данные сохраняются локально и отправятся автоматически при появлении связи.',
  queued,
}: {
  title?: ReactNode;
  detail?: ReactNode;
  queued?: number;
}) {
  return (
    <div className={`pc-prem-offline ${styles.banner}`} role='status'>
      <span className={`pc-prem-offline__icon ${styles.icon}`} aria-hidden='true'>
        <PremiumIcon glyph='route' />
      </span>
      <span className={`pc-prem-offline__body ${styles.body}`}>
        <strong className={`pc-prem-offline__title ${styles.title}`}>{title}</strong>
        <span className={`pc-prem-offline__detail ${styles.detail}`}>{detail}</span>
      </span>
      {typeof queued === 'number' ? <span className={`pc-prem-offline__count ${styles.count}`}>{queued} в очереди</span> : null}
    </div>
  );
}
