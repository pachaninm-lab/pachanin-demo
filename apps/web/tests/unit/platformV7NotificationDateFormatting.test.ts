import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const page = fs.readFileSync(path.join(process.cwd(), 'app/platform-v7/notifications/page.tsx'), 'utf8');

describe('notification dates', () => {
  it('formats event dates through Intl instead of manual string slicing', () => {
    expect(page).toContain("new Intl.DateTimeFormat('ru-RU'");
    expect(page).not.toContain('.substring(');
  });
});
