import { describe, expect, it } from 'vitest';
import {
  createPlatformV7ExecutionState,
  type PlatformV7ExecutionState,
  type PlatformV7ExecutionStateMode,
} from '@/lib/platform-v7/execution-state-spine';

describe('platform-v7 execution state spine', () => {
  it('creates initial state with simulated_runtime mode by default', () => {
    const state = createPlatformV7ExecutionState('deal-001');

    expect(state.dealId).toBe('deal-001');
    expect(state.mode).toBe('simulated_runtime');
    expect(state.dealStatus).toBe('draft');
    expect(state.money).toBeNull();
    expect(state.trip).toBeNull();
    expect(state.dispute).toBeNull();
    expect(state.documents).toHaveLength(0);
    expect(state.support).toHaveLength(0);
    expect(state.auditEvents).toHaveLength(0);
    expect(state.lastActionResult).toBeNull();
  });

  it('accepts contract_only mode', () => {
    const state = createPlatformV7ExecutionState('deal-002', 'contract_only');

    expect(state.mode).toBe('contract_only');
  });

  it('does not claim external_confirmed mode by default', () => {
    const state = createPlatformV7ExecutionState('deal-003');
    const forbidden: PlatformV7ExecutionStateMode[] = ['external_confirmed', 'pre_integration'];

    expect(forbidden).not.toContain(state.mode);
  });

  it('keeps initial money as null — no double counting risk at start', () => {
    const state = createPlatformV7ExecutionState('deal-004');

    expect(state.money).toBeNull();
  });

  it('keeps state fields immutable-shaped with readonly arrays', () => {
    const state = createPlatformV7ExecutionState('deal-005');

    expect(Array.isArray(state.documents)).toBe(true);
    expect(Array.isArray(state.support)).toBe(true);
    expect(Array.isArray(state.auditEvents)).toBe(true);
  });

  it('has stable shape — all required keys present', () => {
    const state = createPlatformV7ExecutionState('deal-006');
    const requiredKeys: Array<keyof PlatformV7ExecutionState> = [
      'dealId',
      'dealStatus',
      'money',
      'documents',
      'trip',
      'dispute',
      'support',
      'auditEvents',
      'lastActionResult',
      'mode',
    ];

    for (const key of requiredKeys) {
      expect(state, `missing key: ${key}`).toHaveProperty(key);
    }
  });
});
