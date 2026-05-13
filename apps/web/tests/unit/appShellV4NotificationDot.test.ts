import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../../components/v7r/AppShellV4.tsx', import.meta.url), 'utf8');

function bellButtonSource() {
  const bellIndex = source.indexOf('<Bell');
  expect(bellIndex).toBeGreaterThan(-1);
  const buttonStart = source.lastIndexOf('<button', bellIndex);
  const buttonEnd = source.indexOf('</button>', bellIndex);
  expect(buttonStart).toBeGreaterThan(-1);
  expect(buttonEnd).toBeGreaterThan(buttonStart);
  return source.slice(buttonStart, buttonEnd + '</button>'.length);
}

describe('AppShellV4 notification indicator', () => {
  it('does not render a decorative unread dot unconditionally near Bell', () => {
    const snippet = bellButtonSource();
    const hasDot = /borderRadius:\s*999|rounded-full|pc-v4-dot|notification-dot|alert-dot/.test(snippet);
    const hasUnreadCondition = /hasUnread|unread|unreadCount|newNotifications/.test(snippet);

    expect(hasDot && !hasUnreadCondition).toBe(false);
  });
});
