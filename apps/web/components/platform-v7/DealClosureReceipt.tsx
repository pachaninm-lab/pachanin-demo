'use client';

import * as React from 'react';
import { AfterActionReceipt } from '@/components/platform-v7/visual/AfterActionReceipt';

/**
 * Празднующая «квитанция закрытия сделки». Показывается один раз при входе на
 * терминальный экран закрытия и мягко сворачивается. Презентационный слой —
 * не меняет деньги, статусы или доменную модель.
 */
export function DealClosureReceipt({ dealId, journalHref }: { dealId: string; journalHref: string }) {
  const [visible, setVisible] = React.useState(true);
  return (
    <AfterActionReceipt
      visible={visible}
      onClose={() => setVisible(false)}
      tone='ok'
      title={`Сделка ${dealId} закрыта.`}
      notes={['Расчёт завершён. Документы и доказательства собраны.']}
      nextAction='Досье доступно в архиве исполнения.'
      journalHref={journalHref}
      autoCloseMs={9000}
      position='bottom-right'
      data-testid='platform-v7-deal-closure-receipt'
    />
  );
}
