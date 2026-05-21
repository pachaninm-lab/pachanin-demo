export interface PlatformV7ShellBreadcrumb {
  label: string;
  href: string;
  isLast: boolean;
}

export const PLATFORM_V7_SHELL_BREADCRUMB_LABELS: Record<string, string> = {
  'platform-v7': 'Прозрачная Цена',
  'platform-v7r': 'Прозрачная Цена',
  roles: 'Роли',
  'control-tower': 'Центр управления',
  'canonical-reconciliation': 'Сверка показателей',
  deals: 'Сделки',
  lots: 'Лоты',
  'market-rfq': 'Рынок и заявки',
  'execution-map': 'Карта исполнения',
  trading: 'Торги и ставки',
  seller: 'Продавец',
  buyer: 'Покупатель',
  'buyer-lot': 'Лот покупателя',
  'anti-bypass': 'Антиобход',
  'offer-log': 'Журнал торгов',
  'offer-to-deal': 'Ставка → сделка',
  'fgis-to-lot': 'ФГИС → лот',
  readiness: 'Готовность сделки',
  logistics: 'Логистика',
  field: 'Поле и приёмка',
  bank: 'Банк',
  'release-safety': 'Проверка выпуска денег',
  'data-room': 'Пакет проверки',
  disputes: 'Споры',
  compliance: 'Комплаенс',
  connectors: 'Интеграции',
  operator: 'Оператор',
  investor: 'Инвестор',
  analytics: 'Сводка',
  procurement: 'Закупки',
  driver: 'Водитель',
  surveyor: 'Сюрвейер',
  elevator: 'Элеватор',
  lab: 'Лаборатория',
  arbitrator: 'Арбитр',
};

export function platformV7ShellBreadcrumbLabel(segment: string): string {
  return PLATFORM_V7_SHELL_BREADCRUMB_LABELS[segment] ?? segment;
}

export function platformV7BuildShellBreadcrumbs(pathname: string): PlatformV7ShellBreadcrumb[] {
  const clean = pathname.split('?')[0]?.split('#')[0] ?? pathname;

  return clean
    .split('/')
    .filter(Boolean)
    .map((part, index, parts) => ({
      label: platformV7ShellBreadcrumbLabel(part),
      href: '/' + parts.slice(0, index + 1).join('/'),
      isLast: index === parts.length - 1,
    }));
}
