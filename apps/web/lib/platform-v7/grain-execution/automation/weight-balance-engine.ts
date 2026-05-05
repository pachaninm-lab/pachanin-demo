import type { MoneyAmount, WeightBalance } from '../types';
import { money } from '../format';

export function calculateWeightBalance(params: {
  readonly id: string;
  readonly dealId: string;
  readonly batchId: string;
  readonly logisticsOrderId?: string;
  readonly routeLegId?: string;
  readonly elevatorOperationId?: string;
  readonly contractedVolumeTons: number;
  readonly loadedGrossTons?: number;
  readonly loadedTareTons?: number;
  readonly loadedNetTons?: number;
  readonly receivedGrossTons?: number;
  readonly receivedTareTons?: number;
  readonly receivedNetTons?: number;
  readonly acceptedNetTons?: number;
  readonly tolerancePercent?: number;
  readonly pricePerTon: MoneyAmount;
  readonly evidenceIds?: string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}): WeightBalance {
  const loadedNetTons = params.loadedNetTons ?? (params.loadedGrossTons !== undefined && params.loadedTareTons !== undefined ? params.loadedGrossTons - params.loadedTareTons : undefined);
  const receivedNetTons = params.receivedNetTons ?? (params.receivedGrossTons !== undefined && params.receivedTareTons !== undefined ? params.receivedGrossTons - params.receivedTareTons : undefined);
  const acceptedNetTons = params.acceptedNetTons ?? receivedNetTons;
  const lossTons = acceptedNetTons !== undefined ? Number((params.contractedVolumeTons - acceptedNetTons).toFixed(3)) : undefined;
  const lossPercent = lossTons !== undefined ? Number(((lossTons / params.contractedVolumeTons) * 100).toFixed(3)) : undefined;
  const tolerancePercent = params.tolerancePercent ?? 0.5;
  const toleranceTons = Number(((params.contractedVolumeTons * tolerancePercent) / 100).toFixed(3));
  const deviationTons = lossTons !== undefined ? Math.max(0, lossTons - toleranceTons) : 0;
  const impact = Math.round(deviationTons * params.pricePerTon.value);
  const status: WeightBalance['status'] =
    acceptedNetTons === undefined
      ? loadedNetTons === undefined
        ? 'not_started'
        : 'loading_weight_captured'
      : impact > 0
        ? 'deviation'
        : 'within_tolerance';

  return {
    id: params.id,
    dealId: params.dealId,
    batchId: params.batchId,
    logisticsOrderId: params.logisticsOrderId,
    routeLegId: params.routeLegId,
    elevatorOperationId: params.elevatorOperationId,
    contractedVolumeTons: params.contractedVolumeTons,
    loadedGrossTons: params.loadedGrossTons,
    loadedTareTons: params.loadedTareTons,
    loadedNetTons,
    receivedGrossTons: params.receivedGrossTons,
    receivedTareTons: params.receivedTareTons,
    receivedNetTons,
    acceptedNetTons,
    adjustedWeightTons: acceptedNetTons,
    lossTons,
    lossPercent,
    toleranceTons,
    tolerancePercent,
    weightDeviationMoneyImpact: money(impact),
    status,
    evidenceIds: params.evidenceIds ?? [],
    createdAt: params.createdAt,
    updatedAt: params.updatedAt,
  };
}
