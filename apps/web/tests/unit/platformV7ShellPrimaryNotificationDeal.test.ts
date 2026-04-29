import { describe, expect, it } from 'vitest';
import { platformV7PrimaryShellNotification } from '@/lib/platform-v7/shellNotifications';

describe('platform-v7 primary shell notification deal traceability', () => {
  it('keeps deal-scoped primary notifications traceable to a deal id', () => {
    const primary = platformV7PrimaryShellNotification();

    expect(primary).toBeDefined();
    if (!primary || primary.kind === 'system') return;

    expect(primary.dealId).toMatch(/^DL-\d+$/);
  });
});
