import { platformV7InvestorMetricById, platformV7InvestorMetricDelta, type PlatformV7InvestorMetric } from './investor-metrics';

export interface PlatformV7InvestorStoryBlock {
  id: string;
  title: string;
  body: string;
  metricIds: string[];
}

export const PLATFORM_V7_INVESTOR_STORY: PlatformV7InvestorStoryBlock[] = [
  {
    id: 'execution-rail',
    title: 'Не каталог, а контур исполнения сделки',
    body: 'Платформа показывает не только цену и лот, а весь путь сделки: допуск, документы, логистика, приёмка, качество, деньги и спор.',
    metricIds: ['gmv', 'cycleDays'],
  },
  {
    id: 'money-control',
    title: 'Деньги отражаются по основаниям, а не по обещаниям',
    body: 'Денежная логика строится вокруг резерва, удержания и банковского подтверждения: статус денег меняется только после закрытия проверяемых условий.',
    metricIds: ['releaseAutomation', 'disputeRate'],
  },
  {
    id: 'execution-boundary',
    title: 'Рабочий контур без завышения зрелости',
    body: 'Инвесторский режим показывает сильную сборку исполнения, но отделяет рабочие UX-слои от внешних подключений, договоров и подтверждений.',
    metricIds: ['controlledPilots', 'activeCompanies'],
  },
];

export interface PlatformV7InvestorStorySummary {
  blocks: PlatformV7InvestorStoryBlock[];
  linkedMetrics: PlatformV7InvestorMetric[];
  totalDelta: number;
}

export function platformV7InvestorStory(): PlatformV7InvestorStoryBlock[] {
  return PLATFORM_V7_INVESTOR_STORY;
}

export function platformV7InvestorStoryMetrics(block: PlatformV7InvestorStoryBlock): PlatformV7InvestorMetric[] {
  return block.metricIds
    .map((id) => platformV7InvestorMetricById(id))
    .filter((metric): metric is PlatformV7InvestorMetric => metric !== null);
}

export function platformV7InvestorStorySummary(): PlatformV7InvestorStorySummary {
  const linkedMetrics = PLATFORM_V7_INVESTOR_STORY.flatMap(platformV7InvestorStoryMetrics);
  const totalDelta = linkedMetrics.reduce((sum, metric) => sum + platformV7InvestorMetricDelta(metric), 0);

  return {
    blocks: PLATFORM_V7_INVESTOR_STORY,
    linkedMetrics,
    totalDelta: Number(totalDelta.toFixed(2)),
  };
}
