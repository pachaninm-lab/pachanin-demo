export type PlatformV7RoadmapStatus = 'done' | 'in_progress' | 'blocked' | 'planned';
export type PlatformV7RoadmapTrack = 'product' | 'bank' | 'region' | 'data-room';

export interface PlatformV7InvestorRoadmapItem {
  id: string;
  track: PlatformV7RoadmapTrack;
  title: string;
  status: PlatformV7RoadmapStatus;
  quarter: string;
  evidence: string;
  risk: string;
}

export const PLATFORM_V7_INVESTOR_ROADMAP: PlatformV7InvestorRoadmapItem[] = [
  {
    id: 'source-of-truth',
    track: 'product',
    title: 'Единый слой данных для сделок, лотов, споров и денег',
    status: 'in_progress',
    quarter: 'Q2 2026',
    evidence: 'Базовые модули и unit-тесты сливаются поэтапно.',
    risk: 'Остались крупные файлы текущего состояния, которые требуют точечных правок без переписывания платформы.',
  },
  {
    id: 'action-feedback',
    track: 'product',
    title: 'Обратная связь для кнопок действий и журнала действий',
    status: 'in_progress',
    quarter: 'Q2 2026',
    evidence: 'База для обратной связи, журнала, уведомлений, сценариев и состояний кнопок подготовлена.',
    risk: 'Подключение текущих действий должно идти поверх существующей логики без изменения смысла денег и споров.',
  },
  {
    id: 'bank-ledger',
    track: 'bank',
    title: 'Банковский реестр, ручная проверка и сверка событий',
    status: 'planned',
    quarter: 'Q2 2026',
    evidence: 'Контур E06 описан; заявлений о боевой банковской интеграции нет.',
    risk: 'Боевые банковские события требуют отдельного подключения и правовой проверки.',
  },
  {
    id: 'tambov-controlled-pilot',
    track: 'region',
    title: 'Controlled pilot для регионального контура',
    status: 'planned',
    quarter: 'Q3 2026',
    evidence: 'Позиционирование пилота удерживается как controlled/sandbox до подтверждения модели реальными сделками.',
    risk: 'Нельзя обещать региону боевую готовность до подтверждения реальных сделок и интеграций.',
  },
  {
    id: 'data-room',
    track: 'data-room',
    title: 'Investor data room: факты, допущения, блокеры, отчёты по эпикам',
    status: 'in_progress',
    quarter: 'Q2 2026',
    evidence: 'E02/E03 reports и блокеры задокументированы.',
    risk: 'Документы должны сохранять единый статус зрелости и не завышать готовность.',
  },
];

export function platformV7InvestorRoadmap(): PlatformV7InvestorRoadmapItem[] {
  return PLATFORM_V7_INVESTOR_ROADMAP;
}

export function platformV7InvestorRoadmapByTrack(track: PlatformV7RoadmapTrack): PlatformV7InvestorRoadmapItem[] {
  return PLATFORM_V7_INVESTOR_ROADMAP.filter((item) => item.track === track);
}

export function platformV7InvestorRoadmapSummary() {
  return PLATFORM_V7_INVESTOR_ROADMAP.reduce(
    (acc, item) => ({
      ...acc,
      [item.status]: acc[item.status] + 1,
    }),
    { done: 0, in_progress: 0, blocked: 0, planned: 0 } satisfies Record<PlatformV7RoadmapStatus, number>,
  );
}