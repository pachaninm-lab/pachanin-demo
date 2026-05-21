import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_ACTION_MESSAGES,
  platformV7ActionMessageIds,
  platformV7ActionMessages,
} from '@/lib/platform-v7/action-messages';

describe('platform-v7 action messages', () => {
  it('keeps bank-basis action messages honest', () => {
    expect(platformV7ActionMessages('releaseFunds')).toEqual({
      loading: 'Передаём основание на банковскую проверку.',
      success: 'Основание передано на банковскую проверку.',
      error: 'Не удалось передать основание на банковскую проверку.',
    });
  });

  it('covers core E03 and E4 actions', () => {
    expect(platformV7ActionMessageIds()).toEqual([
      'startDocs',
      'completeDocs',
      'requestRelease',
      'releaseFunds',
      'openDispute',
      'resolveDispute',
      'manualReview',
      'retryWebhook',
      'submitSellerOffer',
      'acceptOffer',
      'rejectOffer',
      'sendCounterOffer',
      'createDraftDealFromOffer',
      'requestMoneyReserve',
      'assignLogistics',
      'attachDocument',
      'recordFieldEvent',
      'redeemSdiz',
      'refuseSdizRedemption',
      'sendSdizManualReview',
    ]);
  });

  it('keeps every action with loading success and error copy', () => {
    Object.values(PLATFORM_V7_ACTION_MESSAGES).forEach((messages) => {
      expect(messages.loading.length).toBeGreaterThan(0);
      expect(messages.success.length).toBeGreaterThan(0);
      expect(messages.error.length).toBeGreaterThan(0);
    });
  });
});
