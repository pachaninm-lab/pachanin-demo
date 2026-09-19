import { describe, expect, it } from 'vitest';
import {
  applyPlatformV7RuntimeAction,
  createPlatformV7ExecutionState,
  type PlatformV7ExecutionState,
  type PlatformV7RuntimeActionCommand,
} from '@/lib/platform-v7/execution-state-spine';

function stateWithDealStatus(status: PlatformV7ExecutionState['dealStatus']): PlatformV7ExecutionState {
  return { ...createPlatformV7ExecutionState(`deal-${status}`), dealStatus: status };
}

function openDisputeCommand(overrides: Partial<PlatformV7RuntimeActionCommand> = {}): PlatformV7RuntimeActionCommand {
  return {
    actionId: 'dispute.open',
    actorRole: 'buyer',
    entityType: 'dispute',
    entityId: 'dispute-001',
    idempotencyKey: 'idem-dispute-001',
    payload: { reason: 'quality' },
    ...overrides,
  };
}

describe('platform-v7 dispute opening runtime', () => {
  it('opens a dispute from an execution status without faking any money hold', () => {
    const state = stateWithDealStatus('awaiting_documents');
    const [nextState, result] = applyPlatformV7RuntimeAction(
      state,
      openDisputeCommand(),
      () => '2026-05-10T23:30:00.000Z',
    );

    expect(result.ok).toBe(true);
    expect(result.stateChanged).toBe(true);
    expect(result.disputeImpact).toBe('opened');
    expect(result.moneyImpact).toBe('none');
    expect(result.nextAction).toBe('Собрать доказательства и передать спор на разбор.');

    expect(nextState.dealStatus).toBe('dispute');
    expect(nextState.dispute).toEqual({ status: 'open', reason: 'quality' });
    expect(nextState.money).toBeNull();
    expect(nextState.documents).toHaveLength(0);
    expect(nextState.trip).toBeNull();

    expect(nextState.auditEvents).toHaveLength(1);
    expect(nextState.auditEvents[0]).toMatchObject({
      actorRole: 'buyer',
      actionId: 'dispute.open',
      entityType: 'dispute',
      entityId: 'dispute-001',
      result: 'accepted',
      idempotencyKey: 'idem-dispute-001',
      source: 'simulated_runtime',
    });
  });

  it('keeps dispute opening idempotent and does not duplicate audit events', () => {
    const state = stateWithDealStatus('awaiting_logistics');
    const [nextState] = applyPlatformV7RuntimeAction(
      state,
      openDisputeCommand({ entityId: 'dispute-002', idempotencyKey: 'idem-dispute-002' }),
      () => '2026-05-10T23:31:00.000Z',
    );

    const [afterDuplicate, duplicateResult] = applyPlatformV7RuntimeAction(
      nextState,
      openDisputeCommand({ entityId: 'dispute-002', idempotencyKey: 'idem-dispute-002' }),
      () => '2026-05-10T23:32:00.000Z',
    );

    expect(duplicateResult.ok).toBe(true);
    expect(duplicateResult.stateChanged).toBe(false);
    expect(duplicateResult.disputeImpact).toBe('none');
    expect(afterDuplicate).toBe(nextState);
    expect(afterDuplicate.auditEvents).toHaveLength(1);
    expect(afterDuplicate.dealStatus).toBe('dispute');
  });

  it('blocks dispute opening from draft before a deal enters execution', () => {
    const state = createPlatformV7ExecutionState('deal-draft');
    const [nextState, result] = applyPlatformV7RuntimeAction(
      state,
      openDisputeCommand({ entityId: 'dispute-003', idempotencyKey: 'idem-dispute-003' }),
      () => '2026-05-10T23:33:00.000Z',
    );

    expect(result.ok).toBe(false);
    expect(result.stateChanged).toBe(false);
    expect(result.disputeImpact).toBe('none');
    expect(result.moneyImpact).toBe('none');
    expect(result.blockedReason).toBe('Нельзя открыть спор из статуса draft.');
    expect(nextState).toBe(state);
    expect(nextState.auditEvents).toHaveLength(0);
    expect(nextState.dispute).toBeNull();
  });

  it('blocks a second dispute once the deal already has an open dispute', () => {
    const state = stateWithDealStatus('awaiting_acceptance');
    const [nextState] = applyPlatformV7RuntimeAction(
      state,
      openDisputeCommand({ entityId: 'dispute-004', idempotencyKey: 'idem-dispute-004' }),
      () => '2026-05-10T23:34:00.000Z',
    );

    const [afterBlocked, blockedResult] = applyPlatformV7RuntimeAction(
      nextState,
      openDisputeCommand({ entityId: 'dispute-004b', idempotencyKey: 'idem-dispute-004b' }),
      () => '2026-05-10T23:35:00.000Z',
    );

    expect(blockedResult.ok).toBe(false);
    expect(blockedResult.stateChanged).toBe(false);
    expect(blockedResult.blockedReason).toBe('Спор по сделке уже открыт.');
    expect(afterBlocked).toBe(nextState);
    expect(afterBlocked.auditEvents).toHaveLength(1);
  });

  it('keeps driver out of dispute opening at the permission boundary', () => {
    const state = stateWithDealStatus('awaiting_documents');
    const [nextState, result] = applyPlatformV7RuntimeAction(
      state,
      openDisputeCommand({ actorRole: 'driver', entityId: 'dispute-005', idempotencyKey: 'idem-dispute-005' }),
      () => '2026-05-10T23:36:00.000Z',
    );

    expect(result.ok).toBe(false);
    expect(result.stateChanged).toBe(false);
    expect(nextState.dealStatus).toBe('awaiting_documents');
    expect(nextState.dispute).toBeNull();
    expect(nextState.auditEvents).toHaveLength(0);
  });
});
