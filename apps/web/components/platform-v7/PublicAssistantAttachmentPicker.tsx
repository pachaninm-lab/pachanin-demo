'use client';

import * as React from 'react';
import { FileText, Loader2, Paperclip, X } from 'lucide-react';

export type PublicAssistantDocument = Readonly<{
  id: string;
  name: string;
  mediaType: string;
  size: number;
  checksumSha256: string;
  text: string;
  truncated: boolean;
}>;

type Locale = 'ru' | 'en' | 'zh';

type Props = Readonly<{
  locale: Locale;
  disabled: boolean;
  documents: readonly PublicAssistantDocument[];
  onChange: (documents: readonly PublicAssistantDocument[]) => void;
  onError: (message: string) => void;
}>;

const COPY = {
  ru: {
    attach: 'Прикрепить документы',
    remove: 'Удалить файл',
    uploading: 'Обрабатываю документы…',
    unsupported: 'Файл пока нельзя обработать в этом окне.',
    failed: 'Не удалось обработать документ.',
    partial: 'Часть файлов не обработана.',
  },
  en: {
    attach: 'Attach documents',
    remove: 'Remove file',
    uploading: 'Processing documents…',
    unsupported: 'This file cannot be processed in this window yet.',
    failed: 'The document could not be processed.',
    partial: 'Some files were not processed.',
  },
  zh: {
    attach: '添加文件',
    remove: '移除文件',
    uploading: '正在处理文件…',
    unsupported: '此窗口暂时无法处理该文件。',
    failed: '无法处理文件。',
    partial: '部分文件未处理。',
  },
} as const;

function readableBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PublicAssistantAttachmentPicker({ locale, disabled, documents, onChange, onError }: Props) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const ui = COPY[locale];

  const upload = async (files: FileList | null) => {
    if (!files?.length || uploading || disabled) return;
    const form = new FormData();
    Array.from(files).slice(0, 4).forEach((file) => form.append('files', file));
    setUploading(true);
    try {
      const response = await fetch('/api/public-platform-assistant/attachments', {
        method: 'POST',
        cache: 'no-store',
        body: form,
      });
      const payload = await response.json().catch(() => null) as {
        documents?: PublicAssistantDocument[];
        rejected?: Array<{ name: string; code: string }>;
      } | null;
      if (!response.ok || !payload?.documents?.length) {
        const code = payload?.rejected?.[0]?.code || '';
        onError(code.startsWith('PROCESSOR_NOT_CONNECTED') ? ui.unsupported : ui.failed);
        return;
      }
      const next = [...documents, ...payload.documents].slice(0, 4);
      onChange(next);
      if (payload.rejected?.length) onError(ui.partial);
    } catch {
      onError(ui.failed);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className='pc-public-assistant-attachments' data-public-assistant-attachments='true'>
      <input
        ref={inputRef}
        type='file'
        hidden
        multiple
        accept='.txt,.md,.csv,.json,.xml,.xlsx,.pdf,.doc,.docx,.png,.jpg,.jpeg,.heic'
        onChange={(event) => void upload(event.target.files)}
      />
      <button
        type='button'
        className='pc-public-assistant-attach-button'
        onClick={() => inputRef.current?.click()}
        disabled={disabled || uploading || documents.length >= 4}
        aria-label={uploading ? ui.uploading : ui.attach}
        title={uploading ? ui.uploading : ui.attach}
      >
        {uploading ? <Loader2 size={18} aria-hidden='true' /> : <Paperclip size={19} aria-hidden='true' />}
      </button>
      {documents.length ? (
        <div className='pc-public-assistant-attachment-list' aria-label={ui.attach}>
          {documents.map((document) => (
            <span className='pc-public-assistant-attachment-chip' key={document.id}>
              <FileText size={15} aria-hidden='true' />
              <span><strong>{document.name}</strong><small>{readableBytes(document.size)}</small></span>
              <button
                type='button'
                onClick={() => onChange(documents.filter((item) => item.id !== document.id))}
                aria-label={`${ui.remove}: ${document.name}`}
                title={ui.remove}
              >
                <X size={14} aria-hidden='true' />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
