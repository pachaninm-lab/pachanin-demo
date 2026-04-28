import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_INITIAL_EXECUTION_ACTION_STATE,
  applyPlatformV7ExecutionAction,
  guardPlatformV7ExecutionAction,
  rollbackPlatformV7ExecutionAction,
  type PlatformV7ExecutionActionState,
} from '@/lib/platform-v7/execution-action-core';

const now = () => '2026-04-28T12:00:00.000Z';

describe('platform-v7 execution action core', () => {
  it('blocks action when the role is not allowed', () => {
    const result = guardPlatformV7ExecutionAction(PLATFORM_V7_INITIAL_EXECUTION_ACTION_STATE, {
      actionId: 'submitSellerOffer',
      actorRole: 'buyer',
      entityId: 'OFFER-SELLER-2403',
    });

    expect(result).toEqual(expect.objectContaining({
      status: 'blocked',
      disabledReason: 'У роли нет права выполнить это действие.',
    }));
  });

  it('applies seller offer and blocks duplicate submit', () => {
    const first = applyPlatformV7ExecutionAction(PLATFORM_V7_INITIAL_EXECUTION_ACTION_STATE, {
      actionId: 'submitSellerOffer',
      actorRole: 'seller',
      entityId: 'OFFER-SELLER-2403',
    }, now);

    expect(first.status).toBe('success');
    if (first.status !== 'success') throw new Error('Expected success');
    expect(first.nextStateRef.submittedOfferIds).toContain('OFFER-SELLER-2403');
    expect(first.logEntry).toEqual(expect.objectContaining({
      action: 'submitSellerOffer',
      scope: 'lot',
      status: 'success',
    }));

    const duplicate = applyPlatformV7ExecutionAction(first.nextStateRef, {
      actionId: 'submitSellerOffer',
      actorRole: 'seller',
      entityId: 'OFFER-SELLER-2403',
    }, now);

    expect(duplicate).toEqual(expect.objectContaining({
      status: 'blocked',
      disabledReason: 'Ставка уже отправлена. Повторная отправка заблокирована.',
    }));
  });

  it('rolls back accepted offer to previous state', () => {
    const accepted = applyPlatformV7ExecutionAction(PLATFORM_V7_INITIAL_EXECUTION_ACTION_STATE, {
      actionId: 'acceptOffer',
      actorRole: 'buyer',
      entityId: 'OFFER-2403-A',
    }, now);

    expect(accepted.status).toBe('success');
    if (accepted.status !== 'success') throw new Error('Expected success');
    expect(accepted.nextStateRef.acceptedOfferId).toBe('OFFER-2403-A');

    const rolledBack = rollbackPlatformV7ExecutionAction(accepted);
    expect(rolledBack).toEqual(PLATFORM_V7_INITIAL_EXECUTION_ACTION_STATE);
  });

  it('blocks draft deal creation until an offer is accepted', () => {
    const result = applyPlatformV7ExecutionAction(PLATFORM_V7_INITIAL_EXECUTION_ACTION_STATE, {
      actionId: 'createDraftDealFromOffer',
      actorRole: 'operator',
      entityId: 'DL-DRAFT-2403',
    }, now);

    expect(result).toEqual(expect.objectContaining({
      status: 'blocked',
      disabledReason: 'Черновик сделки можно создать только после принятия ставки.',
    }));
  });

  it('blocks money reserve until draft deal exists and never releases money', () => {
    const result = applyPlatformV7ExecutionAction(PLATFORM_V7_INITIAL_EXECUTION_ACTION_STATE, {
      actionId: 'requestMoneyReserve',
      actorRole: 'buyer',
      entityId: 'RESERVE-DL-DRAFT-2403',
    }, now);

    expect(result).toEqual(expect.objectContaining({
      status: 'blocked',
      disabledReason: 'Резерв денег доступен только после создания черновика сделки.',
    }));
  });

  it('runs the bridge flow and blocks duplicate dispute', () => {
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

    const reserve = applyPlatformV7ExecutionAction(draft.nextStateRef, {
      actionId: 'requestMoneyReserve',
      actorRole: 'buyer',
      entityId: 'RESERVE-DL-DRAFT-2403',
    }, now);
    if (reserve.status !== 'success') throw new Error('Expected reserve intent');

    const logistics = applyPlatformV7ExecutionAction(reserve.nextStateRef, {
      actionId: 'assignLogistics',
      actorRole: 'operator',
      entityId: 'LOG-TMB-2403',
    }, now);
    if (logistics.status !== 'success') throw new Error('Expected logistics');

    const field = applyPlatformV7ExecutionAction(logistics.nextStateRef, {
      actionId: 'recordFieldEvent',
      actorRole: 'operator',
      entityId: 'FIELD-EVENT-2403-1',
    }, now);
    expect(field.status).toBe('success');

    const dispute = applyPlatformV7ExecutionAction((field.status === 'success' ? field.nextStateRef : logistics.nextStateRef), {
      actionId: 'openDispute',
      actorRole: 'operator',
      entityId: 'DISPUTE-DL-DRAFT-2403',
    }, now);
    expect(dispute.status).toBe('success');

    const duplicate = applyPlatformV7ExecutionAction((dispute.status === 'success' ? dispute.nextStateRef : draft.nextStateRef), {
      actionId: 'openDispute',
      actorRole: 'operator',
      entityId: 'DISPUTE-DL-DRAFT-2403',
    }, now);

    expect(duplicate).toEqual(expect.objectContaining({
      status: 'blocked',
      disabledReason: 'По этой сделке уже открыт спор.',
    }));
  });

  it('blocks field event without assigned logistics', () => {
    const state: PlatformV7ExecutionActionState = {
      ...PLATFORM_V7_INITIAL_EXECUTION_ACTION_STATE,
      acceptedOfferId: 'OFFER-2403-A',
      draftDealId: 'DL-DRAFT-2403',
      dealId: 'DL-DRAFT-2403',
    };

    const result = applyPlatformV7ExecutionAction(state, {
      actionId: 'recordFieldEvent',
      actorRole: 'operator',
      entityId: 'FIELD-EVENT-2403-1',
    }, now);

    expect(result).toEqual(expect.objectContaining({
      status: 'blocked',
      disabledReason: 'Полевое событие требует назначенной логистики.',
    }));
  });
});
