import { PLATFORM_V7_EXECUTION_SOURCE } from '../deal-execution-source-of-truth';

// VP-5: Driver / Logistics cockpit binding.
// Миссия водителя выводится из runtime-источника исполнения сделки (Stage 5),
// а не из декоративных данных. Деньги и коммерческий контур не раскрываются.

export type PlatformV7DriverPhotoStep = {
  readonly label: string;
  readonly done: boolean;
};

export type PlatformV7DriverCockpitState = {
  readonly tripId: string;
  readonly route: string;
  readonly stageLabel: string;
  readonly progressPercent: number;
  readonly photoChecklist: readonly PlatformV7DriverPhotoStep[];
  readonly offlineQueueCount: number;
  readonly nextAction: string;
  readonly sourceMeta: {
    readonly source: 'controlled-pilot-runtime';
    readonly runtimeBound: true;
    readonly liveExternalIntegrations: false;
  };
};

const LEG_PROGRESS: ReadonlyArray<readonly [string, number]> = [
  ['завершён', 100],
  ['выгруз', 96],
  ['приёмк', 92],
  ['прибыл', 88],
  ['в пути', 62],
  ['погрузк', 35],
  ['ожидает погрузки', 12],
  ['ожидает окна', 5],
  ['резерв', 0],
];

function legProgress(currentLeg: string): number {
  const leg = currentLeg.toLowerCase();
  for (const [needle, value] of LEG_PROGRESS) {
    if (leg.includes(needle)) return value;
  }
  return 0;
}

function legStage(currentLeg: string): string {
  const leg = currentLeg.toLowerCase();
  if (leg.includes('в пути')) return 'в пути';
  if (leg.includes('погрузк')) return 'на погрузке';
  if (leg.includes('прибыл') || leg.includes('приёмк')) return 'на приёмке';
  return 'ожидание';
}

function nextActionFor(currentLeg: string): string {
  const leg = currentLeg.toLowerCase();
  if (leg.includes('в пути')) return 'Подтвердить прибытие на элеватор';
  if (leg.includes('погрузк')) return 'Подтвердить погрузку и приложить фото пломбы';
  if (leg.includes('прибыл') || leg.includes('приёмк')) return 'Передать вес и фото на приёмке';
  return 'Принять рейс после назначения окна';
}

export function getPlatformV7DriverCockpitState(): PlatformV7DriverCockpitState {
  const { logistics } = PLATFORM_V7_EXECUTION_SOURCE;
  const progressPercent = legProgress(logistics.currentLeg);

  return {
    tripId: logistics.tripId,
    route: `${logistics.pickupPoint} → ${logistics.deliveryPoint}`,
    stageLabel: legStage(logistics.currentLeg),
    progressPercent,
    photoChecklist: [
      { label: 'Фото погрузки', done: progressPercent >= 35 },
      { label: 'Пломба зафиксирована', done: progressPercent >= 35 },
      { label: 'Фото выгрузки', done: progressPercent >= 88 },
    ],
    offlineQueueCount: 0,
    nextAction: nextActionFor(logistics.currentLeg),
    sourceMeta: {
      source: 'controlled-pilot-runtime',
      runtimeBound: true,
      liveExternalIntegrations: false,
    },
  };
}
