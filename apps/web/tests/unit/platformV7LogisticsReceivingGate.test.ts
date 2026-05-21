import { describe, expect, it } from 'vitest';
import type { PlatformV7ReceivingGateInput } from '@/lib/platform-v7/logistics-receiving-gate';
import {
  platformV7ReceivingGateBlockers,
  platformV7ReceivingGateModel,
  platformV7ReceivingGateNextAction,
  platformV7ReceivingGateReviewReasons,
  platformV7ReceivingGateStatus,
  platformV7ReceivingGateTone,
  platformV7ReceivingMoneyImpact,
} from '@/lib/platform-v7/logistics-receiving-gate';

const acceptedReceiving: PlatformV7ReceivingGateInput = {
  receivingId: 'RCV-1',
  shipmentId: 'SHIP-1',
  dealId: 'DL-1',
  arrivalConfirmed: true,
  unloadingStarted: true,
  unloadingFinished: true,
  receiverConfirmed: true,
  weightStatus: 'matched',
  qualityStatus: 'passed',
  receivingDocumentStatus: 'registered',
  labProtocolLinked: true,
  activeDispute: false,
  manualHold: false,
};

describe('platform-v7 logistics receiving gate', () => {
  it('allows release only when receiving is fully confirmed', () => {
    const model = platformV7ReceivingGateModel(acceptedReceiving);

    expect(model.status).toBe('ready');
    expect(model.tone).toBe('success');
    expect(model.moneyImpact).toBe('release_allowed');
    expect(model.canFinalizeReceiving).toBe(true);
    expect(model.canReleaseMoney).toBe(true);
    expect(model.blockers).toEqual([]);
  });

  it('blocks receiving when arrival, receiver or lab proof is missing', () => {
    const model = platformV7ReceivingGateModel({
      ...acceptedReceiving,
      arrivalConfirmed: false,
      receiverConfirmed: false,
      labProtocolLinked: false,
    });

    expect(model.status).toBe('blocked');
    expect(model.moneyImpact).toBe('hold');
    expect(model.blockers).toContain('arrival-not-confirmed');
    expect(model.blockers).toContain('receiver-not-confirmed');
    expect(model.blockers).toContain('lab-protocol-not-linked');
  });

  it('routes weight shortage and quality discount into review', () => {
    const model = platformV7ReceivingGateModel({
      ...acceptedReceiving,
      weightStatus: 'shortage',
      qualityStatus: 'discount_required',
    });

    expect(model.status).toBe('review');
    expect(model.moneyImpact).toBe('partial_release');
    expect(model.canReleaseMoney).toBe(false);
    expect(model.reviewReasons).toContain('weight-shortage');
    expect(model.reviewReasons).toContain('quality-discount-required');
  });

  it('blocks rejected quality and active disputes', () => {
    const model = platformV7ReceivingGateModel({
      ...acceptedReceiving,
      qualityStatus: 'rejected',
      activeDispute: true,
    });

    expect(model.status).toBe('blocked');
    expect(model.blockers).toContain('quality-rejected');
    expect(model.blockers).toContain('active-dispute');
  });

  it('keeps helper outputs deterministic', () => {
    expect(platformV7ReceivingGateBlockers(acceptedReceiving)).toEqual([]);
    expect(platformV7ReceivingGateReviewReasons(acceptedReceiving)).toEqual([]);
    expect(platformV7ReceivingGateStatus([], [])).toBe('ready');
    expect(platformV7ReceivingMoneyImpact('ready', acceptedReceiving)).toBe('release_allowed');
    expect(platformV7ReceivingGateTone('blocked')).toBe('danger');
    expect(platformV7ReceivingGateNextAction('ready', [], [])).toBe('Приёмка подтверждена, можно продолжать выпуск денег.');
  });
});
