import { PLATFORM_V7_LEXICON } from './lexicon';
import { PLATFORM_V7_MARKET_RFQ_ROUTE, PLATFORM_V7_RELEASE_SAFETY_ROUTE } from './routes';

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
    subtitle: 'Панель оператора · показатели и приоритеты',
    href: '/platform-v7/control-tower',
    keywords: 'центр управления оператор показатели приоритеты',
  },
  {
    id: 'sec-canonical-kpi-reconciliation',
    group: 'Разделы',
    title: 'Сверка показателей',
    subtitle: 'Сравнение текущей и эталонной формулы показателей',
    href: '/platform-v7/control-tower/canonical-reconciliation',
    keywords: 'сверка показатели формула эталон',
  },
  {
    id: 'sec-deals',
    group: 'Разделы',
    title: `Все ${PLATFORM_V7_LEXICON.nav.deals.toLowerCase()}`,
    subtitle: 'Реестр сделок с фильтрами по статусу и риску',
    href: '/platform-v7/deals',
    keywords: 'сделки реестр',
  },
  {
    id: 'sec-marketplace',
    group: 'Разделы',
    title: 'Витрина лотов',
    subtitle: 'Лоты по культуре и региону',
    href: '/platform-v7/lots',
    keywords: 'витрина лоты рынок',
  },
  {
    id: 'sec-market-rfq',
    group: 'Разделы',
    title: 'Рынок и заявки',
    subtitle: 'Предсделочный контур: лоты, заявки и предложения',
    href: PLATFORM_V7_MARKET_RFQ_ROUTE,
    keywords: 'рынок заявки предложения спрос предложение предсделочный контур',
  },
  {
    id: 'sec-bank',
    group: 'Разделы',
    title: 'Банковый контур',
    subtitle: 'Резервы, удержания, события банка, выпуск денег',
    href: '/platform-v7/bank',
    keywords: 'банк деньги резерв удержание выпуск события',
  },
  {
    id: 'sec-release-safety',
    group: 'Разделы',
    title: 'Проверка выпуска денег',
    subtitle: 'Проверочный режим: блокеры, удержания и кандидаты к выпуску',
    href: PLATFORM_V7_RELEASE_SAFETY_ROUTE,
    keywords: 'проверка деньги выпуск удержания блокеры банк',
  },
  {
    id: 'sec-data-room',
    group: 'Разделы',
    title: 'Пакет проверки',
    subtitle: 'Проверочный пакет для банка и инвестора',
    href: '/platform-v7/data-room',
    keywords: 'пакет проверки банк инвестор документы проверка',
  },
  {
    id: 'sec-disputes',
    group: 'Разделы',
    title: PLATFORM_V7_LEXICON.nav.disputes,
    subtitle: 'Открытые споры и удержания',
    href: '/platform-v7/disputes',
    keywords: 'споры удержания',
  },
  {
    id: 'sec-logistics',
    group: 'Разделы',
    title: PLATFORM_V7_LEXICON.nav.logistics,
    subtitle: 'Маршруты, сроки прибытия, отклонения',
    href: '/platform-v7/logistics',
    keywords: 'логистика маршруты сроки прибытия отклонения',
  },
  {
    id: 'sec-integrations',
    group: 'Разделы',
    title: PLATFORM_V7_LEXICON.nav.connectors,
    subtitle: 'ФГИС, СберБизнес, СПАРК, лаборатории',
    href: '/platform-v7/connectors',
    keywords: 'интеграции фгис сбер спарк лаборатории',
  },
  {
    id: 'sec-operator',
    group: 'Разделы',
    title: 'Кабинет оператора',
    subtitle: 'Очереди, события банка, ручные действия',
    href: '/platform-v7/operator',
    keywords: 'оператор очереди ручные действия',
  },
  {
    id: 'sec-investor',
    group: 'Разделы',
    title: 'Инвестор',
    subtitle: 'Презентационный режим, портфель сделок',
    href: '/platform-v7/investor',
    keywords: 'инвестор портфель презентация',
  },
  {
    id: 'sec-roles',
    group: 'Разделы',
    title: PLATFORM_V7_LEXICON.nav.roles,
    subtitle: 'Сменить активную роль',
    href: '/platform-v7/roles',
    keywords: 'роли смена кабинет',
  },
];

export function platformV7CommandSectionItems(): PlatformV7CommandSectionItem[] {
  return PLATFORM_V7_COMMAND_SECTION_ITEMS;
}
