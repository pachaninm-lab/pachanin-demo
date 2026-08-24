'use client';

import { Check, Copy, RotateCcw } from 'lucide-react';
import type { GektaLocale } from '@/lib/gekta/content';
import { GektaMarkdown } from './GektaMarkdown';
import { GektaSpeakButton } from './GektaSpeakButton';
import { GektaSourceList } from './GektaSourceList';
import type { GektaMessage as Message } from './GektaChatTypes';

export function GektaMessage({ message, locale, assistantName, you, copyLabel, copiedLabel, retryLabel, sourceLabel, copied, canRetry, speechEnabled, onCopy, onRetry, onSourceOpen, onSpeech }: {
  message: Message;
  locale: GektaLocale;
  assistantName: string;
  you: string;
  copyLabel: string;
  copiedLabel: string;
  retryLabel: string;
  sourceLabel: string;
  copied: boolean;
  canRetry: boolean;
  speechEnabled: boolean;
  onCopy: () => void;
  onRetry: () => void;
  onSourceOpen: () => void;
  onSpeech?: (event: 'started' | 'stopped') => void;
}) {
  const user = message.role === 'user';
  const avatar = user ? you.slice(0, 1).toLocaleUpperCase() : 'G';
  const actionClass = 'inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-slate-600 no-underline visited:text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700';
  return (
    <article className={`group mx-auto w-full max-w-[920px] px-4 py-5 sm:px-6 ${user ? '' : 'border-t border-slate-100'}`} data-gekta-role={message.role}>
      <div className='flex items-start gap-3 sm:gap-4'>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${user ? 'bg-slate-900 text-white' : 'bg-emerald-800 text-white'}`}>{avatar}</div>
        <div className='min-w-0 flex-1'>
          <div className='mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500'>{user ? you : assistantName}</div>
          {user ? <p className='whitespace-pre-wrap break-words leading-7 text-slate-800'>{message.text}</p> : <GektaMarkdown text={message.text} />}
          {message.attachments?.length ? <div className='mt-3 flex flex-wrap gap-2'>{message.attachments.map((item) => <span key={`${item.name}-${item.size}`} className='max-w-full truncate rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600'>{item.name}</span>)}</div> : null}
          {!user && message.citations?.length ? <GektaSourceList citations={message.citations} label={sourceLabel} onOpen={onSourceOpen} /> : null}
          {!user && message.text ? (
            <div className='mt-3 flex flex-wrap gap-2 text-xs font-medium text-slate-600' data-gekta-message-actions='true'>
              <button type='button' onClick={onCopy} className={actionClass}>{copied ? <Check className='h-3.5 w-3.5' aria-hidden='true' /> : <Copy className='h-3.5 w-3.5' aria-hidden='true' />}{copied ? copiedLabel : copyLabel}</button>
              {canRetry ? <button type='button' onClick={onRetry} className={actionClass}><RotateCcw className='h-3.5 w-3.5' aria-hidden='true' />{retryLabel}</button> : null}
              {speechEnabled ? <GektaSpeakButton locale={locale} text={message.text} onEvent={onSpeech} /> : null}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
