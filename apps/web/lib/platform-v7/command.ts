import { PLATFORM_V7_LEXICON } from './lexicon';
import { PLATFORM_V7_EXECUTION_MAP_ROUTE, PLATFORM_V7_MARKET_RFQ_ROUTE, PLATFORM_V7_RELEASE_SAFETY_ROUTE } from './routes';

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
    id: 'sec-execution-map',
    group: 'Разделы',
    title: 'Карта исполнения сделки',
    subtitle: 'Один маршрут: товар, торги, готовность, логистика, деньги и спор',
    href: PLATFORM_V7_EXECUTION_MAP_ROUTE,
    keywords: 'карта исполнения сделки маршрут товар торги готовность логистика деньги спор доказательства',
  },
  {
    id: 'sec-trading',
    group: 'Разделы',
    title: 'Торги и ставки',
    subtitle: 'Лоты, заявки, ставки, блокеры и допуск к сделке',
    href: '/platform-v7/trading',
    keywords: 'торги ставки лоты заявки предложения цена допуск сделка',
  },
  {
    id: 'sec-seller-offers',
    group: 'Разделы',
    title: 'Ставки продавца',
    subtitle: 'Входящие предложения по лотам, деньги, риск и действия',
    href: '/platform-v7/seller/offers',
    keywords: 'продавец ставки предложения лоты покупатели деньги риск встречное предложение',
  },
  {
    id: 'sec-buyer-lot',
    group: 'Разделы',
    title: 'Лот глазами покупателя',
    subtitle: 'Проверка товара, условия ставки и переход к сделке',
    href: '/platform-v7/buyer-lot',
    keywords: 'покупатель лот ставка предложение товар качество фгис сделка',
  },
  {
    id: 'sec-anti-bypass',
    group: 'Разделы',
    title: 'Антиобход',
    subtitle: 'Правила раскрытия сторон, контактов и удержания сделки',
    href: '/platform-v7/anti-bypass',
    keywords: 'антиобход контакты раскрытие сторон удержание сделки риск обхода',
  },
  {
    id: 'sec-offer-log',
    group: 'Разделы',
    title: 'Журнал торгов',
    subtitle: 'История ставок, изменений, проверок и выбора предложения',
    href: '/platform-v7/offer-log',
    keywords: 'журнал торгов ставки история изменения проверка предложение доказательства',
  },
  {
    id: 'sec-offer-to-deal',
    group: 'Разделы',
    title: 'Ставка → черновик сделки',
    subtitle: 'Перенос условий, раскрытие сторон и проверки перед сделкой',
    href: '/platform-v7/offer-to-deal',
    keywords: 'ставка черновик сделки условия раскрытие сторон проверки',
  },
  {
    id: 'sec-fgis-to-lot',
    group: 'Разделы',
    title: 'ФГИС → лот',
    subtitle: 'Партия, паспорт товара, блокеры и черновик лота',
    href: '/platform-v7/fgis-to-lot',
    keywords: 'фгис лот партия паспорт товара остаток качество сдиз',
  },
  {
    id: 'sec-readiness',
    group: 'Разделы',
    title: 'Готовность сделки',
    subtitle: 'ФГИС, документы, логистика, банк, спор и удержания',
    href: '/platform-v7/readiness',
    keywords: 'готовность сделки фгис документы логистика банк спор удержания',
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
