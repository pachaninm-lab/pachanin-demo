import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  isAnswering,
  routeAssistantQuestion,
} from '@/lib/platform-v7/assistant-relevance-router';
import {
  composePlatformSectionAnswer,
  composeRedirectAnswer,
  composeSafetyAnswer,
} from '@/lib/platform-v7/assistant-answer-composer';
import {
  buildSemanticAcceptanceCorpus,
  CRITICAL_QUESTIONS,
  CORPUS_SURFACES,
} from '../fixtures/tai-semantic-acceptance-corpus';

const corpus = buildSemanticAcceptanceCorpus();
const root = process.cwd().endsWith('apps/web') ? path.resolve(process.cwd(), '../..') : process.cwd();
const knowledgeRoute = fs.readFileSync(
  path.join(root, 'apps/web/app/api/public-platform-assistant/route.ts'),
  'utf8',
);
const assistantUi = fs.readFileSync(
  path.join(root, 'apps/web/components/platform-v7/PublicPlatformAssistant.tsx'),
  'utf8',
);

/** Every case that must end in an answer rather than a deflection. */
const ALLOWED_SETS = [
  ['direct', corpus.direct],
  ['indirect', corpus.indirect],
  ['short follow-up', corpus.shortFollowUp],
  ['adjacent', corpus.adjacent],
  ['data protection and rights', corpus.dataRights],
] as const;

describe('the corpus covers what the acceptance set requires', () => {
  it('holds the required number of cases in every category', () => {
    expect(corpus.direct).toHaveLength(200);
    expect(corpus.indirect).toHaveLength(200);
    expect(corpus.shortFollowUp).toHaveLength(200);
    expect(corpus.adjacent).toHaveLength(100);
    expect(corpus.dataRights).toHaveLength(100);
    expect(corpus.unrelated).toHaveLength(100);
    expect(corpus.safety).toHaveLength(100);
  });

  it('covers all twelve cabinet roles and the anonymous surface', () => {
    const roles = new Set(CORPUS_SURFACES.map((surface) => surface.role));
    expect(roles.size).toBe(13);
    expect(roles.has(null)).toBe(true);

    // Every category must actually reach every surface, or the pairing is
    // decoration: a corpus that only ever asks anonymously proves nothing about
    // how a driver or a bank officer is answered.
    for (const [name, cases] of ALLOWED_SETS) {
      const covered = new Set(cases.map((item) => item.context.role));
      expect(covered.size, `${name} did not reach every surface`).toBe(13);
    }
  });

  it('asks every category in all three languages', () => {
    for (const [name, cases] of ALLOWED_SETS) {
      const locales = new Set(cases.map((item) => item.locale));
      expect([...locales].sort(), `${name} is missing a language`).toEqual(['en', 'ru', 'zh']);
    }
    expect(new Set(corpus.unrelated.map((item) => item.locale)).size).toBe(3);
    expect(new Set(corpus.safety.map((item) => item.locale)).size).toBe(3);
  });
});

describe('no allowed question is falsely refused', () => {
  for (const [name, cases] of ALLOWED_SETS) {
    it(`${name}: zero false refusals across ${cases.length} cases`, () => {
      const refused = cases.filter((item) => {
        const outcome = routeAssistantQuestion(item.question, item.context);
        return !isAnswering(outcome.decision);
      });
      expect(refused.map((item) => item.label)).toEqual([]);
    });
  }

  it('a short follow-up keeps the subject of the previous turn', () => {
    const drift = corpus.shortFollowUp.filter((item) => {
      const outcome = routeAssistantQuestion(item.question, item.context);
      if (!isAnswering(outcome.decision)) return true;
      // Either the follow-up resolves a section of its own, or it inherits the
      // conversation. What it must never do is arrive with neither.
      return outcome.section === null && !outcome.signals.includes('conversation');
    });
    expect(drift.map((item) => item.label)).toEqual([]);
  });
});

describe('the question from the report is answered as platform security', () => {
  it('resolves in every language, on every surface', () => {
    const question = CRITICAL_QUESTIONS[0];
    for (const surface of CORPUS_SURFACES) {
      for (const locale of ['ru', 'en', 'zh'] as const) {
        const outcome = routeAssistantQuestion(question[locale], {
          ...corpus.direct[0].context,
          locale,
          role: surface.role,
          page: surface.page,
        });
        expect(outcome.decision, `${question[locale]} @ ${surface.label}`).toBe('ALLOW_DIRECT');
        expect(outcome.section).toBe('platform_security');
      }
    }
  });

  it('produces a complete answer in every language', () => {
    for (const locale of ['ru', 'en', 'zh'] as const) {
      const composed = composePlatformSectionAnswer('platform_security', locale)!;
      expect(composed.answer.split('\n\n').length).toBeGreaterThanOrEqual(4);
      // Chinese says the same thing in roughly half the characters, so the
      // floor follows the script instead of flagging a complete answer as thin.
      expect(composed.answer.length).toBeGreaterThan(locale === 'zh' ? 200 : 400);
    }
  });
});

describe('every mandatory question is answered in all three languages', () => {
  it.each(CRITICAL_QUESTIONS.map((row) => [row.ru, row] as const))('%s', (_label, row) => {
    for (const locale of ['ru', 'en', 'zh'] as const) {
      const outcome = routeAssistantQuestion(row[locale], {
        ...corpus.direct[0].context,
        locale,
      });
      expect(isAnswering(outcome.decision), `${row[locale]} (${locale})`).toBe(true);
      expect(outcome.decision).not.toBe('REDIRECT_UNRELATED');
      if (outcome.section) {
        const composed = composePlatformSectionAnswer(outcome.section, locale)!;
        expect(composed.answer.length).toBeGreaterThan(locale === 'zh' ? 150 : 250);
      }
    }
  });
});

describe('boundaries hold', () => {
  it('every unrelated question is redirected', () => {
    const admitted = corpus.unrelated.filter(
      (item) => routeAssistantQuestion(item.question, item.context).decision !== 'REDIRECT_UNRELATED',
    );
    expect(admitted.map((item) => item.label)).toEqual([]);
  });

  it('every safety request is blocked, on every surface', () => {
    const leaked = corpus.safety.filter(
      (item) => routeAssistantQuestion(item.question, item.context).decision !== 'BLOCK_SAFETY',
    );
    expect(leaked.map((item) => item.label)).toEqual([]);
  });

  it('a related conversation never unlocks a safety request', () => {
    for (const item of corpus.safety) {
      const outcome = routeAssistantQuestion(item.question, {
        ...item.context,
        previousTopic: 'platform_security',
        semanticHint: 'related',
        recentMessages: [{ role: 'user', text: 'Как защищаются данные?' }],
      });
      expect(outcome.decision, item.label).toBe('BLOCK_SAFETY');
    }
  });
});

describe('nothing internal reaches the reader', () => {
  const INTERNAL_TOKENS = [
    'ALLOW_DIRECT', 'ALLOW_CONTEXTUAL', 'ALLOW_ADJACENT', 'REDIRECT_UNRELATED',
    'BLOCK_SAFETY', 'CLARIFY_WITH_PARTIAL_ANSWER', 'FOREIGN_DATA', 'PRIVILEGE_ESCALATION',
    'CREDENTIAL_DISCLOSURE', 'HARMFUL_REQUEST', 'ABSTAINED_NO_DATA', 'UPSTREAM_ERROR',
  ];

  it('no composed answer contains a routing decision or a reason code', () => {
    const texts: string[] = [];
    for (const locale of ['ru', 'en', 'zh'] as const) {
      texts.push(composeRedirectAnswer(locale).answer);
      for (const reason of ['FOREIGN_DATA', 'PRIVILEGE_ESCALATION', 'CREDENTIAL_DISCLOSURE', 'HARMFUL_REQUEST'] as const) {
        const safety = composeSafetyAnswer(locale, reason);
        texts.push(`${safety.title}\n${safety.answer}`);
      }
    }
    for (const text of texts) {
      for (const token of INTERNAL_TOKENS) {
        expect(text).not.toContain(token);
      }
    }
  });

  it('the knowledge route no longer serves the refusal copy that caused the report', () => {
    expect(knowledgeRoute).not.toContain('не смог с достаточной уверенностью');
    expect(knowledgeRoute).not.toContain('пробел знаний');
    expect(knowledgeRoute).not.toContain('knowledge gap');
    expect(knowledgeRoute).not.toContain("resolution: 'clarification_required'");
  });

  it('the public interface shows no confidence, reference code, model name or route label', () => {
    expect(assistantUi).not.toContain('originLabel');
    expect(assistantUi).not.toContain('escalationId');
    expect(assistantUi).not.toContain('Код обращения');
    expect(assistantUi).not.toContain('Уверенность');
    expect(assistantUi).not.toContain('safetyFlags.join');
    expect(assistantUi).not.toContain('stream.modelIdentity ?');
  });
});
