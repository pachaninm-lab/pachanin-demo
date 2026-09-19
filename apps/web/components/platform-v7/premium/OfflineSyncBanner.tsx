import type { ReactNode } from 'react';
import { PremiumIcon } from './icons';

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
    <div className='pc-prem-offline' role='status'>
      <span className='pc-prem-offline__icon' aria-hidden='true'>
        <PremiumIcon glyph='route' />
      </span>
      <span className='pc-prem-offline__body'>
        <strong className='pc-prem-offline__title'>{title}</strong>
        <span className='pc-prem-offline__detail'>{detail}</span>
      </span>
      {typeof queued === 'number' ? <span className='pc-prem-offline__count'>{queued} в очереди</span> : null}
    </div>
  );
}
