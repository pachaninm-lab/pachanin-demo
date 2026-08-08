/**
 * Bounded semantic safety buffer for streamed model text.
 *
 * Answer-level redaction is easy: you have the whole string, you match it, you
 * refuse it. Streaming removes that luxury. `<think>` can arrive as `<thi` then
 * `nk>`, an API key can straddle three deltas, and a check applied per chunk
 * would pass every one of them while the concatenation is exactly what it was
 * meant to catch.
 *
 * The buffer solves this by never releasing a tail that could still grow into
 * something prohibited. It holds back the shortest suffix that is a viable
 * prefix of a dangerous token, releases everything before it immediately, and
 * on flush re-checks whatever is left. Text that is obviously safe is released
 * on the delta that produced it, so progressive rendering stays progressive.
 *
 * Both bounds are explicit. `MAX_HOLDBACK_CHARS` caps how much may be withheld,
 * so a crafted stream cannot make the buffer grow or stall the answer, and the
 * hold is capped in characters rather than time so behaviour is identical under
 * test and under load.
 */

export const SAFETY_BLOCK_REASONS = [
  'secret_like',
  'write_claim',
  'unterminated_reasoning',
] as const;

export type SafetyBlockReason = (typeof SAFETY_BLOCK_REASONS)[number];

export type SafetyBufferOutput = Readonly<{
  /** Text cleared for emission. Empty when everything is still held back. */
  safe: string;
  /** Set once, terminally, when the stream cannot be completed safely. */
  blocked: SafetyBlockReason | null;
}>;

/**
 * Longest suffix the buffer will withhold.
 *
 * Sized to cover the longest prohibited token the buffer must never split
 * across a release boundary: a 64-character hex secret plus a little room. It
 * is a latency cost of roughly one short sentence, paid once at the tail of
 * each delta, and it is the price of not shipping half a credential.
 */
export const MAX_HOLDBACK_CHARS = 128;

/** Largest amount of suppressed reasoning tolerated before the stream is failed. */
export const MAX_SUPPRESSED_REASONING_CHARS = 32_000;

/**
 * Tails that could still become something prohibited.
 *
 * Each alternative is a *partial* form: `<`, `<t`, `<th` … are all viable
 * prefixes of `<think>`, so any of them at the very end of the pending text
 * means "wait for more input" rather than "safe to send".
 */
const VIABLE_DANGER_PREFIX = new RegExp(
  '(?:'
  // Opening or closing reasoning/scratchpad tags, at any stage of arrival.
  + '<\\/?(?:t(?:h(?:i(?:n(?:k)?)?)?)?)?'
  + '|<\\/?(?:s(?:c(?:r(?:a(?:t(?:c(?:h(?:p(?:a(?:d)?)?)?)?)?)?)?)?)?)?'
  // Special-token style markers such as <|assistant|>.
  + '|<\\|[^>]{0,64}'
  // Credentials mid-arrival.
  + '|sk-(?:proj-)?[A-Za-z0-9_-]{0,48}'
  + '|B(?:e(?:a(?:r(?:e(?:r)?)?)?)?)?(?:\\s+[A-Za-z0-9._~+/=-]{0,48})?'
  + '|A(?:K(?:I(?:A)?)?|S(?:I(?:A)?)?)?[A-Z0-9]{0,20}'
  + '|[A-Fa-f0-9]{8,}'
  // A first-person claim that may still resolve into a completed-write
  // assertion. The pronoun must stand as its own word: an unanchored "I" also
  // occurs inside ordinary tokens, and matching it there would hold back the
  // tail of almost every English answer — and, worse, of any base64-ish string
  // containing a capital I, which is how a real credential once slipped past
  // the release check while the buffer thought it was waiting for a sentence.
  + '|(?:^|[\\s(«"])(?:я|Я|I|我)(?:[\\s,][^.!?\\n]{0,58})?'
  + ')$',
  'u',
);

/** Complete prohibited literals, checked against text about to be released. */
const SECRET_PATTERN =
  /(?:\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b|\bBearer\s+[A-Za-z0-9._~+/=-]{16,}\b|\b(?:AKIA|ASIA)[A-Z0-9]{16}\b)/u;

/**
 * Claims that the assistant performed a mutation.
 *
 * TAI has no write path, so any such sentence is false by construction. It is
 * blocked rather than stripped: removing the verb would leave a sentence that
 * still reads as confirmation.
 */
const WRITE_CLAIM_PATTERN =
  /(?:я|i|我).{0,40}(?:изменил|удалил|подписал|выплатил|перев[её]л|подтвердил выплату|changed|deleted|signed|paid|transferred|released funds|修改了|删除了|签署了|付款了|转账了)/iu;

const REASONING_OPEN = /<(?:think|thinking|scratchpad|reasoning)>/iu;
const REASONING_CLOSE = /<\/(?:think|thinking|scratchpad|reasoning)>/iu;

export class SemanticSafetyBuffer {
  /** Text received but not yet released. */
  private pending = '';

  /** True while inside an unterminated reasoning block. */
  private suppressing = false;

  /** How much reasoning has been discarded, to bound a never-closing block. */
  private suppressed = 0;

  private blocked: SafetyBlockReason | null = null;

  /** Feed one provider delta; returns whatever is now safe to emit. */
  push(text: string): SafetyBufferOutput {
    if (this.blocked) return { safe: '', blocked: this.blocked };
    this.pending += text;
    return this.drain(false);
  }

  /**
   * Close the stream and release the remainder.
   *
   * An unterminated reasoning block is a failure rather than a flush: its
   * content was withheld precisely because it is not answer text, so emitting
   * it at the end would defeat the whole mechanism.
   */
  flush(): SafetyBufferOutput {
    if (this.blocked) return { safe: '', blocked: this.blocked };
    if (this.suppressing) {
      this.blocked = 'unterminated_reasoning';
      this.pending = '';
      return { safe: '', blocked: this.blocked };
    }
    return this.drain(true);
  }

  private drain(final: boolean): SafetyBufferOutput {
    let released = '';

    for (;;) {
      if (this.suppressing) {
        const close = this.pending.match(REASONING_CLOSE);
        if (!close || close.index === undefined) {
          // Still inside reasoning: discard what is certainly interior, but keep
          // a tail long enough that a closing tag split across chunks is seen.
          const keep = Math.min(this.pending.length, MAX_HOLDBACK_CHARS);
          this.suppressed += this.pending.length - keep;
          this.pending = this.pending.slice(this.pending.length - keep);
          if (this.suppressed > MAX_SUPPRESSED_REASONING_CHARS) {
            this.blocked = 'unterminated_reasoning';
            this.pending = '';
            return { safe: released, blocked: this.blocked };
          }
          // Still suppressing: return now. Falling through to the release path
          // below would emit the very reasoning text being withheld.
          return { safe: released, blocked: null };
        }
        this.suppressed += close.index;
        this.pending = this.pending.slice(close.index + close[0].length);
        this.suppressing = false;
        continue;
      }

      const open = this.pending.match(REASONING_OPEN);
      if (!open || open.index === undefined) break;

      const before = this.pending.slice(0, open.index);
      const verdict = this.classify(before);
      if (verdict) {
        this.blocked = verdict;
        this.pending = '';
        return { safe: released, blocked: verdict };
      }
      released += before;
      this.pending = this.pending.slice(open.index + open[0].length);
      this.suppressing = true;
    }

    const holdback = final ? 0 : this.viableHoldback(this.pending);
    const candidate = this.pending.slice(0, this.pending.length - holdback);
    const verdict = this.classify(candidate);
    if (verdict) {
      this.blocked = verdict;
      this.pending = '';
      return { safe: released, blocked: verdict };
    }

    this.pending = this.pending.slice(candidate.length);
    released += candidate;
    return { safe: released, blocked: null };
  }

  private classify(text: string): SafetyBlockReason | null {
    if (!text) return null;
    if (SECRET_PATTERN.test(text)) return 'secret_like';
    if (WRITE_CLAIM_PATTERN.test(text)) return 'write_claim';
    return null;
  }

  /**
   * Length of the suffix that must not be released yet.
   *
   * Zero whenever the tail cannot begin anything prohibited, which is the
   * overwhelmingly common case and the reason ordinary text streams without
   * added delay.
   */
  private viableHoldback(text: string): number {
    const window = Math.min(text.length, MAX_HOLDBACK_CHARS);
    for (let length = window; length > 0; length -= 1) {
      const tail = text.slice(text.length - length);
      if (VIABLE_DANGER_PREFIX.test(tail)) return length;
    }
    return 0;
  }
}

/** Never emit a partial UTF-16 surrogate pair; it would render as a broken glyph. */
export function trimDanglingSurrogate(text: string): string {
  if (!text) return text;
  const last = text.charCodeAt(text.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) return text.slice(0, -1);
  return text;
}
