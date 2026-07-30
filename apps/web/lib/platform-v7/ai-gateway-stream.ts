/**
 * Client side of the TAI gateway stream.
 *
 * The browser validates every frame before it reaches the UI. Public mode is
 * deliberately stricter: provisional tokens, model identity, assessments,
 * tool traces and reasoning blocks are never projected into the page.
 */
import {
  isRejection,
  resolveOutcome,
  validateFrame,
  type GatewayCitationFrame,
  type GatewayFrame,
  type GatewayMode,
  type GatewayRefusal,
} from '@pc/ai-assistant-stream-contract';

/** What the UI is allowed to render at any moment. */
export type GatewayStreamStatus = 'streaming' | 'answered' | 'refused';

export interface GatewayStreamSnapshot {
  readonly status: GatewayStreamStatus;
  /** Provisional internally while streaming; public projection hides it. */
  readonly text: string;
  readonly citations: readonly GatewayCitationFrame[];
  readonly assessment: string | null;
  readonly modelIdentity: string | null;
  readonly refusal: GatewayRefusal | null;
}

export interface ReadGatewayStreamOptions {
  readonly mode: GatewayMode;
  /** Called on every state change so a component can render progressively. */
  readonly onSnapshot?: (snapshot: GatewayStreamSnapshot) => void;
  readonly signal?: AbortSignal;
  /** Overall stream deadline. Public mode defaults to 45 seconds. */
  readonly timeoutMs?: number;
}

/** Largest unfinished SSE record the client will hold. */
export const MAX_PENDING_RECORD_CHARS = 64 * 1024;
export const PUBLIC_STREAM_TIMEOUT_MS = 45_000;

const EMPTY: GatewayStreamSnapshot = {
  status: 'streaming',
  text: '',
  citations: [],
  assessment: null,
  modelIdentity: null,
  refusal: null,
};

const PUBLIC_ASSISTANT_BOILERPLATE_PATTERNS = [
  /Внешние банковские и государственные шаги считаются подключ[её]нными только после отдельного подтверждения интеграции\.?/giu,
  /Для (?:получения )?более подробной информации\s*:\s*[^\n.!?。！？]{1,180}[.!?。！？]?/giu,
  /Подробнее\s*:\s*[^\n.!?。！？]{1,180}[.!?。！？]?/giu,
  /Bank and government steps are treated as connected only after separate integration acceptance\.?/giu,
  /For (?:more|further) information\s*:\s*[^\n.!?。！？]{1,180}[.!?。！？]?/giu,
  /银行和政府步骤只有在单独完成集成验收后才被视为已连接[。.]?/gu,
  /(?:更多|详细)信息\s*[：:]\s*[^\n。！？]{1,180}[。！？]?/gu,
] as const;

const PUBLIC_INTERNAL_BLOCK_PATTERNS = [
  /<(?:think|analysis|reasoning)\b[^>]*>[\s\S]*?<\/(?:think|analysis|reasoning)>/giu,
  /\[(?:think|analysis|reasoning)\][\s\S]*?\[\/(?:think|analysis|reasoning)\]/giu,
  /```(?:json|javascript|typescript|text)?\s*[\s\S]{0,24000}?"(?:tool_calls?|tool_call_id|arguments|reasoning)"[\s\S]{0,24000}?```/giu,
] as const;

const PUBLIC_HARD_INTERNAL_JSON_KEYS: ReadonlySet<string> = new Set([
  'tool_calls',
  'tool_call',
  'tool_call_id',
  'reasoning_content',
  'scratchpad',
]);
const PUBLIC_AMBIGUOUS_INTERNAL_JSON_KEYS: ReadonlySet<string> = new Set([
  'analysis',
  'reasoning',
  'thinking',
]);
const PUBLIC_SCRATCHPAD_COMPANION_KEYS: ReadonlySet<string> = new Set([
  'final',
  'channel',
  'role',
  'type',
  'step',
  'steps',
  'tool',
  'tool_name',
  'function',
]);
const PUBLIC_INTERNAL_NARRATIVE_PATTERN = /(?:\b(?:first|next|then|step|plan|reason|think|thinking|analysis|internal|scratchpad|tool|function|call|invoke|search|lookup|i need|i should|we need|we should)\b|(?:сначала|затем|далее|шаг|план|рассужд|думаю|внутренн|черновик|инструмент|вызов|поиск|проверяю|уточняю|продолжаю))/iu;
const PUBLIC_HARD_INTERNAL_JSON_PATTERN = /(?:^|[{\[,\s])["']?(?:tool_calls|tool_call|tool_call_id|reasoning_content|scratchpad)["']?\s*:/iu;
const PUBLIC_AMBIGUOUS_INTERNAL_JSON_PATTERN = /(?:^|[{\[,\s])["']?(?:analysis|reasoning|thinking)["']?\s*:/iu;
const PUBLIC_SCRATCHPAD_COMPANION_PATTERN = /(?:^|[{\[,\s])["']?(?:final|channel|role|type|step|steps|tool|tool_name|function)["']?\s*:/iu;
const MAX_PUBLIC_INTERNAL_JSON_CHARS = 24_000;

function hasHardPublicInternalJsonKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasHardPublicInternalJsonKey);
  if (!value || typeof value !== 'object') return false;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (PUBLIC_HARD_INTERNAL_JSON_KEYS.has(key.toLowerCase())) return true;
    if (hasHardPublicInternalJsonKey(child)) return true;
  }
  return false;
}

function scratchpadNarrative(value: unknown): boolean {
  if (typeof value === 'string') return PUBLIC_INTERNAL_NARRATIVE_PATTERN.test(value);
  if (Array.isArray(value)) return value.some(scratchpadNarrative);
  return false;
}

function isRecognizableScratchpadEnvelope(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(isRecognizableScratchpadEnvelope);
  if (!value || typeof value !== 'object') return false;

  const entries = Object.entries(value as Record<string, unknown>);
  const ambiguous = entries.filter(([key]) => PUBLIC_AMBIGUOUS_INTERNAL_JSON_KEYS.has(key.toLowerCase()));
  if (ambiguous.length === 0) return false;

  const hasCompanion = entries.some(([key]) => PUBLIC_SCRATCHPAD_COMPANION_KEYS.has(key.toLowerCase()));
  return ambiguous.some(([, child]) => (
    (typeof child === 'string' || Array.isArray(child))
    && (hasCompanion || scratchpadNarrative(child))
  ));
}

function hasPublicInternalJsonEnvelope(value: unknown): boolean {
  return hasHardPublicInternalJsonKey(value) || isRecognizableScratchpadEnvelope(value);
}

function looksLikePublicInternalJson(value: string): boolean {
  if (PUBLIC_HARD_INTERNAL_JSON_PATTERN.test(value)) return true;
  return PUBLIC_AMBIGUOUS_INTERNAL_JSON_PATTERN.test(value)
    && (PUBLIC_SCRATCHPAD_COMPANION_PATTERN.test(value) || PUBLIC_INTERNAL_NARRATIVE_PATTERN.test(value));
}

function balancedPublicJsonEnd(value: string, start: number): number | null {
  const opener = value[start];
  if (opener !== '{' && opener !== '[') return null;
  const stack = [opener];
  const limit = Math.min(value.length, start + MAX_PUBLIC_INTERNAL_JSON_CHARS);
  let quoted = false;
  let escaped = false;

  for (let index = start + 1; index < limit; index += 1) {
    const character = value[index];
    if (quoted) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        quoted = false;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === '{' || character === '[') {
      stack.push(character);
    } else if (character === '}' || character === ']') {
      const expected = character === '}' ? '{' : '[';
      if (stack[stack.length - 1] !== expected) return null;
      stack.pop();
      if (stack.length === 0) return index + 1;
    }
  }
  return null;
}

function stripPublicAssistantInternalJson(value: string): string {
  let output = '';
  let cursor = 0;
  let searchFrom = 0;

  while (searchFrom < value.length) {
    const objectStart = value.indexOf('{', searchFrom);
    const arrayStart = value.indexOf('[', searchFrom);
    const start = objectStart === -1
      ? arrayStart
      : arrayStart === -1
        ? objectStart
        : Math.min(objectStart, arrayStart);
    if (start === -1) break;

    const end = balancedPublicJsonEnd(value, start);
    if (end === null) {
      const boundedTail = value.slice(start, start + MAX_PUBLIC_INTERNAL_JSON_CHARS);
      if (looksLikePublicInternalJson(boundedTail)) {
        output += value.slice(cursor, start);
        return output;
      }
      searchFrom = start + 1;
      continue;
    }

    const segment = value.slice(start, end);
    let internal = false;
    try {
      internal = hasPublicInternalJsonEnvelope(JSON.parse(segment));
    } catch {
      internal = looksLikePublicInternalJson(segment);
    }
    if (internal) {
      output += value.slice(cursor, start);
      cursor = end;
    }
    searchFrom = end;
  }

  return output + value.slice(cursor);
}

/** Remove repetitive operational and navigation boilerplate from public answers. */
export function stripPublicAssistantBoilerplate(value: string): string {
  let result = value;
  for (const pattern of PUBLIC_ASSISTANT_BOILERPLATE_PATTERNS) result = result.replace(pattern, '');
  return result
    .replace(/[ \t]+\n/gu, '\n')
    .replace(/\n[ \t]+/gu, '\n')
    .replace(/[ \t]{2,}/gu, ' ')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

/**
 * Strip model scratchpad, tool envelopes and debug traces from a completed
 * public answer. This is a second boundary after the stream contract: even a
 * model that emits a reasoning tag as ordinary token text cannot expose it.
 */
export function stripPublicAssistantInternalArtifacts(value: string): string {
  let result = value;
  for (const pattern of PUBLIC_INTERNAL_BLOCK_PATTERNS) result = result.replace(pattern, '');
  result = stripPublicAssistantInternalJson(result);

  result = result
    // Fail closed on an unterminated scratchpad block.
    .replace(/<(?:think|analysis|reasoning)\b[^>]*>[\s\S]*$/giu, '')
    .replace(/\[(?:think|analysis|reasoning)\][\s\S]*$/giu, '')
    // Remove line-oriented tool/debug envelopes that escaped a block wrapper.
    .replace(/^\s*(?:tool[_ -]?calls?|tool[_ -]?trace|reasoning[_ -]?state|think[_ -]?state|debug)\s*:\s*.*$/gimu, '')
    .replace(/^\s*Used\s+(?:personal_context|web|github|file_search|python|api_tool)\s+tool\s*$/gimu, '')
    .replace(/^\s*(?:Планирую|Уточняю|Продолжаю|Завершаю)\s+(?:обновление|область изменений|исправление).*$/gimu, '');

  return result
    .replace(/[ \t]+\n/gu, '\n')
    .replace(/\n[ \t]+/gu, '\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

/**
 * Produce the public UI projection.
 *
 * While the stream is open the user sees only the loading indicator; token text
 * is not rendered. The completed answer is scrubbed and public operational
 * metadata is removed before it is returned to the component.
 */
export function publicSnapshotForDisplay(snapshot: GatewayStreamSnapshot): GatewayStreamSnapshot {
  if (snapshot.status === 'streaming') {
    return {
      ...snapshot,
      text: '',
      assessment: null,
      modelIdentity: null,
    };
  }

  const text = stripPublicAssistantInternalArtifacts(stripPublicAssistantBoilerplate(snapshot.text));
  if (snapshot.status === 'answered' && !text) {
    return {
      ...snapshot,
      status: 'refused',
      text: '',
      assessment: null,
      modelIdentity: null,
      refusal: 'ABSTAINED_NO_DATA',
    };
  }

  return {
    ...snapshot,
    text: snapshot.status === 'answered' ? text : '',
    assessment: null,
    modelIdentity: null,
  };
}

/** Split an SSE buffer into complete records, returning the unfinished tail. */
export function splitRecords(buffer: string): { records: string[]; rest: string } {
  const parts = buffer.split('\n\n');
  const rest = parts.pop() ?? '';
  return { records: parts.filter((part) => part.trim().length > 0), rest };
}

/** The `data:` payload of one SSE record, or null if it carries none. */
export function recordPayload(record: string): string | null {
  const line = record.split('\n').find((candidate) => candidate.startsWith('data:'));
  return line ? line.slice('data:'.length).trim() : null;
}

/** Fold one validated frame into the snapshot. */
export function applyFrame(snapshot: GatewayStreamSnapshot, frame: GatewayFrame): GatewayStreamSnapshot {
  switch (frame.event) {
    case 'meta':
      return { ...snapshot, modelIdentity: frame.modelIdentity };
    case 'token':
      return { ...snapshot, text: snapshot.text + frame.text };
    case 'citation':
      return { ...snapshot, citations: [...snapshot.citations, frame] };
    case 'assessment':
      return { ...snapshot, assessment: frame.summary };
    case 'error':
      return { ...snapshot, refusal: frame.refusal };
    case 'done': {
      const answered = frame.complete && snapshot.refusal === null && snapshot.text.length > 0;
      if (answered) return { ...snapshot, status: 'answered' };
      return {
        ...snapshot,
        status: 'refused',
        text: '',
        refusal: snapshot.refusal ?? (frame.complete ? 'ABSTAINED_NO_DATA' : null),
      };
    }
    /* c8 ignore next 2 -- the frame came from validateFrame; the set is closed */
    default:
      return snapshot;
  }
}

/** A stream that ended without ever saying it was complete is a refusal. */
export function sealSnapshot(snapshot: GatewayStreamSnapshot, fallback: GatewayRefusal): GatewayStreamSnapshot {
  if (snapshot.status !== 'streaming') return snapshot;
  return { ...snapshot, status: 'refused', text: '', refusal: snapshot.refusal ?? fallback };
}

/** Read a gateway response to completion. */
export async function readGatewayStream(
  response: Response,
  options: ReadGatewayStreamOptions,
): Promise<GatewayStreamSnapshot> {
  let snapshot = EMPTY;
  const project = (value: GatewayStreamSnapshot) => (
    options.mode === 'public' ? publicSnapshotForDisplay(value) : value
  );
  const publish = () => options.onSnapshot?.(project(snapshot));

  const finish = (fallback: GatewayRefusal): GatewayStreamSnapshot => {
    snapshot = sealSnapshot(snapshot, fallback);
    if (options.mode === 'public') snapshot = publicSnapshotForDisplay(snapshot);
    publish();
    return snapshot;
  };

  if (!response.ok || !response.body) return finish('UPSTREAM_ERROR');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let timedOut = false;
  const timeoutMs = options.timeoutMs ?? (options.mode === 'public' ? PUBLIC_STREAM_TIMEOUT_MS : 0);
  const timeout = timeoutMs > 0
    ? setTimeout(() => {
      timedOut = true;
      void reader.cancel('public_assistant_timeout').catch(() => undefined);
    }, timeoutMs)
    : null;

  const onAbort = () => {
    void reader.cancel('public_assistant_cancelled').catch(() => undefined);
  };
  options.signal?.addEventListener('abort', onAbort, { once: true });

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const { records, rest } = splitRecords(buffer);
      buffer = rest;

      if (buffer.length > MAX_PENDING_RECORD_CHARS) return finish('UPSTREAM_ERROR');

      for (const record of records) {
        const payload = recordPayload(record);
        if (payload === null) continue;

        let parsed: unknown;
        try {
          parsed = JSON.parse(payload);
        } catch {
          return finish('UPSTREAM_ERROR');
        }

        const verdict = validateFrame(parsed, options.mode);
        if (isRejection(verdict)) return finish('UPSTREAM_ERROR');

        snapshot = applyFrame(snapshot, verdict.frame);
        if (options.mode === 'public' && snapshot.status !== 'streaming') {
          snapshot = publicSnapshotForDisplay(snapshot);
        }
        publish();
        if (snapshot.status !== 'streaming') return snapshot;
      }
    }
  } catch {
    if (options.signal?.aborted) return finish('CANCELLED');
    return finish('UPSTREAM_ERROR');
  } finally {
    if (timeout !== null) clearTimeout(timeout);
    options.signal?.removeEventListener('abort', onAbort);
    reader.releaseLock?.();
  }

  if (options.signal?.aborted) return finish('CANCELLED');
  return finish(timedOut ? 'UPSTREAM_ERROR' : 'UPSTREAM_ERROR');
}

/** Cross-check a completed stream against the contract's own outcome rule. */
export function snapshotAgreesWithContract(
  snapshot: GatewayStreamSnapshot,
  frames: readonly GatewayFrame[],
): boolean {
  const outcome = resolveOutcome(frames);
  if (snapshot.status === 'answered') return outcome.usable && outcome.text === snapshot.text;
  return !outcome.usable && snapshot.text === '';
}

export type GatewayLocale = 'ru' | 'en' | 'zh';

/** User-facing copy for a refused or incomplete answer. */
export function refusalCopy(locale: GatewayLocale, refusal: GatewayRefusal | null): string {
  const copy: Record<GatewayLocale, Record<string, string>> = {
    ru: {
      ABSTAINED_NO_DATA: 'У меня нет подтверждённого основания для ответа на этот вопрос, и я не буду его придумывать. Переформулируйте вопрос или выберите тему ниже.',
      UPSTREAM_ERROR: 'Ответ не был завершён. Повторите запрос.',
      DEFAULT: 'Ответ не получен.',
    },
    en: {
      ABSTAINED_NO_DATA: 'I have no verified basis for answering this, and I will not invent one. Rephrase the question or pick a topic below.',
      UPSTREAM_ERROR: 'The answer did not finish. Retry the request.',
      DEFAULT: 'No answer was produced.',
    },
    zh: {
      ABSTAINED_NO_DATA: '我没有可靠依据回答这个问题，也不会编造答案。请改写问题或选择下面的主题。',
      UPSTREAM_ERROR: '回答未完成。请重试。',
      DEFAULT: '未生成回答。',
    },
  };
  return copy[locale][refusal ?? 'DEFAULT'] ?? copy[locale].DEFAULT;
}
