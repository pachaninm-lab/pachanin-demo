'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import {
  PublicAssistantAttachmentPicker,
  type PublicAssistantDocument,
} from './PublicAssistantAttachmentPicker';

type Locale = 'ru' | 'en' | 'zh';
type HistoryTurn = Readonly<{ role: 'user' | 'assistant'; text: string }>;

function resolveLocale(): Locale {
  const lang = document.documentElement.lang.toLowerCase();
  const query = new URLSearchParams(window.location.search).get('lang');
  if (query === 'en' || query === 'zh') return query;
  if (lang.startsWith('en')) return 'en';
  if (lang.startsWith('zh')) return 'zh';
  return 'ru';
}

function defaultQuestion(locale: Locale): string {
  if (locale === 'en') return 'Analyze the attached documents and identify the key facts, risks and next steps.';
  if (locale === 'zh') return '分析所附文件，并指出关键事实、风险和下一步行动。';
  return 'Проанализируй прикреплённые документы: выдели ключевые факты, риски и следующие шаги.';
}

function splitDocument(document: PublicAssistantDocument): HistoryTurn[] {
  const prefix = `[ATTACHED_DOCUMENT: ${document.name}${document.truncated ? '; extraction truncated' : ''}]\n`;
  const available = 1_900 - prefix.length;
  const chunks: HistoryTurn[] = [];
  for (let offset = 0; offset < document.text.length && chunks.length < 5; offset += available) {
    chunks.push({ role: 'user', text: `${prefix}${document.text.slice(offset, offset + available)}` });
  }
  return chunks;
}

function injectDocuments(raw: string, documents: readonly PublicAssistantDocument[]): string {
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return raw;
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return raw;
  const row = payload as Record<string, unknown>;
  const existing = Array.isArray(row.history)
    ? row.history.filter((item): item is HistoryTurn => Boolean(
        item && typeof item === 'object' && !Array.isArray(item)
        && ((item as HistoryTurn).role === 'user' || (item as HistoryTurn).role === 'assistant')
        && typeof (item as HistoryTurn).text === 'string',
      ))
    : [];
  const attachmentTurns = documents.flatMap(splitDocument).slice(0, 8);
  const history = [...existing, ...attachmentTurns].slice(-12);
  return JSON.stringify({ ...row, history, attachment: true });
}

function setTextareaValue(value: string): void {
  const textarea = document.querySelector<HTMLTextAreaElement>('.pc-public-assistant-composer textarea');
  if (!textarea || textarea.value.trim()) return;
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  setter?.call(textarea, value);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.focus();
}

export function PublicAssistantAttachmentBridge() {
  const [target, setTarget] = React.useState<HTMLElement | null>(null);
  const [documents, setDocuments] = React.useState<readonly PublicAssistantDocument[]>([]);
  const [error, setError] = React.useState('');
  const [locale, setLocale] = React.useState<Locale>('ru');

  React.useEffect(() => {
    setLocale(resolveLocale());
    const find = () => setTarget(document.querySelector<HTMLElement>('.pc-public-assistant-composer-shell'));
    find();
    const observer = new MutationObserver(find);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    if (!documents.length) return;
    const original = window.fetch;
    const patched: typeof window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (
        url.includes('/api/public-platform-assistant')
        && !url.includes('/attachments')
        && typeof init?.body === 'string'
      ) {
        return original(input, { ...init, body: injectDocuments(init.body, documents) });
      }
      return original(input, init);
    };
    window.fetch = patched;
    return () => {
      if (window.fetch === patched) window.fetch = original;
    };
  }, [documents]);

  const changeDocuments = (next: readonly PublicAssistantDocument[]) => {
    setDocuments(next);
    setError('');
    if (next.length) window.setTimeout(() => setTextareaValue(defaultQuestion(locale)), 0);
  };

  if (!target) return null;
  return createPortal(
    <>
      <PublicAssistantAttachmentPicker
        locale={locale}
        disabled={false}
        documents={documents}
        onChange={changeDocuments}
        onError={setError}
      />
      {error ? <span className='pc-public-assistant-attachment-error' role='alert'>{error}</span> : null}
    </>,
    target,
  );
}
