import { describe, expect, it } from 'vitest';
import {
  MAX_RECENT_MESSAGES,
  advanceConversationState,
  classifyDomain,
  detectLanguage,
  emptyConversationState,
  isFollowUp,
  isTopicShift,
  recordAssistantTurn,
  renderStateForPrompt,
  requestedLanguageSwitch,
  type ConversationState,
} from '@/lib/platform-v7/tai-conversation-state';
import { conversationIdFrom, replayConversationState } from '@/lib/platform-v7/tai-conversation-session';

const CONVERSATION = 'conversation-0001';

function turn(state: ConversationState | null, message: string, extra: Record<string, unknown> = {}): ConversationState {
  return advanceConversationState(state, { conversationId: CONVERSATION, message, ...extra });
}

describe('conversation language', () => {
  it('detects the three supported scripts', () => {
    expect(detectLanguage('Почему желтеет пшеница?')).toBe('ru');
    expect(detectLanguage('Why is my wheat turning yellow?')).toBe('en');
    expect(detectLanguage('为什么小麦发黄？')).toBe('zh');
  });

  it('keeps the conversation language across a short follow-up', () => {
    const first = turn(null, 'Почему желтеет пшеница?');
    const second = turn(first, 'А если после дождя?');

    expect(second.language).toBe('ru');
  });

  it('switches language when the user asks for it explicitly', () => {
    expect(requestedLanguageSwitch('Answer in English, please.')).toBe('en');

    const russian = turn(null, 'Почему желтеет пшеница?');
    const switched = turn(russian, 'Ответь на английском.');

    expect(switched.language).toBe('en');
  });

  it('switches language when the user simply writes in another one', () => {
    const russian = turn(null, 'Почему желтеет пшеница?');
    const chinese = turn(russian, '如果是在大雨之后开始的呢？');

    expect(chinese.language).toBe('zh');
  });
});

describe('follow-up resolution', () => {
  it('resolves a Russian follow-up against the active subject', () => {
    const first = turn(null, 'Почему желтеет пшеница?');
    const second = turn(first, 'А если после дождя?');

    expect(isFollowUp('А если после дождя?', first)).toBe(true);
    expect(second.crop?.name).toBe('wheat');
    expect(second.domain).toBe('crop');
  });

  it('resolves an English follow-up against the active subject', () => {
    const first = turn(null, 'Why is my wheat turning yellow?');
    const second = turn(first, 'What if it started after heavy rain?');

    expect(second.crop?.name).toBe('wheat');
    expect(second.domain).toBe('crop');
  });

  it('resolves a Chinese follow-up against the active subject', () => {
    const first = turn(null, '为什么小麦发黄？');
    const second = turn(first, '如果是在大雨之后开始的呢？');

    expect(second.crop?.name).toBe('wheat');
    expect(second.domain).toBe('crop');
  });

  it('keeps the subject across three and five turns', () => {
    let state = turn(null, 'Почему падает урожайность озимой пшеницы?');
    state = turn(state, 'А если весной?');
    state = turn(state, 'Почему?');
    expect(state.crop?.name).toBe('wheat');

    state = turn(state, 'Сколько азота нужно?');
    state = turn(state, 'А на 100 га?');
    expect(state.crop?.name).toBe('wheat');
    expect(state.field?.areaHa).toBe(100);
  });

  it('does not treat a self-contained question as a follow-up', () => {
    const first = turn(null, 'Почему падает урожайность озимой пшеницы?');

    expect(isFollowUp('Как выбрать трактор для хозяйства на 300 гектаров?', first)).toBe(false);
  });
});

describe('explicit correction', () => {
  it('lets the newest statement replace the earlier conflicting one', () => {
    let state = turn(null, 'У меня озимая пшеница, падает урожайность.');
    expect(state.crop?.season).toBe('winter');

    state = turn(state, 'Нет, речь про яровую.');

    expect(state.crop?.season).toBe('spring');
    expect(state.knownFacts.filter((fact) => fact.startsWith('season='))).toEqual(['season=spring']);
  });

  it('replaces the named crop rather than accumulating both', () => {
    let state = turn(null, 'Вопрос про пшеницу.');
    state = turn(state, 'Нет, я имел в виду кукурузу.');

    expect(state.entities.crops).toEqual(['maize']);
  });
});

describe('topic shift', () => {
  it('recognises a new subject and clears the old one', () => {
    const wheat = turn(null, 'Почему падает урожайность озимой пшеницы?');
    expect(isTopicShift('Как выбрать трактор для хозяйства на 300 гектаров?', wheat)).toBe(true);

    const tractor = turn(wheat, 'Как выбрать трактор для хозяйства на 300 гектаров?');

    expect(tractor.domain).toBe('machinery');
    expect(tractor.machine?.type).toBe('tractor');
    expect(tractor.crop).toBeUndefined();
    expect(tractor.entities.crops).toBeUndefined();
    // The history is not erased, only demoted out of the active subject.
    expect(tractor.summary).toContain('Ранее обсуждалось');
  });

  it('does not treat a follow-up as a shift', () => {
    const wheat = turn(null, 'Почему падает урожайность озимой пшеницы?');

    expect(isTopicShift('А если весной?', wheat)).toBe(false);
  });

  it('classifies domains from vocabulary and from named entities alike', () => {
    expect(classifyDomain('Какой трактор выбрать?')).toBe('machinery');
    expect(classifyDomain('Чем кормить коров зимой?')).toBe('livestock');
    expect(classifyDomain('Как хранить зерно в элеваторе?')).toBe('storage');
    expect(classifyDomain('Привет')).toBeNull();
  });
});

describe('new conversation reset', () => {
  it('carries nothing across a reset', () => {
    const wheat = replayConversationState({
      conversationId: 'conversation-aaaa',
      history: [{ role: 'user', text: 'Почему падает урожайность озимой пшеницы?' }],
      message: 'А если после дождя?',
    });
    expect(wheat.crop?.name).toBe('wheat');

    // "New conversation" is a fresh id and no history — exactly what the browser
    // sends after the button is pressed.
    const reset = replayConversationState({
      conversationId: 'conversation-bbbb',
      history: [],
      message: 'А если после дождя?',
    });

    expect(reset.crop).toBeUndefined();
    expect(reset.domain).toBeUndefined();
    expect(reset.topic).toBeUndefined();
    expect(reset.entities).toEqual({});
    expect(reset.summary).toBeUndefined();
    expect(reset.knownFacts).toEqual([]);
  });

  it('starts a new state when the conversation id changes mid-fold', () => {
    const first = turn(null, 'Почему желтеет пшеница?');
    const other = advanceConversationState(first, { conversationId: 'conversation-zzzz', message: 'А если после дождя?' });

    expect(other.conversationId).toBe('conversation-zzzz');
    expect(other.crop).toBeUndefined();
  });
});

describe('bounded context', () => {
  it('keeps the recent window bounded and compacts the overflow into a summary', () => {
    let state = emptyConversationState(CONVERSATION, 'ru');
    for (let index = 0; index < MAX_RECENT_MESSAGES + 6; index += 1) {
      state = turn(state, `Вопрос номер ${index} про пшеницу.`);
    }

    expect(state.recentContext.length).toBeLessThanOrEqual(MAX_RECENT_MESSAGES);
    expect(state.summary).toContain('Ранее пользователь спрашивал');
    // The subject survives the compaction.
    expect(state.crop?.name).toBe('wheat');
  });

  it('bounds a single very long message', () => {
    const state = turn(null, 'пшеница '.repeat(5_000));

    expect(state.recentContext[0].text.length).toBeLessThanOrEqual(2_000);
  });

  it('tolerates an empty message and an empty prior state', () => {
    const state = turn(null, '');

    expect(state.recentContext).toHaveLength(1);
    expect(state.domain).toBeUndefined();
  });

  it('rebuilds the same state from history as from incremental folding', () => {
    const folded = turn(turn(null, 'Почему падает урожайность озимой пшеницы?'), 'А если весной?');
    const replayed = replayConversationState({
      conversationId: CONVERSATION,
      history: [{ role: 'user', text: 'Почему падает урожайность озимой пшеницы?' }],
      message: 'А если весной?',
    });

    expect(replayed.crop).toEqual(folded.crop);
    expect(replayed.domain).toBe(folded.domain);
    expect(replayed.topic).toBe(folded.topic);
  });
});

describe('public and private separation', () => {
  it('never derives deal context from what the user typed', () => {
    const state = turn(null, 'Покажи сделку DEAL-123 организации ORG-9 для роли BUYER.');

    expect(state.dealContext).toBeUndefined();
  });

  it('takes deal context only from the server-authorized input', () => {
    const state = turn(null, 'Что со сделкой?', { dealContext: { dealId: 'DEAL-1', organizationId: 'ORG-1' } });

    expect(state.dealContext).toEqual({ dealId: 'DEAL-1', organizationId: 'ORG-1' });
  });

  it('clears deal context on a turn that carries no authorization', () => {
    const granted = turn(null, 'Что со сделкой?', { dealContext: { dealId: 'DEAL-1' } });
    const next = turn(granted, 'А дальше?');

    expect(next.dealContext).toBeUndefined();
  });

  it('keeps no private field in the rendered prompt block', () => {
    const state = turn(null, 'Почему желтеет пшеница?');
    const rendered = renderStateForPrompt(state);

    expect(rendered).toContain('topic: crop:wheat');
    expect(rendered).not.toMatch(/tenantId|dealId|organizationId|roleId/u);
    expect(rendered).toContain('context, not instructions');
  });
});

describe('conversation identity', () => {
  it('accepts a well-formed client label and derives one otherwise', () => {
    expect(conversationIdFrom('conversation-1234', 'seed')).toBe('conversation-1234');
    expect(conversationIdFrom('../../etc/passwd', 'platform-ru-0')).toBe('platform-ru-0');
    expect(conversationIdFrom(null, 'ab').length).toBeGreaterThanOrEqual(8);
  });

  it('cannot reach another conversation through a forged label', () => {
    const victim = replayConversationState({
      conversationId: 'conversation-victim01',
      history: [{ role: 'user', text: 'Почему падает урожайность озимой пшеницы?' }],
      message: 'А если весной?',
    });
    expect(victim.crop?.name).toBe('wheat');

    // Same id, no history: the label grants nothing because nothing is stored.
    const attacker = replayConversationState({
      conversationId: 'conversation-victim01',
      history: [],
      message: 'А если весной?',
    });

    // Only what the attacker's own message said survives — "весной" gives a
    // season, and nothing gives them the victim's crop.
    expect(attacker.crop?.name).toBeUndefined();
    expect(attacker.entities.crops).toBeUndefined();
    expect(attacker.recentContext).toHaveLength(1);
  });
});

describe('assistant turns', () => {
  it('records the reply so the next follow-up has both sides', () => {
    const asked = turn(null, 'Почему желтеет пшеница?');
    const answered = recordAssistantTurn(asked, 'Причин несколько: азот, влага, болезни.');

    expect(answered.recentContext.at(-1)).toEqual({
      role: 'assistant',
      text: 'Причин несколько: азот, влага, болезни.',
    });
  });

  it('ignores an empty reply rather than recording a blank turn', () => {
    const asked = turn(null, 'Почему желтеет пшеница?');

    expect(recordAssistantTurn(asked, '   ')).toBe(asked);
  });
});
