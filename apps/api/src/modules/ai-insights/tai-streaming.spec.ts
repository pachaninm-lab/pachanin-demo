import { ProviderSseParser, providerStreamRequestBody, type ProviderStreamEvent } from './tai-provider-stream';
import { SemanticSafetyBuffer, trimDanglingSurrogate } from './tai-safety-buffer';

function frame(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;
}

function feed(parser: ProviderSseParser, chunks: readonly string[]): ProviderStreamEvent[] {
  const events: ProviderStreamEvent[] = [];
  for (const chunk of chunks) events.push(...parser.push(chunk));
  return events;
}

function deltas(events: readonly ProviderStreamEvent[]): string {
  return events.filter((event) => event.kind === 'delta').map((event) => (event as { text: string }).text).join('');
}

/** Feed a string one character at a time — the harshest chunk boundary there is. */
function pushCharByChar(buffer: SemanticSafetyBuffer, text: string): string {
  let safe = '';
  for (const character of text) safe += buffer.push(character).safe;
  return safe;
}

describe('provider SSE parser', () => {
  it('requests streaming from the provider', () => {
    const body = providerStreamRequestBody('tai-qwen3-8b-q4km', [{ role: 'user', content: 'x' }], 900);

    expect(body.stream).toBe(true);
    expect(body.chat_template_kwargs).toEqual({ enable_thinking: false });
  });

  it('emits a delta as soon as its record completes, without waiting for done', () => {
    const parser = new ProviderSseParser();

    const events = parser.push(frame('Фосфор'));

    expect(events).toEqual([{ kind: 'delta', text: 'Фосфор' }]);
  });

  it('reassembles a record split across arbitrary chunk boundaries', () => {
    const parser = new ProviderSseParser();
    const wire = frame('Фосфор влияет на корневую систему.');
    const chunks = [wire.slice(0, 7), wire.slice(7, 19), wire.slice(19, 40), wire.slice(40)];

    expect(deltas(feed(parser, chunks))).toBe('Фосфор влияет на корневую систему.');
  });

  it('emits nothing while a record is still incomplete', () => {
    const parser = new ProviderSseParser();
    const wire = frame('частичный');

    expect(parser.push(wire.slice(0, wire.length - 3))).toEqual([]);
  });

  it('joins a payload spread over several data lines, per the SSE rule', () => {
    // SSE concatenates successive `data:` lines with a newline between them, so
    // the reassembled payload must be valid with those newlines present. Using a
    // pretty-printed frame exercises the join without asserting that arbitrary
    // mid-token splits are legal, which they are not.
    const parser = new ProviderSseParser();
    const json = JSON.stringify({ choices: [{ delta: { content: 'многострочный' } }] }, null, 2);
    const wire = `${json.split('\n').map((line) => `data: ${line}`).join('\n')}\n\n`;

    expect(deltas(parser.push(wire))).toBe('многострочный');
  });

  it('ignores non-data SSE fields such as event and id', () => {
    const parser = new ProviderSseParser();

    const events = parser.push(`event: message\nid: 42\ndata: ${JSON.stringify({ choices: [{ delta: { content: 'ок' } }] })}\n\n`);

    expect(deltas(events)).toBe('ок');
  });

  it('accepts CRLF record separators', () => {
    const parser = new ProviderSseParser();

    const events = parser.push(`data: ${JSON.stringify({ choices: [{ delta: { content: 'ok' } }] })}\r\n\r\n`);

    expect(deltas(events)).toBe('ok');
  });

  it('treats [DONE] as the terminator and reports usage seen along the way', () => {
    const parser = new ProviderSseParser();
    parser.push(`data: ${JSON.stringify({ choices: [{ delta: { content: 'a' }, finish_reason: 'stop' }], usage: { prompt_tokens: 12, completion_tokens: 3 } })}\n\n`);

    const events = parser.push('data: [DONE]\n\n');

    expect(events).toEqual([{ kind: 'done', finishReason: 'stop', promptTokens: 12, completionTokens: 3 }]);
  });

  it('ends the stream on a malformed frame rather than emitting an answer with a hole', () => {
    const parser = new ProviderSseParser();

    const events = parser.push('data: {not json at all\n\n');

    expect(events).toEqual([{ kind: 'error', errorClass: 'provider_contract' }]);
  });

  it('surfaces a provider error frame as a controlled error', () => {
    const parser = new ProviderSseParser();

    const events = parser.push(`data: ${JSON.stringify({ error: { message: 'model overloaded' } })}\n\n`);

    expect(events).toEqual([{ kind: 'error', errorClass: 'provider_contract' }]);
  });

  it('never forwards raw provider fields, only the typed contract', () => {
    const parser = new ProviderSseParser();
    const events = parser.push(`data: ${JSON.stringify({
      id: 'chatcmpl-secret-internal-id',
      system_fingerprint: 'fp_do_not_leak',
      choices: [{ delta: { content: 'текст' } }],
    })}\n\n`);

    expect(JSON.stringify(events)).not.toContain('fp_do_not_leak');
    expect(JSON.stringify(events)).not.toContain('chatcmpl-secret-internal-id');
    expect(events).toEqual([{ kind: 'delta', text: 'текст' }]);
  });

  it('fails a disconnect that left a partial record rather than guessing at it', () => {
    const parser = new ProviderSseParser();
    parser.push('data: {"choices":[{"delta":{"content":"обрыв');

    expect(parser.finish()).toEqual([{ kind: 'error', errorClass: 'provider_transport' }]);
  });

  it('completes cleanly when the stream ended on a record boundary', () => {
    const parser = new ProviderSseParser();
    parser.push(frame('готово'));

    expect(parser.finish()).toEqual([{ kind: 'done', finishReason: 'other', promptTokens: null, completionTokens: null }]);
  });

  it('emits exactly one terminal event on cancellation', () => {
    const parser = new ProviderSseParser();
    parser.push(frame('частично'));

    expect(parser.cancel()).toEqual([{ kind: 'cancelled' }]);
    expect(parser.cancel()).toEqual([]);
    expect(parser.finish()).toEqual([]);
  });

  it('refuses an unterminated record that would grow without bound', () => {
    const parser = new ProviderSseParser();

    const events = parser.push(`data: ${'x'.repeat(300_000)}`);

    expect(events).toEqual([{ kind: 'error', errorClass: 'provider_overflow' }]);
  });
});

describe('semantic safety buffer — content split across chunks', () => {
  it('suppresses a reasoning tag split as "<thi" + "nk>"', () => {
    const buffer = new SemanticSafetyBuffer();

    const first = buffer.push('Ответ. <thi');
    const second = buffer.push('nk>скрытые рассуждения</think> Продолжение.');
    const flushed = buffer.flush();

    const emitted = first.safe + second.safe + flushed.safe;
    expect(emitted).not.toContain('скрытые рассуждения');
    expect(emitted).not.toContain('<think>');
    expect(emitted).toContain('Ответ.');
    expect(emitted).toContain('Продолжение.');
  });

  it('suppresses reasoning when every character arrives separately', () => {
    const buffer = new SemanticSafetyBuffer();

    const safe = pushCharByChar(buffer, 'Начало. <think>внутренний монолог</think> Конец.') + buffer.flush().safe;

    expect(safe).not.toContain('внутренний монолог');
    expect(safe).toContain('Начало.');
    expect(safe).toContain('Конец.');
  });

  it('blocks a credential split across three deltas', () => {
    const buffer = new SemanticSafetyBuffer();

    const a = buffer.push('Ключ: sk-proj-');
    const b = buffer.push('ABCDEFGHIJ');
    const c = buffer.push('KLMNOPQRST endline');

    const emitted = a.safe + b.safe + c.safe;
    expect(emitted).not.toContain('sk-proj-ABCDEFGHIJKLMNOPQRST');
    expect(c.blocked ?? b.blocked ?? a.blocked).toBe('secret_like');
  });

  it('blocks a bearer token split at the space', () => {
    const buffer = new SemanticSafetyBuffer();
    buffer.push('Заголовок Bearer');
    const result = buffer.push(' abcdefghijklmnopqrstuvwx ');

    expect(result.blocked).toBe('secret_like');
  });

  it('blocks a false completed-write claim split mid-sentence', () => {
    const buffer = new SemanticSafetyBuffer();

    const first = buffer.push('Я под');
    const second = buffer.push('писал документ и выплатил деньги.');

    expect(first.safe + second.safe).not.toContain('подписал документ');
    expect(second.blocked ?? first.blocked).toBe('write_claim');
  });

  it('stays terminally blocked once blocked', () => {
    const buffer = new SemanticSafetyBuffer();
    buffer.push('Я подписал документ.');

    expect(buffer.push(' Обычный безопасный текст.')).toEqual({ safe: '', blocked: 'write_claim' });
    expect(buffer.flush().blocked).toBe('write_claim');
  });

  it('fails rather than flushing the contents of an unterminated reasoning block', () => {
    const buffer = new SemanticSafetyBuffer();
    buffer.push('Ответ. <think>рассуждение без закрытия');

    const flushed = buffer.flush();

    expect(flushed.blocked).toBe('unterminated_reasoning');
    expect(flushed.safe).not.toContain('рассуждение без закрытия');
  });
});

describe('semantic safety buffer — ordinary text stays progressive', () => {
  it('releases plain text on the delta that produced it', () => {
    const buffer = new SemanticSafetyBuffer();

    const result = buffer.push('Фосфор отвечает за развитие корневой системы. ');

    expect(result.safe).toContain('Фосфор отвечает за развитие корневой системы.');
    expect(result.blocked).toBeNull();
  });

  it('preserves the full answer and its citations across many deltas', () => {
    const buffer = new SemanticSafetyBuffer();
    const parts = ['Снижение урожайности ', 'связано с питанием, ', 'влагой и густотой стояния. ', 'Источник: Как работает сделка.'];

    let safe = '';
    for (const part of parts) safe += buffer.push(part).safe;
    safe += buffer.flush().safe;

    expect(safe).toBe(parts.join(''));
  });

  it('holds back no more than the declared bound', () => {
    const buffer = new SemanticSafetyBuffer();
    const text = 'обычный текст без опасных конструкций '.repeat(20);

    const emitted = buffer.push(text).safe;

    expect(text.length - emitted.length).toBeLessThanOrEqual(128);
  });

  it('keeps angle-bracket text that is not a reasoning tag', () => {
    const buffer = new SemanticSafetyBuffer();

    const safe = buffer.push('Условие: a < b и b > c.').safe + buffer.flush().safe;

    expect(safe).toBe('Условие: a < b и b > c.');
  });

  it('does not split a surrogate pair across an emission', () => {
    expect(trimDanglingSurrogate('поле \ud83c')).toBe('поле ');
    expect(trimDanglingSurrogate('поле 🌾')).toBe('поле 🌾');
  });
});
