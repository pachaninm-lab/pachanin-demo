/**
 * One open operation for the public Gekta widget.
 *
 * Entry points (header, section, prompt cards, contact dock, deal explorer) are
 * server-rendered and hydrate before the assistant chunk arrives. A window
 * event sent in that gap had no listener and the first click was lost. This
 * boundary keeps exactly one pending intent until the single owner
 * (`PublicPlatformAssistant`) binds, then hands it over once.
 *
 * It is a mailbox, not a store: it holds no conversation, draft or messages.
 * Those remain owned by the assistant component.
 */

export type PublicGektaOpenIntent = {
  readonly source: string;
  /** Public page context label; never a tenant, deal or document identifier. */
  readonly context?: string;
  /** Suggestions shown as editable prompt cards. */
  readonly prompts?: readonly string[];
  /** Text placed into the composer. It is never submitted automatically. */
  readonly draft?: string;
  /** Element that receives focus again when the panel closes. */
  readonly opener?: HTMLElement | null;
};

export type PublicGektaOpenStatus = 'idle' | 'opening' | 'failed';

type Owner = (intent: PublicGektaOpenIntent) => void;
type StatusListener = (status: PublicGektaOpenStatus) => void;

/** A pending open that has not been delivered by then is abandoned. */
export const PUBLIC_GEKTA_OPEN_STALL_MS = 15_000;

let owner: Owner | null = null;
let pending: PublicGektaOpenIntent | null = null;
let status: PublicGektaOpenStatus = 'idle';
let stallTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<StatusListener>();

function setStatus(next: PublicGektaOpenStatus) {
  if (status === next) return;
  status = next;
  for (const listener of listeners) listener(next);
}

/** Open Gekta now, or as soon as its owner mounts. The latest intent wins. */
export function requestPublicGektaOpen(intent: PublicGektaOpenIntent): PublicGektaOpenStatus {
  if (owner) {
    owner(intent);
    return 'idle';
  }
  if (status === 'failed') return status;
  pending = intent;
  if (status !== 'opening') {
    // The assistant code never arrived: say so and drop the intent, so a very
    // late load cannot open the dialog after the entry already reported failure.
    stallTimer = setTimeout(reportPublicGektaUnavailable, PUBLIC_GEKTA_OPEN_STALL_MS);
  }
  setStatus('opening');
  return status;
}

/** Bind the single owner. A pending intent is delivered exactly once. */
export function bindPublicGektaOwner(handler: Owner): () => void {
  clearTimeout(stallTimer);
  owner = handler;
  setStatus('idle');
  const intent = pending;
  pending = null;
  if (intent) handler(intent);
  return () => {
    if (owner === handler) owner = null;
  };
}

/** The assistant code could not be loaded. Nothing is opened later by surprise. */
export function reportPublicGektaUnavailable() {
  clearTimeout(stallTimer);
  pending = null;
  setStatus('failed');
}

export function readPublicGektaOpenStatus(): PublicGektaOpenStatus {
  return status;
}

/** Subscribe to the open status; the listener receives the current one at once. */
export function subscribePublicGektaOpenStatus(listener: StatusListener): () => void {
  listeners.add(listener);
  listener(status);
  return () => {
    listeners.delete(listener);
  };
}
