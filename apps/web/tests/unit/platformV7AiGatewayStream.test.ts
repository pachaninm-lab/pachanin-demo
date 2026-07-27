import { describe, expect, it, vi } from 'vitest';
import type { GatewayFrame } from '@pc/ai-assistant-stream-contract';
import { encodeFrame } from '@pc/ai-assistant-stream-contract';
import {
  applyFrame,
  readGatewayStream,
  recordPayload,
  sealSnapshot,
  snapshotAgreesWithContract,
  splitRecords,
  type GatewayStreamSnapshot,
} from '@/lib/platform-v7/ai-gateway-stream';

const STREAM = 'stream-abcdef12';

const meta = (modelIdentity: string | null = 'qwen@sha256:abc'): GatewayFrame =>
  ({ event: 'meta', streamId: STREAM, mode: 'public', modelIdentity });
const token = (text: string): GatewayFrame => ({ event: 'token', streamId: STREAM, text });
const done = (complete: boolean): GatewayFrame => ({ event: 'done', streamId: STREAM, complete });
const error = (refusal: GatewayFrame extends { refusal: infer R } ? R : never, message = 'refused'): GatewayFrame =>
  ({ event: 'error', streamId: STREAM, refusal, message } as GatewayFrame);

/** A response whose body arrives in the exact chunks given, boundaries included. */
function sseResponse(chunks: readonly string[], init: { ok?: boolean; body?: boolean } = {}) {
  if (init.body === false) return { ok: init.ok ?? true, body: null } as unknown as Response;
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(body, { status: init.ok === false ? 500 : 200 });
}

const wire = (frames: readonly GatewayFrame[]) => frames.map(encodeFrame).join('');

describe('the SSE wire is parsed without trusting chunk boundaries', () => {
  it('keeps an unfinished record instead of parsing a truncated payload', () => {
    const { records, rest } = splitRecords('event: token\ndata: {"a":1}\n\nevent: token\ndata: {"b":');

    expect(records).toHaveLength(1);
    expect(rest).toBe('event: token\ndata: {"b":');
  });

  it('reads the data line of a record and ignores the event line', () => {
    expect(recordPayload('event: token\ndata: {"x":1}')).toBe('{"x":1}');
    expect(recordPayload('event: token')).toBeNull();
  });

  it('reassembles a frame split across two network chunks', async () => {
    const full = wire([meta(), token('цена выросла'), done(true)]);
    const cut = Math.floor(full.length / 2);
    const snapshot = await readGatewayStream(sseResponse([full.slice(0, cut), full.slice(cut)]), { mode: 'public' });

    expect(snapshot.status).toBe('answered');
    expect(snapshot.text).toBe('цена выросла');
  });
});

describe('what the reader is allowed to see', () => {
  const base: GatewayStreamSnapshot = {
    status: 'streaming', text: '', citations: [], assessment: null, modelIdentity: null, refusal: null,
  };

  it('shows tokens while they arrive, but not as an answer yet', () => {
    const streaming = applyFrame(applyFrame(base, token('цена ')), token('выросла'));

    expect(streaming).toMatchObject({ status: 'streaming', text: 'цена выросла' });
  });

  it('turns provisional text into an answer only on done{complete:true}', () => {
    const answered = applyFrame(applyFrame(base, token('готово')), done(true));

    expect(answered).toMatchObject({ status: 'answered', text: 'готово' });
  });

  it('drops the text when done says the answer was not finished', () => {
    const refused = applyFrame(applyFrame(base, token('половина')), done(false));

    expect(refused).toMatchObject({ status: 'refused', text: '' });
  });

  it('drops the text when a refusal arrived before a complete done', () => {
    // A server that sent an error and then `done{complete:true}` must not be
    // able to talk the client into showing the partial text anyway.
    const withError = applyFrame(applyFrame(base, token('половина')), error('UPSTREAM_ERROR'));
    const sealed = applyFrame(withError, done(true));

    expect(sealed).toMatchObject({ status: 'refused', text: '', refusal: 'UPSTREAM_ERROR' });
  });

  it('refuses a stream that completed without saying anything', () => {
    // An empty bubble would read as the assistant having considered the
    // question and had nothing to add. `resolveOutcome` calls this unusable too.
    const empty = applyFrame(base, done(true));

    expect(empty).toMatchObject({ status: 'refused', text: '', refusal: 'ABSTAINED_NO_DATA' });
  });

  it('treats a stream that simply stopped as a refusal, not as an answer', () => {
    const sealed = sealSnapshot(applyFrame(base, token('половина')), 'UPSTREAM_ERROR');

    expect(sealed).toMatchObject({ status: 'refused', text: '', refusal: 'UPSTREAM_ERROR' });
  });

  it('keeps the refusal the server actually gave rather than overwriting it', () => {
    const sealed = sealSnapshot(applyFrame(base, error('ABSTAINED_NO_DATA')), 'UPSTREAM_ERROR');

    expect(sealed.refusal).toBe('ABSTAINED_NO_DATA');
  });
});

describe('reading a whole stream', () => {
  it('publishes a snapshot per frame so the UI can render progressively', async () => {
    const onSnapshot = vi.fn();
    await readGatewayStream(sseResponse([wire([meta(), token('а'), token('б'), done(true)])]), {
      mode: 'public',
      onSnapshot,
    });

    const texts = onSnapshot.mock.calls.map(([snapshot]) => (snapshot as GatewayStreamSnapshot).text);
    expect(texts).toEqual(['', 'а', 'аб', 'аб']);
  });

  it('surfaces the admitted model identity from meta', async () => {
    const snapshot = await readGatewayStream(sseResponse([wire([meta('qwen@sha256:abc'), token('x'), done(true)])]), { mode: 'public' });

    expect(snapshot.modelIdentity).toBe('qwen@sha256:abc');
  });

  it('reports a refusal as a refusal rather than throwing at the caller', async () => {
    const snapshot = await readGatewayStream(
      sseResponse([wire([meta(null), error('FEATURE_DISABLED', 'not enabled'), done(false)])]),
      { mode: 'public' },
    );

    expect(snapshot).toMatchObject({ status: 'refused', text: '', refusal: 'FEATURE_DISABLED', modelIdentity: null });
  });

  it('refuses a frame the contract rejects, even though the server sent it', async () => {
    // The client validates too: the thing being protected is what the reader
    // sees, and the reader is on this side of the socket.
    const hostile = 'event: token\ndata: {"event":"token","streamId":"stream-abcdef12","text":"ок","prepared_action":{"verb":"confirm"}}\n\n';
    const snapshot = await readGatewayStream(sseResponse([hostile]), { mode: 'public' });

    expect(snapshot).toMatchObject({ status: 'refused', text: '', refusal: 'UPSTREAM_ERROR' });
  });

  it('refuses a private identity key arriving on a public stream', async () => {
    const leaky = 'event: meta\ndata: {"event":"meta","streamId":"stream-abcdef12","mode":"public","modelIdentity":null,"tenantId":"t-1"}\n\n';
    const snapshot = await readGatewayStream(sseResponse([leaky]), { mode: 'public' });

    expect(snapshot.status).toBe('refused');
  });

  it('refuses bytes that are not the contract at all', async () => {
    const snapshot = await readGatewayStream(sseResponse(['event: token\ndata: not json\n\n']), { mode: 'public' });

    expect(snapshot).toMatchObject({ status: 'refused', refusal: 'UPSTREAM_ERROR' });
  });

  it('refuses a transport failure before any frame', async () => {
    const snapshot = await readGatewayStream(sseResponse([], { ok: false, body: false }), { mode: 'public' });

    expect(snapshot).toMatchObject({ status: 'refused', text: '', refusal: 'UPSTREAM_ERROR' });
  });

  it('discards a partial answer when the stream ends without done', async () => {
    const snapshot = await readGatewayStream(sseResponse([wire([meta(), token('половина ответа')])]), { mode: 'public' });

    expect(snapshot).toMatchObject({ status: 'refused', text: '' });
  });

  it('marks a reader-cancelled stream CANCELLED rather than as a server fault', async () => {
    const controller = new AbortController();
    controller.abort();
    const snapshot = await readGatewayStream(sseResponse([wire([meta(), token('половина')])]), {
      mode: 'public',
      signal: controller.signal,
    });

    expect(snapshot).toMatchObject({ status: 'refused', text: '', refusal: 'CANCELLED' });
  });

  it('stops reading once the stream is sealed', async () => {
    const trailing = wire([meta(), token('готово'), done(true), token('после конца')]);
    const snapshot = await readGatewayStream(sseResponse([trailing]), { mode: 'public' });

    expect(snapshot.text).toBe('готово');
  });
});

describe('the incremental fold never disagrees with the contract', () => {
  const cases: ReadonlyArray<readonly [string, readonly GatewayFrame[]]> = [
    ['a completed answer', [meta(), token('цена '), token('выросла'), done(true)]],
    ['a cancelled answer', [meta(), token('цена '), error('CANCELLED'), done(false)]],
    ['a refusal with no tokens', [meta(null), error('FEATURE_DISABLED'), done(false)]],
    ['an incomplete done', [meta(), token('половина'), done(false)]],
    ['an empty completed stream', [meta(), done(true)]],
  ];

  it.each(cases)('agrees with resolveOutcome on %s', async (_name, frames) => {
    const snapshot = await readGatewayStream(sseResponse([wire(frames)]), { mode: 'public' });

    expect(snapshotAgreesWithContract(snapshot, frames)).toBe(true);
  });
});
