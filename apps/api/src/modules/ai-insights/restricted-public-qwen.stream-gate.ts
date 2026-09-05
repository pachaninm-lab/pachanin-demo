/**
 * The commit gate that turns model deltas into publishable text.
 *
 * The buffered generator could apply every safety rule at once because it held
 * the whole answer. Streaming does not have that luxury, and the tempting
 * shortcut — generate fully, then release in slices — is not streaming at all:
 * the reader still waits for the last token before seeing the first word.
 *
 * So the gate releases text as the model produces it, but only text it can
 * already decide on. Verified-platform and current-evidence answers still wait
 * for syntactically complete blocks because those policies need a whole block.
 * Plain general-agro prose may additionally release a completed word-bounded
 * prefix once it is long enough to be useful. That path keeps a safety
 * lookbehind across fragments, never cuts through a token, and retains every
 * fail-closed rule that applies to the eventual sentence.
 *
 * Two rules genuinely cannot be block-local: a completeness floor exists because
 * the *whole* answer was thin, and a truncation notice describes how generation
 * ended. Those run at flush, where they are appends rather than retractions.
 */
import {
  CROP_PROTECTION_PRESCRIPTION_PRELUDE_PATTERN,
  currentEvidenceVerdict,
  groundingAuthority,
  isUngroundedCropProtectionPrescription,
  platformGroundingVerdict,
  sanitizeAnswer,
  splitAnswerBlocks,
  stripRawLinks,
  SECRET_PATTERN,
  WRITE_CLAIM_PATTERN,
  type PublicAnswerMode,
  type PublicGrounding,
} from './restricted-public-qwen.safety';
import { stripInternalModelTrace, undecidedTailStart } from './restricted-public-qwen.internal-trace';

/** Why the gate refused the answer outright. Both are fail-closed. */
export type GateViolation = 'WRITE_CLAIM' | 'SECRET';

export interface GateCommit {
  /** Text safe to put on the wire now. Empty when nothing became decidable. */
  readonly text: string;
  readonly flags: readonly string[];
  /** Non-null once the answer must be refused rather than continued. */
  readonly violation: GateViolation | null;
}

export interface StreamingAnswerGateOptions {
  readonly answerMode: PublicAnswerMode;
  readonly currentDataRequired: boolean;
  readonly grounding: PublicGrounding;
  /**
   * Bound on withheld text. A model that never emits a sentence terminator must
   * not grow an unbounded buffer, so beyond this the gate commits at the last
   * word boundary instead of waiting. Safety rules still run on what it commits.
   */
  readonly maxPendingChars?: number;
}

const DEFAULT_MAX_PENDING_CHARS = 3_000;
const BLOCK_BOUNDARY = /(?:[.!?。！？][\s]|\n)\s*$/u;
/**
 * A progressive fragment shorter than this is rarely useful to a reader and
 * increases frame churn. 48 characters is deliberately independent of locale
 * and model tokenization; it is a transport threshold, not answer semantics.
 */
const GENERAL_AGRO_PROGRESSIVE_MIN_CHARS = 48;
/**
 * WRITE_CLAIM has at most 40 arbitrary characters between actor and action; all
 * secret signatures become decidable within far less than this. Keeping 96
 * published characters as lookbehind therefore preserves detection when one
 * sentence is released through several progressive fragments.
 */
const PROGRESSIVE_SAFETY_LOOKBEHIND_CHARS = 96;

const EMPTY_COMMIT: GateCommit = Object.freeze({ text: '', flags: Object.freeze([]), violation: null });

export class StreamingAnswerGate {
  private pending = '';
  private published = '';
  private violationState: GateViolation | null = null;
  private partialBlockOpen = false;
  private progressiveSafetyContext = '';
  private readonly authority: string;
  private readonly maxPendingChars: number;

  constructor(private readonly options: StreamingAnswerGateOptions) {
    this.authority = groundingAuthority(options.grounding);
    this.maxPendingChars = options.maxPendingChars ?? DEFAULT_MAX_PENDING_CHARS;
  }

  /** Everything the gate has published so far, as the reader has it. */
  get emitted(): string {
    return this.published;
  }

  get violation(): GateViolation | null {
    return this.violationState;
  }

  /** Text still withheld. Non-empty mid-answer is normal, not an error. */
  get withheld(): string {
    return this.pending;
  }

  push(delta: string): GateCommit {
    if (this.violationState !== null || !delta) return EMPTY_COMMIT;
    this.pending += delta;
    return this.drain(false);
  }

  /** Release whatever remains once generation has ended. */
  flush(): GateCommit {
    if (this.violationState !== null) return EMPTY_COMMIT;
    return this.drain(true);
  }

  private drain(final: boolean): GateCommit {
    const decidable = final ? this.pending.length : undecidedTailStart(this.pending);
    const overflowing = !final && this.pending.length > this.maxPendingChars;
    const progressiveAllowed = !final
      && this.options.answerMode === 'general_agro'
      && !this.options.currentDataRequired;

    let head = this.pending.slice(0, decidable);
    if (!head) return EMPTY_COMMIT;

    let consumed = head.length;
    let progressiveFragment = false;
    if (!final && !BLOCK_BOUNDARY.test(head)) {
      const lastBoundary = lastBlockBoundary(head);
      if (lastBoundary > 0) {
        head = head.slice(0, lastBoundary);
        consumed = lastBoundary;
      } else if (progressiveAllowed) {
        const wordBoundary = progressiveWordBoundary(head);
        if (wordBoundary <= 0) return EMPTY_COMMIT;
        head = head.slice(0, wordBoundary);
        consumed = wordBoundary;
        progressiveFragment = true;
      } else if (overflowing) {
        const wordBreak = head.lastIndexOf(' ');
        if (wordBreak <= 0) return EMPTY_COMMIT;
        head = head.slice(0, wordBreak);
        consumed = wordBreak;
      } else {
        return EMPTY_COMMIT;
      }
    }

    if (progressiveFragment) {
      const candidate = this.partialBlockOpen && this.progressiveSafetyContext
        ? `${this.progressiveSafetyContext} ${head}`
        : head;
      if (CROP_PROTECTION_PRESCRIPTION_PRELUDE_PATTERN.test(candidate)) return EMPTY_COMMIT;
    }

    this.pending = this.pending.slice(consumed);

    const flags: string[] = [];
    const kept: string[] = [];
    for (const rawBlock of splitAnswerBlocks(stripInternalModelTrace(head))) {
      const block = sanitizeAnswer(rawBlock);
      if (!block) continue;

      // A progressive fragment can split one sentence over several commits.
      // Re-check the bounded tail already published with the new fragment so a
      // prohibited claim cannot be assembled across the transport boundary.
      const safetyBlock = this.partialBlockOpen && this.progressiveSafetyContext
        ? `${this.progressiveSafetyContext} ${block}`
        : block;

      // A block claiming an executed write, or carrying secret-shaped material,
      // invalidates the whole answer. Text already published is not "kept anyway":
      // the caller seals the stream with a refusal, and the contract's outcome
      // rule makes a refused stream unusable end to end.
      if (WRITE_CLAIM_PATTERN.test(safetyBlock)) return this.refuse('WRITE_CLAIM');
      if (SECRET_PATTERN.test(safetyBlock)) return this.refuse('SECRET');
      if (isUngroundedCropProtectionPrescription(safetyBlock)) {
        flags.push('UNGROUNDED_CROP_PROTECTION_PRESCRIPTION_REMOVED');
        continue;
      }

      if (this.options.answerMode === 'verified_platform') {
        const verdict = platformGroundingVerdict(block, this.authority);
        if (!verdict.keep) {
          flags.push(...verdict.flags);
          continue;
        }
      }
      if (this.options.currentDataRequired && !currentEvidenceVerdict(block)) continue;

      const linkFree = stripRawLinks(block);
      if (linkFree.removed) flags.push('RAW_LINK_REMOVED');
      if (linkFree.text) kept.push(linkFree.text);
    }

    if (kept.length === 0) return { text: '', flags: Object.freeze([...new Set(flags)]), violation: null };

    const joined = kept.join('\n');
    const separator = this.published ? (this.partialBlockOpen ? ' ' : '\n') : '';
    const text = `${separator}${joined}`;
    this.published += text;

    if (progressiveFragment) {
      const sentenceContext = this.partialBlockOpen && this.progressiveSafetyContext
        ? `${this.progressiveSafetyContext} ${joined}`
        : joined;
      this.progressiveSafetyContext = sentenceContext.slice(-PROGRESSIVE_SAFETY_LOOKBEHIND_CHARS);
      this.partialBlockOpen = true;
    } else {
      this.progressiveSafetyContext = '';
      this.partialBlockOpen = false;
    }

    return { text, flags: Object.freeze([...new Set(flags)]), violation: null };
  }

  private refuse(violation: GateViolation): GateCommit {
    this.violationState = violation;
    this.pending = '';
    this.progressiveSafetyContext = '';
    this.partialBlockOpen = false;
    return { text: '', flags: Object.freeze([]), violation };
  }
}

/** End index of the last complete block in `value`, or 0 when there is none. */
function lastBlockBoundary(value: string): number {
  let best = 0;
  const boundary = /(?:[.!?。！？]\s|\n)/gu;
  for (let match = boundary.exec(value); match !== null; match = boundary.exec(value)) {
    best = match.index + match[0].length;
  }
  return best;
}

/**
 * End index of a complete whitespace-delimited prefix suitable for progressive
 * general-agro release. The current unfinished token always remains pending, so
 * a secret-like token or raw URL can never be cut in half and leaked early.
 */
function progressiveWordBoundary(value: string): number {
  if (value.length < GENERAL_AGRO_PROGRESSIVE_MIN_CHARS) return 0;
  for (let index = value.length - 1; index >= GENERAL_AGRO_PROGRESSIVE_MIN_CHARS - 1; index -= 1) {
    if (/\s/u.test(value[index])) return index + 1;
  }
  return 0;
}

/**
 * Incremental reader for an OpenAI-compatible `stream: true` body.
 *
 * Written as a fold over arbitrary byte chunks rather than over lines, because
 * an HTTP chunk boundary lands wherever the network puts it — routinely inside a
 * JSON payload and, with Cyrillic or Chinese output, inside a UTF-8 sequence.
 * The decoder is kept in streaming mode for the same reason.
 */
export class ProviderStreamParser {
  private buffer = '';
  private readonly decoder = new TextDecoder('utf-8');
  private doneState = false;

  get finished(): boolean {
    return this.doneState;
  }

  push(chunk: Uint8Array): ProviderStreamDelta {
    return this.consume(this.decoder.decode(chunk, { stream: true }));
  }

  /** Flush the decoder and any complete record left in the buffer. */
  end(): ProviderStreamDelta {
    return this.consume(this.decoder.decode());
  }

  private consume(text: string): ProviderStreamDelta {
    this.buffer += text;
    const parts = this.buffer.split(/\r?\n\r?\n/u);
    this.buffer = parts.pop() ?? '';

    let content = '';
    let finishReason: ProviderFinishReason | null = null;
    let promptTokens: number | null = null;
    let completionTokens: number | null = null;

    for (const record of parts) {
      const payload = record
        .split(/\r?\n/u)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice('data:'.length).trim())
        .join('');
      if (!payload) continue;
      if (payload === '[DONE]') {
        this.doneState = true;
        continue;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(payload);
      } catch {
        // A record the provider did not finish writing is not an answer. It is
        // dropped rather than salvaged: half a JSON object cannot be trusted to
        // mean what its readable half suggests.
        continue;
      }

      const row = asRecord(parsed);
      const choice = asRecord(Array.isArray(row?.choices) ? row.choices[0] : null);
      const delta = asRecord(choice?.delta);
      const piece = typeof delta?.content === 'string' ? delta.content : '';
      if (piece) content += piece;

      const reason = choice?.finish_reason;
      if (reason === 'stop' || reason === 'length') finishReason = reason;
      else if (typeof reason === 'string' && reason) finishReason = 'other';

      const usage = asRecord(row?.usage);
      const prompt = integerOrNull(usage?.prompt_tokens);
      const completion = integerOrNull(usage?.completion_tokens);
      if (prompt !== null) promptTokens = prompt;
      if (completion !== null) completionTokens = completion;
    }

    return { content, finishReason, promptTokens, completionTokens };
  }
}

export type ProviderFinishReason = 'stop' | 'length' | 'other';

export interface ProviderStreamDelta {
  readonly content: string;
  readonly finishReason: ProviderFinishReason | null;
  readonly promptTokens: number | null;
  readonly completionTokens: number | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function integerOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}
