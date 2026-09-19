import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const page = fs.readFileSync(path.join(process.cwd(), 'app/platform-v7/notifications/page.tsx'), 'utf8');

describe('notification copy', () => {
  it('uses direct user-facing language without technical inbox jargon', () => {
    expect(page).toContain('Уведомления');
    expect(page).toContain('Только непрочитанные');
    expect(page).toContain('Открыть сделку');
    expect(page).not.toContain('Inbox-центр');
  });
});
