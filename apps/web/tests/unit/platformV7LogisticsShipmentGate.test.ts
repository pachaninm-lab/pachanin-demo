import { describe, expect, it } from 'vitest';
import type { PlatformV7ShipmentGateInput } from '@/lib/platform-v7/logistics-shipment-gate';
import {
  platformV7ShipmentGateBlockers,
  platformV7ShipmentGateModel,
  platformV7ShipmentGateNextAction,
  platformV7ShipmentGateReviewReasons,
  platformV7ShipmentGateStatus,
  platformV7ShipmentGateTone,
  platformV7ShipmentMoneyImpact,
} from '@/lib/platform-v7/logistics-shipment-gate';

const acceptedShipment: PlatformV7ShipmentGateInput = {
  shipmentId: 'SHIP-1',
  dealId: 'DL-1',
  transportStatus: 'accepted',
  transportDocumentStatus: 'registered',
  trackingStatus: 'active',
  weightStatus: 'matched',
  qualityStatus: 'passed',
  receiverConfirmed: true,
  activeDispute: false,
  manualHold: false,
};

describe('platform-v7 logistics shipment gate', () => {
  it('allows money release only for accepted and confirmed shipment', () => {
    const model = platformV7ShipmentGateModel(acceptedShipment);

    expect(model.status).toBe('ready');
    expect(model.tone).toBe('success');
    expect(model.moneyImpact).toBe('release_allowed');
    expect(model.canReleaseMoney).toBe(true);
    expect(model.blockers).toEqual([]);
  });

  it('blocks release when route deviation or active dispute exists', () => {
    const model = platformV7ShipmentGateModel({
      ...acceptedShipment,
      trackingStatus: 'route_deviation',
      activeDispute: true,
    });

    expect(model.status).toBe('blocked');
    expect(model.moneyImpact).toBe('hold');
    expect(model.canReleaseMoney).toBe(false);
    expect(model.blockers).toContain('active-dispute');
    expect(model.blockers).toContain('route-deviation');
  });

  it('puts in-transit shipment into review with partial release impact', () => {
    const model = platformV7ShipmentGateModel({
      ...acceptedShipment,
      transportStatus: 'in_transit',
      receiverConfirmed: false,
    });

    expect(model.status).toBe('review');
    expect(model.moneyImpact).toBe('partial_release');
    expect(model.reviewReasons).toContain('transport:in_transit');
    expect(model.reviewReasons).toContain('shipment-not-accepted');
  });

  it('uses partial release for quality discount or weight tolerance', () => {
    const model = platformV7ShipmentGateModel({
      ...acceptedShipment,
      qualityStatus: 'discount_required',
      weightStatus: 'tolerance_exceeded',
    });

    expect(model.status).toBe('review');
    expect(model.moneyImpact).toBe('partial_release');
    expect(model.canReleaseMoney).toBe(false);
  });

  it('keeps helper outputs deterministic', () => {
    expect(platformV7ShipmentGateBlockers(acceptedShipment)).toEqual([]);
    expect(platformV7ShipmentGateReviewReasons(acceptedShipment)).toEqual([]);
    expect(platformV7ShipmentGateStatus([], [])).toBe('ready');
    expect(platformV7ShipmentMoneyImpact('ready', acceptedShipment)).toBe('release_allowed');
    expect(platformV7ShipmentGateTone('blocked')).toBe('danger');
    expect(platformV7ShipmentGateNextAction('ready', [], [])).toBe('Рейс подтверждён, транспортный блокер снят.');
  });
});
