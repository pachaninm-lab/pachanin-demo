import { describe, expect, it } from 'vitest';
import { platformV7PrimaryShellNotification } from '@/lib/platform-v7/shellNotifications';

const forbiddenClaims = [
  'production ready',
  'fully live',
  'live integration completed',
  'guaranteed payment',
  'no risk',
  'all integrations completed',
];

describe('platform-v7 primary shell notification claims', () => {
  it('keeps the selected primary notification free of forbidden maturity claims', () => {
    const primary = platformV7PrimaryShellNotification();

    expect(primary).toBeDefined();
    if (!primary) return;

    const normalized = `${primary.title} ${primary.description}`.toLowerCase();
    for (const claim of forbiddenClaims) {
      expect(normalized.includes(claim)).toBe(false);
    }
  });
});
