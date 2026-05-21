export type PlatformV7DemoTourStepId =
  | 'lot-readiness'
  | 'rfq-selection'
  | 'logistics-control'
  | 'acceptance-quality'
  | 'money-release';

export interface PlatformV7DemoTourStep {
  id: PlatformV7DemoTourStepId;
  order: number;
  route: string;
  durationMs: number;
  title: string;
  narration: string;
  highlights: string[];
}

export const PLATFORM_V7_DEMO_TOUR_STEPS: PlatformV7DemoTourStep[] = [
  {
    id: 'lot-readiness',
    order: 1,
    route: '/platform-v7/lots/LOT-2403',
    durationMs: 22000,
    title: 'Лот и допуск',
    narration: 'Начинаем с лота: партия, качество, регион и готовность к сделке собраны в один проверяемый контур.',
    highlights: ['lot-details', 'quality-passport', 'fgis-readiness'],
  },
  {
    id: 'rfq-selection',
    order: 2,
    route: '/platform-v7/procurement',
    durationMs: 26000,
    title: 'Запрос покупателя',
    narration: 'Покупатель сравнивает предложения и переводит выбранный вариант в черновик сделки без ухода во внешний канал.',
    highlights: ['rfq-list', 'offer-comparison', 'draft-deal'],
  },
  {
    id: 'logistics-control',
    order: 3,
    route: '/platform-v7/logistics',
    durationMs: 26000,
    title: 'Логистика и контроль',
    narration: 'Маршрут, ETA, водитель, документы перевозки и отклонения видны оператору до приёмки.',
    highlights: ['route-map', 'eta', 'transport-documents'],
  },
  {
    id: 'acceptance-quality',
    order: 4,
    route: '/platform-v7/elevator',
    durationMs: 28000,
    title: 'Приёмка и качество',
    narration: 'Элеватор и лаборатория фиксируют вес, качество, СДИЗ и расхождения как доказательства, а не как переписку.',
    highlights: ['weighing', 'lab-result', 'sdiz'],
  },
  {
    id: 'money-release',
    order: 5,
    route: '/platform-v7/bank',
    durationMs: 30000,
    title: 'Деньги и спорность',
    narration: 'Деньги выпускаются только после закрытия документов, приёмки, качества, банковского события и отсутствия активного спора.',
    highlights: ['reserve-ledger', 'hold-release', 'bank-callback'],
  },
];

export function platformV7DemoTourSteps(): PlatformV7DemoTourStep[] {
  return [...PLATFORM_V7_DEMO_TOUR_STEPS].sort((a, b) => a.order - b.order);
}

export function platformV7DemoTourDurationMs(): number {
  return PLATFORM_V7_DEMO_TOUR_STEPS.reduce((sum, step) => sum + step.durationMs, 0);
}

export function platformV7DemoTourStepById(id: PlatformV7DemoTourStepId): PlatformV7DemoTourStep | null {
  return PLATFORM_V7_DEMO_TOUR_STEPS.find((step) => step.id === id) ?? null;
}
