import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { answerPublicPlatformQuestion } from '@/lib/platform-v7/public-assistant-knowledge';
import { answerProspectQuestion } from '@/lib/platform-v7/prospect-assistant-knowledge';
import { understandAssistantQuestion } from '@/lib/platform-v7/assistant-question-understanding';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');
const resilience = read('apps/web/lib/platform-v7/install-public-assistant-fetch-resilience.ts');
const shell = read('apps/web/components/platform-v7/ContextualSupportOrAssistant.tsx');

describe('public assistant production transport resilience', () => {
  it('answers the exact production regression question locally', () => {
    const question = understandAssistantQuestion('Как работает платформа?').corrected;
    const answer = answerProspectQuestion(question, 'ru') ?? answerPublicPlatformQuestion(question, 'ru');
    expect(answer.answer.trim().length).toBeGreaterThan(40);
    expect(answer.sources.length).toBeGreaterThan(0);
    expect(answer.actionAllowed).toBe(false);
  });

  it('installs fallback before the public launcher renders', () => {
    expect(shell).toContain('installPublicAssistantFetchResilience();');
    expect(shell.indexOf('installPublicAssistantFetchResilience();')).toBeLessThan(shell.indexOf('<PublicPlatformAssistant />'));
  });

  it('falls back on both network rejection and non-2xx response', () => {
    expect(resilience).toContain('if (response.ok) return response;');
    expect(resilience).toContain('return localResponse(input, init);');
    expect(resilience).toContain("url.pathname === '/api/public-platform-assistant'");
  });

  it('keeps the fallback public, local and read-only', () => {
    expect(resilience).toContain("dataMode: 'public_knowledge'");
    expect(resilience).toContain("mode: 'read_only'");
    expect(resilience).toContain('answerPublicPlatformQuestion');
    expect(resilience).toContain('answerProspectQuestion');
    expect(resilience).not.toContain('/api/proxy/ai-assistant');
    expect(resilience).not.toContain('localStorage');
  });
});
