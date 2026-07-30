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
  /\{[\s\S]{0,24000}?"(?:tool_calls?|tool_call_id)"\s*:[\s\S]{0,24000}?\}/giu,
] as const;

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
