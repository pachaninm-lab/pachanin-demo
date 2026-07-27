/**
 * Wire contract for the TAI assistant stream.
 *
 * TAI is never the source of truth for Deals, roles, organizations, money,
 * documents, bids, signatures, quality, logistics, disputes or execution status.
 * It reads and explains; it does not act. This module is where that is made
 * structural rather than aspirational: an event the contract cannot describe
 * cannot be emitted, and a frame that fails these checks is refused rather than
 * forwarded.
 *
 * The contract is deliberately transport-shaped and dependency-free so that both
 * the API that produces frames and the boundary that relays them validate against
 * exactly the same rules. Two implementations of "almost the same" contract is how
 * a private field eventually reaches the public contour.
 */

/** Events a stream may carry. Anything else is a protocol violation. */
export const GATEWAY_EVENTS = ['meta', 'token', 'citation', 'assessment', 'done', 'error'] as const;

export type GatewayEvent = (typeof GATEWAY_EVENTS)[number];

/**
 * Write verbs the assistant must never emit. TAI is READ_ONLY: it has no
 * prepared action, no confirmation step and no execution path. The names are
 * checked as data rather than as types because the danger is a hand-built frame
 * from a model response, which no type can constrain at runtime.
 */
export const FORBIDDEN_ACTION_KEYS = [
  'prepared_action',
  'preparedAction',
  'confirm_action',
  'confirmAction',
  'execute',
  'execute_action',
  'executeAction',
  'mutation',
  'command',
  'write',
] as const;

/**
 * Server-authorized identity. The client never selects any of it: a
 * client-chosen tenant or role is the whole tenant-isolation failure in one step.
 * Carried here only so the private contour can assert what it was given.
 */
export interface PrivateGatewayIdentity {
  readonly tenantId: string;
  readonly roleId: string;
  readonly subjectId: string;
  readonly dealId?: string;
}

/** Fields that must never cross into the public contour. */
export const PRIVATE_IDENTITY_KEYS = ['tenantId', 'roleId', 'subjectId', 'dealId'] as const;

export type GatewayMode = 'public' | 'private';

/** Why a stream refused to answer. Every value is a refusal, never a degraded answer. */
export const GATEWAY_REFUSALS = [
  'MODEL_NOT_ADMITTED',
  'FEATURE_DISABLED',
  'ABSTAINED_NO_DATA',
  'CANCELLED',
  'UPSTREAM_ERROR',
] as const;

export type GatewayRefusal = (typeof GATEWAY_REFUSALS)[number];

export interface GatewayMetaFrame {
  readonly event: 'meta';
  readonly mode: GatewayMode;
  readonly streamId: string;
  /** Identity of the admitted model, or null when nothing is admitted. */
  readonly modelIdentity: string | null;
}

export interface GatewayTokenFrame {
  readonly event: 'token';
  readonly streamId: string;
  readonly text: string;
}

export interface GatewayCitationFrame {
  readonly event: 'citation';
  readonly streamId: string;
  readonly sourceId: string;
  readonly title: string;
  readonly uri: string;
}

export interface GatewayAssessmentFrame {
  readonly event: 'assessment';
  readonly streamId: string;
  readonly summary: string;
  /** Read-only judgement never raises operational maturity. */
  readonly operationalStatus: 'NOT_ATTESTED';
}

export interface GatewayDoneFrame {
  readonly event: 'done';
  readonly streamId: string;
  /** False when the client cancelled or the upstream died mid-answer. */
  readonly complete: boolean;
}

export interface GatewayErrorFrame {
  readonly event: 'error';
  readonly streamId: string;
  readonly refusal: GatewayRefusal;
  readonly message: string;
}

export type GatewayFrame =
  | GatewayMetaFrame
  | GatewayTokenFrame
  | GatewayCitationFrame
  | GatewayAssessmentFrame
  | GatewayDoneFrame
  | GatewayErrorFrame;

const STREAM_ID = /^[A-Za-z0-9_-]{8,64}$/;
const MAX_TEXT = 8_192;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown, max = 512): boolean {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

/**
 * Recursively refuse any write-shaped key, at any depth. A nested
 * `{"data":{"prepared_action":…}}` is the same capability as a top-level one.
 */
function findForbiddenKey(value: unknown, depth = 0): string | null {
  if (depth > 8 || !isPlainObject(value)) return null;
  for (const [key, nested] of Object.entries(value)) {
    if ((FORBIDDEN_ACTION_KEYS as readonly string[]).includes(key)) return key;
    const deeper = findForbiddenKey(nested, depth + 1);
    if (deeper !== null) return deeper;
  }
  return null;
}

/** Same idea for server-only identity leaking outward. */
function findPrivateKey(value: unknown, depth = 0): string | null {
  if (depth > 8 || !isPlainObject(value)) return null;
  for (const [key, nested] of Object.entries(value)) {
    if ((PRIVATE_IDENTITY_KEYS as readonly string[]).includes(key)) return key;
    const deeper = findPrivateKey(nested, depth + 1);
    if (deeper !== null) return deeper;
  }
  return null;
}

export interface FrameRejection {
  readonly ok: false;
  readonly reason: string;
}

export interface FrameAcceptance {
  readonly ok: true;
  readonly frame: GatewayFrame;
}

export type FrameVerdict = FrameAcceptance | FrameRejection;

const reject = (reason: string): FrameRejection => ({ ok: false, reason });

/**
 * Explicit predicates rather than relying on discriminated-union narrowing: this
 * package does not enable `strict`, and without it a `true`/`false` discriminant
 * widens to `boolean` and stops narrowing. A contract whose safety depends on a
 * compiler setting elsewhere is not a contract.
 */
export function isRejection(verdict: FrameVerdict): verdict is FrameRejection {
  return verdict.ok === false;
}

export function isAcceptance(verdict: FrameVerdict): verdict is FrameAcceptance {
  return verdict.ok === true;
}

/**
 * Validate one frame for one mode.
 *
 * Fail-closed by construction: the function returns a verdict rather than
 * throwing or defaulting, so a caller cannot accidentally treat an unparsed
 * frame as a valid one.
 */
export function validateFrame(candidate: unknown, mode: GatewayMode): FrameVerdict {
  if (!isPlainObject(candidate)) return reject('frame must be an object');

  const event = candidate.event;
  if (typeof event !== 'string' || !(GATEWAY_EVENTS as readonly string[]).includes(event)) {
    return reject(`unknown event ${JSON.stringify(event)}`);
  }

  const forbidden = findForbiddenKey(candidate);
  if (forbidden !== null) {
    return reject(`write-capable key ${JSON.stringify(forbidden)} is forbidden: the gateway is read-only`);
  }

  // Public frames must not carry server-authorized identity at all. Private ones
  // may not either: the identity is established by the server session, so a frame
  // restating it can only be an echo the client could tamper with.
  const privateKey = findPrivateKey(candidate);
  if (privateKey !== null) {
    return reject(`identity key ${JSON.stringify(privateKey)} must not travel in a frame`);
  }

  if (!nonEmptyString(candidate.streamId, 64) || !STREAM_ID.test(candidate.streamId as string)) {
    return reject('streamId must be 8..64 url-safe characters');
  }

  switch (event) {
    case 'meta': {
      if (candidate.mode !== mode) return reject(`meta mode ${JSON.stringify(candidate.mode)} does not match the stream`);
      const identity = candidate.modelIdentity;
      if (identity !== null && !nonEmptyString(identity, 200)) {
        return reject('modelIdentity must be a bounded string or null');
      }
      return { ok: true, frame: candidate as unknown as GatewayMetaFrame };
    }
    case 'token': {
      // Empty text is allowed to be refused rather than silently dropped: a stream
      // that emits nothings is a bug worth seeing, not whitespace worth hiding.
      if (typeof candidate.text !== 'string' || candidate.text.length === 0) {
        return reject('token text must be a non-empty string');
      }
      if (candidate.text.length > MAX_TEXT) return reject('token text exceeds the bounded size');
      return { ok: true, frame: candidate as unknown as GatewayTokenFrame };
    }
    case 'citation': {
      if (!nonEmptyString(candidate.sourceId, 200)) return reject('citation sourceId is required');
      if (!nonEmptyString(candidate.title, 512)) return reject('citation title is required');
      if (!nonEmptyString(candidate.uri, 2_048)) return reject('citation uri is required');
      // A citation nobody can open is indistinguishable from an invented one.
      if (!/^https?:\/\//.test(candidate.uri as string)) return reject('citation uri must be http(s)');
      return { ok: true, frame: candidate as unknown as GatewayCitationFrame };
    }
    case 'assessment': {
      if (!nonEmptyString(candidate.summary, 2_048)) return reject('assessment summary is required');
      if (candidate.operationalStatus !== 'NOT_ATTESTED') {
        return reject('an assessment must not raise operational maturity');
      }
      return { ok: true, frame: candidate as unknown as GatewayAssessmentFrame };
    }
    case 'done': {
      if (typeof candidate.complete !== 'boolean') return reject('done requires an explicit complete flag');
      return { ok: true, frame: candidate as unknown as GatewayDoneFrame };
    }
    case 'error': {
      const refusal = candidate.refusal;
      if (typeof refusal !== 'string' || !(GATEWAY_REFUSALS as readonly string[]).includes(refusal)) {
        return reject(`unknown refusal ${JSON.stringify(refusal)}`);
      }
      if (!nonEmptyString(candidate.message, 512)) return reject('error requires a bounded message');
      return { ok: true, frame: candidate as unknown as GatewayErrorFrame };
    }
    /* c8 ignore next 2 -- unreachable: the event set is closed above */
    default:
      return reject(`unhandled event ${JSON.stringify(event)}`);
  }
}

/**
 * A truncated answer must be invalidated, not shown.
 *
 * If a stream is cancelled or dies after tokens were emitted, the partial text is
 * an answer the model never finished and nobody vouched for. Rendering it is how
 * an assistant appears to state something it did not conclude, so the contract
 * makes "keep what we got" unrepresentable: the only outcomes are a completed
 * answer or none.
 */
export interface StreamOutcome {
  readonly usable: boolean;
  readonly text: string;
  readonly refusal: GatewayRefusal | null;
}

export function resolveOutcome(frames: readonly GatewayFrame[]): StreamOutcome {
  let text = '';
  let sawDone = false;
  let complete = false;
  let refusal: GatewayRefusal | null = null;

  for (const frame of frames) {
    if (frame.event === 'token') text += frame.text;
    else if (frame.event === 'done') {
      sawDone = true;
      complete = frame.complete;
    } else if (frame.event === 'error') refusal = frame.refusal;
  }

  const usable = sawDone && complete && refusal === null && text.length > 0;
  return { usable, text: usable ? text : '', refusal };
}

/**
 * Whether generation may run at all.
 *
 * Without an admitted model the answer is a refusal — never a canned or mocked
 * reply. A fallback would make an unadmitted model indistinguishable from an
 * admitted one to anyone reading the UI, which is precisely the false readiness
 * this whole contour exists to prevent.
 */
export function resolveAdmission(input: {
  readonly featureEnabled: boolean;
  readonly modelIdentity: string | null;
  readonly admissionStatus: string | null;
}): { readonly allowed: boolean; readonly refusal: GatewayRefusal | null } {
  if (!input.featureEnabled) return { allowed: false, refusal: 'FEATURE_DISABLED' };
  if (input.modelIdentity === null || input.admissionStatus !== 'ADMITTED') {
    return { allowed: false, refusal: 'MODEL_NOT_ADMITTED' };
  }
  return { allowed: true, refusal: null };
}

/**
 * Absolute, openable citation URI, or null.
 *
 * Both contours cite platform pages by path. A path is not something a reader
 * can open out of a citation list, and `validateFrame` refuses a non-http(s)
 * URI for that reason, so a citation that cannot be resolved to an absolute
 * address is dropped rather than reshaped into something that looks openable.
 */
export function absoluteCitationUri(href: string | null | undefined, base: string | null): string | null {
  if (!href) return null;
  if (/^https?:\/\//.test(href)) return href;
  if (!base) return null;
  try {
    const resolved = new URL(href, base.endsWith('/') ? base : `${base}/`).toString();
    return /^https?:\/\//.test(resolved) ? resolved : null;
  } catch {
    return null;
  }
}

/** Default token size. Bounded so one frame never carries a whole answer. */
export const TOKEN_CHUNK_CHARS = 400;

/** Split an answer into token frames the client can render progressively. */
export function chunkAnswer(text: string, size: number = TOKEN_CHUNK_CHARS): string[] {
  // A non-positive size would either loop forever or produce the empty token
  // text the contract refuses, so it falls back to the bounded default.
  const step = size > 0 ? size : TOKEN_CHUNK_CHARS;
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += step) {
    chunks.push(text.slice(index, index + step));
  }
  return chunks;
}

/**
 * SSE wire form of a validated frame.
 *
 * The encoder lives with the validator on purpose. If each contour serialized
 * frames itself, the two would drift — a stray newline or a differently named
 * event field is enough for one side to accept what the other emits and vice
 * versa, and the contract would describe a wire nobody actually speaks.
 *
 * `JSON.stringify` cannot produce a raw newline inside the payload, so the
 * single-line `data:` form is safe by construction rather than by convention.
 */
export function encodeFrame(frame: GatewayFrame): string {
  return `event: ${frame.event}\ndata: ${JSON.stringify(frame)}\n\n`;
}

/** A stream that has ended, and whether it ended with a complete answer. */
export interface GatewayStreamState {
  readonly sealed: boolean;
  readonly complete: boolean;
}

/**
 * The single emission path both contours use.
 *
 * Every frame is validated before it is written, so an invalid frame is never
 * on the wire — not even briefly. A rejected frame does not merely get skipped:
 * skipping would leave the tokens already sent looking like a finished answer,
 * which is the exact failure `resolveOutcome` exists to prevent. It seals the
 * stream with a refusal and `done{complete:false}` instead, so a stream that
 * went wrong is invalidated end to end.
 *
 * Nothing here knows about Nest, Next, Node streams or sockets: the sink is a
 * plain `write` callback. That is what lets the private API and the public
 * boundary share one implementation rather than two that resemble each other.
 */
export class GatewayStreamWriter {
  private sealedState = false;
  private completeState = false;

  constructor(
    private readonly write: (chunk: string) => void,
    private readonly mode: GatewayMode,
    private readonly streamId: string,
  ) {
    // Checked once, up front: the refusal path writes frames directly, and it
    // must not be the thing that produces an invalid frame. A bad streamId is a
    // server bug, so it fails before any byte is sent rather than mid-stream.
    if (!STREAM_ID.test(streamId)) {
      throw new Error('streamId must be 8..64 url-safe characters');
    }
  }

  get state(): GatewayStreamState {
    return { sealed: this.sealedState, complete: this.completeState };
  }

  /**
   * Emit a frame body. Returns whether it reached the wire, so a caller that
   * loops over model output stops instead of pushing into a sealed stream.
   */
  emit(body: Record<string, unknown>): boolean {
    if (this.sealedState) return false;

    const candidate = { ...body, streamId: this.streamId };
    const verdict = validateFrame(candidate, this.mode);
    if (isRejection(verdict)) {
      this.sealWithRefusal('UPSTREAM_ERROR', `frame rejected by the contract: ${verdict.reason}`);
      return false;
    }

    this.write(encodeFrame(verdict.frame));
    if (verdict.frame.event === 'done') {
      this.sealedState = true;
      this.completeState = verdict.frame.complete;
    }
    return true;
  }

  /** End the stream with a refusal. Never marks the answer complete. */
  fail(refusal: GatewayRefusal, message: string): void {
    if (this.sealedState) return;
    this.sealWithRefusal(refusal, message);
  }

  /** End the stream with a finished answer. */
  complete(): boolean {
    return this.emit({ event: 'done', complete: true });
  }

  /**
   * End the stream without an answer: cancellation, a dead upstream, or a frame
   * the contract refused. Safe to call twice, so a socket-close handler and the
   * normal path cannot contradict each other.
   */
  abandon(): void {
    if (this.sealedState) return;
    this.emit({ event: 'done', complete: false });
  }

  private sealWithRefusal(refusal: GatewayRefusal, message: string): void {
    // Emitted directly rather than through `emit`, which would recurse if the
    // refusal itself failed validation. Both frames are contract-shaped here.
    const bounded = message.length > 512 ? `${message.slice(0, 509)}...` : message;
    this.write(encodeFrame({ event: 'error', streamId: this.streamId, refusal, message: bounded }));
    this.write(encodeFrame({ event: 'done', streamId: this.streamId, complete: false }));
    this.sealedState = true;
    this.completeState = false;
  }
}
