'use client';

import { Check, CircleAlert, Copy, Info, Loader2, RotateCcw } from 'lucide-react';
import type { GektaLocale } from '@/lib/gekta/content';
import { GEKTA_INTERRUPTION_COPY } from '@/lib/gekta/message-status';
import { GektaBrandMark } from './GektaBrandMark';
import { GektaMarkdown } from './GektaMarkdown';
import { GektaSpeakButton } from './GektaSpeakButton';
import { GektaSourceList } from './GektaSourceList';
import type { GektaMessage as Message } from './GektaChatTypes';
import styles from './GektaWorkspace.module.css';

const NOTICE = {
  ru: { failed: 'Не удалось ответить', recovery: 'Проверь соединение и попробуй снова.', noData: 'Нужны данные для ответа', unavailable: 'Ответ пока недоступен' },
  en: { failed: 'Could not answer', recovery: 'Check the connection and try again.', noData: 'More information needed', unavailable: 'Answer unavailable' },
  zh: { failed: '无法回答', recovery: '请检查网络连接后重试。', noData: '需要更多信息', unavailable: '暂时无法回答' },
} as const;

export function GektaMessage({ message, locale, assistantName, you, copyLabel, copiedLabel, retryLabel, sourceLabel, workingLabel, copied, canRetry, speechEnabled, onCopy, onRetry, onSourceOpen, onSpeech }: {
  message: Message;
  locale: GektaLocale;
  assistantName: string;
  you: string;
  copyLabel: string;
  copiedLabel: string;
  retryLabel: string;
  sourceLabel: string;
  workingLabel: string;
  copied: boolean;
  canRetry: boolean;
  speechEnabled: boolean;
  onCopy: () => void;
  onRetry: () => void;
  onSourceOpen: () => void;
  onSpeech?: (event: 'started' | 'stopped') => void;
}) {
  const user = message.role === 'user';
  const working = !user && message.status === 'streaming' && !message.text;
  const actionClass = 'inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-slate-600 no-underline visited:text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700';
  if (!user && message.status === 'refused') {
    const copy = NOTICE[locale];
    const cancelled = message.refusal === 'CANCELLED';
    const retryable = cancelled || !message.refusal || message.refusal === 'UPSTREAM_ERROR';
    const failed = retryable && !cancelled;
    const Icon = failed ? CircleAlert : Info;
    const stopped = GEKTA_INTERRUPTION_COPY[locale].stopped;
    const title = cancelled ? stopped : failed ? copy.failed : message.refusal === 'ABSTAINED_NO_DATA' ? copy.noData : copy.unavailable;
    const detail = message.text === GEKTA_INTERRUPTION_COPY[locale].error ? copy.recovery : message.text;
    return (
      <article className='mx-auto w-full max-w-[820px] px-4 py-3 sm:px-[30px]' data-gekta-role='assistant' aria-label={assistantName}>
        <div className={styles.answerNotice} data-gekta-answer-notice={failed ? 'error' : 'info'}>
          <Icon className='mt-0.5 h-[18px] w-[18px] shrink-0' aria-hidden='true' />
          <div className='min-w-0'>
            <div role='status'>
              <p className='text-sm font-semibold'>{title}</p>
              {detail && detail !== title ? <p className='mt-1 text-sm leading-6'>{detail}</p> : null}
            </div>
            {retryable && canRetry ? (
              <button type='button' onClick={onRetry} className={styles.noticeAction}>
                <RotateCcw className='h-4 w-4' aria-hidden='true' />{retryLabel}
              </button>
            ) : null}
          </div>
        </div>
      </article>
    );
  }
  return (
    <article className='mx-auto w-full max-w-[820px] px-4 py-4 sm:px-[30px] sm:py-5' data-gekta-role={message.role} aria-label={user ? you : assistantName}>
      <div className={user ? styles.messageUser : 'flex items-start gap-3 sm:gap-4'}>
        {!user ? <GektaBrandMark /> : null}
        <div className='min-w-0 flex-1'>
          {working ? (
            <p className='flex min-h-8 items-center gap-2 text-sm text-slate-600'>
              <Loader2 className='h-4 w-4 animate-spin motion-reduce:animate-none' aria-hidden='true' />{workingLabel}
            </p>
          ) : <div className={user ? 'sr-only' : 'mb-2 text-sm font-semibold text-slate-950'}>{user ? you : assistantName}</div>}
          {user ? <p className='whitespace-pre-wrap break-words leading-7 text-slate-800'>{message.text}</p> : <GektaMarkdown text={message.text} locale={locale} />}
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
