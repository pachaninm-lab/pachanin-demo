/** Extracted text stays separate from the short question and is never silently sliced. */
export type GektaDocumentContext = Readonly<{ name: string; text: string; truncated: boolean }>;

export class DocumentContextError extends Error {
  constructor(readonly status: 400 | 413 = 400) { super('Invalid or oversized document context.'); }
}

export function readDocumentContext(value: unknown): readonly GektaDocumentContext[] {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value)) throw new DocumentContextError();
  if (value.length > 4) throw new DocumentContextError(413);
  let total = 0;
  return Object.freeze(value.map((item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new DocumentContextError();
    const row = item as Record<string, unknown>;
    if (typeof row.name !== 'string' || !row.name.trim() || row.name.length > 255
      || typeof row.text !== 'string' || !row.text.trim() || typeof row.truncated !== 'boolean') throw new DocumentContextError();
    total += row.text.length;
    if (row.text.length > 12_000 || total > 32_000) throw new DocumentContextError(413);
    // Only non-printing controls are removed; comparisons, indentation and line breaks survive.
    return Object.freeze({ name: row.name, text: row.text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, ' '), truncated: row.truncated });
  }));
}

/** Per-workspace, bounded volatile cache. No document text enters persisted history. */
export class GektaDocumentRetryCache {
  private readonly requests = new Map<string, readonly GektaDocumentContext[]>();
  remember(messageId: string, documents: readonly GektaDocumentContext[]): void {
    if (!documents.length) return;
    this.requests.delete(messageId);
    this.requests.set(messageId, readDocumentContext(documents));
    if (this.requests.size > 8) this.requests.delete(this.requests.keys().next().value!);
  }
  read(messageId: string): readonly GektaDocumentContext[] | undefined { return this.requests.get(messageId); }
  clear(): void { this.requests.clear(); }
}

export const DOCUMENT_CONTEXT_COPY = {
  ru: { invalid: 'Документы превышают доступный объём или не содержат читаемого текста. Выбери меньший фрагмент и прикрепи его снова.', missing: 'Для повтора нужен исходный документ. Прикрепи его снова и отправь вопрос.' },
  en: { invalid: 'The documents exceed the available size or contain no readable text. Attach a smaller extract and try again.', missing: 'Retry needs the original document. Attach it again and send your question.' },
  zh: { invalid: '文件超出可用大小或没有可读文本。请重新添加较小的片段。', missing: '重试需要原始文件。请重新添加文件并发送问题。' },
} as const;
