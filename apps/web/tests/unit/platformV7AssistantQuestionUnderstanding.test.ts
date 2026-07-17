import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { understandAssistantQuestion } from '../../lib/platform-v7/assistant-question-understanding';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

const route = read('apps/web/app/api/public-platform-assistant/route.ts');
const helper = read('apps/web/lib/platform-v7/assistant-question-understanding.ts');

describe('platform-v7 assistant universal question understanding', () => {
  it('corrects common Russian mistakes without changing authority scope', () => {
    const result = understandAssistantQuestion('Как палучить денги после преемки?');
    expect(result.corrected).toContain('получить');
    expect(result.corrected).toContain('деньги');
    expect(result.corrected).toContain('приёмка');
    expect(result.detectedLocale).toBe('ru');
  });

  it('understands common transliterated platform terms', () => {
    const result = understandAssistantQuestion('gde oplata po sdelka');
    expect(result.corrected).toContain('оплата');
    expect(result.corrected).toContain('сделка');
  });

  it('uses bounded deterministic fuzzy matching rather than arbitrary generation', () => {
    expect(helper).toContain('function distance(');
    expect(helper).toContain('DOMAIN_DICTIONARY');
    expect(helper).toContain('COMMON_CORRECTIONS');
    expect(helper).toContain('SYNONYMS');
    expect(helper).not.toContain('fetch(');
    expect(helper).not.toContain('openai');
    expect(helper).not.toContain('gigachat');
  });

  it('returns a safe clarification and registers only a question hash when no answer is grounded', () => {
    expect(route).toContain("resolution: 'clarification_required'");
    expect(route).toContain("event: 'PUBLIC_ASSISTANT_UNANSWERED'");
    expect(route).toContain('questionHash: hashQuestion(message)');
    expect(route).toContain('messageLength: message.length');
    expect(route).not.toContain('questionText: message');
    expect(route).toContain('escalationId');
    expect(route).toContain('не придумывает ответ');
  });

  it('preserves public read-only and no-account-data boundaries', () => {
    expect(route).toContain("dataMode: 'public_knowledge'");
    expect(route).toContain("mode: 'read_only'");
    expect(route).toContain('actionAllowed: false');
    expect(route).not.toContain('/api/proxy/ai-assistant');
  });
});
