import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_INITIAL_EXECUTION_ACTION_STATE,
  PLATFORM_V7_EXECUTION_ACTION_SPECS,
  applyPlatformV7ExecutionAction,
  type PlatformV7ExecutionActionRequest,
  type PlatformV7ExecutionActionState,
} from '@/lib/platform-v7/execution-action-core';

const now = () => '2026-05-21T10:00:00.000Z';

describe('role-notifications', () => {
  it('creates a next-role notification for every successful execution action', () => {
    const successfulRequests: Array<{ state: PlatformV7ExecutionActionState; request: PlatformV7ExecutionActionRequest }> = [
      {
        state: PLATFORM_V7_INITIAL_EXECUTION_ACTION_STATE,
        request: { actionId: 'submitSellerOffer', actorRole: 'seller', entityId: 'OFFER-SELLER-2403' },
      },
      {
        state: PLATFORM_V7_INITIAL_EXECUTION_ACTION_STATE,
        request: { actionId: 'acceptOffer', actorRole: 'buyer', entityId: 'OFFER-2403-A' },
      },
      {
        state: PLATFORM_V7_INITIAL_EXECUTION_ACTION_STATE,
        request: { actionId: 'rejectOffer', actorRole: 'buyer', entityId: 'OFFER-2403-A' },
      },
      {
        state: PLATFORM_V7_INITIAL_EXECUTION_ACTION_STATE,
        request: { actionId: 'sendCounterOffer', actorRole: 'buyer', entityId: 'OFFER-2403-A' },
      },
      {
        state: { ...PLATFORM_V7_INITIAL_EXECUTION_ACTION_STATE, acceptedOfferId: 'OFFER-2403-A' },
        request: { actionId: 'createDraftDealFromOffer', actorRole: 'operator', entityId: 'DL-9106' },
      },
      {
        state: { ...PLATFORM_V7_INITIAL_EXECUTION_ACTION_STATE, acceptedOfferId: 'OFFER-2403-A', dealId: 'DL-9106', draftDealId: 'DL-9106' },
        request: { actionId: 'requestMoneyReserve', actorRole: 'buyer', entityId: 'RESERVE-DL-9106' },
      },
      {
        state: { ...PLATFORM_V7_INITIAL_EXECUTION_ACTION_STATE, dealId: 'DL-9106', draftDealId: 'DL-9106', moneyReserveIntentId: 'RESERVE-DL-9106' },
        request: { actionId: 'assignLogistics', actorRole: 'logistics', entityId: 'LOG-REQ-2403', mode: 'manual' },
      },
      {
        state: { ...PLATFORM_V7_INITIAL_EXECUTION_ACTION_STATE, dealId: 'DL-9106', draftDealId: 'DL-9106' },
        request: { actionId: 'attachDocument', actorRole: 'operator', entityId: 'DOC-DL-9106-UPD', mode: 'manual' },
      },
      {
        state: { ...PLATFORM_V7_INITIAL_EXECUTION_ACTION_STATE, dealId: 'DL-9106', draftDealId: 'DL-9106', logisticsOrderId: 'LOG-REQ-2403' },
        request: { actionId: 'recordFieldEvent', actorRole: 'driver', entityId: 'FIELD-DL-9106-ARRIVAL', mode: 'manual' },
      },
      {
        state: { ...PLATFORM_V7_INITIAL_EXECUTION_ACTION_STATE, dealId: 'DL-9106', draftDealId: 'DL-9106' },
        request: { actionId: 'openDispute', actorRole: 'buyer', entityId: 'DSP-DL-9106' },
      },
      {
        state: sdizReadyState(),
        request: { actionId: 'redeemSdiz', actorRole: 'buyer', entityId: 'SDIZ-DL-9106', mode: 'manual' },
      },
      {
        state: sdizReadyState(),
        request: { actionId: 'refuseSdizRedemption', actorRole: 'buyer', entityId: 'SDIZ-DL-9106', mode: 'manual' },
      },
      {
        state: { ...PLATFORM_V7_INITIAL_EXECUTION_ACTION_STATE, dealId: 'DL-9106', draftDealId: 'DL-9106' },
        request: { actionId: 'sendSdizManualReview', actorRole: 'buyer', entityId: 'SDIZ-DL-9106', mode: 'manual' },
      },
    ];

    expect(successfulRequests.map(({ request }) => request.actionId).sort()).toEqual(Object.keys(PLATFORM_V7_EXECUTION_ACTION_SPECS).sort());

    for (const { state, request } of successfulRequests) {
      const result = applyPlatformV7ExecutionAction(state, request, now);

      expect(result.status, `${request.actionId} should succeed`).toBe('success');
      if (result.status !== 'success') continue;
      expect(result.roleNotifications.length, `${request.actionId} should create next role task`).toBeGreaterThan(0);
      expect(result.nextStateRef.roleNotificationIds).toEqual(expect.arrayContaining(result.roleNotifications.map((item) => item.notificationId)));

      for (const notification of result.roleNotifications) {
        expect(notification.linkedDealId).toBeTruthy();
        expect(notification.text).toBeTruthy();
        expect(notification.actionLink).toMatch(/^\/platform-v7/);
        expect(notification.createdByActionId).toBe(request.actionId);
        expect(notification.readStatus).toBe('unread');
      }
    }
  });

  it('routes SDIZ refusal to support and compliance', () => {
    const result = applyPlatformV7ExecutionAction(sdizReadyState(), {
      actionId: 'refuseSdizRedemption',
      actorRole: 'buyer',
      entityId: 'SDIZ-DL-9106',
      mode: 'manual',
    }, now);

    expect(result.status).toBe('success');
    if (result.status !== 'success') throw new Error('Expected success');
    expect(result.roleNotifications.map((item) => item.targetRole).sort()).toEqual(['compliance', 'support']);
    expect(result.roleNotifications.every((item) => item.priority === 'critical' || item.priority === 'high')).toBe(true);
  });
});

function sdizReadyState(): PlatformV7ExecutionActionState {
  return {
    ...PLATFORM_V7_INITIAL_EXECUTION_ACTION_STATE,
    dealId: 'DL-9106',
    draftDealId: 'DL-9106',
    sdizIssuedStatus: 'issued_manual_check',
    sdizSignedStatus: 'signed_manual_check',
    sdizTransferredStatus: 'transferred_manual_check',
  };
}
