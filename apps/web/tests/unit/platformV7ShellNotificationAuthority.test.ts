import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const cwd = process.cwd();
const root = [cwd, path.resolve(cwd, '../..')]
  .find((candidate) => fs.existsSync(path.join(candidate, 'design-governance-v8.json')));

if (!root) throw new Error(`Cannot resolve repository root from ${cwd}`);

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const shell = read('apps/web/components/v7r/AppShellV4.tsx');
const page = read('apps/web/app/platform-v7/notifications/page.tsx');

describe('platform-v7 shell notification authority', () => {
  it('routes the header bell to the existing authenticated notification workspace', () => {
    expect(shell).toContain("const NOTIFICATIONS_ROUTE = '/platform-v7/notifications'");
    expect(shell).toContain('href={NOTIFICATIONS_ROUTE}');
    expect(shell).toContain("aria-label='Открыть уведомления'");
    expect(page).toContain("fetch('/api/proxy/notifications'");
    expect(page).toContain("cache: 'no-store'");
    expect(page).toContain("credentials: 'same-origin'");
  });

  it('does not invent notification rows or unread state inside the global shell', () => {
    expect(shell).not.toContain("from '@/lib/v7r/data'");
    expect(shell).not.toContain('NOTIFICATION_GROUPS');
    expect(shell).not.toContain('NOTIFICATIONS.length');
    expect(shell).not.toContain('groupNotifications');
    expect(shell).not.toContain('groupedNotifications');
    expect(shell).not.toContain('hasUnread');
    expect(shell).not.toContain('unreadDot');
    expect(shell).not.toContain('alertsOpen');
    expect(shell).not.toContain('alertsSeen');
  });

  it('does not derive FGIS bank or dispute health from the current URL', () => {
    expect(shell).not.toContain('function systemStatus');
    expect(shell).not.toContain("pathname.startsWith('/platform-v7/connectors')");
    expect(shell).not.toContain("pathname.startsWith('/platform-v7/bank')");
    expect(shell).not.toContain("pathname.startsWith('/platform-v7/disputes')");
    expect(shell).not.toContain('без критического стопа');
    expect(shell).not.toContain('ожидает подтверждение');
  });

  it('keeps server response validation and honest empty and error states on the notification page', () => {
    expect(page).toContain('function validNotification');
    expect(page).toContain('function parseItems');
    expect(page).toContain('Сервер вернул уведомления в неизвестном формате');
    expect(page).toContain('Уведомления недоступны');
    expect(page).toContain('Уведомлений пока нет');
    expect(page).toContain('только фактические события твоего аккаунта и доступных сделок');
  });
});
