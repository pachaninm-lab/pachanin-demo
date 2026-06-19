import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const checkedFiles = [
  'lib/platform-v7/workflow-source-of-truth.ts',
  'components/platform-v7/WorkflowActionPanel.tsx',
  'components/v7r/BankRuntime.tsx',
  'lib/platform-v7/deal-execution-source-of-truth.ts',
] as const;

const forbiddenMoneyClaims = [
  'выпуск денег',
  'выпускает деньги',
  'гарантирует оплату',
  'гарантированная оплата платформой',
  'platform releases money',
  'payment guaranteed by platform',
] as const;

describe('platform-v7 money copy logic', () => {
  // Honest controlled-pilot copy must be able to say what the platform does
  // NOT do ("не выпускает деньги без подписания"), so a claim only counts as a
  // leak when it is stated affirmatively (not directly negated by "не ").
  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  it('does not imply that the platform itself releases or guarantees money', () => {
    const leaks = checkedFiles.flatMap((file) => {
      const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8').toLowerCase();
      return forbiddenMoneyClaims
        .filter((claim) => new RegExp(`(?<!не\\s)${escapeRegExp(claim.toLowerCase())}`).test(source))
        .map((claim) => `${file}: ${claim}`);
    });

    expect(leaks).toEqual([]);
  });
});
