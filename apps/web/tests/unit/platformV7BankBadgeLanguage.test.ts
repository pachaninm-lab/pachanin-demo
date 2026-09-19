import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('platform-v7 bank badge language', () => {
  const badge = readFileSync(join(process.cwd(), 'components/v9/bank/SandboxBadge.tsx'), 'utf8');

  it('shows pilot and test contour as user-facing bank states', () => {
    expect(badge).toContain('пилотный режим');
    expect(badge).toContain('тестовый контур');
    expect(badge).toContain('Не промышленная эксплуатация');
    expect(badge).toContain('Банк ·');
  });

  it('keeps the bank badge tied to the platform maturity boundary', () => {
    expect(badge).toContain('Банковый контур');
    expect(badge).toContain('Статус банкового контура');
    expect(badge).toContain('demoMode');
  });
});
