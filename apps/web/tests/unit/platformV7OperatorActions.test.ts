import { describe, expect, it } from 'vitest';
import { buildGatePassResult } from '@/lib/platform-v7/operator-actions';

describe('platform-v7 operator actions', () => {
  it('builds gate pass result with two log entries', () => {
    const result = buildGatePassResult({ dealId: 'DL-9102', amount: 1000, at: '2026-04-23T10:00:00Z' });

    expect(result.gateState).toBe('PASS');
    expect(result.nextOwner).toBe('Банк');
    expect(result.log).toHaveLength(2);
    expect(result.log[0]?.action).toBe('gate-pass');
    expect(result.log[1]?.action).toBe('bank-check');
  });

  it('marks bank check as started when amount is positive', () => {
    const result = buildGatePassResult({ dealId: 'DL-9102', amount: 1000 });
    expect(result.log[1]?.status).toBe('started');
  });

  it('marks bank check as success when amount is zero', () => {
    const result = buildGatePassResult({ dealId: 'DL-9102', amount: 0 });
    expect(result.log[1]?.status).toBe('success');
  });
});
