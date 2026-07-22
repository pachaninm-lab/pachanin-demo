export const AI_GATEWAY_STREAM_SCHEMA = 'tai.ai-assistant.stream.v1' as const;

export type AiGatewayCitation = Readonly<{
  source: 'platform' | 'deal_registry' | 'deal_workspace';
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
  evidence: readonly Readonly<{
    kind: string;
    label: string;
    value: string;
    source: AiGatewayCitation['source'];
  }>[];
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
  const contentType = response.headers.get('content-type')?.toLowerCase() || '';
  if (!contentType.includes('text/event-stream')) {
    throw new AiGatewayStreamError('AI_GATEWAY_STREAM_CONTENT_TYPE_REQUIRED', false);
  }
  if (!response.body) throw new AiGatewayStreamError('AI_GATEWAY_STREAM_BODY_REQUIRED', true);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let state = INITIAL_STATE;

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const normalized = buffer.replace(/\r\n/gu, '\n');
      const frames = normalized.split('\n\n');
      buffer = frames.pop() || '';
      for (const frame of frames) {
        if (!frame.trim()) continue;
        state = applyAiGatewayEvent(state, parseFrame(frame), handlers);
      }
      if (done) break;
    }
    if (buffer.trim()) state = applyAiGatewayEvent(state, parseFrame(buffer), handlers);
  } finally {
    reader.releaseLock();
  }

  if (!state.done || !state.response) {
    throw new AiGatewayStreamError('AI_GATEWAY_STREAM_INCOMPLETE', true);
  }
  return state;
}

export function applyAiGatewayEvent(
  state: AiGatewayStreamState,
  raw: unknown,
  handlers: AiGatewayStreamHandlers = {},
): AiGatewayStreamState {
  const event = strictRecord(raw);
  const type = requiredString(event.type, 32, 'type');
  const schema = requiredString(event.schema, 80, 'schema');
  if (schema !== AI_GATEWAY_STREAM_SCHEMA) throw new AiGatewayStreamError('AI_GATEWAY_STREAM_SCHEMA_REJECTED', false);
  const requestId = requiredString(event.requestId, 200, 'requestId');
  const correlationId = requiredString(event.correlationId, 200, 'correlationId');
  const sequence = requiredInteger(event.sequence, 'sequence');

  const expectedSequence = state.requestId === null ? 1 : sequenceFromState(state) + 1;
  if (sequence !== expectedSequence) throw new AiGatewayStreamError('AI_GATEWAY_STREAM_SEQUENCE_REJECTED', false);
  if (state.requestId !== null && (state.requestId !== requestId || state.correlationId !== correlationId)) {
    throw new AiGatewayStreamError('AI_GATEWAY_STREAM_CORRELATION_REJECTED', false);
  }
  if (state.done) throw new AiGatewayStreamError('AI_GATEWAY_STREAM_AFTER_DONE', false);

  const base = {
    ...state,
    requestId,
    correlationId,
  };
  Object.defineProperty(base, '__sequence', { value: sequence, enumerable: false, configurable: true });

  if (type === 'meta') {
    exactKeys(event, ['schema', 'type', 'sequence', 'requestId', 'correlationId', 'generatedAt', 'mode', 'actionAllowed', 'provider', 'runtime']);
    if (event.mode !== 'read_only' || event.actionAllowed !== false) {
      throw new AiGatewayStreamError('AI_GATEWAY_STREAM_WRITE_CAPABILITY_REJECTED', false);
    }
    handlers.onMeta?.(event);
    return Object.freeze(base);
  }

  if (type === 'token') {
    exactKeys(event, ['schema', 'type', 'sequence', 'requestId', 'correlationId', 'delta']);
    const delta = requiredString(event.delta, 512, 'delta');
    const answer = `${state.answer}${delta}`;
    if (answer.length > 12_000) throw new AiGatewayStreamError('AI_GATEWAY_STREAM_ANSWER_TOO_LARGE', false);
    handlers.onToken?.(delta, answer);
    return freezeState({ ...base, answer });
  }

  if (type === 'citations') {
    exactKeys(event, ['schema', 'type', 'sequence', 'requestId', 'correlationId', 'citations']);
    const citations = validateCitations(event.citations);
    handlers.onCitations?.(citations);
    return freezeState({ ...base, citations });
  }

  if (type === 'decision') {
    exactKeys(event, ['schema', 'type', 'sequence', 'requestId', 'correlationId', 'decision']);
    const decision = validateDecision(event.decision);
    handlers.onDecision?.(decision);
    return freezeState({ ...base, decision });
  }

  if (type === 'done') {
    exactKeys(event, ['schema', 'type', 'sequence', 'requestId', 'correlationId', 'response']);
    const finalResponse = validateFinalResponse(event.response);
    if (finalResponse.requestId !== requestId || finalResponse.answer !== state.answer) {
      throw new AiGatewayStreamError('AI_GATEWAY_STREAM_FINAL_RESPONSE_MISMATCH', false);
    }
    if (!state.citations.length || !state.decision) {
      throw new AiGatewayStreamError('AI_GATEWAY_STREAM_GROUNDING_INCOMPLETE', false);
    }
    if (JSON.stringify(finalResponse.citations) !== JSON.stringify(state.citations)
      || JSON.stringify(finalResponse.decision) !== JSON.stringify(state.decision)) {
      throw new AiGatewayStreamError('AI_GATEWAY_STREAM_FINAL_GROUNDING_MISMATCH', false);
    }
    handlers.onDone?.(finalResponse);
    return freezeState({ ...base, response: finalResponse, done: true });
  }

  if (type === 'error') {
    exactKeys(event, ['schema', 'type', 'sequence', 'requestId', 'correlationId', 'code', 'retryable']);
    throw new AiGatewayStreamError(requiredString(event.code, 160, 'code'), event.retryable === true);
  }

  throw new AiGatewayStreamError('AI_GATEWAY_STREAM_EVENT_UNKNOWN', false);
}

export class AiGatewayStreamError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(code);
    this.name = 'AiGatewayStreamError';
  }
}

function parseFrame(frame: string): unknown {
  let eventName = '';
  let data = '';
  for (const line of frame.split('\n')) {
    if (!line || line.startsWith(':') || line.startsWith('id:')) continue;
    if (line.startsWith('event:')) eventName = line.slice(6).trim();
    if (line.startsWith('data:')) data += `${line.slice(5).trim()}\n`;
  }
  if (!eventName || !data.trim()) throw new AiGatewayStreamError('AI_GATEWAY_STREAM_FRAME_INVALID', false);
  let parsed: unknown;
  try {
    parsed = JSON.parse(data.trim());
  } catch {
    throw new AiGatewayStreamError('AI_GATEWAY_STREAM_JSON_INVALID', false);
  }
  const record = strictRecord(parsed);
  if (record.type !== eventName) throw new AiGatewayStreamError('AI_GATEWAY_STREAM_EVENT_NAME_MISMATCH', false);
  return record;
}

function validateFinalResponse(value: unknown): AiGatewayFinalResponse {
  const record = strictRecord(value);
  exactKeys(record, [
    'requestId', 'answer', 'provider', 'mode', 'dataMode', 'role', 'dealId', 'generatedAt', 'citations', 'limitations', 'decision',
  ]);
  if (record.mode !== 'read_only' || record.dataMode !== 'authoritative') {
    throw new AiGatewayStreamError('AI_GATEWAY_STREAM_FINAL_MODE_REJECTED', false);
  }
  if (record.provider !== 'openai-compatible' && record.provider !== 'local-deterministic') {
    throw new AiGatewayStreamError('AI_GATEWAY_STREAM_PROVIDER_REJECTED', false);
  }
  if (record.dealId !== null && typeof record.dealId !== 'string') {
    throw new AiGatewayStreamError('AI_GATEWAY_STREAM_DEAL_ID_REJECTED', false);
  }
  if (!Array.isArray(record.limitations) || record.limitations.some((item) => typeof item !== 'string')) {
    throw new AiGatewayStreamError('AI_GATEWAY_STREAM_LIMITATIONS_REJECTED', false);
  }
  return Object.freeze({
    requestId: requiredString(record.requestId, 200, 'requestId'),
    answer: requiredString(record.answer, 12_000, 'answer'),
    provider: record.provider,
    mode: 'read_only',
    dataMode: 'authoritative',
    role: requiredString(record.role, 160, 'role'),
    dealId: record.dealId,
    generatedAt: validTimestamp(record.generatedAt, 'generatedAt'),
    citations: validateCitations(record.citations),
    limitations: Object.freeze([...record.limitations]),
    decision: validateDecision(record.decision),
  });
}

function validateCitations(value: unknown): readonly AiGatewayCitation[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) {
    throw new AiGatewayStreamError('AI_GATEWAY_STREAM_CITATIONS_REJECTED', false);
  }
  return Object.freeze(value.map((item) => {
    const record = strictRecord(item);
    exactKeys(record, ['source', 'label', 'href', 'asOf']);
    if (!['platform', 'deal_registry', 'deal_workspace'].includes(String(record.source))) {
      throw new AiGatewayStreamError('AI_GATEWAY_STREAM_CITATION_SOURCE_REJECTED', false);
    }
    if (record.href !== null && (typeof record.href !== 'string' || !record.href.startsWith('/platform-v7'))) {
      throw new AiGatewayStreamError('AI_GATEWAY_STREAM_CITATION_HREF_REJECTED', false);
    }
    return Object.freeze({
      source: record.source as AiGatewayCitation['source'],
      label: requiredString(record.label, 500, 'citation.label'),
      href: record.href as string | null,
      asOf: validTimestamp(record.asOf, 'citation.asOf'),
    });
  }));
}

function validateDecision(value: unknown): AiGatewayDecision {
  const record = strictRecord(value);
  exactKeys(record, [
    'summary', 'reason', 'nextAction', 'ownerRole', 'deadlineAt', 'moneyAtRiskKopecks', 'confidence', 'actionAllowed', 'actionKind', 'intent', 'evidence', 'followUps', 'dataFreshnessAt',
  ]);
  if (record.actionAllowed !== false || record.actionKind !== 'NONE') {
    throw new AiGatewayStreamError('AI_GATEWAY_STREAM_WRITE_CAPABILITY_REJECTED', false);
  }
  if (!['high', 'medium', 'low'].includes(String(record.confidence))) {
    throw new AiGatewayStreamError('AI_GATEWAY_STREAM_CONFIDENCE_REJECTED', false);
  }
  if (!Array.isArray(record.evidence) || !Array.isArray(record.followUps)) {
    throw new AiGatewayStreamError('AI_GATEWAY_STREAM_DECISION_COLLECTION_REJECTED', false);
  }
  return Object.freeze({
    summary: requiredString(record.summary, 2_000, 'summary'),
    reason: optionalString(record.reason, 2_000, 'reason'),
    nextAction: optionalString(record.nextAction, 2_000, 'nextAction'),
    ownerRole: optionalString(record.ownerRole, 200, 'ownerRole'),
    deadlineAt: record.deadlineAt === null ? null : validTimestamp(record.deadlineAt, 'deadlineAt'),
    moneyAtRiskKopecks: optionalString(record.moneyAtRiskKopecks, 100, 'moneyAtRiskKopecks'),
    confidence: record.confidence as AiGatewayDecision['confidence'],
    actionAllowed: false,
    actionKind: 'NONE',
    intent: requiredString(record.intent, 120, 'intent'),
    evidence: Object.freeze(record.evidence.map((item) => {
      const evidence = strictRecord(item);
      exactKeys(evidence, ['kind', 'label', 'value', 'source']);
      if (!['platform', 'deal_registry', 'deal_workspace'].includes(String(evidence.source))) {
        throw new AiGatewayStreamError('AI_GATEWAY_STREAM_EVIDENCE_SOURCE_REJECTED', false);
      }
      return Object.freeze({
        kind: requiredString(evidence.kind, 100, 'evidence.kind'),
        label: requiredString(evidence.label, 500, 'evidence.label'),
        value: requiredString(evidence.value, 2_000, 'evidence.value'),
        source: evidence.source as AiGatewayCitation['source'],
      });
    })),
    followUps: Object.freeze(record.followUps.map((item) => requiredString(item, 500, 'followUp'))),
    dataFreshnessAt: validTimestamp(record.dataFreshnessAt, 'dataFreshnessAt'),
  });
}

function sequenceFromState(state: AiGatewayStreamState): number {
  return Number((state as AiGatewayStreamState & { __sequence?: number }).__sequence || 0);
}

function freezeState(value: AiGatewayStreamState): AiGatewayStreamState {
  return Object.freeze(value);
}

function strictRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AiGatewayStreamError('AI_GATEWAY_STREAM_OBJECT_REQUIRED', false);
  }
  return value as Record<string, unknown>;
}

function exactKeys(record: Record<string, unknown>, expected: readonly string[]): void {
  const actual = Object.keys(record).sort();
  const keys = [...expected].sort();
  if (actual.length !== keys.length || actual.some((key, index) => key !== keys[index])) {
    throw new AiGatewayStreamError('AI_GATEWAY_STREAM_FIELDS_REJECTED', false);
  }
}

function requiredString(value: unknown, max: number, label: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001F\u007F]/u.test(value)) {
    throw new AiGatewayStreamError(`AI_GATEWAY_STREAM_${label.toUpperCase()}_REJECTED`, false);
  }
  return value;
}

function optionalString(value: unknown, max: number, label: string): string | null {
  if (value === null) return null;
  return requiredString(value, max, label);
}

function requiredInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) < 1) {
    throw new AiGatewayStreamError(`AI_GATEWAY_STREAM_${label.toUpperCase()}_REJECTED`, false);
  }
  return Number(value);
}

function validTimestamp(value: unknown, label: string): string {
  const text = requiredString(value, 80, label);
  if (!Number.isFinite(Date.parse(text))) {
    throw new AiGatewayStreamError(`AI_GATEWAY_STREAM_${label.toUpperCase()}_REJECTED`, false);
  }
  return text;
}
