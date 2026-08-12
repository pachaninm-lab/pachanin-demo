'use client';

import * as React from 'react';
import { Send, Square } from 'lucide-react';
import type { PublicAssistantDocument } from '@/components/platform-v7/PublicAssistantAttachmentPicker';
import type { GektaLocale } from '@/lib/gekta/content';
import { GektaAttachments } from './GektaAttachments';
import { GektaVoiceInput } from './GektaVoiceInput';

export function GektaComposer({ locale, value, placeholder, sending, stopLabel, sendLabel, boundary, documents, voiceEnabled, onDocuments, onChange, onSubmit, onStop, onError }: {
  locale: GektaLocale;
  value: string;
  placeholder: string;
  sending: boolean;
  stopLabel: string;
  sendLabel: string;
  boundary: string;
  documents: readonly PublicAssistantDocument[];
  voiceEnabled: boolean;
  onDocuments: (documents: readonly PublicAssistantDocument[]) => void;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  onError: (message: string) => void;
}) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [voiceStatus, setVoiceStatus] = React.useState('');
  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(180, Math.max(52, textarea.scrollHeight))}px`;
  }, [value]);

  return (
    <div className='mx-auto w-full max-w-[960px] px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 sm:px-6'>
      <GektaAttachments locale={locale} disabled={sending} documents={documents} onChange={onDocuments} onError={onError}>
        <label htmlFor='gekta-composer-input' className='sr-only'>{placeholder}</label>
        <textarea id='gekta-composer-input' ref={textareaRef} value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (!sending) onSubmit(); } }} rows={2} maxLength={1200} placeholder={placeholder} aria-describedby='gekta-composer-boundary' className='block max-h-[180px] min-h-[76px] w-full resize-none bg-transparent px-4 pb-14 pt-4 text-[16px] leading-6 text-slate-900 outline-none placeholder:text-slate-400' />
        <div className='absolute bottom-3 right-3 flex items-center gap-2'>
          {voiceEnabled && !sending ? (
            <GektaVoiceInput
              locale={locale}
              disabled={sending}
              onStatus={setVoiceStatus}
              onTranscript={(text) => {
                // The transcript is offered for editing, never sent on its own.
                onChange(value ? `${value.trim()} ${text}`.slice(0, 1200) : text.slice(0, 1200));
                textareaRef.current?.focus();
              }}
            />
          ) : null}
          {sending ? <button type='button' onClick={onStop} className='flex h-11 min-w-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700' aria-label={stopLabel}><Square className='h-3.5 w-3.5 fill-current' aria-hidden='true' /><span className='hidden sm:inline'>{stopLabel}</span></button> : <button type='button' onClick={onSubmit} disabled={!value.trim()} className='flex h-11 min-w-11 items-center justify-center gap-2 rounded-xl bg-emerald-800 px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700' aria-label={sendLabel}><Send className='h-4 w-4' aria-hidden='true' /><span className='hidden sm:inline'>{sendLabel}</span></button>}
        </div>
      </GektaAttachments>
      <p className='sr-only' role='status' aria-live='polite'>{voiceStatus}</p>
      <p id='gekta-composer-boundary' className='mt-2 px-2 text-center text-[11px] leading-4 text-slate-500'>{boundary}</p>
    </div>
  );
}
