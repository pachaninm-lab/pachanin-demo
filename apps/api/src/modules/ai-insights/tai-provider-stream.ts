/**
 * Incremental parser for an OpenAI-compatible provider SSE stream.
 *
 * The parser exists so that no raw provider frame ever travels further than
 * this module. Everything downstream — the safety buffer, the gateway contract,
 * the BFF, the browser — sees only the typed events declared here. A provider
 * that changes its wire shape, or returns something unexpected, therefore
 * changes one file rather than leaking a new field into the browser.
 *
 * It is written to be fed arbitrary byte-boundary chunks: a `data:` line may
 * arrive split across three reads, a record separator may straddle a chunk, and
 * the final frame may never arrive at all because the provider disconnected.
 * None of those are exceptional cases here; they are the normal case for a
 * stream read from a socket.
 */

/** Everything the rest of the system is allowed to learn about a provider stream. */
export type ProviderStreamEvent =
  | Readonly<{ kind: 'delta'; text: string }>
  | Readonly<{ kind: 'done'; finishReason: ProviderFinishReason; promptTokens: number | null; completionTokens: number | null }>
  | Readonly<{ kind: 'error'; errorClass: ProviderErrorClass }>
  | Readonly<{ kind: 'cancelled' }>;

export type ProviderFinishReason = 'stop' | 'length' | 'other';

export const PROVIDER_ERROR_CLASSES = [
  'provider_contract',
  'provider_transport',
  'provider_overflow',
] as const;

export type ProviderErrorClass = (typeof PROVIDER_ERROR_CLASSES)[number];

/**
 * Largest partial record held while waiting for its terminator.
 *
 * A provider that never sends a record separator would otherwise grow this
 * buffer without limit, turning a misbehaving upstream into an out-of-memory
 * condition in the gateway.
 */
export const MAX_PENDING_RECORD_CHARS = 262_144;

/** Largest total answer text accepted from one stream. */
export const MAX_STREAM_TEXT_CHARS = 60_000;

function integerOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function finishReasonOf(value: unknown): ProviderFinishReason {
  return value === 'stop' ? 'stop' : value === 'length' ? 'length' : 'other';
}

export class ProviderSseParser {
  private pending = '';

  private finished = false;

  private emittedText = 0;

  private promptTokens: number | null = null;

  private completionTokens: number | null = null;

  private finishReason: ProviderFinishReason = 'other';

  /**
   * Feed a chunk of decoded provider output.
   *
   * Returns the events that became complete because of this chunk — often none,
   * when the chunk ended mid-record.
   */
  push(chunk: string): readonly ProviderStreamEvent[] {
    if (this.finished) return [];
    this.pending += chunk;

    if (this.pending.length > MAX_PENDING_RECORD_CHARS) {
      this.finished = true;
      this.pending = '';
      return [{ kind: 'error', errorClass: 'provider_overflow' }];
    }

    const events: ProviderStreamEvent[] = [];
    // A record ends at a blank line. Providers differ on CRLF, so both are
    // accepted rather than assuming the one we happened to test against.
    const normalized = this.pending.replace(/\r\n/gu, '\n');
    const blocks = normalized.split('\n\n');
    this.pending = blocks.pop() ?? '';

    for (const block of blocks) {
      const event = this.consumeRecord(block);
      if (event) {
        events.push(...event);
        if (this.finished) return events;
      }
    }
    return events;
  }

  /**
   * Close the stream.
   *
   * A provider that disconnects mid-answer leaves a partial record behind. That
   * record is deliberately not parsed: half a JSON frame is not evidence of
   * anything, and guessing at it is how truncated content becomes a confident
   * answer. The stream ends as a transport error unless a real terminator was
   * already seen.
   */
  finish(): readonly ProviderStreamEvent[] {
    if (this.finished) return [];
    this.finished = true;
    const hadPartial = this.pending.trim().length > 0;
    this.pending = '';
    if (hadPartial) return [{ kind: 'error', errorClass: 'provider_transport' }];
    return [{ kind: 'done', finishReason: this.finishReason, promptTokens: this.promptTokens, completionTokens: this.completionTokens }];
  }

  /** Mark the stream cancelled; emits exactly one terminal cancelled event. */
  cancel(): readonly ProviderStreamEvent[] {
    if (this.finished) return [];
    this.finished = true;
    this.pending = '';
    return [{ kind: 'cancelled' }];
  }

  private consumeRecord(block: string): readonly ProviderStreamEvent[] | null {
    // SSE allows a payload to span several `data:` lines; they join with \n.
    const dataLines = block
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice('data:'.length).replace(/^ /u, ''));

    if (dataLines.length === 0) return null;
    const payload = dataLines.join('\n').trim();
    if (!payload) return null;

    if (payload === '[DONE]') {
      this.finished = true;
      return [{ kind: 'done', finishReason: this.finishReason, promptTokens: this.promptTokens, completionTokens: this.completionTokens }];
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      // One unreadable frame ends the stream. Skipping it would mean emitting an
      // answer with a hole in it and calling that a success.
      this.finished = true;
      return [{ kind: 'error', errorClass: 'provider_contract' }];
    }

    const row = asRecord(parsed);
    if (!row) {
      this.finished = true;
      return [{ kind: 'error', errorClass: 'provider_contract' }];
    }

    if (row.error) {
      this.finished = true;
      return [{ kind: 'error', errorClass: 'provider_contract' }];
    }

    const usage = asRecord(row.usage);
    if (usage) {
      this.promptTokens = integerOrNull(usage.prompt_tokens) ?? this.promptTokens;
      this.completionTokens = integerOrNull(usage.completion_tokens) ?? this.completionTokens;
    }

    const choices = Array.isArray(row.choices) ? row.choices : [];
    const first = asRecord(choices[0]);
    if (!first) return null;

    if (first.finish_reason) this.finishReason = finishReasonOf(first.finish_reason);

    const delta = asRecord(first.delta) ?? asRecord(first.message);
    const content = delta?.content;
    if (typeof content !== 'string' || content.length === 0) return null;

    this.emittedText += content.length;
    if (this.emittedText > MAX_STREAM_TEXT_CHARS) {
      this.finished = true;
      return [{ kind: 'error', errorClass: 'provider_overflow' }];
    }

    return [{ kind: 'delta', text: content }];
  }
}

/**
 * Body of the streaming request sent to the provider.
 *
 * Kept beside the parser so the flag that turns streaming on and the code that
 * can read a streamed response cannot drift apart.
 */
export function providerStreamRequestBody(
  model: string,
  messages: readonly Readonly<{ role: string; content: string }>[],
  maxTokens: number,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    model,
    messages,
    temperature: 0,
    seed: 0,
    max_tokens: maxTokens,
    stream: true,
    stream_options: { include_usage: true },
    chat_template_kwargs: { enable_thinking: false },
  });
}
