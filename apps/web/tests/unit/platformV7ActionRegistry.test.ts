import { describe, expect, it } from 'vitest';
import { PLATFORM_V7_ACTION_MESSAGES, platformV7ActionMessages, type PlatformV7ActionMessageId } from '@/lib/platform-v7/action-messages';
import { PLATFORM_V7_ACTION_TARGETS } from '@/lib/platform-v7/action-targets';
import { PLATFORM_V7_EXECUTION_ACTION_SPECS, platformV7ExecutionActionSpec } from '@/lib/platform-v7/execution-action-core';

const E4_EXECUTION_ACTION_IDS = Object.keys(PLATFORM_V7_EXECUTION_ACTION_SPECS).sort() as PlatformV7ActionMessageId[];
const LEGACY_ACTION_IDS = (Object.keys(PLATFORM_V7_ACTION_MESSAGES) as PlatformV7ActionMessageId[])
  .filter((actionId) => !E4_EXECUTION_ACTION_IDS.includes(actionId))
  .sort();

const EXPECTED_LEGACY_ACTION_IDS = [
  'completeDocs',
  'manualReview',
  'releaseFunds',
  'requestRelease',
  'resolveDispute',
  'retryWebhook',
  'startDocs',
] as const satisfies readonly PlatformV7ActionMessageId[];

const E4_TARGETS = PLATFORM_V7_ACTION_TARGETS.filter((target) => target.id.startsWith('e4-'));

describe('platform-v7 action registry contracts', () => {
  it('keeps every action target backed by a message registry entry', () => {
    for (const target of PLATFORM_V7_ACTION_TARGETS) {
      expect(platformV7ActionMessages(target.actionId), `${target.id} must have action messages`).toEqual(expect.objectContaining({
        loading: expect.any(String),
        success: expect.any(String),
        error: expect.any(String),
      }));
    }
  });

  it('derives the E4 action contract from the execution spec registry', () => {
    expect(E4_EXECUTION_ACTION_IDS).toEqual(Object.keys(PLATFORM_V7_EXECUTION_ACTION_SPECS).sort());
    expect(E4_EXECUTION_ACTION_IDS.length).toBeGreaterThan(0);
  });

  it('keeps every E4 execution action backed by target, message and execution spec', () => {
    for (const actionId of E4_EXECUTION_ACTION_IDS) {
      const matchingTargets = E4_TARGETS.filter((target) => target.actionId === actionId);
      const spec = platformV7ExecutionActionSpec(actionId);

      expect(PLATFORM_V7_ACTION_MESSAGES[actionId], `${actionId} must have user-facing messages`).toBeDefined();
      expect(matchingTargets.length, `${actionId} must have at least one e4-* target`).toBeGreaterThan(0);
      expect(spec, `${actionId} must have an execution spec`).toEqual(expect.objectContaining({ actionId }));
    }
  });

  it('keeps every E4 target backed by a matching execution spec', () => {
    for (const target of E4_TARGETS) {
      const spec = platformV7ExecutionActionSpec(target.actionId);

      expect(spec, `${target.id} must resolve to execution spec`).toBeTruthy();
      expect(spec?.actionId).toBe(target.actionId);
      expect(spec?.scope).toBe(target.scope);
    }
  });

  it('keeps execution specs complete and never marks this controlled-pilot slice as live', () => {
    for (const [actionId, spec] of Object.entries(PLATFORM_V7_EXECUTION_ACTION_SPECS)) {
      expect(spec.actionId).toBe(actionId);
      expect(spec.allowedRoles.length, `${actionId} must have allowed roles`).toBeGreaterThan(0);
      expect(spec.scope, `${actionId} must have a scope`).toBeTruthy();
      expect(spec.entityType, `${actionId} must have an entity type`).toBeTruthy();
      expect(spec.successStateLabel.trim(), `${actionId} must have success copy`).toBeTruthy();
      expect(spec.rollbackLabel.trim(), `${actionId} must have rollback copy`).toBeTruthy();
      expect(spec.mode, `${actionId} must not claim live integration`).not.toBe('live');
    }
  });

  it('keeps legacy actions explicit instead of silently mixing them into the E4 execution slice', () => {
    expect(LEGACY_ACTION_IDS).toEqual([...EXPECTED_LEGACY_ACTION_IDS].sort());

    for (const actionId of LEGACY_ACTION_IDS) {
      expect(PLATFORM_V7_ACTION_MESSAGES[actionId], `${actionId} must remain in message registry`).toBeDefined();
      expect(platformV7ExecutionActionSpec(actionId), `${actionId} must not be implicitly treated as E4 execution action`).toBeNull();
    }
  });

  it('does not use releaseFunds as a fake controlled-pilot money release action', () => {
    expect(E4_EXECUTION_ACTION_IDS).not.toContain('releaseFunds');
    expect(E4_TARGETS.some((target) => target.actionId === 'releaseFunds')).toBe(false);
    expect(platformV7ExecutionActionSpec('releaseFunds')).toBeNull();
  });

  it('keeps openDispute in E4 but resolveDispute legacy until dispute room is explicitly wired', () => {
    expect(platformV7ExecutionActionSpec('openDispute')).toEqual(expect.objectContaining({
      actionId: 'openDispute',
      mode: 'controlled-pilot',
      scope: 'dispute',
    }));

    expect(platformV7ExecutionActionSpec('resolveDispute')).toBeNull();
    expect(E4_TARGETS.some((target) => target.actionId === 'resolveDispute')).toBe(false);
  });
});
