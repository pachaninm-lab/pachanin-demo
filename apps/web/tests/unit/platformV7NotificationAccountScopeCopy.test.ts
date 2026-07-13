import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const page = fs.readFileSync(path.join(process.cwd(), 'app/platform-v7/notifications/page.tsx'), 'utf8');

describe('notification account scope copy', () => {
  it('states that displayed events belong to the current account', () => {
    expect(page).toContain('события, полученные для твоего аккаунта');
    expect(page).toContain('фактические события твоего аккаунта');
  });
});
