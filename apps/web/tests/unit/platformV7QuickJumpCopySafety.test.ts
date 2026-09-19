import { describe, expect, it } from 'vitest';
import { platformV7QuickJumpItems } from '@/lib/platform-v7/shellQuickJump';

const forbiddenClaims = [
  'production ready',
  'fully live',
  'live integration completed',
  'guaranteed payment',
  'no risk',
  'all integrations completed',
];

describe('platform-v7 quick jump copy safety', () => {
  it('keeps quick jump labels free of forbidden maturity claims', () => {
    for (const item of platformV7QuickJumpItems()) {
      const copy = item.label.toLowerCase();

      for (const claim of forbiddenClaims) {
        expect(copy).not.toContain(claim);
      }
    }
  });
});
