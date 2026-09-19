import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const styles = fs.readFileSync(path.join(process.cwd(), 'app/platform-v7/notifications/notifications.module.css'), 'utf8');

describe('notification mobile actions', () => {
  it('makes primary actions full width on narrow screens', () => {
    expect(styles).toContain('.primaryLink,');
    expect(styles).toContain('.readButton');
    expect(styles).toContain('width: 100%');
  });
});
