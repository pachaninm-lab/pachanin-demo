import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_INITIAL_EXECUTION_ACTION_STATE,
  applyPlatformV7ExecutionAction,
  guardPlatformV7ExecutionAction,
  previewPlatformV7ExecutionAction,
  rollbackPlatformV7ExecutionAction,
  type PlatformV7ExecutionActionState,
} from '@/lib/platform-v7/execution-action-core';

const now = () => '2026-04-28T12:00:00.000Z';

const readySdizState: PlatformV7ExecutionActionState = {
  ...PLATFORM_V7_INITIAL_EXECUTION_ACTION_STATE,
  dealId: 'DL-9106',
  draftDealId: 'DL-9106',
  sdizIssuedStatus: 'issued_manual_check',
  sdizSignedStatus: 'signed_manual_check',
  sdizTransferredStatus: 'transferred_manual_check',
};

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
    expect(rollbackPlatformV7ExecutionAction(accepted)).toEqual(PLATFORM_V7_INITIAL_EXECUTION_ACTION_STATE);
  });

  it('blocks unsafe action order before prerequisites', () => {
    expect(applyPlatformV7ExecutionAction(PLATFORM_V7_INITIAL_EXECUTION_ACTION_STATE, {
      actionId: 'createDraftDealFromOffer',
      actorRole: 'operator',
      entityId: 'DL-DRAFT-2403',
    }, now)).toEqual(expect.objectContaining({
      status: 'blocked',
      disabledReason: 'Черновик сделки можно создать только после принятия ставки.',
    }));

    expect(applyPlatformV7ExecutionAction(PLATFORM_V7_INITIAL_EXECUTION_ACTION_STATE, {
      actionId: 'requestMoneyReserve',
      actorRole: 'buyer',
      entityId: 'RESERVE-DL-DRAFT-2403',
    }, now)).toEqual(expect.objectContaining({
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

  it('keeps bank reserve as an internal request without claiming bank confirmation', () => {
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
    expect(reserve.nextStateRef.moneyReserveIntentId).toBe('RESERVE-DL-DRAFT-2403');
    expect(reserve.receipt.externalContour).toBe('контур исполнения без заявления о внешней интеграции');
    expect(reserve.auditCopy).not.toContain('платформа выпускает деньги');
  });

  it('previews and applies buyer SDIZ redemption as manual external check', () => {
    const request = {
      actionId: 'redeemSdiz',
      actorRole: 'buyer',
      actorId: 'buyer-user-1',
      entityId: 'SDIZ-DL-9106',
      mode: 'manual',
    } as const;

    const preview = previewPlatformV7ExecutionAction(readySdizState, request);
    expect(preview).toEqual(expect.objectContaining({
      actionLabelRu: 'Погасить СДИЗ',
      targetType: 'document',
      targetId: 'SDIZ-DL-9106',
      statusAfter: 'СДИЗ погашен покупателем · ожидает внешнее подтверждение ФГИС',
    }));
    expect(preview?.moneyImpact).toContain('Деньги не готовы к выплате');

    const result = applyPlatformV7ExecutionAction(readySdizState, request, now);

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
    const result = applyPlatformV7ExecutionAction(readySdizState, {
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
