'use client';

import { Loader2 } from 'lucide-react';
import type { GektaLocale } from '@/lib/gekta/content';
import { GektaMessage } from './GektaMessage';
import type { GektaMessage as Message } from './GektaChatTypes';

export function GektaMessageList({ messages, locale, sending, speechEnabled, labels, copiedId, onCopy, onRetry, onSourceOpen, onSpeech }: {
  messages: readonly Message[];
  locale: GektaLocale;
  sending: boolean;
  speechEnabled: boolean;
  labels: { assistant: string; you: string; copy: string; copied: string; retry: string; sources: string; working: string };
  copiedId: string;
  onCopy: (message: Message) => void;
  onRetry: (index: number) => void;
  onSourceOpen: () => void;
  onSpeech?: (event: 'started' | 'stopped') => void;
}) {
  return (
    <div className='pb-6'>
      {messages.map((message, index) => (
        <GektaMessage key={message.id} message={message} locale={locale} speechEnabled={speechEnabled} onSpeech={onSpeech} assistantName={labels.assistant} you={labels.you} copyLabel={labels.copy} copiedLabel={labels.copied} retryLabel={labels.retry} sourceLabel={labels.sources} copied={copiedId === message.id} canRetry={!sending && message.role === 'assistant' && index === messages.length - 1} onCopy={() => onCopy(message)} onRetry={() => onRetry(index)} onSourceOpen={onSourceOpen} />
      ))}
      {sending && messages[messages.length - 1]?.role === 'assistant' && !messages[messages.length - 1]?.text ? (
        <div className='mx-auto flex w-full max-w-[920px] items-center gap-3 px-4 py-5 text-sm text-slate-500 sm:px-6' role='status' aria-live='polite'><Loader2 className='h-4 w-4 animate-spin motion-reduce:animate-none' aria-hidden='true' />{labels.working}</div>
      ) : null}
    </div>
  );
}
