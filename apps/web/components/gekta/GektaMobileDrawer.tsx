'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { useDialogFocus } from './useDialogFocus';

export function GektaMobileDrawer({ open, closeLabel, onClose, children }: { open: boolean; closeLabel: string; onClose: () => void; children: React.ReactNode }) {
  const panelRef = useDialogFocus(open, onClose);
  React.useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  if (!open) return null;
  return (
    <div
      className='fixed left-0 right-0 z-50 md:hidden'
      style={{ top: 'var(--gekta-visual-viewport-top, 0px)', height: 'var(--gekta-visual-viewport-height, 100dvh)' }}
      role='dialog'
      aria-modal='true'
      aria-label='Gekta navigation'
    >
      <button type='button' className='absolute inset-0 bg-slate-950/40' onClick={onClose} aria-label={closeLabel} />
      <div ref={panelRef} className='absolute inset-y-0 left-0 flex w-[min(92vw,360px)] flex-col overflow-hidden bg-[#f6f5ef] shadow-2xl'>
        <div className='flex min-h-14 shrink-0 items-center justify-end border-b border-slate-200/80 px-3 pt-[max(4px,env(safe-area-inset-top))]'>
          <button type='button' onClick={onClose} className='flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700' aria-label={closeLabel}><X className='h-5 w-5' aria-hidden='true' /></button>
        </div>
        <div className='min-h-0 flex-1 overflow-hidden'>{children}</div>
      </div>
    </div>
  );
}
