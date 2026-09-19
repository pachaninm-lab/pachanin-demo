import type { GrainQualityProfile, MoneyAmount, QualityDelta, QualityDeltaItem } from '../types';
import { money } from '../format';

function item(params: {
  readonly metric: string;
  readonly agreedValue?: number | string;
  readonly actualValue?: number | string;
  readonly tolerance?: number | string;
  readonly deviationText: string;
  readonly moneyImpact: number;
  readonly requiresDispute?: boolean;
}): QualityDeltaItem {
  return {
    metric: params.metric,
    agreedValue: params.agreedValue,
    actualValue: params.actualValue,
    tolerance: params.tolerance,
    deviationText: params.deviationText,
    moneyImpact: money(params.moneyImpact),
    requiresDispute: params.requiresDispute ?? params.moneyImpact > 0,
  };
}

function positive(value: number): number {
  return Math.max(0, Math.round(value));
}

export function calculateQualityDelta(params: {
  readonly id: string;
  readonly dealId: string;
  readonly batchId: string;
  readonly agreedQualityProfile: GrainQualityProfile;
  readonly acceptedQualityProfile?: GrainQualityProfile;
  readonly pricePerTon: MoneyAmount;
  readonly volumeTons: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}): QualityDelta {
  if (!params.acceptedQualityProfile) {
    return {
      id: params.id,
      dealId: params.dealId,
      batchId: params.batchId,
      agreedQualityProfileId: params.agreedQualityProfile.id,
      items: [],
      totalDiscount: money(0),
      totalHoldAmount: money(0),
      status: 'not_measured',
      createdAt: params.createdAt,
      updatedAt: params.updatedAt,
    };
  }

  const agreed = params.agreedQualityProfile;
  const actual = params.acceptedQualityProfile;
  const base = params.pricePerTon.value * params.volumeTons;
  const items: QualityDeltaItem[] = [];

  if (agreed.moisture !== undefined && actual.moisture !== undefined && actual.moisture > agreed.moisture + 0.5) {
    const diff = actual.moisture - agreed.moisture;
    items.push(item({ metric: 'Влажность', agreedValue: `${agreed.moisture}%`, actualValue: `${actual.moisture}%`, tolerance: '+0,5%', deviationText: `+${diff.toFixed(1)}%`, moneyImpact: positive(base * diff * 0.004) }));
  }

  if (agreed.gluten !== undefined && actual.gluten !== undefined && actual.gluten < agreed.gluten - 1) {
    const diff = agreed.gluten - actual.gluten;
    items.push(item({ metric: 'Клейковина', agreedValue: `${agreed.gluten}%`, actualValue: `${actual.gluten}%`, tolerance: '-1%', deviationText: `-${diff.toFixed(1)}%`, moneyImpact: positive(base * diff * 0.006) }));
  }

  if (agreed.natWeight !== undefined && actual.natWeight !== undefined && actual.natWeight < agreed.natWeight - 10) {
    const diff = agreed.natWeight - actual.natWeight;
    items.push(item({ metric: 'Натура', agreedValue: agreed.natWeight, actualValue: actual.natWeight, tolerance: '-10', deviationText: `-${diff}`, moneyImpact: positive(base * diff * 0.0007) }));
  }

  if (agreed.weedImpurity !== undefined && actual.weedImpurity !== undefined && actual.weedImpurity > agreed.weedImpurity + 0.5) {
    const diff = actual.weedImpurity - agreed.weedImpurity;
    items.push(item({ metric: 'Сорная примесь', agreedValue: `${agreed.weedImpurity}%`, actualValue: `${actual.weedImpurity}%`, tolerance: '+0,5%', deviationText: `+${diff.toFixed(1)}%`, moneyImpact: positive(base * diff * 0.0024) }));
  }

  const total = items.reduce((sum, next) => sum + next.moneyImpact.value, 0);

  return {
    id: params.id,
    dealId: params.dealId,
    batchId: params.batchId,
    agreedQualityProfileId: agreed.id,
    acceptedQualityProfileId: actual.id,
    items,
    totalDiscount: money(total),
    totalHoldAmount: money(total),
    status: total === 0 ? 'within_tolerance' : total > base * 0.015 ? 'dispute_required' : 'discount_required',
    createdAt: params.createdAt,
    updatedAt: params.updatedAt,
  };
}
