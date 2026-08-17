'use client';

import * as React from 'react';
import { CircleSlash2, Send, Square } from 'lucide-react';
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
  ru: 'История этого режима хранится в браузере. Не отправляй секреты, пароли и токены.',
  en: 'This mode stores its history in your browser. Do not send secrets, passwords or tokens.',
  zh: '此模式的历史记录保存在浏览器中。请勿发送秘密、密码或令牌。',
};

const ATTACHMENT_ONLY_PROMPT: Record<GektaLocale, string> = {
  ru: 'Проанализируй приложенные материалы.',
  en: 'Analyse the attached materials.',
  zh: '请分析所附材料。',
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
  const pendingAttachmentSubmit = React.useRef(false);
  const [voiceStatus, setVoiceStatus] = React.useState('');
  const canSubmit = Boolean(value.trim() || documents.length);

  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(144, Math.max(68, textarea.scrollHeight))}px`;
  }, [value]);

  React.useEffect(() => {
    if (!pendingAttachmentSubmit.current || !value.trim()) return;
    pendingAttachmentSubmit.current = false;
    onSubmit();
  }, [onSubmit, value]);

  const submitComposer = React.useCallback(() => {
    if (sending || !canSubmit) return;
    if (value.trim()) {
      onSubmit();
      return;
    }
    pendingAttachmentSubmit.current = true;
    onChange(ATTACHMENT_ONLY_PROMPT[locale]);
  }, [canSubmit, locale, onChange, onSubmit, sending, value]);

  return (
    <div data-gekta-composer-root='true' className='mx-auto w-full max-w-[960px] px-3 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 sm:px-6 sm:pb-[max(12px,env(safe-area-inset-bottom))] sm:pt-3'>
      <GektaAttachments locale={locale} disabled={sending} documents={documents} onChange={onDocuments} onError={onError}>
        <label htmlFor='gekta-composer-input' className='sr-only'>{placeholder}</label>
        <textarea id='gekta-composer-input' ref={textareaRef} value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submitComposer(); } }} rows={1} maxLength={1200} placeholder={COMPACT_PLACEHOLDER[locale]} aria-describedby='gekta-composer-boundary' className='block max-h-36 min-h-[68px] w-full resize-none overflow-y-auto bg-transparent px-4 pb-14 pt-3.5 text-[16px] leading-6 text-slate-900 outline-none placeholder:text-[15px] placeholder:text-slate-400' />
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
          {sending ? (
            <button type='button' onClick={onStop} className='flex h-11 min-w-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700' aria-label={stopLabel}><Square className='h-3.5 w-3.5 fill-current' aria-hidden='true' /><span className='hidden sm:inline'>{stopLabel}</span></button>
          ) : (
            <button
              type='button'
              onClick={submitComposer}
              disabled={!canSubmit}
              className={`flex h-11 min-w-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${canSubmit ? 'bg-emerald-800 text-white hover:bg-emerald-900' : 'cursor-not-allowed border border-dashed border-slate-300 bg-slate-100 text-slate-500'}`}
              aria-label={sendLabel}
            >
              {canSubmit ? <Send className='h-4 w-4' aria-hidden='true' /> : <CircleSlash2 className='h-4 w-4' aria-hidden='true' />}
              <span className='hidden sm:inline'>{sendLabel}</span>
            </button>
          )}
        </div>
      </GektaAttachments>
      <p className='sr-only' role='status' aria-live='polite'>{voiceStatus}</p>
      <p id='gekta-composer-boundary' className='mt-1.5 px-2 text-center text-sm leading-5 text-slate-600'>
        <span className='sm:hidden'>{COMPACT_BOUNDARY[locale]}</span>
        <span className='hidden sm:inline'>{boundary}</span>
      </p>
    </div>
  );
}
