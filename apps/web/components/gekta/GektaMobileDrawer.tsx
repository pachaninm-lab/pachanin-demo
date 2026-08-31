'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { useDialogFocus } from './useDialogFocus';

type InertSnapshot = Readonly<{
  element: HTMLElement;
  inert: boolean;
  ariaHidden: string | null;
}>;

export function GektaMobileDrawer({ open, closeLabel, onClose, children }: { open: boolean; closeLabel: string; onClose: () => void; children: React.ReactNode }) {
  const panelRef = useDialogFocus(open, onClose);
  const dialogRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return undefined;

    const dialog = dialogRef.current;
    const workspace = dialog?.closest<HTMLElement>("[data-gekta-chat-workspace='true']");
    const inertTargets = new Set<HTMLElement>();
    workspace?.querySelectorAll<HTMLElement>(':scope > *').forEach((element) => {
      if (element !== dialog) inertTargets.add(element);
    });
    document.querySelectorAll<HTMLElement>("[data-gekta-server-discovery='true'], [data-gekta-floating-entry]").forEach((element) => inertTargets.add(element));

    const snapshots: InertSnapshot[] = [...inertTargets].map((element) => ({
      element,
      inert: element.hasAttribute('inert'),
      ariaHidden: element.getAttribute('aria-hidden'),
    }));
    snapshots.forEach(({ element }) => {
      element.setAttribute('inert', '');
      element.setAttribute('aria-hidden', 'true');
    });

    const previousRootOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    return () => {
      snapshots.forEach(({ element, inert, ariaHidden }) => {
        if (inert) element.setAttribute('inert', '');
        else element.removeAttribute('inert');
        if (ariaHidden === null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', ariaHidden);
      });
      document.documentElement.style.overflow = previousRootOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [open]);

  if (!open) return null;
  return (
    <div
      ref={dialogRef}
      className='fixed left-0 right-0 z-50 md:hidden'
      style={{ top: 'var(--gekta-visual-viewport-top, 0px)', height: 'var(--gekta-visual-viewport-height, 100dvh)' }}
      role='dialog'
      aria-modal='true'
      aria-labelledby='gekta-mobile-drawer-title'
    >
      <button type='button' className='absolute inset-0 bg-slate-950/40' onClick={onClose} aria-label={closeLabel} />
      <div
        ref={panelRef}
        data-gekta-mobile-drawer-panel='true'
        className='absolute inset-y-0 left-0 flex flex-col overflow-hidden bg-[#f6f5ef] pb-[max(8px,env(safe-area-inset-bottom))] shadow-2xl'
        style={{ width: 'min(88vw, 360px, calc(100vw - 48px))' }}
        onClick={(event) => {
          const target = event.target instanceof Element ? event.target : null;
          if (target?.closest('a[href]')) onClose();
        }}
      >
        <div className='flex min-h-14 shrink-0 items-center justify-between border-b border-slate-200/80 px-3 pt-[max(4px,env(safe-area-inset-top))]'>
          <h2 id='gekta-mobile-drawer-title' className='sr-only'>Gekta</h2>
          <span aria-hidden='true' />
          <button type='button' onClick={onClose} className='flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700' aria-label={closeLabel}><X className='h-5 w-5' aria-hidden='true' /></button>
        </div>
        <div className='min-h-0 flex-1 overflow-hidden'>{children}</div>
      </div>
    </div>
  );
}
