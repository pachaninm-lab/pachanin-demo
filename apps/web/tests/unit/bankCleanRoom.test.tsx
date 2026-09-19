import { describe, expect, it, vi } from 'vitest';

// Phase 2 / PR-3 — /platform-v7/bank/clean is now a legacy "clean room" alias that
// redirects to the canonical bank cabinet /platform-v7/bank. It no longer renders a
// second bank cockpit, so this suite verifies the redirect contract instead.
const redirect = vi.fn();
vi.mock('next/navigation', () => ({
  redirect: (href: string) => redirect(href),
}));

import BankCleanAliasRedirect from '@/app/platform-v7/bank/clean/page';
import { PLATFORM_V7_BANK_ROUTE } from '@/lib/platform-v7/routes';

describe('platform-v7 bank clean alias', () => {
  it('redirects the legacy clean-room route to the canonical bank cabinet', () => {
    BankCleanAliasRedirect();
    expect(redirect).toHaveBeenCalledWith(PLATFORM_V7_BANK_ROUTE);
    expect(PLATFORM_V7_BANK_ROUTE).toBe('/platform-v7/bank');
  });

  it('is a thin alias, not a second bank cockpit', () => {
    expect(BankCleanAliasRedirect.length).toBe(0);
  });
});
