import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const page = fs.readFileSync(path.join(process.cwd(), 'app/platform-v7/notifications/page.tsx'), 'utf8');

describe('notification information density', () => {
  it('does not show decorative metrics before the event list', () => {
    expect(page).not.toContain("<Metric title='Активные'");
    expect(page).not.toContain("<Metric title='Закреплены'");
    expect(page).not.toContain("<Metric title='Отложены'");
  });
});
