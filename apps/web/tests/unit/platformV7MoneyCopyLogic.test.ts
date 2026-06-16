import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const checkedFiles = [
  'apps/web/lib/platform-v7/workflow-source-of-truth.ts',
  'apps/web/components/platform-v7/WorkflowActionPanel.tsx',
  'apps/web/components/v7r/BankRuntime.tsx',
  'apps/web/lib/platform-v7/deal-execution-source-of-truth.ts',
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
  it('does not imply that the platform itself releases or guarantees money', () => {
    const leaks = checkedFiles.flatMap((file) => {
      const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8').toLowerCase();
      return forbiddenMoneyClaims
        .filter((claim) => source.includes(claim.toLowerCase()))
        .map((claim) => `${file}: ${claim}`);
    });

    expect(leaks).toEqual([]);
  });
});
