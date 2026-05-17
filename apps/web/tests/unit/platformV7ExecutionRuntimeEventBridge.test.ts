import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_INITIAL_EXECUTION_ACTION_STATE,
  applyPlatformV7ExecutionAction,
  type PlatformV7ExecutionActionState,
} from '@/lib/platform-v7/execution-action-core';
import { buildRuntimeEventFromExecutionAction } from '@/lib/platform-v7/execution-runtime-event-bridge';

const now = () => '2026-04-28T12:00:00.000Z';

function createDraftState(): PlatformV7ExecutionActionState {
  const accepted = applyPlatformV7ExecutionAction(PLATFORM_V7_INITIAL_EXECUTION_ACTION_STATE, {
    actionId: 'acceptOffer',
    actorRole: 'buyer',
    entityId: 'OFFER-2403-A',
  }, now);
  if (accepted.status !== 'success') throw new Error('Expected accepted offer');

  const draft = applyPlatformV7ExecutionAction(accepted.nextStateRef, {
    actionId: 'createDraftDealFromOffer',
    actorRole: 'operator',
    entityId: 'DL-DRAFT-2403',
  }, now);
  if (draft.status !== 'success') throw new Error('Expected draft deal');

  return draft.nextStateRef;
}

describe('platform-v7 execution runtime event bridge', () => {
  it('maps money reserve execution action to a pending bank runtime event', () => {
    const reserve = applyPlatformV7ExecutionAction(createDraftState(), {
      actionId: 'requestMoneyReserve',
      actorRole: 'buyer',
      entityId: 'RESERVE-DL-DRAFT-2403',
    }, now);

    expect(reserve.status).toBe('success');
    if (reserve.status !== 'success') throw new Error('Expected reserve action');

    const bridge = buildRuntimeEventFromExecutionAction(reserve);

    expect(bridge.status).toBe('mapped');
    expect(bridge.runtimeEvent?.status).toBe('created');
    if (!bridge.runtimeEvent || bridge.runtimeEvent.status !== 'created') throw new Error('Expected runtime event');

    expect(bridge.runtimeEvent).toEqual(expect.objectContaining({
      actionId: 'request_bank_reserve_review',
      externalSystem: 'bank',
      externalConfirmationStatus: 'requested',
      resultingState: 'pending_bank_review',
      doesNotConfirmExternally: true,
    }));
    expect(bridge.runtimeEvent.logEntry).toEqual(expect.objectContaining({
      scope: 'bank',
      status: 'started',
      action: 'bank_reserve_review_requested',
      actor: 'buyer',
    }));
    expect(bridge.runtimeEvent.logEntry.message).toContain('Ожидается подтверждение внешней системы: bank.');
    expect(bridge.runtimeEvent.logEntry.message).toContain('Не подтверждает резерв');
  });

  it('maps draft deal creation to an internal runtime success without bank movement', () => {
    const accepted = applyPlatformV7ExecutionAction(PLATFORM_V7_INITIAL_EXECUTION_ACTION_STATE, {
      actionId: 'acceptOffer',
      actorRole: 'buyer',
      entityId: 'OFFER-2403-A',
    }, now);
    if (accepted.status !== 'success') throw new Error('Expected accepted offer');

    const draft = applyPlatformV7ExecutionAction(accepted.nextStateRef, {
      actionId: 'createDraftDealFromOffer',
      actorRole: 'operator',
      entityId: 'DL-DRAFT-2403',
    }, now);

    expect(draft.status).toBe('success');
    if (draft.status !== 'success') throw new Error('Expected draft action');

    const bridge = buildRuntimeEventFromExecutionAction(draft);

    expect(bridge.status).toBe('mapped');
    expect(bridge.runtimeEvent?.status).toBe('created');
    if (!bridge.runtimeEvent || bridge.runtimeEvent.status !== 'created') throw new Error('Expected runtime event');

    expect(bridge.runtimeEvent.externalSystem).toBe('none');
    expect(bridge.runtimeEvent.externalConfirmationStatus).toBe('not_required');
    expect(bridge.runtimeEvent.logEntry.status).toBe('success');
    expect(bridge.runtimeEvent.logEntry.action).toBe('draft_deal_created');
    expect(bridge.runtimeEvent.logEntry.message).toContain('Не запускает оплату, банк, ЭДО или внешнее подтверждение.');
  });

  it('maps attached internal document without treating it as EDO or external confirmation', () => {
    const document = applyPlatformV7ExecutionAction(createDraftState(), {
      actionId: 'attachDocument',
      actorRole: 'operator',
      entityId: 'DOC-2403-1',
    }, now);

    expect(document.status).toBe('success');
    if (document.status !== 'success') throw new Error('Expected document action');

    const bridge = buildRuntimeEventFromExecutionAction(document);

    expect(bridge.status).toBe('mapped');
    expect(bridge.runtimeEvent?.status).toBe('created');
    if (!bridge.runtimeEvent || bridge.runtimeEvent.status !== 'created') throw new Error('Expected runtime event');

    expect(bridge.runtimeEvent.externalSystem).toBe('none');
    expect(bridge.runtimeEvent.externalConfirmationStatus).toBe('not_required');
    expect(bridge.runtimeEvent.logEntry.status).toBe('success');
    expect(bridge.runtimeEvent.logEntry.message).toContain('Не является ЭДО, УКЭП или внешним подтверждением.');
  });

  it('keeps unmapped execution actions as internal UI events only', () => {
    const accepted = applyPlatformV7ExecutionAction(PLATFORM_V7_INITIAL_EXECUTION_ACTION_STATE, {
      actionId: 'acceptOffer',
      actorRole: 'buyer',
      entityId: 'OFFER-2403-A',
    }, now);

    expect(accepted.status).toBe('success');
    if (accepted.status !== 'success') throw new Error('Expected accepted offer');

    const bridge = buildRuntimeEventFromExecutionAction(accepted);

    expect(bridge).toEqual(expect.objectContaining({
      status: 'not_mapped',
      executionActionId: 'acceptOffer',
      runtimeEvent: null,
    }));
    expect(bridge.note).toContain('остаётся только внутренним UI-событием');
  });

  it('maps driver field event only to internal evidence and not to bank or FGIS', () => {
    const state: PlatformV7ExecutionActionState = {
      ...createDraftState(),
      moneyReserveIntentId: 'RESERVE-DL-DRAFT-2403',
      logisticsOrderId: 'LOG-2403',
    };

    const field = applyPlatformV7ExecutionAction(state, {
      actionId: 'recordFieldEvent',
      actorRole: 'driver',
      entityId: 'TRIP-2403-EVIDENCE-1',
    }, now);

    expect(field.status).toBe('success');
    if (field.status !== 'success') throw new Error('Expected field action');

    const bridge = buildRuntimeEventFromExecutionAction(field);

    expect(bridge.status).toBe('mapped');
    expect(bridge.runtimeEvent?.status).toBe('created');
    if (!bridge.runtimeEvent || bridge.runtimeEvent.status !== 'created') throw new Error('Expected runtime event');

    expect(bridge.runtimeEvent.actorRole).toBe('driver');
    expect(bridge.runtimeEvent.externalSystem).toBe('none');
    expect(bridge.runtimeEvent.externalConfirmationStatus).toBe('not_required');
    expect(bridge.runtimeEvent.logEntry.scope).toBe('logistics');
    expect(bridge.runtimeEvent.logEntry.action).toBe('field_evidence_recorded');
    expect(bridge.runtimeEvent.logEntry.message).toContain('Создаёт внутреннее доказательство.');
  });

  it('does not generate unsafe maturity or payment release wording through the bridge', () => {
    const reserve = applyPlatformV7ExecutionAction(createDraftState(), {
      actionId: 'requestMoneyReserve',
      actorRole: 'operator',
      entityId: 'RESERVE-DL-DRAFT-2403',
    }, now);
    if (reserve.status !== 'success') throw new Error('Expected reserve action');

    const bridge = buildRuntimeEventFromExecutionAction(reserve);
    if (bridge.status !== 'mapped' || !bridge.runtimeEvent || bridge.runtimeEvent.status !== 'created') {
      throw new Error('Expected mapped runtime event');
    }

    const message = bridge.runtimeEvent.logEntry.message;

    expect(message).not.toContain('production-ready');
    expect(message).not.toContain('fully live');
    expect(message).not.toContain('fully integrated');
    expect(message).not.toContain('гарантирует оплату');
    expect(message).not.toContain('К выпуску');
    expect(message).not.toContain('Выпущено');
    expect(message).not.toContain('платформа выпускает деньги');
  });
});
