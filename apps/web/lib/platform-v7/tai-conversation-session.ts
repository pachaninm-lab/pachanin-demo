/**
 * How the boundary gets conversation state without owning a conversation store.
 *
 * The obvious implementation — a process-global map keyed by conversation id —
 * is a cross-user collision and a memory leak waiting for enough traffic, and on
 * a restart it silently forgets every conversation in flight. It also makes the
 * id a capability: anyone who guesses one reads someone else's context.
 *
 * So state is not stored. It is replayed, per request, from the history that
 * request carried. Two consequences follow, and both are wanted: a reader can
 * only ever reconstruct their own conversation, because the only input is their
 * own request; and "new conversation" is genuinely a reset, because the browser
 * sends no history and there is nothing anywhere else to inherit from.
 */
import {
  advanceConversationState,
  emptyConversationState,
  recordAssistantTurn,
  type ConversationLanguage,
  type ConversationDealContext,
  type ConversationMessage,
  type ConversationState,
} from './tai-conversation-state';

const CONVERSATION_ID = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * A conversation identifier for this request.
 *
 * The client's value is accepted only as a correlation label, and only when it
 * is shaped like one. It grants nothing: no state is looked up by it, so a
 * forged or replayed id reaches exactly the context the same request already
 * contained. A missing or malformed id gets a derived one rather than a refusal,
 * because an unlabelled conversation is still a conversation.
 */
export function conversationIdFrom(candidate: unknown, fallbackSeed: string): string {
  if (typeof candidate === 'string' && CONVERSATION_ID.test(candidate)) return candidate;
  const seed = fallbackSeed.replace(/[^A-Za-z0-9_-]/gu, '').slice(0, 48);
  return seed.length >= 8 ? seed : `conversation-${seed}`.slice(0, 64);
}

export interface ReplayInput {
  readonly conversationId: string;
  readonly history: readonly ConversationMessage[];
  readonly message: string;
  readonly requestedLanguage?: ConversationLanguage;
  /**
   * Server-authorized deal context only. The public contour passes nothing here,
   * and an authenticated one passes what its own authorization resolved — never
   * a value the request body asked for.
   */
  readonly dealContext?: ConversationDealContext | null;
  readonly now?: string;
}

/**
 * Fold a conversation forward from its history and the message that just
 * arrived. The current message is applied last so the newest explicit statement
 * is the one that wins every conflict.
 */
export function replayConversationState(input: ReplayInput): ConversationState {
  let state: ConversationState = emptyConversationState(
    input.conversationId,
    input.requestedLanguage ?? 'ru',
    input.now,
  );

  for (const turn of input.history) {
    const text = turn.text.trim();
    if (!text) continue;
    state = turn.role === 'user'
      ? advanceConversationState(state, {
        conversationId: input.conversationId,
        message: text,
        requestedLanguage: input.requestedLanguage,
        dealContext: input.dealContext ?? null,
        now: input.now,
      })
      : recordAssistantTurn(state, text, input.now);
  }

  return advanceConversationState(state, {
    conversationId: input.conversationId,
    message: input.message,
    requestedLanguage: input.requestedLanguage,
    dealContext: input.dealContext ?? null,
    now: input.now,
  });
}
