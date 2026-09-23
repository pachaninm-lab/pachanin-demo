import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { encodeFrame, type GatewayFrame } from '@pc/ai-assistant-stream-contract';
import { PublicPlatformAssistant } from '@/components/platform-v7/PublicPlatformAssistant';
import { PublicGektaChatButton } from '@/components/platform-v7/PublicGektaChatButton';
import { PublicContactDock } from '@/components/platform-v7/PublicContactDock';
import {
  bindPublicGektaOwner,
  readPublicGektaOpenStatus,
  reportPublicGektaUnavailable,
  requestPublicGektaOpen,
} from '@/lib/platform-v7/public-gekta-open';

// GEKTA-01 / UX-12 / UX-28: one open operation, draft-only prompts, honest
// stream outcomes, one POST per question and late responses kept out.

const STREAM = 'stream-abcdef12';
const meta = (): GatewayFrame => ({ event: 'meta', streamId: STREAM, mode: 'public', modelIdentity: null });
const token = (text: string): GatewayFrame => ({ event: 'token', streamId: STREAM, text });
const done = (complete: boolean): GatewayFrame => ({ event: 'done', streamId: STREAM, complete });

function sseChunks(chunks: readonly string[], options: { holdOpen?: Promise<void> } = {}) {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      if (options.holdOpen) await options.holdOpen;
      controller.close();
    },
  }), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}
const sse = (frames: readonly GatewayFrame[]) => sseChunks([frames.map(encodeFrame).join('')]);

const catalogResponse = () => new Response(JSON.stringify({
  knowledgeVersion: 'v1', dataMode: 'public_knowledge', actionAllowed: false,
  title: 'Гекта', description: '', starterPrompts: ['Как выбрать сорт пшеницы?'],
}), { status: 200, headers: { 'Content-Type': 'application/json' } });

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;
function installFetch(handler: Handler) {
  const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    return handler(url, init);
  });
  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: spy });
  return spy;
}
const posts = (spy: ReturnType<typeof installFetch>) => spy.mock.calls.filter(([, init]) => init?.method === 'POST');

const originalFetch = globalThis.fetch;
function stubConfirm(answer: boolean) {
  const confirm = vi.fn(() => answer);
  Object.defineProperty(window, 'confirm', { configurable: true, writable: true, value: confirm });
  return confirm;
}
let unbindProbe: (() => void) | null = null;

beforeEach(() => {
  document.documentElement.lang = 'ru';
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  unbindProbe?.();
  unbindProbe = null;
  // Leave the mailbox without an owner and without a failure for the next test.
  unbindProbe = bindPublicGektaOwner(() => undefined);
  unbindProbe();
  unbindProbe = null;
  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: originalFetch });
  vi.restoreAllMocks();
});

async function openAndType(question: string) {
  const user = userEvent.setup();
  render(<PublicPlatformAssistant />);
  await user.click(screen.getByRole('button', { name: /Спросить Гекту/ }));
  const box = await screen.findByRole('textbox');
  await user.type(box, question);
  return { user, box };
}

describe('G01/G02 one open operation', () => {
  it('keeps a cold first click until the assistant mounts, then opens with the prompt as a draft', async () => {
    const spy = installFetch((url) => (url.includes('locale=') ? catalogResponse() : sse([meta(), token('x'), done(true)])));
    render(<PublicGektaChatButton locale='ru' variant='section' prompt='Что проверить перед отгрузкой?' />);
    const entry = screen.getByRole('button', { name: /Что проверить перед отгрузкой/ });
    fireEvent.click(entry);
    expect(readPublicGektaOpenStatus()).toBe('opening');
    expect(entry.getAttribute('aria-busy')).toBe('true');
    expect(entry.textContent).toContain('Открываем Гекту');

    // The assistant chunk arrives later.
    render(<PublicPlatformAssistant />);
    const dialogs = await screen.findAllByRole('dialog');
    expect(dialogs).toHaveLength(1);
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Что проверить перед отгрузкой?');
    expect(posts(spy)).toHaveLength(0);
    expect(readPublicGektaOpenStatus()).toBe('idle');
  });

  it('shows explicit recovery when the assistant code cannot be loaded, and never opens later by surprise', () => {
    render(<PublicGektaChatButton locale='ru' variant='header' />);
    reportPublicGektaUnavailable();
    const entry = screen.getByRole('button');
    fireEvent.click(entry);
    expect(entry.getAttribute('data-gekta-open-state')).toBe('failed');
    expect(entry.textContent).toContain('Гекта не загрузилась');
    expect(requestPublicGektaOpen({ source: 'test' })).toBe('failed');
  });

  it('mounts one dialog under StrictMode and repeated opens', async () => {
    installFetch(() => catalogResponse());
    render(<React.StrictMode><PublicPlatformAssistant /></React.StrictMode>);
    act(() => {
      requestPublicGektaOpen({ source: 'a' });
      requestPublicGektaOpen({ source: 'b' });
      window.dispatchEvent(new CustomEvent('pc:public-assistant-context', { detail: { context: 'platform', prompts: [] } }));
    });
    expect(await screen.findAllByRole('dialog')).toHaveLength(1);
  });

  it('opens from the public contact dock without clicking a hidden DOM button', async () => {
    installFetch(() => catalogResponse());
    const clickSpy = vi.spyOn(HTMLElement.prototype, 'click');
    render(<><PublicContactDock assistantContext='public' publicMode='gekta' /><PublicPlatformAssistant /></>);
    fireEvent.click(document.querySelector<HTMLButtonElement>('.pc-public-contact-dock-assistant')!);
    expect(await screen.findAllByRole('dialog')).toHaveLength(1);
    expect(clickSpy).not.toHaveBeenCalled();
  });
});

describe('G03 composer', () => {
  it('Enter submits once; a second Enter in the same tick sends nothing', async () => {
    let release!: () => void;
    const hold = new Promise<void>((resolve) => { release = resolve; });
    const spy = installFetch((url) => (url.includes('locale=')
      ? catalogResponse()
      : sseChunks([encodeFrame(meta()), encodeFrame(token('Ответ.')), encodeFrame(done(true))], { holdOpen: hold })));
    const { box } = await openAndType('Вопрос');
    act(() => {
      fireEvent.keyDown(box, { key: 'Enter', code: 'Enter', keyCode: 13 });
      fireEvent.keyDown(box, { key: 'Enter', code: 'Enter', keyCode: 13 });
    });
    release();
    await waitFor(() => expect(screen.getByText('Ответ.')).toBeInTheDocument());
    expect(posts(spy)).toHaveLength(1);
    expect(document.querySelectorAll(".pc-public-assistant-message[data-role='user']")).toHaveLength(1);
  });

  it('Shift+Enter and IME composition Enter do not submit', async () => {
    const spy = installFetch(() => catalogResponse());
    const { box } = await openAndType('你好');
    fireEvent.keyDown(box, { key: 'Enter', code: 'Enter', keyCode: 13, shiftKey: true });
    fireEvent.compositionStart(box);
    fireEvent.keyDown(box, { key: 'Enter', code: 'Enter', keyCode: 13 });
    fireEvent.compositionEnd(box);
    fireEvent.keyDown(box, { key: 'Enter', code: 'Enter', keyCode: 229 });
    expect(posts(spy)).toHaveLength(0);
  });

  it('a starter prompt fills the composer and is not sent', async () => {
    const spy = installFetch(() => catalogResponse());
    const user = userEvent.setup();
    render(<PublicPlatformAssistant />);
    await user.click(screen.getByRole('button', { name: /Спросить Гекту/ }));
    await user.click(await screen.findByRole('button', { name: 'Как выбрать сорт пшеницы?' }));
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Как выбрать сорт пшеницы?');
    expect(posts(spy)).toHaveLength(0);
  });

  it('an existing draft is never replaced silently by a prompt', async () => {
    installFetch(() => catalogResponse());
    const { box } = await openAndType('Мой черновик');
    act(() => { requestPublicGektaOpen({ source: 'card', draft: 'Другой вопрос' }); });
    expect((box as HTMLTextAreaElement).value).toBe('Мой черновик');
    expect(document.querySelector('[data-gekta-draft-offer="true"]')?.textContent).toContain('Другой вопрос');
  });
});

describe('G04 close, reopen and new dialog', () => {
  it('close keeps the draft; New dialog asks first and Cancel keeps everything', async () => {
    const spy = installFetch((url) => (url.includes('locale=') ? catalogResponse() : sse([meta(), token('Ответ один.'), done(true)])));
    const { user, box } = await openAndType('Первый вопрос');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.getByText('Ответ один.')).toBeInTheDocument());
    await user.type(box, 'черновик');
    await user.click(document.querySelector<HTMLButtonElement>('.pc-public-assistant-header > .pc-public-assistant-icon-button:last-child')!);
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(screen.getByRole('button', { name: /Спросить Гекту/ }));
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('черновик');
    expect(screen.getByText('Ответ один.')).toBeInTheDocument();

    const confirm = stubConfirm(false);
    await user.click(screen.getByRole('button', { name: 'Новый диалог' }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('черновик');
    expect(screen.getByText('Ответ один.')).toBeInTheDocument();

    confirm.mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: 'Новый диалог' }));
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('');
    expect(screen.queryByText('Ответ один.')).toBeNull();
    expect(posts(spy)).toHaveLength(1);
  });
});

describe('G05 honest stream outcomes', () => {
  it('reassembles SSE frames split across network chunks', async () => {
    const whole = [meta(), token('Разбитый '), token('поток.'), done(true)].map(encodeFrame).join('');
    const chunks = [whole.slice(0, 7), whole.slice(7, 40), whole.slice(40, 41), whole.slice(41)];
    installFetch((url) => (url.includes('locale=') ? catalogResponse() : sseChunks(chunks)));
    const { user } = await openAndType('Вопрос');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.getByText('Разбитый поток.')).toBeInTheDocument());
    expect(document.querySelector('[data-interrupted="true"]')).toBeNull();
    expect(screen.getByText('Ответ Гекты получен.')).toBeInTheDocument();
  });

  it('keeps partial text after EOF without done, marks it interrupted, and sends one POST', async () => {
    const spy = installFetch((url) => (url.includes('locale=') ? catalogResponse() : sse([meta(), token('половина ответа')])));
    const { user } = await openAndType('Вопрос');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.getByText('половина ответа')).toBeInTheDocument());
    expect(document.querySelector('[data-interrupted="true"]')).not.toBeNull();
    expect(screen.getByText('Ответ прерван и не завершён')).toBeInTheDocument();
    expect(posts(spy)).toHaveLength(1);
  });

  it.each([
    [429, 'rate_limited', /Слишком много запросов/],
    [503, 'server_error', /временно не ответил/],
  ])('reports HTTP %s as %s without retrying', async (status, failure, copy) => {
    const spy = installFetch((url) => (url.includes('locale=') ? catalogResponse() : new Response('{}', { status })));
    const { user } = await openAndType('Вопрос');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(copy));
    expect(screen.getByRole('alert').getAttribute('data-gekta-failure')).toBe(failure);
    expect(posts(spy)).toHaveLength(1);
  });

  it('reports offline without a second request', async () => {
    const spy = installFetch((url) => {
      if (url.includes('locale=')) return catalogResponse();
      throw new TypeError('Failed to fetch');
    });
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    const { user } = await openAndType('Вопрос');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.getByRole('alert').getAttribute('data-gekta-failure')).toBe('offline'));
    expect(posts(spy)).toHaveLength(1);
  });

  it('treats an empty final and a malformed final as not answered', async () => {
    installFetch((url) => (url.includes('locale=') ? catalogResponse() : sse([meta(), done(true)])));
    const { user, box } = await openAndType('Пусто');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.getByText(/не буду его придумывать/)).toBeInTheDocument());

    installFetch((url) => (url.includes('locale=') ? catalogResponse() : sseChunks([`${encodeFrame(meta())}event: done\ndata: {not json\n\n`])));
    await user.type(box, 'Сломано');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.getByText(/Ответ не был завершён/)).toBeInTheDocument());
  });

  it('a late response of an older conversation never lands in the new one', async () => {
    let releaseA!: () => void;
    const holdA = new Promise<void>((resolve) => { releaseA = resolve; });
    let call = 0;
    installFetch((url) => {
      if (url.includes('locale=')) return catalogResponse();
      call += 1;
      if (call === 1) return sseChunks([encodeFrame(meta())], { holdOpen: holdA.then(() => undefined) });
      return sse([meta(), token('Ответ B.'), done(true)]);
    });
    const { user, box } = await openAndType('Вопрос A');
    await user.keyboard('{Enter}');
    stubConfirm(true);
    await user.click(screen.getByRole('button', { name: 'Новый диалог' }));
    await user.type(box, 'Вопрос B');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.getByText('Ответ B.')).toBeInTheDocument());
    releaseA();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByText('Вопрос A')).toBeNull();
    expect(document.querySelectorAll('.pc-public-assistant-message')).toHaveLength(2);
  });
});

describe('G07/G08 accessibility and public boundary', () => {
  it('returns focus to the element that opened Gekta', async () => {
    installFetch(() => catalogResponse());
    const user = userEvent.setup();
    render(<><PublicGektaChatButton locale='ru' variant='header' /><PublicPlatformAssistant /></>);
    const entry = document.querySelector<HTMLButtonElement>('[data-gekta-chat-entry="true"]')!;
    await user.click(entry);
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(document.activeElement).toBe(entry));
  });

  it('sends only message, locale, context and history; no private authority', async () => {
    const spy = installFetch((url) => (url.includes('locale=') ? catalogResponse() : sse([meta(), token('ok'), done(true)])));
    const { user } = await openAndType('Вопрос');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.getByText('ok')).toBeInTheDocument());
    const body = JSON.parse(String(posts(spy)[0][1]?.body));
    expect(Object.keys(body).sort()).toEqual(['context', 'history', 'locale', 'message']);
    expect(JSON.stringify(body)).not.toMatch(/tenantId|dealId|documentId/u);
  });

  it('never renders a javascript: citation as an active link', async () => {
    installFetch((url) => (url.includes('locale=')
      ? catalogResponse()
      : sse([meta(), { event: 'citation', streamId: STREAM, sourceId: 's', title: 'Опасная ссылка', uri: 'javascript:alert(1)' } as GatewayFrame, token('Ответ.'), done(true)])));
    const { user } = await openAndType('Вопрос');
    await user.keyboard('{Enter}');
    // The stream contract may reject the frame outright; either way the turn ends
    // and no active javascript: link exists.
    await waitFor(() => expect(document.querySelectorAll(".pc-public-assistant-message[data-role='assistant']").length).toBeGreaterThan(0));
    await waitFor(() => expect(document.querySelector("[data-stream-status='streaming']")).toBeNull());
    for (const link of document.querySelectorAll('a')) expect(link.getAttribute('href') || '').not.toMatch(/^javascript:/iu);
  });
});
