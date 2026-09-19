import { describe, expect, it } from 'vitest';
import {
  platformV7BeforeAfterHash,
  platformV7CanonicalJson,
  platformV7ContentHash,
} from '@/lib/platform-v7/audit-content-hash';

describe('SOC2-003 audit content hash', () => {
  it('is deterministic and key-order independent', () => {
    const a = { dealId: 'D1', amount: 100, status: 'held' };
    const b = { status: 'held', amount: 100, dealId: 'D1' };
    expect(platformV7CanonicalJson(a)).toBe(platformV7CanonicalJson(b));
    expect(platformV7ContentHash(a)).toBe(platformV7ContentHash(b));
  });

  it('changes when content changes', () => {
    const before = { status: 'held', amount: 100 };
    const after = { status: 'released', amount: 100 };
    const result = platformV7BeforeAfterHash(before, after);
    expect(result.changed).toBe(true);
    expect(result.beforeHash).not.toBe(result.afterHash);
  });

  it('reports no change for equal snapshots', () => {
    const snap = { status: 'held', amount: 100, nested: { a: 1, b: 2 } };
    const result = platformV7BeforeAfterHash(snap, { ...snap, nested: { b: 2, a: 1 } });
    expect(result.changed).toBe(false);
  });

  it('produces an 8-char hex fingerprint and ignores undefined fields', () => {
    const h = platformV7ContentHash({ a: 1, b: undefined });
    expect(h).toMatch(/^[0-9a-f]{8}$/);
    expect(platformV7ContentHash({ a: 1 })).toBe(h);
  });
});
