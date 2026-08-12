import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('RestrictedPublicQwen prompt-prefix locality', () => {
  it('keeps request-varying system rules behind the large shared prefix', () => {
    const source = readFileSync(
      join(__dirname, 'restricted-public-qwen.service.ts'),
      'utf8',
    );
    const fnStart = source.indexOf('function publicSystemPrompt(');
    const fnEnd = source.indexOf('\nfunction generalAgroResponseBudgetRule(', fnStart);
    expect(fnStart).toBeGreaterThanOrEqual(0);
    expect(fnEnd).toBeGreaterThan(fnStart);

    const block = source.slice(fnStart, fnEnd);
    const templateStart = block.indexOf('return `');
    expect(templateStart).toBeGreaterThanOrEqual(0);
    const template = block.slice(templateStart);
    const sharedTail = 'Start with the direct answer and avoid generic filler.';
    const sharedTailIndex = template.indexOf(sharedTail);
    expect(sharedTailIndex).toBeGreaterThan(1_000);

    for (const varyingFragment of [
      '${authorityRule}',
      '${currentRule}',
      '${responseBudgetRule}',
      '${language}',
    ]) {
      expect(template.indexOf(varyingFragment)).toBeGreaterThan(sharedTailIndex);
    }

    expect(template.indexOf('${coverageRule}')).toBeGreaterThanOrEqual(0);
    expect(template.indexOf('${coverageRule}')).toBeLessThan(sharedTailIndex);
  });
});
