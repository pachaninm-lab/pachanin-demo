'use client';

import * as React from 'react';
import { outboundDestination, type OutboundDestination } from '@/lib/gekta/outbound-destination';

/**
 * ASVS V3.7.3. A link the assistant chose is a destination this application
 * does not control, so leaving for it is a step the person takes rather than
 * one a click performs: the notice names the host, and nothing navigates until
 * they answer it. A link that stays on this origin behaves as an ordinary one.
 */

export type OutboundLinkCopy = {
  readonly title: string;
  readonly body: string;
  readonly confirm: string;
  readonly cancel: string;
};

export const DEFAULT_OUTBOUND_COPY: OutboundLinkCopy = {
  title: 'Переход на внешний сайт',
  body: 'Этот источник выбран ассистентом. Платформа не контролирует его содержимое.',
  confirm: 'Перейти',
  cancel: 'Отмена',
};

export function OutboundLink({
  uri,
  children,
  className,
  copy = DEFAULT_OUTBOUND_COPY,
  newTab = false,
  onOpen,
}: {
  uri: string;
  children: React.ReactNode;
  className?: string;
  copy?: OutboundLinkCopy;
  newTab?: boolean;
  onOpen?: () => void;
}) {
  const [pending, setPending] = React.useState<OutboundDestination | null>(null);
  const pageOrigin = typeof window === 'undefined' ? 'https://localhost' : window.location.origin;
  const destination = outboundDestination(uri, pageOrigin);
  if (!destination) return null;

  const leave = (target: OutboundDestination) => {
    setPending(null);
    onOpen?.();
    if (typeof window === 'undefined') return;
    if (newTab) window.open(target.href, '_blank', 'noopener,noreferrer');
    else window.location.assign(target.href);
  };

  return (
    <>
      <a
        href={destination.href}
        target={newTab ? '_blank' : undefined}
        rel='noreferrer'
        data-outbound={destination.outbound ? 'true' : 'false'}
        className={className}
        onClick={(event) => {
          if (!destination.outbound) { onOpen?.(); return; }
          // Nothing navigates until the notice is answered.
          event.preventDefault();
          setPending(destination);
        }}
      >
        {children}
      </a>
      {pending ? (
        <div
          role='alertdialog'
          aria-modal='true'
          aria-labelledby='outbound-notice-title'
          data-testid='gekta-outbound-notice'
          className='mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm'
        >
          <p id='outbound-notice-title' className='font-semibold text-slate-900'>{copy.title}</p>
          <p className='mt-1 break-all text-slate-700'>{pending.host}</p>
          <p className='mt-1 text-xs text-slate-600'>{copy.body}</p>
          <div className='mt-3 flex flex-wrap gap-2'>
            <button type='button' data-testid='gekta-outbound-continue' onClick={() => leave(pending)} className='min-h-11 rounded-lg bg-emerald-700 px-3 text-sm font-semibold text-white'>
              {copy.confirm}
            </button>
            <button type='button' data-testid='gekta-outbound-cancel' onClick={() => setPending(null)} className='min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800'>
              {copy.cancel}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
