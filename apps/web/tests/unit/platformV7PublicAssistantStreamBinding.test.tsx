import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { encodeFrame, type GatewayFrame } from '@pc/ai-assistant-stream-contract';
import { PublicPlatformAssistant } from '@/components/platform-v7/PublicPlatformAssistant';

const STREAM = 'stream-abcdef12';

const meta = (modelIdentity: string | null = 'qwen@sha256:abc'): GatewayFrame =>
  ({ event: 'meta', streamId: STREAM, mode: 'public', modelIdentity });
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

const KNOWLEDGE_ANSWER = {
  requestId: 'req-1', generatedAt: '2026-07-27T10:00:00.000Z', knowledgeVersion: 'v1',
  dataMode: 'public_knowledge', mode: 'read_only', topic: 'overview',
  title: 'Как работает Сделка', answer: 'Ответ из публичной базы знаний.',
  facts: ['факт'], maturity: 'Пилот', confidence: 'high', actionAllowed: false,
  sources: [], suggestions: [], limitations: [],
};

/** Routes the component's three calls: catalog, stream, knowledge-base POST. */
function installFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    return handler(url, init);
  });
  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: spy });
  return spy;
}

const catalogResponse = () => new Response(JSON.stringify({
  knowledgeVersion: 'v1', dataMode: 'public_knowledge', actionAllowed: false,
  title: 'Помощник', description: '', starterPrompts: [],
}), { status: 200, headers: { 'Content-Type': 'application/json' } });

const knowledgeResponse = () => new Response(JSON.stringify(KNOWLEDGE_ANSWER), {
  status: 200, headers: { 'Content-Type': 'application/json' },
});

async function ask(question = 'Как работает сделка?') {
  const user = userEvent.setup();
  render(<PublicPlatformAssistant />);
  await user.click(screen.getByRole('button', { name: /Спросить о платформе/ }));
  const box = await screen.findByRole('textbox');
  await user.type(box, question);
  await user.keyboard('{Enter}');
  return user;
}

const originalFetch = globalThis.fetch;

describe('the public assistant binds to the gateway stream', () => {
  beforeEach(() => {
    document.documentElement.lang = 'ru';
  });

  afterEach(() => {
    cleanup();
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: originalFetch });
  });

  it('renders a completed stream as the answer, with the admitted model named', async () => {
    installFetch((url) => {
      if (url.includes('stream=1')) return sse([meta(), token('Сделка '), token('работает так.'), done(true)]);
      if (url.includes('locale=')) return catalogResponse();
      return knowledgeResponse();
    });

    await ask();

    await waitFor(() => expect(screen.getByText('Сделка работает так.')).toBeInTheDocument());
    expect(screen.getByText(/qwen@sha256:abc/)).toBeInTheDocument();
    // The knowledge-base answer must not also appear: one question, one answer.
    expect(screen.queryByText(KNOWLEDGE_ANSWER.answer)).not.toBeInTheDocument();
  });

  it('leaves no partial text on screen when the stream never completes', async () => {
    installFetch((url) => {
      if (url.includes('stream=1')) return sse([meta(), token('половина ответа')]);
      if (url.includes('locale=')) return catalogResponse();
      return knowledgeResponse();
    });

    await ask();

    await waitFor(() => expect(screen.getByText(/Ответ не был завершён/)).toBeInTheDocument());
    expect(screen.queryByText('половина ответа')).not.toBeInTheDocument();
  });

  it('shows an abstention as a refusal instead of substituting a prepared answer', async () => {
    const spy = installFetch((url) => {
      if (url.includes('stream=1')) return sse([meta(), refusal('ABSTAINED_NO_DATA'), done(false)]);
      if (url.includes('locale=')) return catalogResponse();
      return knowledgeResponse();
    });

    await ask('банк');

    await waitFor(() => expect(screen.getByText(/не буду его придумывать/)).toBeInTheDocument());
    // The knowledge-base endpoint must not have been consulted as a substitute.
    const posted = spy.mock.calls.map(([input]) => String(input));
    expect(posted.filter((url) => url.endsWith('/api/public-platform-assistant'))).toHaveLength(0);
    expect(screen.queryByText(KNOWLEDGE_ANSWER.answer)).not.toBeInTheDocument();
  });

  it('falls back to the verified knowledge base only when the gateway is switched off', async () => {
    // FEATURE_DISABLED is not a statement about the question, so the existing
    // public knowledge answer — which never claimed to be a model answer — stands.
    const spy = installFetch((url) => {
      if (url.includes('stream=1')) return sse([meta(null), refusal('FEATURE_DISABLED'), done(false)]);
      if (url.includes('locale=')) return catalogResponse();
      return knowledgeResponse();
    });

    await ask();

    await waitFor(() => expect(screen.getByText(KNOWLEDGE_ANSWER.answer)).toBeInTheDocument());
    expect(spy.mock.calls.some(([input]) => String(input).endsWith('/api/public-platform-assistant'))).toBe(true);
    expect(screen.queryByText(/qwen/)).not.toBeInTheDocument();
  });

  it('falls back when no model is admitted, and does not name a model it does not have', async () => {
    installFetch((url) => {
      if (url.includes('stream=1')) return sse([meta(null), refusal('MODEL_NOT_ADMITTED'), done(false)]);
      if (url.includes('locale=')) return catalogResponse();
      return knowledgeResponse();
    });

    await ask();

    await waitFor(() => expect(screen.getByText(KNOWLEDGE_ANSWER.answer)).toBeInTheDocument());
    expect(screen.queryByText(/Допущенная модель/)).not.toBeInTheDocument();
  });

  it('refuses a frame the contract rejects, even when the server sent it', async () => {
    installFetch((url) => {
      if (url.includes('stream=1')) {
        const encoder = new TextEncoder();
        const hostile = `event: token\ndata: {"event":"token","streamId":"${STREAM}","text":"ок","prepared_action":{"verb":"confirm"}}\n\n`;
        return new Response(new ReadableStream<Uint8Array>({
          start(controller) { controller.enqueue(encoder.encode(hostile)); controller.close(); },
        }), { status: 200 });
      }
      if (url.includes('locale=')) return catalogResponse();
      return knowledgeResponse();
    });

    await ask();

    await waitFor(() => expect(screen.getByText(/Ответ не был завершён/)).toBeInTheDocument());
    expect(screen.queryByText('ок')).not.toBeInTheDocument();
  });
});
