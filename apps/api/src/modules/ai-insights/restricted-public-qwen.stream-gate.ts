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
  type PublicLocale,
  type PublicGrounding,
} from './restricted-public-qwen.safety';
import { stripInternalModelTrace, undecidedTailStart } from './restricted-public-qwen.internal-trace';

/** Why the gate refused the answer outright. Both are fail-closed. */
export type GateViolation = 'WRITE_CLAIM' | 'SECRET' | 'OUTPUT_LIMIT';

export interface GateCommit {
  /** Text safe to put on the wire now. Empty when nothing became decidable. */
  readonly text: string;
  readonly flags: readonly string[];
  /** Non-null once the answer must be refused rather than continued. */
  readonly violation: GateViolation | null;
}

export interface StreamingAnswerGateOptions {
  readonly answerMode: PublicAnswerMode;
  readonly locale: PublicLocale;
  readonly currentDataRequired: boolean;
  readonly grounding: PublicGrounding;
  readonly economicComparison?: EconomicComparison | null;
  /**
   * Bound on withheld text. A model that never emits a sentence terminator must
   * not grow an unbounded buffer, so beyond this the gate commits at the last
   * word boundary instead of waiting. Safety rules still run on what it commits.
   */
  readonly maxPendingChars?: number;
}

const DEFAULT_MAX_PENDING_CHARS = 3_000;
const BLOCK_BOUNDARY = /(?:[.!?]\s|[。！？]|\n)\s*$/u;
/**
 * A progressive fragment shorter than this is rarely useful to a reader and
 * increases frame churn. 48 characters is deliberately independent of locale
 * and model tokenization; it is a transport threshold, not answer semantics.
 */
const GENERAL_AGRO_PROGRESSIVE_MIN_CHARS = 48;
/**
 * WRITE_CLAIM has at most 40 arbitrary characters between actor and action.
 * A 320-character lookbehind also covers the longest crop-prescription pattern
 * across progressive fragments; secret signatures are shorter.
 */
const PROGRESSIVE_SAFETY_LOOKBEHIND_CHARS = 320;
const HAN_CHARACTER = /\p{Script=Han}/u;
const CHINESE_PRESCRIPTION_PREFIX = /(?:使用|施用|选择|推荐)[^.!?。！？\n]{0,200}$|[使施选推]$/u;

const EMPTY_COMMIT: GateCommit = Object.freeze({ text: '', flags: Object.freeze([]), violation: null });

export type EconomicComparison = 'storage' | 'transport';
type UserContextTurn = Readonly<{ role: 'user' | 'assistant'; text: string }>;
const STORAGE_TOPIC = /хран[еи]|storage|stor[ei]|仓储|储存/iu;
const ECONOMIC_TOPIC = /цен|стоим|расход|руб|прода|выгод|покры|price|cost|sell|profit|break.even|价格|成本|出售|收益/iu;
const TRANSPORT_COMPARISON = /перевоз|перевозчик|freight|haul|carrier|运输|承运/iu;

/** History establishes a topic only; assistant prose never establishes a quantity. */
export function economicComparisonFor(question: string, history: readonly UserContextTurn[]): EconomicComparison | null {
  if (/документ|персональн|хранени[ея]\s+данных|платформ|document|personal data|data retention|platform|文件|个人数据|平台/iu.test(question)) return null;
  if (TRANSPORT_COMPARISON.test(question) && /рейс|тонн|тариф|trip|tonne|rate|趟|吨|费率/iu.test(question)) return 'transport';
  if (STORAGE_TOPIC.test(question) && ECONOMIC_TOPIC.test(question)) return 'storage';
  const lastUser = [...history].reverse().find((turn) => turn.role === 'user')?.text ?? '';
  if (STORAGE_TOPIC.test(lastUser) && ECONOMIC_TOPIC.test(lastUser)
    && /месяц|покры|срок|month|cover|duration|月|期限/iu.test(question)) return 'storage';
  return null;
}

/** Bounded output screen, not a proof of arbitrary financial prose. */
export function economicBlockAllowed(block: string): boolean {
  const body = block.replace(/^\d+[.)]\s*/u, '');
  return !/[\d=\\]|руб|ruble|\bRUB\b|卢布|месяц|month|个月|выгод|лучше|дешевле|дороже|окуп|прибыль|рентабель|продавай|продайте|храните|выбира|выбери|рекоменд|советую|следует\s+(?:прода|хран)|(?:продавать|продать|покупать|купить|хранить)\s+(?:сейчас|сегодня|немедленно)|(?:сейчас|сегодня|немедленно)[^.!?。！？\n]{0,30}(?:продавать|продать|покупать|купить|хранить)|profita|cheaper|more expensive|better|choose|select|recommend|should\s+(?:sell|stor)|\b(?:sell|buy|store)\s+(?:now|today)\b|pay[s]? off|更划算|更便宜|盈利|获利|更有利|更好|应选|选择|建议|应该|现在卖|今天卖|现在买|今天买/iu.test(body)
    && !/(?:два|двух|три|тр[её]х|несколько|two|three|several|[一二三四五六七八九十两])\s*(?:месяц|month|个月|月)/iu.test(body);
}

type StorageInput = Readonly<{ value: number; unit: 'RUB_PER_TONNE_MONTH_MINOR' | 'MONTH'; userTurn: number }>;

/** Only a deliberately narrow, explicit RUB/tonne/month × integer-month calculation. */
export function storageCostFromUser(question: string, history: readonly UserContextTurn[]): number | null {
  if (economicComparisonFor(question, history) !== 'storage') return null;
  let rate: StorageInput | null = null;
  let duration: StorageInput | null = null;
  // Only a bounded duration-only continuation may inherit the preceding rate.
  // A newly named commodity, free-form correction or longer thread requires
  // explicit restatement; do not try to infer commodity identity from a list.
  const previous = [...history].reverse().find((turn) => turn.role === 'user')?.text;
  const continuation = /^срок\s+хранения\s+(?:\d{1,3}|один|два|двух|три|тр[её]х)\s+месяц(?:а|ев)?[.?!]?\s*(?:насколько\s+должна\s+вырасти\s+цена,?\s+чтобы\s+покрыть\s+только\s+хранение[?.]?)?$/iu.test(question.trim());
  const turns = [...(previous && continuation ? [previous] : []), question];
  for (const [userTurn, text] of turns.entries()) {
    const ambiguousNumber = /\d\s+\d|[-−]\s*\d|\d\s*[–—-]\s*\d|от\s+\d.{0,12}до\s+\d|\d[eE][+-]?\d/iu.test(text);
    // Ambiguous corrections or a unit change invalidate the old input, never reuse it silently.
    if (/(?:\d.{0,20}(?:руб|₽|RUB)|тариф|хран[еи].{0,35}(?:\d|стоим|цен|руб)|(?:storage|仓储).{0,35}(?:\d|cost|rate|成本))/iu.test(text)) {
      const matches = [...text.matchAll(/(?:^|[\s.!?;])(?:хранение|стоимость\s+хранения)(?:\s+стоит)?\s+(\d{1,7}(?:[.,]\d{1,2})?)\s*(?:руб(?:лей|ля|ль)?\.?|₽|RUB)\s*(?:за\s*тонн[уы]|\/\s*т(?:онн[уы])?)\s*(?:в\s*месяц|\/\s*мес(?:яц)?)/giu)];
      rate = null;
      if (!ambiguousNumber && matches.length === 1 && !/(?:(?:^|\s)не\s+(?:\d|один|два|три|хранени|стоимост|срок)|неизвест|отмен|not\s|unknown|(?:\d|один|два|три)\s*(?:или|либо))/iu.test(text)) {
        const parts = matches[0][1].replace(',', '.').split('.');
        const value = Number(parts[0]) * 100 + Number((parts[1] ?? '').padEnd(2, '0'));
        if (Number.isSafeInteger(value) && value > 0) rate = { value, unit: 'RUB_PER_TONNE_MONTH_MINOR', userTurn };
      }
    }
    const durationText = text.replace(/(?:в\s*месяц|\/\s*мес(?:яц)?)/giu, '');
    if (/месяц|год|лет|недел|дн|duration|store for|period|срок\s+(?:неизвест|отмен|измен|друг)/iu.test(durationText)) {
      const matches = [...text.matchAll(/(?:срок\s+хранения|хранить|хранение\s+на)\s+(\d{1,3}|один|два|двух|три|тр[её]х)\s+месяц(?:а|ев)?/giu)];
      duration = null;
      if (!ambiguousNumber && matches.length === 1 && !/(?:(?:^|\s)не\s+(?:\d|один|два|три|хранени|стоимост|срок)|неизвест|отмен|not\s|unknown|(?:\d|один|два|три)\s*(?:или|либо))/iu.test(text)) {
        const words: Record<string, number> = { один: 1, два: 2, двух: 2, три: 3, трех: 3, трёх: 3 };
        const value = words[matches[0][1].toLowerCase()] ?? Number(matches[0][1]);
        if (Number.isSafeInteger(value) && value > 0 && value <= 120) duration = { value, unit: 'MONTH', userTurn };
      }
    }
  }
  if (!rate || !duration) return null;
  const minor = rate.value * duration.value;
  return Number.isSafeInteger(minor) ? minor : null;
}

export function economicComparisonCopy(kind: EconomicComparison, locale: PublicLocale, storageMinor: number | null): string {
  if (kind === 'transport') {
    if (locale === 'en') return 'Compare the total quote per trip divided by the actual payable tonnes with the per-tonne quote. Include all trips, loading, waiting and return charges. What are both rates and the actual load?';
    if (locale === 'zh') return '将按趟报价的总费用除以实际计费吨数，再与按吨报价比较；计入全部趟数、装卸、等待和返程费用。两种费率和实际装载量是多少？';
    return 'Разделите полную стоимость всех рейсов на фактически оплачиваемый тоннаж и сравните с тарифом за тонну. Учтите погрузку, простой и обратный путь. Какие тарифы и фактическая загрузка?';
  }
  const amount = storageMinor === null ? null : (storageMinor / 100).toFixed(2).replace(/\.00$/u, '');
  if (locale === 'en') return `${amount === null ? 'Storage-only break-even is the monthly cost per tonne multiplied by the holding period; please specify both inputs with units.' : `Calculation from your inputs: covering storage alone requires a price increase of ${amount} RUB per tonne.`} This does not establish total profitability: compare future net proceeds, quality losses, financing and delivery costs.`;
  if (locale === 'zh') return `${amount === null ? '仅覆盖仓储费所需的涨价等于每吨每月费用乘以储存月数；请提供带单位的费用和期限。' : `根据你提供的数据计算：仅覆盖仓储费，每吨价格需上涨${amount}卢布。`}这不代表总体盈利；还需比较未来净收入、质量损失、融资和运输费用。`;
  return `${amount === null ? 'Для покрытия только хранения умножьте месячную стоимость за тонну на срок. Уточните эти два значения с единицами.' : `Расчёт по вашим данным: для покрытия только хранения цена должна вырасти на ${amount.replace('.', ',')} руб/т.`} Это не доказывает общую выгодность: сравните будущую чистую выручку, потери качества, финансирование и доставку.`;
}

export class StreamingAnswerGate {
  private pending = '';
  private published = '';
  private violationState: GateViolation | null = null;
  private partialBlockOpen = false;
  private progressiveSafetyContext = '';
  private progressiveJoiner = ' ';
  private pendingListMarker = '';
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
    const commit = this.drain(true);
    // A standalone number may be a valid answer outside evidence-bound output.
    // An orphan marker after actual content is never published on its own.
    if (!commit.violation && !this.published && this.pendingListMarker && !this.options.currentDataRequired && !this.options.economicComparison) {
      this.published = this.pendingListMarker;
      this.pendingListMarker = '';
      return { ...commit, text: this.published };
    }
    this.pendingListMarker = '';
    return commit;
  }

  private drain(final: boolean): GateCommit {
    const decidable = final ? this.pending.length : undecidedTailStart(this.pending);
    const overflowing = !final && this.pending.length > this.maxPendingChars;
    const progressiveAllowed = !final
      && this.options.answerMode === 'general_agro'
      && !this.options.currentDataRequired
      && !this.options.economicComparison;

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
        const wordBoundary = progressiveWordBoundary(head, this.options.locale);
        if (wordBoundary <= 0) return EMPTY_COMMIT;
        head = head.slice(0, wordBoundary);
        consumed = wordBoundary;
        progressiveFragment = true;
      } else if (overflowing) {
        // Never publish an undecided economic claim merely to bound the buffer.
        if (this.options.economicComparison) return this.refuse('OUTPUT_LIMIT');
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
        ? `${this.progressiveSafetyContext}${this.progressiveJoiner}${head}`
        : head;
      if (CROP_PROTECTION_PRESCRIPTION_PRELUDE_PATTERN.test(candidate)
        || (this.options.locale === 'zh' && CHINESE_PRESCRIPTION_PREFIX.test(candidate))) return EMPTY_COMMIT;
    }

    this.pending = this.pending.slice(consumed);

    // Sanitization trims a new fragment's leading whitespace. Preserve that
    // boundary, including a delta containing only whitespace, until text is
    // committed. Keep the safety lookbehind across the same boundary.
    if (this.partialBlockOpen && /^\s/u.test(head)) {
      this.progressiveJoiner = /^\s*\n/u.test(head) || this.progressiveJoiner === '\n'
        ? '\n'
        : ' ';
    }

    const flags: string[] = [];
    const kept: string[] = [];
    const blocks = splitAnswerBlocks(stripInternalModelTrace(head)).flatMap((block) => block.split(/(?<=[。！？])/u));
    for (const rawBlock of blocks) {
      let block = sanitizeAnswer(rawBlock);
      if (!block) continue;

      // A numbered prefix is punctuation, not a complete answer sentence.
      // Keep it with the following body so filtering cannot leave an empty item.
      if (/^\d{1,2}[.)]$/u.test(block)) {
        this.pendingListMarker = block;
        continue;
      }
      if (this.pendingListMarker) {
        block = `${this.pendingListMarker} ${block}`;
        this.pendingListMarker = '';
      }

      // A progressive fragment can split one sentence over several commits.
      // Re-check the bounded tail already published with the new fragment so a
      // prohibited claim cannot be assembled across the transport boundary.
      const safetyBlock = this.partialBlockOpen && this.progressiveSafetyContext
        ? `${this.progressiveSafetyContext}${this.progressiveJoiner}${block}`
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

      if (this.options.economicComparison && !economicBlockAllowed(block)) {
        flags.push('UNVERIFIED_ECONOMIC_CLAIM_REMOVED');
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
    const separator = this.published ? (this.partialBlockOpen ? this.progressiveJoiner : '\n') : '';
    const text = `${separator}${joined}`;
    this.published += text;

    if (progressiveFragment) {
      const sentenceContext = this.partialBlockOpen && this.progressiveSafetyContext
        ? `${this.progressiveSafetyContext}${this.progressiveJoiner}${joined}`
        : joined;
      this.progressiveSafetyContext = sentenceContext.slice(-PROGRESSIVE_SAFETY_LOOKBEHIND_CHARS);
      this.partialBlockOpen = true;
      this.progressiveJoiner = /\s$/u.test(head) ? ' ' : '';
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
  const boundary = /(?:[.!?]\s|[。！？]\s*|\n)/gu;
  for (let match = boundary.exec(value); match !== null; match = boundary.exec(value)) {
    best = match.index + match[0].length;
  }
  return best;
}

/**
 * Release whitespace-bounded text, or a complete Han character in Chinese.
 * ASCII secrets and URLs remain withheld until their whole token is decidable.
 */
function progressiveWordBoundary(value: string, locale: PublicLocale): number {
  if (value.length < GENERAL_AGRO_PROGRESSIVE_MIN_CHARS) return 0;
  const unfinishedUrl = /(?:https?:\/\/|www\.)\S*$/iu.exec(value);
  const upperBound = unfinishedUrl?.index ?? value.length;
  for (let index = upperBound - 1; index >= GENERAL_AGRO_PROGRESSIVE_MIN_CHARS - 1; index -= 1) {
    if (/\s/u.test(value[index]) || (locale === 'zh' && HAN_CHARACTER.test(value[index]))) {
      return index + 1;
    }
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
