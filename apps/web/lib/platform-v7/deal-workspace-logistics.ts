export type PlatformV7DealLogisticsStatus = 'none' | 'planned' | 'in_transit' | 'arrived' | 'accepted' | 'blocked';
export type PlatformV7DealLogisticsBlocker = 'route-deviation' | 'eta-risk' | 'weight-mismatch' | 'missing-ettn' | 'driver-not-confirmed';

export interface PlatformV7DealLogisticsTrip {
  id: string;
  carrier: string;
  driver: string;
  vehicle: string;
  status: PlatformV7DealLogisticsStatus;
  eta?: string;
  kmLeft?: number;
  blockers: PlatformV7DealLogisticsBlocker[];
  ettnStatus: 'missing' | 'draft' | 'signed';
}

export interface PlatformV7DealLogisticsModel {
  hasActiveTrip: boolean;
  trip: PlatformV7DealLogisticsTrip | null;
  blocksRelease: boolean;
  statusLabel: string;
  blockers: PlatformV7DealLogisticsBlocker[];
  evidenceRequired: boolean;
}

const STATUS_LABELS: Record<PlatformV7DealLogisticsStatus, string> = {
  none: 'Нет активного рейса',
  planned: 'Рейс запланирован',
  in_transit: 'В пути',
  arrived: 'Прибыл',
  accepted: 'Принят',
  blocked: 'Блокирует выпуск',
};

export function platformV7DealLogisticsModel(trip: PlatformV7DealLogisticsTrip | null): PlatformV7DealLogisticsModel {
  if (!trip) {
    return {
      hasActiveTrip: false,
      trip: null,
      blocksRelease: true,
      statusLabel: STATUS_LABELS.none,
      blockers: ['driver-not-confirmed'],
      evidenceRequired: true,
    };
  }

  const blockers = [...trip.blockers];
  if (trip.ettnStatus !== 'signed') blockers.push('missing-ettn');
  const blocksRelease = trip.status === 'blocked' || blockers.length > 0 || trip.status !== 'accepted';

  return {
    hasActiveTrip: true,
    trip,
    blocksRelease,
    statusLabel: STATUS_LABELS[trip.status],
    blockers,
    evidenceRequired: blocksRelease,
  };
}

export function platformV7DealLogisticsBadgeTone(model: PlatformV7DealLogisticsModel): 'success' | 'warning' | 'danger' {
  if (!model.blocksRelease) return 'success';
  if (model.blockers.length > 0) return 'danger';
  return 'warning';
}
