import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transpileModule } from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { DOCUMENT_CONTEXT_COPY, DocumentContextError, GektaDocumentRetryCache, readDocumentContext } from '@/lib/gekta/document-context';

const doc = (text = 'Начало\n  x < 12 && y > 3\n' + 'я'.repeat(6_000) + '\nQA_END_987', truncated = false) => ({ name: 'Условия.docx', text, truncated });
const source = readFileSync('components/gekta/GektaChatWorkspace.tsx', 'utf8');
function actualCallback(name: 'submit' | 'retry', context: Record<string, unknown>) {
  const start = source.indexOf(`const ${name} = React.useCallback(`);
  const end = source.indexOf('\n  }, [', start);
  const finish = source.indexOf(');', end) + 2;
  expect(start).toBeGreaterThan(-1); expect(finish).toBeGreaterThan(start);
  const js = transpileModule(source.slice(start, finish) + `\nglobalThis.callback = ${name};`, {}).outputText;
  return runInNewContext(js + '\ncallback', { React: { useCallback: (f: unknown) => f }, ...context }) as (...args: unknown[]) => Promise<void>;
}
function client(documents = [doc()]) {
  const cache = new GektaDocumentRetryCache();
  const context = {
    documents, sending: false, input: 'Проверь условия договора по зерну.', locale: 'ru', activeId: 'conversation-1', messages: [] as unknown[],
    documentRetries: { current: cache }, readDocumentContext, DOCUMENT_CONTEXT_COPY,
    cleanText: (s: string) => s, id: () => 'user-1', titleFrom: (s: string) => s,
    historyFrom: () => [], reserveAnswer: vi.fn(async () => 'one-use-ticket'), runGeneration: vi.fn(async () => undefined),
    saveConversation: vi.fn(), focusComposer: vi.fn(), onEnteredChat: vi.fn(), track: vi.fn(),
    setError: vi.fn(), setInput: vi.fn(), setActiveId: vi.fn(), setMessages: vi.fn(), setDocuments: vi.fn(),
  };
  return { cache, context };
}

describe('G-A04 structured extracted document context', () => {
  it('preserves the end, comparisons, indentation and incomplete marker', () => {
    expect(readDocumentContext([doc(undefined, true)])).toEqual([doc(undefined, true)]);
  });
  it('accepts the exact existing per-file and total extraction bounds', () => {
    const docs = [doc('甲'.repeat(12_000)), doc('б'.repeat(12_000)), doc('x'.repeat(8_000))];
    expect(readDocumentContext(docs)).toEqual(docs);
  });
  it.each([null, {}, 'text', [null], [doc('')], [{ ...doc(), truncated: 'false' }], [{ ...doc(), name: '' }]].map(value => [value]))('rejects malformed context without silently substituting it: %j', value => {
    expect(() => readDocumentContext(value)).toThrow(DocumentContextError);
  });
  it.each([[doc('x'.repeat(12_001))], Array.from({ length: 5 }, () => doc('x')), [doc('a'.repeat(12_000)), doc('b'.repeat(12_000)), doc('c'.repeat(8_001))]].map(value => [value]))('rejects overflow instead of cutting off evidence', value => {
    expect(() => readDocumentContext(value)).toThrow(DocumentContextError);
    try { readDocumentContext(value); } catch (e) { expect((e as DocumentContextError).status).toBe(413); }
  });
  it('sends full extracted text separately and persists only attachment summaries', async () => {
    const { context } = client();
    await actualCallback('submit', context)();
    const request = context.runGeneration.mock.calls[0] as unknown as [{ question: string; documents: unknown }];
    expect(request[0].question).toBe(context.input);
    expect(request[0].documents).toEqual(context.documents);
    const saved = JSON.stringify(context.saveConversation.mock.calls);
    expect(saved).toContain('Условия.docx');
    expect(saved).not.toContain('QA_END_987');
  });
  it('rejects oversized documents before consuming an answer reservation', async () => {
    const { context } = client([doc('x'.repeat(12_001))]);
    await actualCallback('submit', context)();
    expect(context.reserveAnswer).not.toHaveBeenCalled();
    expect(context.runGeneration).not.toHaveBeenCalled();
    expect(context.setError).toHaveBeenCalledWith(DOCUMENT_CONTEXT_COPY.ru.invalid);
  });
});

describe('G-A06 document retry without silent evidence loss', () => {
  it('retries the original immutable document snapshot with a fresh reservation', async () => {
    const { cache, context } = client();
    cache.remember('user-1', context.documents);
    context.messages = [{ id: 'user-1', role: 'user', text: context.input, attachments: [{ name: 'Условия.docx' }] }, { role: 'assistant' }];
    context.documents[0].text = 'Replacement upload must not replace original evidence';
    await actualCallback('retry', context)(1);
    const request = (context.runGeneration.mock.calls[0] as unknown as [{ documents: ReturnType<typeof readDocumentContext>; ticket: string }])[0];
    expect(request.documents[0].text).toContain('QA_END_987');
    expect(request.ticket).toBe('one-use-ticket');
    expect(context.reserveAnswer).toHaveBeenCalledTimes(1);
  });
  it.each(['ru', 'en', 'zh'] as const)('asks to reattach in %s after text is no longer available, before reserving or deleting the old answer', async locale => {
    const { context } = client(); context.locale = locale;
    context.messages = [{ id: 'old-user', role: 'user', text: context.input, attachments: [{ name: 'old.docx' }] }, { role: 'assistant' }];
    await actualCallback('retry', context)(1);
    expect(context.setError).toHaveBeenCalledWith(DOCUMENT_CONTEXT_COPY[locale].missing);
    expect(context.setInput).toHaveBeenCalledWith(context.input);
    expect(context.reserveAnswer).not.toHaveBeenCalled();
    expect(context.runGeneration).not.toHaveBeenCalled();
    expect(context.setMessages).not.toHaveBeenCalled();
  });
  it('still retries a plain question without document context', async () => {
    const { context } = client([]);
    context.messages = [{ id: 'plain', role: 'user', text: context.input }, { role: 'assistant' }];
    await actualCallback('retry', context)(1);
    expect(context.reserveAnswer).toHaveBeenCalledTimes(1);
    expect(context.runGeneration).toHaveBeenCalledTimes(1);
  });
  it('bounds volatile history to eight document requests and supports explicit disposal', () => {
    const cache = new GektaDocumentRetryCache();
    for (let i = 0; i < 9; i++) cache.remember(`u-${i}`, [doc()]);
    expect(cache.read('u-0')).toBeUndefined();
    expect(cache.read('u-1')).toEqual([doc()]);
    cache.clear(); expect(cache.read('u-8')).toBeUndefined();
    expect(new GektaDocumentRetryCache().read('u-1')).toBeUndefined();
  });
});
