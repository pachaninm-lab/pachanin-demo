export const AI_GATEWAY_STREAM_SCHEMA = 'tai.ai-assistant.stream.v1' as const;

type Source = 'platform' | 'deal_registry' | 'deal_workspace';

export type AiGatewayCitation = Readonly<{
  source: Source;
  label: string;
  href: string | null;
  asOf: string;
}>;

export type AiGatewayDecision = Readonly<{
  summary: string;
  reason: string | null;
  nextAction: string | null;
  ownerRole: string | null;
  deadlineAt: string | null;
  moneyAtRiskKopecks: string | null;
  confidence: 'high' | 'medium' | 'low';
  actionAllowed: false;
  actionKind: 'NONE';
  intent: string;
  evidence: readonly Readonly<{ kind: string; label: string; value: string; source: Source }>[];
  followUps: readonly string[];
  dataFreshnessAt: string;
}>;

export type AiGatewayFinalResponse = Readonly<{
  requestId: string;
  answer: string;
  provider: 'local-deterministic' | 'openai-compatible';
  mode: 'read_only';
  dataMode: 'authoritative';
  role: string;
  dealId: string | null;
  generatedAt: string;
  citations: readonly AiGatewayCitation[];
  limitations: readonly string[];
  decision: AiGatewayDecision;
}>;

export type AiGatewayStreamState = Readonly<{
  sequence: number;
  requestId: string | null;
  correlationId: string | null;
  answer: string;
  citations: readonly AiGatewayCitation[];
  decision: AiGatewayDecision | null;
  response: AiGatewayFinalResponse | null;
  done: boolean;
}>;

export type AiGatewayStreamHandlers = Readonly<{
  onMeta?: (value: Readonly<Record<string, unknown>>) => void;
  onToken?: (delta: string, answer: string) => void;
  onCitations?: (citations: readonly AiGatewayCitation[]) => void;
  onDecision?: (decision: AiGatewayDecision) => void;
  onDone?: (response: AiGatewayFinalResponse) => void;
}>;

const INITIAL_STATE: AiGatewayStreamState = Object.freeze({
  sequence: 0,
  requestId: null,
  correlationId: null,
  answer: '',
  citations: Object.freeze([]),
  decision: null,
  response: null,
  done: false,
});

export async function consumeAiGatewayStream(
  response: Response,
  handlers: AiGatewayStreamHandlers = {},
): Promise<AiGatewayStreamState> {
  if (!response.ok) throw new AiGatewayStreamError(`AI_GATEWAY_HTTP_${response.status}`, true);
  if (!(response.headers.get('content-type') || '').toLowerCase().includes('text/event-stream')) {
    throw new AiGatewayStreamError('AI_GATEWAY_STREAM_CONTENT_TYPE_REQUIRED', false);
  }
  if (!response.body) throw new AiGatewayStreamError('AI_GATEWAY_STREAM_BODY_REQUIRED', true);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let state = INITIAL_STATE;
  try {
    while (true) {
      const chunk = await reader.read();
      buffer += decoder.decode(chunk.value || new Uint8Array(), { stream: !chunk.done }).replace(/\r\n/gu, '\n');
      const frames = buffer.split('\n\n');
      buffer = frames.pop() || '';
      for (const frame of frames) {
        if (frame.trim()) state = applyAiGatewayEvent(state, parseFrame(frame), handlers);
      }
      if (chunk.done) break;
    }
    if (buffer.trim()) state = applyAiGatewayEvent(state, parseFrame(buffer), handlers);
  } finally {
    reader.releaseLock();
  }
  if (!state.done || !state.response) throw new AiGatewayStreamError('AI_GATEWAY_STREAM_INCOMPLETE', true);
  return state;
}

export function applyAiGatewayEvent(
  state: AiGatewayStreamState,
  raw: unknown,
  handlers: AiGatewayStreamHandlers = {},
): AiGatewayStreamState {
  const event = record(raw);
  if (text(event.schema, 80, 'SCHEMA') !== AI_GATEWAY_STREAM_SCHEMA) {
    throw new AiGatewayStreamError('AI_GATEWAY_STREAM_SCHEMA_REJECTED', false);
  }
  const type = text(event.type, 32, 'TYPE');
  const sequence = integer(event.sequence, 'SEQUENCE');
  const requestId = text(event.requestId, 200, 'REQUEST_ID');
  const correlationId = text(event.correlationId, 200, 'CORRELATION_ID');
  if (sequence !== state.sequence + 1) throw new AiGatewayStreamError('AI_GATEWAY_STREAM_SEQUENCE_REJECTED', false);
  if (state.requestId && (requestId !== state.requestId || correlationId !== state.correlationId)) {
    throw new AiGatewayStreamError('AI_GATEWAY_STREAM_CORRELATION_REJECTED', false);
  }
  if (state.done) throw new AiGatewayStreamError('AI_GATEWAY_STREAM_AFTER_DONE', false);

  const base = { ...state, sequence, requestId, correlationId };
  if (type === 'meta') {
    keys(event, ['schema', 'type', 'sequence', 'requestId', 'correlationId', 'generatedAt', 'mode', 'actionAllowed', 'provider', 'runtime']);
    if (event.mode !== 'read_only' || event.actionAllowed !== false) {
      throw new AiGatewayStreamError('AI_GATEWAY_STREAM_WRITE_CAPABILITY_REJECTED', false);
    }
    handlers.onMeta?.(event);
    return Object.freeze(base);
  }
  if (type === 'token') {
    keys(event, ['schema', 'type', 'sequence', 'requestId', 'correlationId', 'delta']);
    const delta = text(event.delta, 512, 'DELTA');
    const answer = state.answer + delta;
    if (answer.length > 12_000) throw new AiGatewayStreamError('AI_GATEWAY_STREAM_ANSWER_TOO_LARGE', false);
    handlers.onToken?.(delta, answer);
    return Object.freeze({ ...base, answer });
  }
  if (type === 'citations') {
    keys(event, ['schema', 'type', 'sequence', 'requestId', 'correlationId', 'citations']);
    const citations = citationsOf(event.citations);
    handlers.onCitations?.(citations);
    return Object.freeze({ ...base, citations });
  }
  if (type === 'decision') {
    keys(event, ['schema', 'type', 'sequence', 'requestId', 'correlationId', 'decision']);
    const decision = decisionOf(event.decision);
    handlers.onDecision?.(decision);
    return Object.freeze({ ...base, decision });
  }
  if (type === 'done') {
    keys(event, ['schema', 'type', 'sequence', 'requestId', 'correlationId', 'response']);
    const response = responseOf(event.response);
    if (response.requestId !== requestId || response.answer !== state.answer || !state.citations.length || !state.decision) {
      throw new AiGatewayStreamError('AI_GATEWAY_STREAM_FINAL_RESPONSE_MISMATCH', false);
    }
    if (JSON.stringify(response.citations) !== JSON.stringify(state.citations)
      || JSON.stringify(response.decision) !== JSON.stringify(state.decision)) {
      throw new AiGatewayStreamError('AI_GATEWAY_STREAM_FINAL_GROUNDING_MISMATCH', false);
    }
    handlers.onDone?.(response);
    return Object.freeze({ ...base, response, done: true });
  }
  if (type === 'error') {
    keys(event, ['schema', 'type', 'sequence', 'requestId', 'correlationId', 'code', 'retryable']);
    throw new AiGatewayStreamError(text(event.code, 160, 'ERROR_CODE'), event.retryable === true);
  }
  throw new AiGatewayStreamError('AI_GATEWAY_STREAM_EVENT_UNKNOWN', false);
}

export class AiGatewayStreamError extends Error {
  constructor(readonly code: string, readonly retryable: boolean) {
    super(code);
    this.name = 'AiGatewayStreamError';
  }
}

function parseFrame(frame: string): unknown {
  let name = '';
  let data = '';
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) name = line.slice(6).trim();
    else if (line.startsWith('data:')) data += line.slice(5).trim();
  }
  if (!name || !data) throw new AiGatewayStreamError('AI_GATEWAY_STREAM_FRAME_INVALID', false);
  let parsed: unknown;
  try { parsed = JSON.parse(data); } catch { throw new AiGatewayStreamError('AI_GATEWAY_STREAM_JSON_INVALID', false); }
  if (record(parsed).type !== name) throw new AiGatewayStreamError('AI_GATEWAY_STREAM_EVENT_NAME_MISMATCH', false);
  return parsed;
}

function responseOf(value: unknown): AiGatewayFinalResponse {
  const item = record(value);
  keys(item, ['requestId', 'answer', 'provider', 'mode', 'dataMode', 'role', 'dealId', 'generatedAt', 'citations', 'limitations', 'decision']);
  if (item.mode !== 'read_only' || item.dataMode !== 'authoritative') throw new AiGatewayStreamError('AI_GATEWAY_STREAM_FINAL_MODE_REJECTED', false);
  if (item.provider !== 'openai-compatible' && item.provider !== 'local-deterministic') throw new AiGatewayStreamError('AI_GATEWAY_STREAM_PROVIDER_REJECTED', false);
  if (item.dealId !== null && typeof item.dealId !== 'string') throw new AiGatewayStreamError('AI_GATEWAY_STREAM_DEAL_ID_REJECTED', false);
  if (!Array.isArray(item.limitations) || item.limitations.some((entry) => typeof entry !== 'string')) throw new AiGatewayStreamError('AI_GATEWAY_STREAM_LIMITATIONS_REJECTED', false);
  return Object.freeze({
    requestId: text(item.requestId, 200, 'REQUEST_ID'), answer: text(item.answer, 12_000, 'ANSWER'), provider: item.provider,
    mode: 'read_only', dataMode: 'authoritative', role: text(item.role, 160, 'ROLE'), dealId: item.dealId,
    generatedAt: timestamp(item.generatedAt, 'GENERATED_AT'), citations: citationsOf(item.citations),
    limitations: Object.freeze([...item.limitations]), decision: decisionOf(item.decision),
  });
}

function citationsOf(value: unknown): readonly AiGatewayCitation[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) throw new AiGatewayStreamError('AI_GATEWAY_STREAM_CITATIONS_REJECTED', false);
  return Object.freeze(value.map((raw) => {
    const item = record(raw); keys(item, ['source', 'label', 'href', 'asOf']);
    if (!['platform', 'deal_registry', 'deal_workspace'].includes(String(item.source))) throw new AiGatewayStreamError('AI_GATEWAY_STREAM_CITATION_SOURCE_REJECTED', false);
    if (item.href !== null && (typeof item.href !== 'string' || !item.href.startsWith('/platform-v7'))) throw new AiGatewayStreamError('AI_GATEWAY_STREAM_CITATION_HREF_REJECTED', false);
    return Object.freeze({ source: item.source as Source, label: text(item.label, 500, 'CITATION_LABEL'), href: item.href as string | null, asOf: timestamp(item.asOf, 'CITATION_AS_OF') });
  }));
}

function decisionOf(value: unknown): AiGatewayDecision {
  const item = record(value);
  keys(item, ['summary', 'reason', 'nextAction', 'ownerRole', 'deadlineAt', 'moneyAtRiskKopecks', 'confidence', 'actionAllowed', 'actionKind', 'intent', 'evidence', 'followUps', 'dataFreshnessAt']);
  if (item.actionAllowed !== false || item.actionKind !== 'NONE') throw new AiGatewayStreamError('AI_GATEWAY_STREAM_WRITE_CAPABILITY_REJECTED', false);
  if (!['high', 'medium', 'low'].includes(String(item.confidence))) throw new AiGatewayStreamError('AI_GATEWAY_STREAM_CONFIDENCE_REJECTED', false);
  if (!Array.isArray(item.evidence) || !Array.isArray(item.followUps)) throw new AiGatewayStreamError('AI_GATEWAY_STREAM_DECISION_COLLECTION_REJECTED', false);
  return Object.freeze({
    summary: text(item.summary, 2_000, 'SUMMARY'), reason: optional(item.reason, 2_000, 'REASON'), nextAction: optional(item.nextAction, 2_000, 'NEXT_ACTION'),
    ownerRole: optional(item.ownerRole, 200, 'OWNER_ROLE'), deadlineAt: item.deadlineAt === null ? null : timestamp(item.deadlineAt, 'DEADLINE'),
    moneyAtRiskKopecks: optional(item.moneyAtRiskKopecks, 100, 'MONEY'), confidence: item.confidence as AiGatewayDecision['confidence'],
    actionAllowed: false, actionKind: 'NONE', intent: text(item.intent, 120, 'INTENT'),
    evidence: Object.freeze(item.evidence.map((raw) => { const evidence = record(raw); keys(evidence, ['kind', 'label', 'value', 'source']); if (!['platform', 'deal_registry', 'deal_workspace'].includes(String(evidence.source))) throw new AiGatewayStreamError('AI_GATEWAY_STREAM_EVIDENCE_SOURCE_REJECTED', false); return Object.freeze({ kind: text(evidence.kind, 100, 'EVIDENCE_KIND'), label: text(evidence.label, 500, 'EVIDENCE_LABEL'), value: text(evidence.value, 2_000, 'EVIDENCE_VALUE'), source: evidence.source as Source }); })),
    followUps: Object.freeze(item.followUps.map((entry) => text(entry, 500, 'FOLLOW_UP'))), dataFreshnessAt: timestamp(item.dataFreshnessAt, 'FRESHNESS'),
  });
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AiGatewayStreamError('AI_GATEWAY_STREAM_OBJECT_REQUIRED', false);
  return value as Record<string, unknown>;
}
function keys(item: Record<string, unknown>, expected: readonly string[]): void {
  const actual = Object.keys(item).sort(); const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((entry, index) => entry !== wanted[index])) throw new AiGatewayStreamError('AI_GATEWAY_STREAM_FIELDS_REJECTED', false);
}
function text(value: unknown, max: number, label: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001F\u007F]/u.test(value)) throw new AiGatewayStreamError(`AI_GATEWAY_STREAM_${label}_REJECTED`, false);
  return value;
}
function optional(value: unknown, max: number, label: string): string | null { return value === null ? null : text(value, max, label); }
function integer(value: unknown, label: string): number { if (!Number.isInteger(value) || Number(value) < 1) throw new AiGatewayStreamError(`AI_GATEWAY_STREAM_${label}_REJECTED`, false); return Number(value); }
function timestamp(value: unknown, label: string): string { const result = text(value, 80, label); if (!Number.isFinite(Date.parse(result))) throw new AiGatewayStreamError(`AI_GATEWAY_STREAM_${label}_REJECTED`, false); return result; }
