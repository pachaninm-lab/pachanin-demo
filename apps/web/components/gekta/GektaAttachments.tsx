'use client';

import * as React from 'react';
import { FileText, Loader2, Paperclip, X } from 'lucide-react';
import type { PublicAssistantDocument } from '@/components/platform-v7/PublicAssistantAttachmentPicker';
import type { GektaLocale } from '@/lib/gekta/content';

const MAX_FILES = 4;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPT = '.txt,.md,.csv,.json,.xml,.xlsx,.pdf,.doc,.docx,.png,.jpg,.jpeg,.heic';

const COPY = {
  ru: { attach: 'Прикрепить файл', uploading: 'Обработка файлов…', remove: 'Удалить', drop: 'Перетащи файлы сюда', failed: 'Не удалось безопасно обработать файл.', tooLarge: 'Файл больше 10 МБ.', partial: 'Часть файлов не обработана.' },
  en: { attach: 'Attach file', uploading: 'Processing files…', remove: 'Remove', drop: 'Drop files here', failed: 'The file could not be processed safely.', tooLarge: 'The file is larger than 10 MB.', partial: 'Some files were not processed.' },
  zh: { attach: '添加文件', uploading: '正在处理文件…', remove: '移除', drop: '将文件拖到此处', failed: '无法安全处理该文件。', tooLarge: '文件大于 10 MB。', partial: '部分文件未处理。' },
} as const;

function readableBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function GektaAttachments({ locale, disabled, documents, onChange, onError, children }: {
  locale: GektaLocale;
  disabled: boolean;
  documents: readonly PublicAssistantDocument[];
  onChange: (documents: readonly PublicAssistantDocument[]) => void;
  onError: (message: string) => void;
  children: React.ReactNode;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const [textareaFocused, setTextareaFocused] = React.useState(false);
  const ui = COPY[locale];

  const upload = React.useCallback(async (files: readonly File[]) => {
    if (!files.length || uploading || disabled) return;
    const room = Math.max(0, MAX_FILES - documents.length);
    const selected = files.slice(0, room);
    const oversized = selected.find((file) => file.size > MAX_FILE_SIZE);
    if (oversized) { onError(ui.tooLarge); return; }
    if (!selected.length) return;
    const form = new FormData();
    selected.forEach((file) => form.append('files', file));
    setUploading(true);
    try {
      const response = await fetch('/api/public-platform-assistant/attachments', { method: 'POST', cache: 'no-store', body: form });
      const payload = await response.json().catch(() => null) as { documents?: PublicAssistantDocument[]; rejected?: Array<{ name: string; code: string }> } | null;
      if (!response.ok || !payload?.documents?.length) { onError(ui.failed); return; }
      onChange([...documents, ...payload.documents].slice(0, MAX_FILES));
      if (payload.rejected?.length) onError(ui.partial);
    } catch {
      onError(ui.failed);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }, [disabled, documents, onChange, onError, ui, uploading]);

  const focusSurface = textareaFocused
    ? 'border-emerald-700 shadow-[0_12px_34px_rgba(15,23,42,0.10),0_0_0_3px_rgba(4,120,87,0.10)]'
    : 'border-slate-200 shadow-[0_10px_30px_rgba(15,23,42,0.07)]';

  return (
    <div
      className={`relative rounded-[22px] border bg-white transition-[border-color,box-shadow] ${focusSurface} ${dragging ? 'ring-4 ring-emerald-100' : ''}`}
      onFocusCapture={(event) => setTextareaFocused(event.target instanceof HTMLTextAreaElement)}
      onBlurCapture={(event) => {
        const next = event.relatedTarget;
        setTextareaFocused(next instanceof HTMLTextAreaElement && event.currentTarget.contains(next));
      }}
      onDragEnter={(event) => { event.preventDefault(); if (!disabled) setDragging(true); }}
      onDragOver={(event) => { event.preventDefault(); }}
      onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }}
      onDrop={(event) => { event.preventDefault(); setDragging(false); void upload(Array.from(event.dataTransfer.files)); }}
      data-gekta-drop-target='true'
    >
      <input ref={inputRef} type='file' hidden multiple accept={ACCEPT} onChange={(event) => void upload(Array.from(event.target.files || []))} />
      {dragging ? <div className='pointer-events-none absolute inset-2 z-20 flex items-center justify-center rounded-2xl bg-emerald-50/95 text-[14px] font-semibold text-emerald-900'>{ui.drop}</div> : null}
      {documents.length ? <div className='flex max-h-32 flex-wrap gap-2 overflow-y-auto px-4 pt-3'>{documents.map((document) => <span key={document.id} className='flex max-w-full items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[14px] text-slate-700'><FileText className='h-4 w-4 shrink-0 text-emerald-700' aria-hidden='true' /><span className='min-w-0'><strong className='block max-w-44 truncate'>{document.name}</strong><span className='text-[14px] text-slate-500'>{readableBytes(document.size)}</span></span><button type='button' onClick={() => onChange(documents.filter((item) => item.id !== document.id))} className='ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700' aria-label={`${ui.remove}: ${document.name}`}><X className='h-3.5 w-3.5' aria-hidden='true' /></button></span>)}</div> : null}
      {children}
      <button type='button' onClick={() => inputRef.current?.click()} disabled={disabled || uploading || documents.length >= MAX_FILES} className='absolute bottom-3 left-3 flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700' aria-label={uploading ? ui.uploading : ui.attach} title={uploading ? ui.uploading : ui.attach}>{uploading ? <Loader2 className='h-4 w-4 animate-spin motion-reduce:animate-none' aria-hidden='true' /> : <Paperclip className='h-4 w-4' aria-hidden='true' />}</button>
    </div>
  );
}
