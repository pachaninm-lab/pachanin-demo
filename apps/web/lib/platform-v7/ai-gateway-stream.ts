/**
 * Client side of the TAI gateway stream.
 *
 * The browser reads the same contract the server writes with: frames are parsed
 * off the wire and handed to `validateFrame` before anything reaches the UI, so
 * a frame the server should never have sent is refused here too. That matters
 * because the failure this whole contour guards against — an answer that looks
 * validated but is not — is a failure of what the reader sees, and the reader
 * is on this side of the socket.
 *
 * Live tokens are surfaced as they arrive, but never as a finished answer:
 * `resolveOutcome` decides that, and until it says so the text is provisional.
 * A stream that ends without `done{complete:true}` leaves no text at all.
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
  /**
   * Provisional while `status` is 'streaming'; the validated answer once it is
   * 'answered'; empty when 'refused'. It is never partial text presented as an
   * answer — a refused stream carries no text at all.
   */
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
}

/**
 * Largest unfinished SSE record the client will hold.
 *
 * Comfortably above one legitimate frame — the contract bounds token text at
 * 8192 characters and a citation URI at 2048 — and far below anything that
 * could exhaust a browser tab.
 */
export const MAX_PENDING_RECORD_CHARS = 64 * 1024;

const EMPTY: GatewayStreamSnapshot = {
  status: 'streaming',
  text: '',
  citations: [],
  assessment: null,
  modelIdentity: null,
  refusal: null,
};

/**
 * Split an SSE buffer into complete records, returning the unfinished tail.
 *
 * A chunk boundary can land anywhere, including inside a JSON payload, so a
 * partial record is kept rather than parsed — parsing it would either throw or,
 * worse, succeed on a truncated object.
 */
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

/**
 * Fold one validated frame into the snapshot.
 *
 * Exported because the folding rules are the part worth testing directly: the
 * transport around them is plumbing, this is where "what may be shown" is
 * decided.
 */
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
      // The one place a stream becomes an answer. Anything else — a refusal, a
      // `done{complete:false}`, or no `done` at all — drops the text, so the
      // provisional tokens cannot survive as something that looks vouched for.
      const answered = frame.complete && snapshot.refusal === null && snapshot.text.length > 0;
      if (answered) return { ...snapshot, status: 'answered' };
      // A stream that completed without saying anything is not an empty answer;
      // it is a stream that produced nothing, and `resolveOutcome` calls it
      // unusable for the same reason. Rendering an empty bubble would read as
      // the assistant having considered the question and had nothing to add.
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

/**
 * Read a gateway response to completion.
 *
 * Resolves with the final snapshot rather than throwing on a refused stream: a
 * refusal is an answer the reader is meant to see, not an exception the caller
 * has to remember to catch and render.
 */
export async function readGatewayStream(
  response: Response,
  options: ReadGatewayStreamOptions,
): Promise<GatewayStreamSnapshot> {
  let snapshot = EMPTY;
  const publish = () => options.onSnapshot?.(snapshot);

  const finish = (fallback: GatewayRefusal): GatewayStreamSnapshot => {
    snapshot = sealSnapshot(snapshot, fallback);
    publish();
    return snapshot;
  };

  if (!response.ok || !response.body) return finish('UPSTREAM_ERROR');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const onAbort = () => {
    void reader.cancel().catch(() => undefined);
  };
  options.signal?.addEventListener('abort', onAbort, { once: true });

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const { records, rest } = splitRecords(buffer);
      buffer = rest;

      // Every field the contract describes is bounded, but the transport around
      // them was not: bytes that never contain a record separator are held as an
      // unfinished record forever, and the buffer grows without limit in the
      // reader's browser. A stream that has sent this much without completing a
      // single record is not speaking the contract.
      if (buffer.length > MAX_PENDING_RECORD_CHARS) return finish('UPSTREAM_ERROR');

      for (const record of records) {
        const payload = recordPayload(record);
        if (payload === null) continue;

        let parsed: unknown;
        try {
          parsed = JSON.parse(payload);
        } catch {
          // Unparseable bytes on a stream that claims to be this contract are
          // not something to skip past: whatever produced them is not speaking
          // the contract, and the rest of the stream cannot be trusted either.
          return finish('UPSTREAM_ERROR');
        }

        const verdict = validateFrame(parsed, options.mode);
        if (isRejection(verdict)) return finish('UPSTREAM_ERROR');

        snapshot = applyFrame(snapshot, verdict.frame);
        publish();
        if (snapshot.status !== 'streaming') return snapshot;
      }
    }
  } catch {
    // A socket that dies mid-answer is the truncation case, not a special one.
    return finish(options.signal?.aborted ? 'CANCELLED' : 'UPSTREAM_ERROR');
  } finally {
    options.signal?.removeEventListener('abort', onAbort);
    reader.releaseLock?.();
  }

  return finish(options.signal?.aborted ? 'CANCELLED' : 'UPSTREAM_ERROR');
}

/**
 * Cross-check a completed stream against the contract's own outcome rule.
 *
 * The incremental fold above and `resolveOutcome` are two ways of deciding the
 * same thing, and the UI must not be able to show an answer the contract would
 * call unusable. Callers that keep the frames can assert the two agree.
 */
export function snapshotAgreesWithContract(
  snapshot: GatewayStreamSnapshot,
  frames: readonly GatewayFrame[],
): boolean {
  const outcome = resolveOutcome(frames);
  if (snapshot.status === 'answered') return outcome.usable && outcome.text === snapshot.text;
  return !outcome.usable && snapshot.text === '';
}
