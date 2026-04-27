import { PLATFORM_V7_LEXICON } from './lexicon';

export type PlatformV7CommandGroup = 'Сделки' | 'Лоты' | 'Споры' | 'Разделы';

export interface PlatformV7CommandSectionItem {
  id: string;
  group: 'Разделы';
  title: string;
  subtitle: string;
  href: string;
  keywords: string;
}

export const PLATFORM_V7_COMMAND_SECTION_ITEMS: PlatformV7CommandSectionItem[] = [
  {
    id: 'sec-control',
    group: 'Разделы',
    title: PLATFORM_V7_LEXICON.nav.controlTower,
    subtitle: 'Дашборд оператора · KPI и приоритеты',
    href: '/platform-v7/control-tower',
    keywords: 'центр управления оператор kpi control tower',
  },
  {
    id: 'sec-canonical-kpi-reconciliation',
    group: 'Разделы',
    title: 'Сверка canonical KPI',
    subtitle: 'Сравнение текущей и canonical формулы KPI',
    href: '/platform-v7/control-tower/canonical-reconciliation',
    keywords: 'canonical kpi сверка reconciliation domain',
  },
  {
    id: 'sec-deals',
    group: 'Разделы',
    title: `Все ${PLATFORM_V7_LEXICON.nav.deals.toLowerCase()}`,
    subtitle: 'Реестр сделок с фильтрами по статусу и риску',
    href: '/platform-v7/deals',
    keywords: 'сделки deals реестр',
  },
  {
    id: 'sec-marketplace',
    group: 'Разделы',
    title: 'Витрина лотов',
    subtitle: 'Лоты по культуре и региону',
    href: '/platform-v7/lots',
    keywords: 'витрина лоты marketplace маркетплейс',
  },
  {
    id: 'sec-market-rfq',
    group: 'Разделы',
    title: 'Market / RFQ',
    subtitle: 'Предсделочный sandbox-контур: лоты, заявки и оферты',
    href: '/platform-v7/market-rfq',
    keywords: 'market rfq рынок заявки оферты спрос предложение предсделочный контур',
  },
  {
    id: 'sec-bank',
    group: 'Разделы',
    title: 'Банковый контур',
    subtitle: 'Резервы, удержания, события банка, выпуск денег',
    href: '/platform-v7/bank',
    keywords: 'банк bank деньги резерв удержание выпуск release callbacks',
  },
  {
    id: 'sec-release-safety',
    group: 'Разделы',
    title: 'Проверка выпуска денег',
    subtitle: 'Read-only audit: блокеры, удержания и кандидаты к выпуску',
    href: '/platform-v7/bank/release-safety',
    keywords: 'release safety audit банк деньги выпуск удержания блокеры gate',
  },
  {
    id: 'sec-disputes',
    group: 'Разделы',
    title: PLATFORM_V7_LEXICON.nav.disputes,
    subtitle: 'Открытые споры и удержания',
    href: '/platform-v7/disputes',
    keywords: 'споры disputes удержания hold',
  },
  {
    id: 'sec-logistics',
    group: 'Разделы',
    title: PLATFORM_V7_LEXICON.nav.logistics,
    subtitle: 'Маршруты, ETA, отклонения',
    href: '/platform-v7/logistics',
    keywords: 'логистика маршруты gps eta',
  },
  {
    id: 'sec-integrations',
    group: 'Разделы',
    title: PLATFORM_V7_LEXICON.nav.connectors,
    subtitle: 'ФГИС, СберБизнес, СПАРК, лаборатории',
    href: '/platform-v7/connectors',
    keywords: 'интеграции connectors fgis sber spark',
  },
  {
    id: 'sec-operator',
    group: 'Разделы',
    title: 'Кабинет оператора',
    subtitle: 'Очереди, события банка, ручные действия',
    href: '/platform-v7/operator',
    keywords: 'оператор operator queues очереди',
  },
  {
    id: 'sec-investor',
    group: 'Разделы',
    title: 'Инвестор',
    subtitle: 'Презентационный режим, портфель сделок',
    href: '/platform-v7/investor',
    keywords: 'инвестор investor портфель',
  },
  {
    id: 'sec-roles',
    group: 'Разделы',
    title: PLATFORM_V7_LEXICON.nav.roles,
    subtitle: 'Сменить активную роль',
    href: '/platform-v7/roles',
    keywords: 'роли roles смена кабинет',
  },
];

export function platformV7CommandSectionItems(): PlatformV7CommandSectionItem[] {
  return PLATFORM_V7_COMMAND_SECTION_ITEMS;
}
