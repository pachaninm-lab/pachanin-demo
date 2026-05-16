export type PlatformV7InvestorMetricUnit = 'млн ₽/мес' | 'компаний' | '%' | 'дней' | 'контуров';
export type PlatformV7InvestorMetricTone = 'growth' | 'risk' | 'neutral';

export interface PlatformV7InvestorMetric {
  id: string;
  title: string;
  value: number;
  unit: PlatformV7InvestorMetricUnit;
  trend: number[];
  tone: PlatformV7InvestorMetricTone;
  note: string;
}

export const PLATFORM_V7_INVESTOR_METRICS: PlatformV7InvestorMetric[] = [
  {
    id: 'gmv',
    title: 'Оборот',
    value: 182,
    unit: 'млн ₽/мес',
    trend: [42, 61, 88, 112, 145, 182],
    tone: 'growth',
    note: 'ГИПОТЕЗА: месячный оборот по проверочному сценарию.',
  },
  {
    id: 'activeCompanies',
    title: 'Активные компании',
    value: 87,
    unit: 'компаний',
    trend: [12, 28, 45, 61, 73, 87],
    tone: 'growth',
    note: 'ГИПОТЕЗА: продавцы, покупатели и сервисные роли.',
  },
  {
    id: 'disputeRate',
    title: 'Доля спорных сделок',
    value: 8,
    unit: '%',
    trend: [18, 15, 14, 12, 10, 8],
    tone: 'risk',
    note: 'ГИПОТЕЗА: снижение спорности через доказательный контур.',
  },
  {
    id: 'cycleDays',
    title: 'Цикл сделки',
    value: 8.3,
    unit: 'дней',
    trend: [14, 12, 11, 10, 9, 8.3],
    tone: 'growth',
    note: 'ГИПОТЕЗА: лот → документы → приёмка → банковское подтверждение.',
  },
  {
    id: 'controlledPilots',
    title: 'Рабочие контуры',
    value: 3,
    unit: 'контуров',
    trend: [1, 1, 2, 2, 3, 3],
    tone: 'neutral',
    note: 'ГИПОТЕЗА: банк, регион, якорные участники.',
  },
  {
    id: 'releaseAutomation',
    title: 'Готовность банковского основания',
    value: 64,
    unit: '%',
    trend: [22, 31, 39, 48, 57, 64],
    tone: 'growth',
    note: 'ГИПОТЕЗА: доля сделок без ручного денежного стопа.',
  },
];

export function platformV7InvestorMetrics(): PlatformV7InvestorMetric[] {
  return PLATFORM_V7_INVESTOR_METRICS;
}

export function platformV7InvestorMetricById(id: string): PlatformV7InvestorMetric | null {
  return PLATFORM_V7_INVESTOR_METRICS.find((metric) => metric.id === id) ?? null;
}

export function platformV7InvestorMetricDelta(metric: PlatformV7InvestorMetric): number {
  const first = metric.trend[0] ?? metric.value;
  const last = metric.trend.at(-1) ?? metric.value;
  return Number((last - first).toFixed(2));
}
