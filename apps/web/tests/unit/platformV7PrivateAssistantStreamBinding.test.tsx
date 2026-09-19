import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { encodeFrame, type GatewayFrame } from '@pc/ai-assistant-stream-contract';

vi.mock('next/navigation', () => ({ usePathname: () => '/platform-v7/buyer' }));

import { AiAssistantPanel } from '@/components/platform-v7/AiAssistantPanel';

const STREAM = 'stream-abcdef12';

const meta = (modelIdentity: string | null = 'qwen@sha256:abc'): GatewayFrame =>
  ({ event: 'meta', streamId: STREAM, mode: 'private', modelIdentity });
const token = (text: string): GatewayFrame => ({ event: 'token', streamId: STREAM, text });
const done = (complete: boolean): GatewayFrame => ({ event: 'done', streamId: STREAM, complete });
const refusal = (code: string): GatewayFrame =>
  ({ event: 'error', streamId: STREAM, refusal: code, message: 'refused' } as unknown as GatewayFrame);

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

const CHAT_ANSWER = {
  requestId: 'req-1',
  answer: 'Ответ, составленный сервером.',
  provider: 'local-deterministic',
  mode: 'read_only',
  dataMode: 'authoritative',
  role: 'BUYER',
  dealId: null,
  generatedAt: '2026-07-27T10:00:00.000Z',
  citations: [],
  limitations: [],
  decision: {
    summary: 'Сводка', reason: null, nextAction: null, ownerRole: null, deadlineAt: null,
    moneyAtRiskKopecks: null, confidence: 'high', actionAllowed: false, actionKind: 'NONE',
    intent: 'status', evidence: [], followUps: [], dataFreshnessAt: '2026-07-27T10:00:00.000Z',
  },
};

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });

function installFetch(handler: (url: string) => Response | Promise<Response>) {
  const spy = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    return handler(url);
  });
  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: spy });
  return spy;
}

const catalogResponse = () => json({
  title: 'Помощник сделки', mode: 'authoritative', dataMode: 'authoritative',
  presence: 'online', starterPrompts: [],
});

async function ask(question = 'Что требует внимания?') {
  const user = userEvent.setup();
  render(<AiAssistantPanel />);
  const trigger = await screen.findByRole('button', { name: /помощник|assistant/i });
  await user.click(trigger);
  const box = await screen.findByRole('textbox');
  await user.type(box, question);
  await user.keyboard('{Enter}');
  return user;
}

const originalFetch = globalThis.fetch;

describe('the private assistant panel binds to the gateway stream', () => {
  beforeEach(() => {
    document.documentElement.lang = 'ru';
  });

  afterEach(() => {
    cleanup();
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: originalFetch });
  });

  it('renders a completed stream as the answer and names the admitted model', async () => {
    installFetch((url) => {
      if (url.includes('ai-assistant/stream')) return sse([meta(), token('Груз '), token('в пути.'), done(true)]);
      if (url.includes('ai-assistant/catalog')) return catalogResponse();
      return json(CHAT_ANSWER);
    });

    await ask();

    await waitFor(() => expect(screen.getByText('Груз в пути.')).toBeInTheDocument());
    expect(screen.getByText(/qwen@sha256:abc/)).toBeInTheDocument();
    expect(screen.queryByText(CHAT_ANSWER.answer)).not.toBeInTheDocument();
  });

  it('leaves no partial text on screen when the stream never completes', async () => {
    installFetch((url) => {
      if (url.includes('ai-assistant/stream')) return sse([meta(), token('половина ответа')]);
      if (url.includes('ai-assistant/catalog')) return catalogResponse();
      return json(CHAT_ANSWER);
    });

    await ask();

    await waitFor(() => expect(screen.getByText(/Ответ не был завершён/)).toBeInTheDocument());
    expect(screen.queryByText('половина ответа')).not.toBeInTheDocument();
  });

  it('shows an abstention as a refusal without falling back to the composed answer', async () => {
    const spy = installFetch((url) => {
      if (url.includes('ai-assistant/stream')) return sse([meta(), refusal('ABSTAINED_NO_DATA'), done(false)]);
      if (url.includes('ai-assistant/catalog')) return catalogResponse();
      return json(CHAT_ANSWER);
    });

    await ask();

    await waitFor(() => expect(screen.getByText(/не буду его придумывать/)).toBeInTheDocument());
    expect(spy.mock.calls.some(([input]) => String(input).includes('ai-assistant/chat'))).toBe(false);
    expect(screen.queryByText(CHAT_ANSWER.answer)).not.toBeInTheDocument();
  });

  it('falls back to the composed answer only when the gateway is switched off', async () => {
    const spy = installFetch((url) => {
      if (url.includes('ai-assistant/stream')) return sse([meta(null), refusal('FEATURE_DISABLED'), done(false)]);
      if (url.includes('ai-assistant/catalog')) return catalogResponse();
      return json(CHAT_ANSWER);
    });

    await ask();

    await waitFor(() => expect(screen.getByText(CHAT_ANSWER.answer)).toBeInTheDocument());
    expect(spy.mock.calls.some(([input]) => String(input).includes('ai-assistant/chat'))).toBe(true);
    expect(screen.queryByText(/Допущенная модель/)).not.toBeInTheDocument();
  });

  it('falls back when no model is admitted, and names no model it does not have', async () => {
    installFetch((url) => {
      if (url.includes('ai-assistant/stream')) return sse([meta(null), refusal('MODEL_NOT_ADMITTED'), done(false)]);
      if (url.includes('ai-assistant/catalog')) return catalogResponse();
      return json(CHAT_ANSWER);
    });

    await ask();

    await waitFor(() => expect(screen.getByText(CHAT_ANSWER.answer)).toBeInTheDocument());
    expect(screen.queryByText(/qwen/)).not.toBeInTheDocument();
  });

  it('refuses a frame carrying server identity, even on the private contour', async () => {
    // Private mode is not a licence to echo tenant or role back to the browser:
    // the session already established them, so a frame restating them can only
    // be an echo the client could tamper with.
    installFetch((url) => {
      if (url.includes('ai-assistant/stream')) {
        const leaky = `event: token\ndata: {"event":"token","streamId":"${STREAM}","text":"ок","tenantId":"t-1"}\n\n`;
        const encoder = new TextEncoder();
        return new Response(new ReadableStream<Uint8Array>({
          start(controller) { controller.enqueue(encoder.encode(leaky)); controller.close(); },
        }), { status: 200 });
      }
      if (url.includes('ai-assistant/catalog')) return catalogResponse();
      return json(CHAT_ANSWER);
    });

    await ask();

    await waitFor(() => expect(screen.getByText(/Ответ не был завершён/)).toBeInTheDocument());
    expect(screen.queryByText('ок')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain('t-1');
  });
});
