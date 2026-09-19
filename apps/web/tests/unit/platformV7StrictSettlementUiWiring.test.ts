import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const uiFiles = [
  'apps/web/app/platform-v7/readiness/page.tsx',
  'apps/web/app/platform-v7/data-room/page.tsx',
] as const;

describe('platform-v7 strict settlement UI wiring', () => {
  for (const file of uiFiles) {
    it(`${file} uses strict money gate instead of the legacy soft gate`, () => {
      const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8');

      expect(source).toContain('@/lib/platform-v7/deal-money-release-gate');
      expect(source).toContain('canRequestStrictMoneyRelease');
      expect(source).toContain('strictMoneyReleaseBlockers');
      expect(source).not.toContain('canRequestMoneyRelease');
      expect(source).not.toContain('executionBlockers');
    });
  }

  it('keeps the public execution cards tied to DL-9106 naming', () => {
    const readiness = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/platform-v7/readiness/page.tsx'), 'utf8');
    const dataRoom = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/platform-v7/data-room/page.tsx'), 'utf8');

    expect(readiness).toContain('DL9106ReadinessCard');
    expect(dataRoom).toContain('DL9106ExecutionConsistencyCard');
    expect(readiness).not.toContain('DL9102ReadinessCard');
    expect(dataRoom).not.toContain('DL9102ExecutionConsistencyCard');
  });
});
