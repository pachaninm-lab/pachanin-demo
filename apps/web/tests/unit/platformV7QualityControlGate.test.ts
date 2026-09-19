import { describe, expect, it } from 'vitest';
import type { PlatformV7QualityControlGateInput } from '@/lib/platform-v7/quality-control-gate';
import {
  platformV7QualityControlBlockers,
  platformV7QualityControlGateModel,
  platformV7QualityControlNextAction,
  platformV7QualityControlReviewReasons,
  platformV7QualityControlStableKey,
  platformV7QualityControlStatus,
  platformV7QualityControlTone,
  platformV7QualityMissingRequiredCodes,
  platformV7QualityMoneyImpact,
} from '@/lib/platform-v7/quality-control-gate';

const acceptedQuality: PlatformV7QualityControlGateInput = {
  qualityId: 'QLT-1',
  dealId: 'DL-1',
  shipmentId: 'SHIP-1',
  cropKind: 'wheat',
  protocolStatus: 'linked',
  protocolSignedBy: ['lab-specialist'],
  parameters: [
    { code: 'protein', title: 'Протеин', status: 'within_contract', actualValue: 13.2, contractMin: 12.5, unit: '%' },
    { code: 'moisture', title: 'Влажность', status: 'within_contract', actualValue: 12, contractMax: 14, unit: '%' },
    { code: 'foreign_matter', title: 'Сорная примесь', status: 'within_contract', actualValue: 1.5, contractMax: 2, unit: '%' },
  ],
  requiredParameterCodes: ['protein', 'moisture', 'foreign_matter'],
  discountAccepted: false,
  receiverConfirmed: true,
  activeDispute: false,
  manualHold: false,
};

describe('platform-v7 quality control gate', () => {
  it('allows release when quality protocol and required parameters are accepted', () => {
    const model = platformV7QualityControlGateModel(acceptedQuality);

    expect(model.status).toBe('ready');
    expect(model.tone).toBe('success');
    expect(model.moneyImpact).toBe('release_allowed');
    expect(model.canReleaseMoney).toBe(true);
    expect(model.blockers).toEqual([]);
    expect(model.missingRequiredCodes).toEqual([]);
  });

  it('blocks release when required parameter or signature is missing', () => {
    const model = platformV7QualityControlGateModel({
      ...acceptedQuality,
      protocolSignedBy: [],
      parameters: acceptedQuality.parameters.filter((parameter) => parameter.code !== 'protein'),
    });

    expect(model.status).toBe('blocked');
    expect(model.moneyImpact).toBe('hold');
    expect(model.blockers).toContain('quality-protocol-not-signed');
    expect(model.blockers).toContain('required-parameter-missing:protein');
  });

  it('blocks rejected parameters and active disputes', () => {
    const model = platformV7QualityControlGateModel({
      ...acceptedQuality,
      activeDispute: true,
      parameters: [
        ...acceptedQuality.parameters,
        { code: 'falling_number', title: 'Число падения', status: 'rejected' },
      ],
      requiredParameterCodes: [...acceptedQuality.requiredParameterCodes, 'falling_number'],
    });

    expect(model.status).toBe('blocked');
    expect(model.blockers).toContain('active-dispute');
    expect(model.blockers).toContain('parameter-rejected:falling_number');
  });

  it('routes discounts and tolerances into review with partial release impact', () => {
    const model = platformV7QualityControlGateModel({
      ...acceptedQuality,
      parameters: [
        { code: 'protein', title: 'Протеин', status: 'discount_required', actualValue: 11.9, contractMin: 12.5, unit: '%' },
        { code: 'moisture', title: 'Влажность', status: 'within_tolerance', actualValue: 14.2, contractMax: 14, unit: '%' },
        { code: 'foreign_matter', title: 'Сорная примесь', status: 'within_contract', actualValue: 1.5, contractMax: 2, unit: '%' },
      ],
      discountAccepted: false,
    });

    expect(model.status).toBe('review');
    expect(model.moneyImpact).toBe('partial_release');
    expect(model.canReleaseMoney).toBe(false);
    expect(model.discountParameterCodes).toEqual(['protein']);
    expect(model.reviewReasons).toContain('discount-required:protein');
    expect(model.reviewReasons).toContain('parameter-within-tolerance:moisture');
    expect(model.reviewReasons).toContain('discount-not-accepted');
  });

  it('keeps helper outputs deterministic', () => {
    expect(platformV7QualityMissingRequiredCodes(acceptedQuality.parameters, acceptedQuality.requiredParameterCodes)).toEqual([]);
    expect(platformV7QualityControlBlockers(acceptedQuality, [], [])).toEqual([]);
    expect(platformV7QualityControlReviewReasons(acceptedQuality, [])).toEqual([]);
    expect(platformV7QualityControlStatus([], [])).toBe('ready');
    expect(platformV7QualityMoneyImpact('ready', [])).toBe('release_allowed');
    expect(platformV7QualityControlTone('blocked')).toBe('danger');
    expect(platformV7QualityControlNextAction('ready', [], [])).toBe('Качество подтверждено, блокер качества снят.');
    expect(platformV7QualityControlStableKey(acceptedQuality)).toBe('DL-1:SHIP-1:wheat:foreign_matter|moisture|protein');
  });
});
