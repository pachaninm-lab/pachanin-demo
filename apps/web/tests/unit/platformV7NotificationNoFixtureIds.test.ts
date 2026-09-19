import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const page = fs.readFileSync(path.join(process.cwd(), 'app/platform-v7/notifications/page.tsx'), 'utf8');

describe('notification fixture ids', () => {
  it('contains no hard-coded deal, bank or logistics identifiers', () => {
    expect(page).not.toMatch(/DL-\d+/);
    expect(page).not.toMatch(/CB-\d+/);
    expect(page).not.toContain('ТМБ-');
  });
});
