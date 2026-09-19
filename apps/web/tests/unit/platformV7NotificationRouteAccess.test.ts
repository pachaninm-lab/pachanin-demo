import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const policy = fs.readFileSync(path.join(process.cwd(), 'lib/platform-v7/cabinet-access-policy.ts'), 'utf8');

describe('notification route access', () => {
  it('treats the authenticated notification inbox as a shared cabinet route', () => {
    expect(policy).toContain("'/platform-v7/notifications'");
  });
});
