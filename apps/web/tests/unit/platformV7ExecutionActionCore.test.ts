import { describe, expect, it } from 'vitest';
import {
  executionActionCoreEntries,
  isReleaseFundsUsedAsControlledPilot,
  disputeActionsConflict,
  LEGACY_ACTION_REGISTRY,
} from '@/lib/platform-v7/execution-action-core';
import { allExecutionActionSpecs } from '@/lib/platform-v7/execution-state-machine';

describe('execution action core — registry hardening', () => {
  it('every E4/E5 action spec has a non-empty label (message)', () => {
    const specs = allExecutionActionSpecs();
    for (const spec of specs) {
      expect(spec.label.length).toBeGreaterThan(0);
    }
  });

  it('every E4/E5 action spec has allowedRoles (non-empty)', () => {
    const specs = allExecutionActionSpecs();
    for (const spec of specs) {
      expect(spec.allowedRoles.length).toBeGreaterThan(0);
    }
  });

  it('every E4/E5 action spec has a scope', () => {
    const specs = allExecutionActionSpecs();
    for (const spec of specs) {
      expect(spec.scope.length).toBeGreaterThan(0);
    }
  });

  it('no E4/E5 action spec has mode = live', () => {
    const specs = allExecutionActionSpecs();
    for (const spec of specs) {
      expect(spec.mode).not.toBe('live');
    }
  });

  it('every E4/E5 action spec has fromStates (non-empty)', () => {
    const specs = allExecutionActionSpecs();
    for (const spec of specs) {
      expect(spec.fromStates.length).toBeGreaterThan(0);
    }
  });

  it('releaseFunds is NOT used as a controlled-pilot fake-release', () => {
    expect(isReleaseFundsUsedAsControlledPilot()).toBe(false);
  });

  it('releaseFunds is marked legacy in the action core registry', () => {
    const entry = LEGACY_ACTION_REGISTRY.find((e) => e.actionId === 'releaseFunds');
    expect(entry).toBeDefined();
    expect(entry!.mode).toBe('legacy');
  });

  it('openDispute and resolveDispute do not conflict between old and new layers', () => {
    expect(disputeActionsConflict()).toBe(false);
  });

  it('executionActionCoreEntries returns combined legacy + SM entries', () => {
    const entries = executionActionCoreEntries();
    expect(entries.length).toBeGreaterThan(20);
  });

  it('no entry in combined registry has isLive = true', () => {
    const entries = executionActionCoreEntries();
    for (const entry of entries) {
      expect(entry.isLive).toBe(false);
    }
  });

  it('SM resolveDispute and legacy resolveDispute are distinct entries', () => {
    const entries = executionActionCoreEntries();
    const smResolve = entries.find((e) => e.actionId === 'resolveDispute' && e.mode !== 'legacy');
    const legacyResolve = entries.find((e) => e.actionId === 'resolveDispute' && e.mode === 'legacy');
    expect(smResolve).toBeDefined();
    expect(legacyResolve).toBeDefined();
    expect(smResolve!.mode).not.toBe('legacy');
    expect(legacyResolve!.mode).toBe('legacy');
  });

  it('every legacy action has at least one target id', () => {
    for (const entry of LEGACY_ACTION_REGISTRY) {
      expect(entry.targetIds.length).toBeGreaterThan(0);
    }
  });

  it('legacy action count is 8 (E03 layer unchanged)', () => {
    expect(LEGACY_ACTION_REGISTRY).toHaveLength(8);
  });
});
