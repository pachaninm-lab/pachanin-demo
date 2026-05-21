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
    expect(first.runtimeEventBridgeStatus).toBe('not_mapped');
    expect(first.runtimeEvent).toBeNull();

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

  it('returns runtime event for bank reserve without confirming bank or moving money', () => {
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

    expect(reserve.status).toBe('success');
    if (reserve.status !== 'success') throw new Error('Expected reserve intent');

    expect(reserve.runtimeEventBridgeStatus).toBe('mapped');
    expect(reserve.runtimeEvent?.status).toBe('created');
    if (!reserve.runtimeEvent || reserve.runtimeEvent.status !== 'created') throw new Error('Expected runtime event');

    expect(reserve.runtimeEvent).toEqual(expect.objectContaining({
      actionId: 'request_bank_reserve_review',
      externalSystem: 'bank',
      externalConfirmationStatus: 'requested',
      resultingState: 'pending_bank_review',
      doesNotConfirmExternally: true,
    }));
    expect(reserve.runtimeEvent.logEntry).toEqual(expect.objectContaining({
      scope: 'bank',
      status: 'started',
      action: 'bank_reserve_review_requested',
      actor: 'buyer',
    }));
    expect(reserve.runtimeEvent.logEntry.message).toContain('Не подтверждает резерв');
    expect(reserve.runtimeEvent.logEntry.message).toContain('Ожидается подтверждение внешней системы: bank.');
    expect(reserve.runtimeEvent.logEntry.message).not.toContain('Выпущено');
    expect(reserve.runtimeEvent.logEntry.message).not.toContain('К выпуску');
    expect(reserve.runtimeEvent.logEntry.message).not.toContain('платформа выпускает деньги');
  });

  it('returns runtime event for internal document without treating it as EDO or UKEP', () => {
    const state: PlatformV7ExecutionActionState = {
      ...PLATFORM_V7_INITIAL_EXECUTION_ACTION_STATE,
      acceptedOfferId: 'OFFER-2403-A',
      draftDealId: 'DL-DRAFT-2403',
      dealId: 'DL-DRAFT-2403',
    };

    const document = applyPlatformV7ExecutionAction(state, {
      actionId: 'attachDocument',
      actorRole: 'operator',
      entityId: 'DOC-2403-1',
    }, now);

    expect(document.status).toBe('success');
    if (document.status !== 'success') throw new Error('Expected document action');

    expect(document.runtimeEventBridgeStatus).toBe('mapped');
    expect(document.runtimeEvent?.status).toBe('created');
    if (!document.runtimeEvent || document.runtimeEvent.status !== 'created') throw new Error('Expected runtime event');

    expect(document.runtimeEvent.externalSystem).toBe('none');
    expect(document.runtimeEvent.externalConfirmationStatus).toBe('not_required');
    expect(document.runtimeEvent.logEntry.status).toBe('success');
    expect(document.runtimeEvent.logEntry.action).toBe('internal_document_attached');
    expect(document.runtimeEvent.logEntry.message).toContain('Не является ЭДО, УКЭП или внешним подтверждением.');
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

  it('previews and applies buyer SDIZ redemption as manual external check', () => {
    const sdizReadyState: PlatformV7ExecutionActionState = {
      ...PLATFORM_V7_INITIAL_EXECUTION_ACTION_STATE,
      dealId: 'DL-9106',
      draftDealId: 'DL-9106',
      sdizIssuedStatus: 'issued_manual_check',
      sdizSignedStatus: 'signed_manual_check',
      sdizTransferredStatus: 'transferred_manual_check',
    };

    const request = {
      actionId: 'redeemSdiz',
      actorRole: 'buyer',
      actorId: 'buyer-user-1',
      entityId: 'SDIZ-DL-9106',
      mode: 'manual',
    } as const;

    const preview = previewPlatformV7ExecutionAction(sdizReadyState, request);
    expect(preview).toEqual(expect.objectContaining({
      actionLabelRu: 'Погасить СДИЗ',
      targetType: 'document',
      targetId: 'SDIZ-DL-9106',
      statusAfter: 'СДИЗ погашен покупателем · ожидает внешнее подтверждение ФГИС',
    }));
    expect(preview?.moneyImpact).toContain('Деньги не готовы к выплате');

    const result = applyPlatformV7ExecutionAction(sdizReadyState, request, now);

    expect(result.status).toBe('success');
    if (result.status !== 'success') throw new Error('Expected SDIZ redemption success');
    expect(result.nextStateRef.sdizRedeemedStatus).toBe('redeemed_awaiting_fgis_confirmation');
    expect(result.nextStateRef.sdizManualReviewStatus).toBe('requested');
    expect(result.nextStateRef.documentIds).toContain('SDIZ-DL-9106:sdiz-redeemed-manual-check');
    expect(result.nextStateRef.roleNotificationIds).toContain('bank:DL-9106:sdiz-redeemed-check');
    expect(result.receipt).toEqual(expect.objectContaining({
      actorId: 'buyer-user-1',
      externalContour: 'ручная проверка / ожидает внешнее подтверждение',
      waitingFor: 'Банк проверяет документный пакет и ждёт подтверждение ФГИС/ручную отметку оператора.',
    }));
    expect(result.auditCopy).toContain('Погасить СДИЗ');
  });

  it('blocks SDIZ redemption before the seller signs and transfers SDIZ', () => {
    const dealState: PlatformV7ExecutionActionState = {
      ...PLATFORM_V7_INITIAL_EXECUTION_ACTION_STATE,
      dealId: 'DL-9106',
      draftDealId: 'DL-9106',
      sdizIssuedStatus: 'issued_manual_check',
    };

    const result = applyPlatformV7ExecutionAction(dealState, {
      actionId: 'redeemSdiz',
      actorRole: 'buyer',
      entityId: 'SDIZ-DL-9106',
      mode: 'manual',
    }, now);

    expect(result).toEqual(expect.objectContaining({
      status: 'blocked',
      disabledReason: 'СДИЗ ещё не подписан продавцом.',
    }));
  });

  it('records SDIZ refusal and routes the next task to support and compliance', () => {
    const sdizReadyState: PlatformV7ExecutionActionState = {
      ...PLATFORM_V7_INITIAL_EXECUTION_ACTION_STATE,
      dealId: 'DL-9106',
      draftDealId: 'DL-9106',
      sdizIssuedStatus: 'issued_manual_check',
      sdizSignedStatus: 'signed_manual_check',
      sdizTransferredStatus: 'transferred_manual_check',
    };

    const result = applyPlatformV7ExecutionAction(sdizReadyState, {
      actionId: 'refuseSdizRedemption',
      actorRole: 'buyer',
      entityId: 'SDIZ-DL-9106',
      mode: 'manual',
    }, now);

    expect(result.status).toBe('success');
    if (result.status !== 'success') throw new Error('Expected SDIZ refusal success');
    expect(result.nextStateRef.sdizRedeemedStatus).toBe('refused_manual_check');
    expect(result.nextStateRef.sdizRefusalStatus).toBe('refusal_recorded_manual_check');
    expect(result.nextStateRef.roleNotificationIds).toEqual(expect.arrayContaining([
      'support:DL-9106:sdiz-refusal',
      'compliance:DL-9106:sdiz-refusal',
    ]));
    expect(result.receipt.nextRoleTask).toContain('Поддержка снимает блокер');
  });
});
