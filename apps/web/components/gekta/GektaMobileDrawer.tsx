'use client';

import * as React from 'react';
import { X } from 'lucide-react';

export function GektaMobileDrawer({ open, closeLabel, onClose, children }: { open: boolean; closeLabel: string; onClose: () => void; children: React.ReactNode }) {
  const closeRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = previous; };
  }, [onClose, open]);
  if (!open) return null;
  return (
    <div className='fixed inset-0 z-50 md:hidden' role='dialog' aria-modal='true' aria-label='Gekta navigation'>
      <button type='button' className='absolute inset-0 bg-slate-950/35' onClick={onClose} aria-label={closeLabel} />
      <div className='absolute inset-y-0 left-0 w-[min(88vw,300px)] overflow-hidden bg-[#f6f5ef] shadow-2xl'>
        <button ref={closeRef} type='button' onClick={onClose} className='absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm' aria-label={closeLabel}><X className='h-5 w-5' aria-hidden='true' /></button>
        {children}
      </div>
    </div>
  );
}
