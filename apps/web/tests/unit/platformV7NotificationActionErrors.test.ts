import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const page = fs.readFileSync(path.join(process.cwd(), 'app/platform-v7/notifications/page.tsx'), 'utf8');

describe('notification action failures', () => {
  it('keeps the inbox visible and explains failed read updates', () => {
    expect(page).toContain('setActionError');
    expect(page).toContain('Уведомление осталось непрочитанным');
    expect(page).toContain('Не удалось отметить все уведомления');
    expect(page).toContain("role='alert'");
  });
});
