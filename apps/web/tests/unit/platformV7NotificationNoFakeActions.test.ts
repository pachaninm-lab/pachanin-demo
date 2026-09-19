import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const page = fs.readFileSync(path.join(process.cwd(), 'app/platform-v7/notifications/page.tsx'), 'utf8');

describe('notification actions', () => {
  it('does not expose client-only pin, snooze or archive simulations', () => {
    expect(page).not.toContain('togglePin');
    expect(page).not.toContain('toggleSnooze');
    expect(page).not.toContain('archiveItem');
    expect(page).not.toContain('Pin критичные');
    expect(page).not.toContain('Snooze');
  });
});
