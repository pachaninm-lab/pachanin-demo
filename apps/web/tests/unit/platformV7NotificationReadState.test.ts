import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const page = fs.readFileSync(path.join(process.cwd(), 'app/platform-v7/notifications/page.tsx'), 'utf8');

describe('notification read state', () => {
  it('shows read state in text and not only through color', () => {
    expect(page).toContain('<span className={styles.readStatus}><Check');
    expect(page).toContain('Прочитано</span>');
  });
});
