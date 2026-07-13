import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const page = fs.readFileSync(path.join(process.cwd(), 'app/platform-v7/notifications/page.tsx'), 'utf8');
const styles = fs.readFileSync(path.join(process.cwd(), 'app/platform-v7/notifications/notifications.module.css'), 'utf8');

describe('platform-v7 notification inbox', () => {
  it('loads account-scoped notifications from the API and never ships fixture events', () => {
    expect(page).toContain("fetch('/api/proxy/notifications'");
    expect(page).toContain("credentials: 'same-origin'");
    expect(page).toContain("/api/proxy/notifications/read-all");
    expect(page).not.toContain('INITIAL_ITEMS');
    expect(page).not.toContain('DL-9102');
    expect(page).not.toContain('CB-441');
  });

  it('has explicit loading, empty, error and read states', () => {
    expect(page).toContain("kind: 'loading'");
    expect(page).toContain("kind: 'error'");
    expect(page).toContain('Уведомлений пока нет');
    expect(page).toContain('Все уведомления прочитаны');
    expect(page).toContain('Прочитано');
  });

  it('uses mobile-first accessible controls', () => {
    expect(styles).toContain('min-height: 48px');
    expect(styles).toContain('@media (max-width: 640px)');
    expect(styles).toContain('@media (forced-colors: active)');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
