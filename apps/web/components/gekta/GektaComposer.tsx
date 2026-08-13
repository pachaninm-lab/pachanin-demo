'use client';

import * as React from 'react';
import { Send, Square } from 'lucide-react';
import type { PublicAssistantDocument } from '@/components/platform-v7/PublicAssistantAttachmentPicker';
import type { GektaLocale } from '@/lib/gekta/content';
import { GektaAttachments } from './GektaAttachments';
import { GektaVoiceInput } from './GektaVoiceInput';

const COMPACT_PLACEHOLDER: Record<GektaLocale, string> = {
  ru: 'Задай вопрос по сельскому хозяйству',
  en: 'Ask about farming or agribusiness',
  zh: '询问农业生产或农业经营',
};

const COMPACT_BOUNDARY: Record<GektaLocale, string> = {
  ru: 'Анонимная история хранится в этом браузере. Не отправляй секретные данные.',
  en: 'Anonymous history stays in this browser. Do not send secrets.',
  zh: '匿名记录保存在此浏览器中。请勿发送敏感信息。',
};

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
    textarea.style.height = `${Math.min(144, Math.max(68, textarea.scrollHeight))}px`;
  }, [value]);

  return (
    <div data-gekta-composer-root='true' className='mx-auto w-full max-w-[960px] px-3 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 sm:px-6 sm:pb-[max(12px,env(safe-area-inset-bottom))] sm:pt-3'>
      <GektaAttachments locale={locale} disabled={sending} documents={documents} onChange={onDocuments} onError={onError}>
        <label htmlFor='gekta-composer-input' className='sr-only'>{placeholder}</label>
        <textarea id='gekta-composer-input' ref={textareaRef} value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (!sending) onSubmit(); } }} rows={1} maxLength={1200} placeholder={COMPACT_PLACEHOLDER[locale]} aria-describedby='gekta-composer-boundary' className='block max-h-36 min-h-[68px] w-full resize-none bg-transparent px-4 pb-14 pt-3.5 text-[16px] leading-6 text-slate-900 outline-none placeholder:text-[15px] placeholder:text-slate-400' />
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
      <p id='gekta-composer-boundary' className='mt-1.5 px-2 text-center text-[11px] leading-4 text-slate-500'>
        <span className='sm:hidden'>{COMPACT_BOUNDARY[locale]}</span>
        <span className='hidden sm:inline'>{boundary}</span>
      </p>
    </div>
  );
}
