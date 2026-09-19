import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const page = fs.readFileSync(path.join(process.cwd(), 'app/platform-v7/notifications/page.tsx'), 'utf8');

describe('notification states', () => {
  it('fails visibly instead of silently fabricating content', () => {
    expect(page).toContain('Уведомления недоступны');
    expect(page).toContain('Повторить');
    expect(page).toContain('Сервер вернул уведомления в неизвестном формате');
  });
});
