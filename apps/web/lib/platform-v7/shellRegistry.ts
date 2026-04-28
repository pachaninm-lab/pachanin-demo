import type { PlatformV7SectionKey } from './navigation';
import {
  PLATFORM_V7_BANK_ROUTE,
  PLATFORM_V7_BUYER_ROUTE,
  PLATFORM_V7_COMPLIANCE_ROUTE,
  PLATFORM_V7_CONTROL_TOWER_ROUTE,
  PLATFORM_V7_DEALS_ROUTE,
  PLATFORM_V7_DISPUTES_ROUTE,
  PLATFORM_V7_FIELD_ROUTE,
  PLATFORM_V7_LOGISTICS_ROUTE,
  PLATFORM_V7_PROCUREMENT_ROUTE,
  PLATFORM_V7_SELLER_ROUTE,
  PLATFORM_V7R_ANALYTICS_ROUTE,
  PLATFORM_V7R_ARBITRATOR_ROUTE,
  PLATFORM_V7R_DRIVER_ROUTE,
  PLATFORM_V7R_ELEVATOR_ROUTE,
  PLATFORM_V7R_LAB_ROUTE,
  PLATFORM_V7R_ROLES_ROUTE,
  PLATFORM_V7R_SURVEYOR_ROUTE,
  type PlatformV7ShellRouteSurface,
} from './routes';

export type PlatformV7ShellSurfaceType =
  | 'core'
  | 'money'
  | 'documents'
  | 'logistics'
  | 'disputes'
  | 'compliance'
  | 'analytics'
  | 'settings';

export type PlatformV7ShellSection = 'Навигация' | 'Сделки' | 'Споры' | 'Роли';

export type PlatformV7ShellRegistryHref =
  | PlatformV7ShellRouteSurface
  | `${typeof PLATFORM_V7_DEALS_ROUTE}/${string}`
  | `${typeof PLATFORM_V7_DISPUTES_ROUTE}/${string}`;

export interface PlatformV7ShellRegistryEntry {
  readonly id: string;
  readonly label: string;
  readonly href: PlatformV7ShellRegistryHref;
  readonly section: PlatformV7ShellSection;
  readonly iconKey: PlatformV7SectionKey;
  readonly description: string;
  readonly shortcut?: string;
  readonly commandKeywords: readonly string[];
  readonly breadcrumbLabel: string;
  readonly enabled: boolean;
  readonly surface: PlatformV7ShellSurfaceType;
}

export const PLATFORM_V7_SHELL_REGISTRY: readonly PlatformV7ShellRegistryEntry[] = [
  {
    id: 'control-tower',
    label: 'Центр управления',
    href: PLATFORM_V7_CONTROL_TOWER_ROUTE,
    section: 'Навигация',
    iconKey: 'dashboard',
    description: 'Операционный дашборд сделок и блокеров платформы.',
    shortcut: 'G + C',
    commandKeywords: ['центр управления', 'дашборд', 'сводка', 'control tower', 'dashboard'],
    breadcrumbLabel: 'Центр управления',
    enabled: true,
    surface: 'core',
  },
  {
    id: 'deals',
    label: 'Сделки',
    href: PLATFORM_V7_DEALS_ROUTE,
    section: 'Навигация',
    iconKey: 'deals',
    description: 'Реестр сделок. Статус исполнения, документы, блокеры.',
    shortcut: 'G + D',
    commandKeywords: ['сделки', 'контракты', 'deals', 'реестр'],
    breadcrumbLabel: 'Сделки',
    enabled: true,
    surface: 'core',
  },
  {
    id: 'procurement',
    label: 'Закупки',
    href: PLATFORM_V7_PROCUREMENT_ROUTE,
    section: 'Навигация',
    iconKey: 'procurement',
    description: 'Закупочные запросы и лоты в статусе проверки.',
    commandKeywords: ['закупки', 'тендеры', 'заявки', 'procurement'],
    breadcrumbLabel: 'Закупки',
    enabled: true,
    surface: 'core',
  },
  {
    id: 'logistics',
    label: 'Логистика',
    href: PLATFORM_V7_LOGISTICS_ROUTE,
    section: 'Навигация',
    iconKey: 'logistics',
    description: 'Диспетчерская. Маршруты, рейсы и GPS-статусы.',
    shortcut: 'G + L',
    commandKeywords: ['логистика', 'маршруты', 'транспорт', 'рейсы', 'logistics'],
    breadcrumbLabel: 'Логистика',
    enabled: true,
    surface: 'logistics',
  },
  {
    id: 'bank',
    label: 'Банк',
    href: PLATFORM_V7_BANK_ROUTE,
    section: 'Навигация',
    iconKey: 'bank',
    description: 'Банковый контур. Резервы, выпуск и ручные решения.',
    shortcut: 'G + B',
    commandKeywords: ['банк', 'деньги', 'резерв', 'выпуск', 'bank', 'money'],
    breadcrumbLabel: 'Банк',
    enabled: true,
    surface: 'money',
  },
  {
    id: 'disputes',
    label: 'Споры',
    href: PLATFORM_V7_DISPUTES_ROUTE,
    section: 'Навигация',
    iconKey: 'disputes',
    description: 'Реестр споров и удержаний. Доказательная база и арбитраж.',
    shortcut: 'G + S',
    commandKeywords: ['споры', 'арбитраж', 'удержания', 'disputes'],
    breadcrumbLabel: 'Споры',
    enabled: true,
    surface: 'disputes',
  },
  {
    id: 'compliance',
    label: 'Комплаенс',
    href: PLATFORM_V7_COMPLIANCE_ROUTE,
    section: 'Навигация',
    iconKey: 'cabinet',
    description: 'Допуск участников. Проверка документов и онбординг.',
    commandKeywords: ['комплаенс', 'допуск', 'онбординг', 'compliance', 'кайс'],
    breadcrumbLabel: 'Комплаенс',
    enabled: true,
    surface: 'compliance',
  },
  {
    id: 'buyer',
    label: 'Кабинет покупателя',
    href: PLATFORM_V7_BUYER_ROUTE,
    section: 'Навигация',
    iconKey: 'cabinet',
    description: 'Кабинет покупателя. Лоты, ставки, резерв денег.',
    commandKeywords: ['покупатель', 'кабинет', 'buyer'],
    breadcrumbLabel: 'Покупатель',
    enabled: true,
    surface: 'core',
  },
  {
    id: 'seller',
    label: 'Кабинет продавца',
    href: PLATFORM_V7_SELLER_ROUTE,
    section: 'Навигация',
    iconKey: 'cabinet',
    description: 'Кабинет продавца. Лоты, сделки, документы.',
    commandKeywords: ['продавец', 'кабинет', 'seller'],
    breadcrumbLabel: 'Продавец',
    enabled: true,
    surface: 'core',
  },
  {
    id: 'field',
    label: 'Поле и приёмка',
    href: PLATFORM_V7_FIELD_ROUTE,
    section: 'Навигация',
    iconKey: 'receiving',
    description: 'Полевые события: прибытие, загрузка, приёмка зерна.',
    commandKeywords: ['поле', 'приёмка', 'field', 'элеватор', 'загрузка'],
    breadcrumbLabel: 'Поле и приёмка',
    enabled: true,
    surface: 'logistics',
  },
  {
    id: 'analytics',
    label: 'Сводка',
    href: PLATFORM_V7R_ANALYTICS_ROUTE,
    section: 'Навигация',
    iconKey: 'analytics',
    description: 'Аналитическая сводка. Метрики исполнения и финансовые KPI.',
    commandKeywords: ['аналитика', 'сводка', 'отчёты', 'analytics', 'kpi'],
    breadcrumbLabel: 'Сводка',
    enabled: true,
    surface: 'analytics',
  },
  {
    id: 'roles',
    label: 'Все роли',
    href: PLATFORM_V7R_ROLES_ROUTE,
    section: 'Роли',
    iconKey: 'roles',
    description: 'Выбор кабинета по роли: оператор, покупатель, продавец и другие.',
    commandKeywords: ['роли', 'переключить', 'roles', 'кабинет'],
    breadcrumbLabel: 'Роли',
    enabled: true,
    surface: 'settings',
  },
  {
    id: 'driver',
    label: 'Водитель',
    href: PLATFORM_V7R_DRIVER_ROUTE,
    section: 'Роли',
    iconKey: 'logistics',
    description: 'Кабинет водителя. Текущий маршрут и полевые события.',
    commandKeywords: ['водитель', 'driver', 'маршрут', 'рейс'],
    breadcrumbLabel: 'Водитель',
    enabled: true,
    surface: 'logistics',
  },
  {
    id: 'surveyor',
    label: 'Сюрвейер',
    href: PLATFORM_V7R_SURVEYOR_ROUTE,
    section: 'Роли',
    iconKey: 'cabinet',
    description: 'Кабинет сюрвейера. Назначения и отчёты о качестве.',
    commandKeywords: ['сюрвейер', 'surveyor', 'назначения', 'качество'],
    breadcrumbLabel: 'Сюрвейер',
    enabled: true,
    surface: 'documents',
  },
  {
    id: 'elevator',
    label: 'Элеватор',
    href: PLATFORM_V7R_ELEVATOR_ROUTE,
    section: 'Роли',
    iconKey: 'receiving',
    description: 'Кабинет элеватора. Приёмка грузов и качественный контроль.',
    commandKeywords: ['элеватор', 'elevator', 'приёмка', 'зерно'],
    breadcrumbLabel: 'Элеватор',
    enabled: true,
    surface: 'logistics',
  },
  {
    id: 'lab',
    label: 'Лаборатория',
    href: PLATFORM_V7R_LAB_ROUTE,
    section: 'Навигация',
    iconKey: 'lab',
    description: 'Лабораторный контур. Пробы, протоколы и результаты анализов.',
    commandKeywords: ['лаборатория', 'lab', 'пробы', 'анализ', 'протокол'],
    breadcrumbLabel: 'Лаборатория',
    enabled: true,
    surface: 'documents',
  },
  {
    id: 'arbitrator',
    label: 'Арбитр',
    href: PLATFORM_V7R_ARBITRATOR_ROUTE,
    section: 'Роли',
    iconKey: 'analytics',
    description: 'Кабинет арбитра. Разбор споров и доказательная база.',
    commandKeywords: ['арбитр', 'arbitrator', 'разбор', 'споры'],
    breadcrumbLabel: 'Арбитр',
    enabled: true,
    surface: 'disputes',
  },
  {
    id: 'deal-dl-9102',
    label: 'Сделка DL-9102',
    href: `${PLATFORM_V7_DEALS_ROUTE}/DL-9102`,
    section: 'Сделки',
    iconKey: 'deals',
    description: 'Сделка DL-9102. Пшеница. Открыт спор по качеству.',
    commandKeywords: ['dl-9102', 'сделка', 'пшеница', 'спор', 'качество'],
    breadcrumbLabel: 'DL-9102',
    enabled: true,
    surface: 'disputes',
  },
  {
    id: 'deal-dl-9103',
    label: 'Сделка DL-9103',
    href: `${PLATFORM_V7_DEALS_ROUTE}/DL-9103`,
    section: 'Сделки',
    iconKey: 'deals',
    description: 'Сделка DL-9103. Кукуруза. Рейс в пути, ожидает приёмки.',
    commandKeywords: ['dl-9103', 'сделка', 'кукуруза', 'рейс', 'в пути'],
    breadcrumbLabel: 'DL-9103',
    enabled: true,
    surface: 'logistics',
  },
  {
    id: 'deal-dl-9109',
    label: 'Сделка DL-9109',
    href: `${PLATFORM_V7_DEALS_ROUTE}/DL-9109`,
    section: 'Сделки',
    iconKey: 'deals',
    description: 'Сделка DL-9109. Запрос на выпуск денег. Ожидает решения банка.',
    commandKeywords: ['dl-9109', 'сделка', 'выпуск', 'банк', 'резерв'],
    breadcrumbLabel: 'DL-9109',
    enabled: true,
    surface: 'money',
  },
  {
    id: 'dispute-dk-2024-89',
    label: 'Спор DK-2024-89',
    href: `${PLATFORM_V7_DISPUTES_ROUTE}/DK-2024-89`,
    section: 'Споры',
    iconKey: 'disputes',
    description: 'Спор DK-2024-89. Расхождение по влажности. Дело у арбитра.',
    commandKeywords: ['dk-2024-89', 'спор', 'влажность', 'арбитраж', 'доказательства'],
    breadcrumbLabel: 'DK-2024-89',
    enabled: true,
    surface: 'disputes',
  },
] as const;

export function platformV7ShellRegistryEntries(): readonly PlatformV7ShellRegistryEntry[] {
  return PLATFORM_V7_SHELL_REGISTRY;
}

export function platformV7ShellRegistryById(id: string): PlatformV7ShellRegistryEntry | null {
  return PLATFORM_V7_SHELL_REGISTRY.find((e) => e.id === id) ?? null;
}

export function platformV7ShellRegistryBySurface(surface: PlatformV7ShellSurfaceType): readonly PlatformV7ShellRegistryEntry[] {
  return PLATFORM_V7_SHELL_REGISTRY.filter((e) => e.surface === surface);
}

export function platformV7ShellRegistryBySection(section: PlatformV7ShellSection): readonly PlatformV7ShellRegistryEntry[] {
  return PLATFORM_V7_SHELL_REGISTRY.filter((e) => e.section === section);
}

export function platformV7ShellRegistryShortcutEntries(): readonly PlatformV7ShellRegistryEntry[] {
  return PLATFORM_V7_SHELL_REGISTRY.filter((e) => Boolean(e.shortcut));
}

export function platformV7ShellRegistryBreadcrumbLabel(segment: string): string | null {
  const entry = PLATFORM_V7_SHELL_REGISTRY.find((e) => e.breadcrumbLabel.toLowerCase() === segment.toLowerCase() || e.id === segment);
  return entry?.breadcrumbLabel ?? null;
}

export function platformV7ShellRegistrySearchEntries(query: string): readonly PlatformV7ShellRegistryEntry[] {
  const q = query.toLowerCase().trim();
  if (!q) return PLATFORM_V7_SHELL_REGISTRY;
  return PLATFORM_V7_SHELL_REGISTRY.filter(
    (e) =>
      e.label.toLowerCase().includes(q) ||
      e.commandKeywords.some((kw) => kw.includes(q)) ||
      e.description.toLowerCase().includes(q),
  );
}
