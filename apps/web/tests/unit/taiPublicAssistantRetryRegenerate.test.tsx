import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { encodeFrame, type GatewayFrame } from '@pc/ai-assistant-stream-contract';
import { PublicPlatformAssistant } from '@/components/platform-v7/PublicPlatformAssistant';

/**
 * Retry must regenerate an answer, not re-ask the question.
 *
 * It used to call `submit()` with the earlier question's text, and `submit()`
 * always appends a user turn — so every retry left a second copy of a question
 * the reader had asked once. That was not merely cosmetic: history is built by
 * reading the message list, so the next request carried the same user turn
 * twice and the derived conversation state saw the subject restated rather than
 * revisited.
 *
 * These tests read the actual request bodies the component sends, because the
 * duplicate that mattered was the one on the wire.
 */

const STREAM = 'stream-retry01';

const meta: GatewayFrame = { event: 'meta', streamId: STREAM, mode: 'public', modelIdentity: null };
const token = (text: string): GatewayFrame => ({ event: 'token', streamId: STREAM, text });
const done: GatewayFrame = { event: 'done', streamId: STREAM, complete: true };

const assessment = (): GatewayFrame => ({
  event: 'assessment',
  streamId: STREAM,
  summary: JSON.stringify({
    source: 'local_qwen',
    answerMode: 'general_agro',
    currentDataRequired: false,
    streaming: 'incremental',
    upstream: { finishReason: 'stop', truncated: false, safetyFlags: [] },
  }),
  operationalStatus: 'NOT_ATTESTED',
} as unknown as GatewayFrame);

function sse(frames: readonly GatewayFrame[]) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(frames.map(encodeFrame).join('')));
        controller.close();
      },
    }),
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
  );
}

const catalogResponse = () => new Response(JSON.stringify({
  knowledgeVersion: 'v1', dataMode: 'public_knowledge', actionAllowed: false,
  title: 'Помощник', description: '', starterPrompts: [],
}), { status: 200, headers: { 'Content-Type': 'application/json' } });

interface StreamCall { readonly message: string; readonly history: readonly { role: string; text: string }[] }

/** Every streaming request body the component sent, in order. */
function installFetch(answers: readonly string[]) {
  const calls: StreamCall[] = [];
  let index = 0;
  const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes('stream=1')) {
      const body = JSON.parse(String(init?.body ?? '{}')) as StreamCall;
      calls.push(body);
      const answer = answers[Math.min(index, answers.length - 1)];
      index += 1;
      return sse([meta, token(answer), assessment(), done]);
    }
    return catalogResponse();
  });
  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: spy });
  return calls;
}

async function openAndAsk(question: string) {
  const user = userEvent.setup();
  render(<PublicPlatformAssistant />);
  await user.click(screen.getByRole('button', { name: /Спросить Гекту/ }));
  const box = await screen.findByRole('textbox');
  await user.type(box, question);
  await user.keyboard('{Enter}');
  return user;
}

const answerBubbles = (text: string) =>
  screen.queryAllByText(text, { selector: '.pc-public-assistant-message[data-role="assistant"] .pc-public-assistant-bubble *' });

const userTurns = (question: string) =>
  screen.queryAllByText(question, { selector: '.pc-public-assistant-message[data-role="user"] *' });

async function clickRetry(user: ReturnType<typeof userEvent.setup>) {
  const buttons = await screen.findAllByRole('button', { name: 'Повторить запрос' });
  await user.click(buttons[buttons.length - 1]);
}

const originalFetch = globalThis.fetch;

describe('retry regenerates the answer without re-asking the question', () => {
  beforeEach(() => {
    document.documentElement.lang = 'ru';
    // The panel restores its transcript from session storage, so a leftover
    // conversation would shift every index this suite reasons about.
    window.sessionStorage.clear();
  });
  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: originalFetch });
  });

  const QUESTION = 'Чем удобрять картофель?';

  it('does not add a second user turn, and sends the question once', async () => {
    const calls = installFetch(['Первый ответ про калий и фосфор.', 'Второй ответ про калий и фосфор.']);
    const user = await openAndAsk(QUESTION);
    await screen.findByText('Первый ответ про калий и фосфор.');
    expect(userTurns(QUESTION)).toHaveLength(1);

    await clickRetry(user);
    await screen.findByText('Второй ответ про калий и фосфор.');

    // The visible conversation still shows the question exactly once.
    expect(userTurns(QUESTION)).toHaveLength(1);
    // And the regeneration asked for it as the current question, once.
    expect(calls).toHaveLength(2);
    expect(calls[1].message).toBe(QUESTION);
  });

  it('never puts the current question into its own history', async () => {
    const calls = installFetch(['Первый ответ.', 'Второй ответ.']);
    const user = await openAndAsk(QUESTION);
    await screen.findByText('Первый ответ.');
    await clickRetry(user);
    await screen.findByText('Второй ответ.');

    const retryHistory = calls[1].history ?? [];
    // The turn being regenerated is sent as `message`; repeating it in history
    // is the duplicate that polluted conversation state.
    expect(retryHistory.filter((turn) => turn.text === QUESTION)).toHaveLength(0);
    // The replaced answer must not be context for its own replacement either.
    expect(retryHistory.some((turn) => turn.text.includes('Первый ответ'))).toBe(false);
  });

  it('replaces the answer rather than appending a second one', async () => {
    const calls = installFetch(['Первый ответ.', 'Второй ответ.']);
    const user = await openAndAsk(QUESTION);
    await screen.findByText('Первый ответ.');
    await clickRetry(user);
    await screen.findByText('Второй ответ.');

    expect(answerBubbles('Первый ответ.')).toHaveLength(0);
    expect(answerBubbles('Второй ответ.')).toHaveLength(1);
    expect(calls).toHaveLength(2);
  });

  it('stays idempotent in visible user turns across repeated retries', async () => {
    const calls = installFetch(['Ответ один.', 'Ответ два.', 'Ответ три.']);
    const user = await openAndAsk(QUESTION);
    await screen.findByText('Ответ один.');

    await clickRetry(user);
    await screen.findByText('Ответ два.');
    await clickRetry(user);
    await screen.findByText('Ответ три.');

    expect(userTurns(QUESTION)).toHaveLength(1);
    expect(calls).toHaveLength(3);
    // Each regeneration asked the same question with the same empty history —
    // a second retry must not accumulate the answers it has been discarding.
    expect(calls[2].message).toBe(QUESTION);
    expect(calls[2].history ?? []).toHaveLength(0);
  });

  it('carries earlier turns as history but never the retried turn', async () => {
    const calls = installFetch(['Ответ про картофель.', 'Ответ про огурцы.', 'Другой ответ про огурцы.']);
    const user = await openAndAsk(QUESTION);
    await screen.findByText('Ответ про картофель.');

    const box = screen.getByRole('textbox');
    await user.type(box, 'А огурцы?');
    await user.keyboard('{Enter}');
    await screen.findByText('Ответ про огурцы.');

    await clickRetry(user);
    await screen.findByText('Другой ответ про огурцы.');

    const retryHistory = calls[2].history ?? [];
    expect(calls[2].message).toBe('А огурцы?');
    // The first exchange is legitimate context and must survive.
    expect(retryHistory.some((turn) => turn.text === QUESTION)).toBe(true);
    expect(retryHistory.some((turn) => turn.text.includes('Ответ про картофель'))).toBe(true);
    // The retried question and its replaced answer must not be in it.
    expect(retryHistory.filter((turn) => turn.text === 'А огурцы?')).toHaveLength(0);
    expect(retryHistory.some((turn) => turn.text.includes('Ответ про огурцы'))).toBe(false);
    // Both questions are still on screen exactly once each.
    expect(userTurns(QUESTION)).toHaveLength(1);
    expect(userTurns('А огурцы?')).toHaveLength(1);
  });

  it('leaves the original user turn intact when a retry is cancelled', async () => {
    let release: (() => void) | null = null;
    const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (!url.includes('stream=1')) return catalogResponse();
      if (release === null) return sse([meta, token('Первый ответ.'), assessment(), done]);
      // The retry hangs until aborted, so Stop lands mid-generation.
      const signal = init?.signal;
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
      });
    });
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: spy });

    const user = await openAndAsk(QUESTION);
    await screen.findByText('Первый ответ.');
    release = () => undefined;

    await clickRetry(user);
    const stop = await screen.findByRole('button', { name: 'Остановить ответ' });
    await user.click(stop);

    await waitFor(() => {
      // The question the reader asked survives a cancelled regeneration; it was
      // never re-sent, so there is nothing to roll back.
      expect(userTurns(QUESTION)).toHaveLength(1);
    });
  });
});

describe('stopping keeps what the reader already saw', () => {
  beforeEach(() => {
    document.documentElement.lang = 'ru';
    window.sessionStorage.clear();
  });
  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: originalFetch });
  });

  /** A stream that emits some text and then hangs until the reader aborts. */
  function installHangingStream(partial: string) {
    const encoder = new TextEncoder();
    const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (!url.includes('stream=1')) return catalogResponse();
      const signal = init?.signal;
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode([meta, token(partial)].map(encodeFrame).join('')));
            signal?.addEventListener('abort', () => { try { controller.close(); } catch { /* already closed */ } }, { once: true });
          },
        }),
        { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
      );
    });
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: spy });
  }

  it('leaves the emitted partial answer on screen after Stop', async () => {
    const partial = 'Первая часть ответа про подкормку картофеля.';
    installHangingStream(partial);
    const user = await openAndAsk('Чем удобрять картофель?');

    const assistantText = () => Array.from(
      document.querySelectorAll('.pc-public-assistant-message[data-role="assistant"]'),
    ).map(node => node.textContent || '').join(' ');

    await waitFor(() => expect(assistantText()).toContain(partial), { timeout: 5_000 });
    const stop = await screen.findByRole('button', { name: 'Остановить ответ' });
    await user.click(stop);

    // Erasing it would make a deliberate halt look like an answer that was lost.
    await waitFor(() => expect(assistantText()).toContain(partial), { timeout: 5_000 });
    // And it must not be mistakable for a completed answer.
    await waitFor(() => {
      expect(document.querySelectorAll('[data-stream-status="streaming"]')).toHaveLength(0);
      expect(document.querySelectorAll('[data-stream-status="answered"]')).toHaveLength(0);
    });
  });

  it('does not leave an empty assistant bubble when nothing was emitted', async () => {
    const encoder = new TextEncoder();
    const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (!url.includes('stream=1')) return catalogResponse();
      const signal = init?.signal;
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode(encodeFrame(meta)));
            signal?.addEventListener('abort', () => { try { controller.close(); } catch { /* already closed */ } }, { once: true });
          },
        }),
        { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
      );
    });
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: spy });

    const user = await openAndAsk('Чем удобрять картофель?');
    const stop = await screen.findByRole('button', { name: 'Остановить ответ' });
    await user.click(stop);

    await waitFor(() => {
      expect(document.querySelectorAll('.pc-public-assistant-message[data-role="assistant"]')).toHaveLength(0);
    });
  });
});

describe('the component keeps the two paths distinct', () => {
  it('regenerates through a path that does not append a user message', () => {
    const source = readComponent();

    expect(source).toContain('const regenerateAnswer = async (index: number) => {');
    expect(source).toContain('void regenerateAnswer(index)');
    // The defect, verbatim: retry delegating to the path that appends a turn.
    expect(source).not.toContain('void submit(previous.text)');
    expect(source).not.toContain('const retryMessage');
  });

  it('builds retry history from before the question and drops the invalid branch', () => {
    const source = readComponent();

    expect(source).toContain('const history = historyFrom(messages.slice(0, userIndex));');
    expect(source).toContain('setMessages((current) => current.slice(0, index));');
    // Only `submit` may append a user turn.
    expect(source.match(/setMessages\(\(current\) => \[\.\.\.current, userMessage\]\)/gu)).toHaveLength(1);
  });
});

function readComponent(): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('node:fs') as typeof import('node:fs');
  const path = require('node:path') as typeof import('node:path');
  return fs.readFileSync(
    path.resolve(process.cwd(), '../..', 'apps/web/components/platform-v7/PublicPlatformAssistant.tsx'),
    'utf8',
  );
}
