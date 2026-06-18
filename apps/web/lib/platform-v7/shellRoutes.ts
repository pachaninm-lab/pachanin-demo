import type { PlatformRole } from '@/stores/usePlatformV7RStore';
import {
  PLATFORM_V7_AI_ROUTE,
  PLATFORM_V7_ARBITRATOR_ROUTE,
  PLATFORM_V7_BANK_CLEAN_ROUTE,
  PLATFORM_V7_BANK_ESCROW_ROUTE,
  PLATFORM_V7_BANK_EVENTS_ROUTE,
  PLATFORM_V7_BANK_FACTORING_ROUTE,
  PLATFORM_V7_BANK_PAYMENT_BASIS_ROUTE,
  PLATFORM_V7_BANK_ROUTE,
  PLATFORM_V7_BUYER_ROUTE,
  PLATFORM_V7_COMPLIANCE_ROUTE,
  PLATFORM_V7_CONTROL_TOWER_ROUTE,
  PLATFORM_V7_DEALS_ROUTE,
  PLATFORM_V7_DISPUTES_ROUTE,
  PLATFORM_V7_DOCUMENTS_ROUTE,
  PLATFORM_V7_DRIVER_FIELD_ROUTE,
  PLATFORM_V7_ELEVATOR_ROUTE,
  PLATFORM_V7_EXECUTIVE_ROUTE,
  PLATFORM_V7_LAB_ROUTE,
  PLATFORM_V7_LOGISTICS_ROUTE,
  PLATFORM_V7_LOTS_ROUTE,
  PLATFORM_V7_MONEY_ROUTE,
  PLATFORM_V7_OPERATOR_QUEUES_ROUTE,
  PLATFORM_V7_PROCUREMENT_ROUTE,
  PLATFORM_V7_PROFILE_ROUTE,
  PLATFORM_V7_REPORTS_ROUTE,
  PLATFORM_V7_ROLES_ROUTE,
  PLATFORM_V7_SELLER_ROUTE,
  PLATFORM_V7_STATUS_ROUTE,
  PLATFORM_V7_SURVEYOR_ROUTE,
  PLATFORM_V7_TRUST_ROUTE,
  PLATFORM_V7_SHELL_ROUTE_SURFACE,
  type PlatformV7ShellRouteSurface,
} from './routes';

export interface PlatformV7ShellNavItem {
  href: string;
  label: string;
}

export interface PlatformV7RoleNavItem extends PlatformV7ShellNavItem {
  note?: string;
}

export interface PlatformV7RoleNavigationEntry {
  home: string;
  bottom: PlatformV7RoleNavItem[];
  drawer: PlatformV7RoleNavItem[];
  command: PlatformV7RoleNavItem[];
  allowedPrefixes: string[];
}

function hash(home: string, id: string) {
  return `${home}#${id}`;
}

export const PLATFORM_V7_ROLE_ROUTES: Record<PlatformRole, string> = {
  operator: PLATFORM_V7_CONTROL_TOWER_ROUTE,
  buyer: PLATFORM_V7_BUYER_ROUTE,
  seller: PLATFORM_V7_SELLER_ROUTE,
  logistics: PLATFORM_V7_LOGISTICS_ROUTE,
  driver: PLATFORM_V7_DRIVER_FIELD_ROUTE,
  surveyor: PLATFORM_V7_SURVEYOR_ROUTE,
  elevator: PLATFORM_V7_ELEVATOR_ROUTE,
  lab: PLATFORM_V7_LAB_ROUTE,
  bank: PLATFORM_V7_BANK_CLEAN_ROUTE,
  arbitrator: PLATFORM_V7_ARBITRATOR_ROUTE,
  compliance: PLATFORM_V7_COMPLIANCE_ROUTE,
  executive: PLATFORM_V7_EXECUTIVE_ROUTE,
};

const ROLE_BLOCKED_PREFIXES = [
  PLATFORM_V7_ROLES_ROUTE,
  '/platform-v7r/roles',
  '/platform-v7/auth',
];

const SHARED_ROLE_PREFIXES = [
  PLATFORM_V7_AI_ROUTE,
  PLATFORM_V7_PROFILE_ROUTE,
  PLATFORM_V7_STATUS_ROUTE,
];

const CONTROL_ROLE_PREFIXES = [
  PLATFORM_V7_CONTROL_TOWER_ROUTE,
  PLATFORM_V7_DEALS_ROUTE,
  PLATFORM_V7_LOTS_ROUTE,
  PLATFORM_V7_PROCUREMENT_ROUTE,
  PLATFORM_V7_LOGISTICS_ROUTE,
  PLATFORM_V7_BANK_ROUTE,
  PLATFORM_V7_BANK_CLEAN_ROUTE,
  PLATFORM_V7_BANK_EVENTS_ROUTE,
  PLATFORM_V7_DISPUTES_ROUTE,
  PLATFORM_V7_COMPLIANCE_ROUTE,
  PLATFORM_V7_REPORTS_ROUTE,
  PLATFORM_V7_TRUST_ROUTE,
  PLATFORM_V7_EXECUTIVE_ROUTE,
];

export const PLATFORM_V7_ROLE_NAVIGATION: Record<PlatformRole, PlatformV7RoleNavigationEntry> = {
  operator: {
    home: PLATFORM_V7_CONTROL_TOWER_ROUTE,
    bottom: [
      { href: PLATFORM_V7_CONTROL_TOWER_ROUTE, label: 'Центр', note: 'Операционный контур' },
      { href: PLATFORM_V7_DEALS_ROUTE, label: 'Сделки', note: 'Реестр исполнения' },
      { href: hash(PLATFORM_V7_CONTROL_TOWER_ROUTE, 'blockers'), label: 'Блокеры', note: 'Причины остановки' },
      { href: PLATFORM_V7_OPERATOR_QUEUES_ROUTE, label: 'Очереди', note: 'Ручная обработка' },
      { href: PLATFORM_V7_COMPLIANCE_ROUTE, label: 'Контроль', note: 'Допуск и риски' },
    ],
    drawer: [
      { href: PLATFORM_V7_LOTS_ROUTE, label: 'Лоты и запросы', note: 'Предсделочный контур' },
      { href: PLATFORM_V7_PROCUREMENT_ROUTE, label: 'Закупки', note: 'Потребности и заявки' },
      { href: PLATFORM_V7_LOGISTICS_ROUTE, label: 'Логистика', note: 'Рейсы и отклонения' },
      { href: PLATFORM_V7_BANK_ROUTE, label: 'Деньги', note: 'Основания и удержания' },
      { href: PLATFORM_V7_DISPUTES_ROUTE, label: 'Споры', note: 'Доказательства и разбор' },
      { href: PLATFORM_V7_REPORTS_ROUTE, label: 'Отчёты', note: 'Контрольные срезы' },
    ],
    command: [],
    allowedPrefixes: [...CONTROL_ROLE_PREFIXES, PLATFORM_V7_OPERATOR_QUEUES_ROUTE],
  },
  buyer: {
    home: PLATFORM_V7_BUYER_ROUTE,
    bottom: [
      { href: PLATFORM_V7_BUYER_ROUTE, label: 'Кабинет', note: 'Статус закупки' },
      { href: PLATFORM_V7_PROCUREMENT_ROUTE, label: 'Закупки', note: 'Потребности' },
      { href: hash(PLATFORM_V7_BUYER_ROUTE, 'acceptance'), label: 'Приёмка', note: 'Вес и качество' },
      { href: hash(PLATFORM_V7_BUYER_ROUTE, 'money'), label: 'Деньги', note: 'Резерв и удержания' },
      { href: hash(PLATFORM_V7_BUYER_ROUTE, 'blockers'), label: 'Блокеры', note: 'Что остановило оплату' },
    ],
    drawer: [
      { href: hash(PLATFORM_V7_BUYER_ROUTE, 'reserve'), label: 'Резерв', note: 'Запрос и подтверждение' },
      { href: hash(PLATFORM_V7_BUYER_ROUTE, 'documents'), label: 'Документы', note: 'Пакет для исполнения' },
      { href: hash(PLATFORM_V7_BUYER_ROUTE, 'quality'), label: 'Качество', note: 'Отклонения и допуски' },
    ],
    command: [],
    allowedPrefixes: [PLATFORM_V7_BUYER_ROUTE, PLATFORM_V7_PROCUREMENT_ROUTE],
  },
  seller: {
    home: PLATFORM_V7_SELLER_ROUTE,
    bottom: [
      { href: PLATFORM_V7_SELLER_ROUTE, label: 'Кабинет', note: 'Статус продажи' },
      { href: hash(PLATFORM_V7_SELLER_ROUTE, 'parties'), label: 'Партии', note: 'Товар и допуск' },
      { href: hash(PLATFORM_V7_SELLER_ROUTE, 'documents'), label: 'Документы', note: 'СДИЗ и ЭТрН' },
      { href: hash(PLATFORM_V7_SELLER_ROUTE, 'money'), label: 'Деньги', note: 'Резерв и удержания' },
      { href: hash(PLATFORM_V7_SELLER_ROUTE, 'blockers'), label: 'Блокеры', note: 'Что мешает оплате' },
    ],
    drawer: [
      { href: hash(PLATFORM_V7_SELLER_ROUTE, 'offers'), label: 'Офферы', note: 'Условия продажи' },
      { href: hash(PLATFORM_V7_SELLER_ROUTE, 'fgis-epd'), label: 'СДИЗ / ЭТрН', note: 'Основание движения' },
      { href: hash(PLATFORM_V7_SELLER_ROUTE, 'acceptance'), label: 'Приёмка', note: 'Вес, качество, акт' },
    ],
    command: [],
    allowedPrefixes: [PLATFORM_V7_SELLER_ROUTE],
  },
  logistics: {
    home: PLATFORM_V7_LOGISTICS_ROUTE,
    bottom: [
      { href: PLATFORM_V7_LOGISTICS_ROUTE, label: 'Диспетчер', note: 'Статус рейсов' },
      { href: hash(PLATFORM_V7_LOGISTICS_ROUTE, 'routes'), label: 'Рейсы', note: 'Маршруты' },
      { href: hash(PLATFORM_V7_LOGISTICS_ROUTE, 'drivers'), label: 'Водители', note: 'Назначения' },
      { href: hash(PLATFORM_V7_LOGISTICS_ROUTE, 'documents'), label: 'Документы', note: 'ЭПД и пакет' },
      { href: hash(PLATFORM_V7_LOGISTICS_ROUTE, 'deviations'), label: 'Отклонения', note: 'Простои и геозоны' },
    ],
    drawer: [],
    command: [],
    allowedPrefixes: [PLATFORM_V7_LOGISTICS_ROUTE],
  },
  driver: {
    home: PLATFORM_V7_DRIVER_FIELD_ROUTE,
    bottom: [
      { href: PLATFORM_V7_DRIVER_FIELD_ROUTE, label: 'Рейс', note: 'Текущий рейс' },
      { href: hash(PLATFORM_V7_DRIVER_FIELD_ROUTE, 'route'), label: 'Маршрут', note: 'Следующая точка' },
      { href: hash(PLATFORM_V7_DRIVER_FIELD_ROUTE, 'photo'), label: 'Фото', note: 'Фиксация события' },
      { href: hash(PLATFORM_V7_DRIVER_FIELD_ROUTE, 'status'), label: 'Статус', note: 'Полевое событие' },
      { href: hash(PLATFORM_V7_DRIVER_FIELD_ROUTE, 'support'), label: 'Связь', note: 'Контакт по рейсу' },
    ],
    drawer: [],
    command: [],
    allowedPrefixes: [PLATFORM_V7_DRIVER_FIELD_ROUTE, '/platform-v7/driver'],
  },
  surveyor: {
    home: PLATFORM_V7_SURVEYOR_ROUTE,
    bottom: [
      { href: PLATFORM_V7_SURVEYOR_ROUTE, label: 'Осмотр', note: 'Назначение' },
      { href: hash(PLATFORM_V7_SURVEYOR_ROUTE, 'inspection'), label: 'Факты', note: 'Фиксация' },
      { href: hash(PLATFORM_V7_SURVEYOR_ROUTE, 'evidence'), label: 'Evidence', note: 'Фото, гео, время' },
      { href: hash(PLATFORM_V7_SURVEYOR_ROUTE, 'act'), label: 'Акт', note: 'Итог осмотра' },
    ],
    drawer: [],
    command: [],
    allowedPrefixes: [PLATFORM_V7_SURVEYOR_ROUTE],
  },
  elevator: {
    home: PLATFORM_V7_ELEVATOR_ROUTE,
    bottom: [
      { href: PLATFORM_V7_ELEVATOR_ROUTE, label: 'Приёмка', note: 'Въезд и статус' },
      { href: hash(PLATFORM_V7_ELEVATOR_ROUTE, 'queue'), label: 'Очередь', note: 'Назначение' },
      { href: hash(PLATFORM_V7_ELEVATOR_ROUTE, 'weight'), label: 'Вес', note: 'Брутто и нетто' },
      { href: hash(PLATFORM_V7_ELEVATOR_ROUTE, 'acts'), label: 'Акты', note: 'Документы' },
      { href: hash(PLATFORM_V7_ELEVATOR_ROUTE, 'discrepancy'), label: 'Расхождения', note: 'Вес и качество' },
    ],
    drawer: [],
    command: [],
    allowedPrefixes: [PLATFORM_V7_ELEVATOR_ROUTE],
  },
  lab: {
    home: PLATFORM_V7_LAB_ROUTE,
    bottom: [
      { href: PLATFORM_V7_LAB_ROUTE, label: 'Пробы', note: 'Очередь проб' },
      { href: hash(PLATFORM_V7_LAB_ROUTE, 'quality'), label: 'Качество', note: 'Показатели' },
      { href: hash(PLATFORM_V7_LAB_ROUTE, 'protocol'), label: 'Протокол', note: 'Основание' },
      { href: hash(PLATFORM_V7_LAB_ROUTE, 'delta'), label: 'Дельта', note: 'Допуск' },
      { href: hash(PLATFORM_V7_LAB_ROUTE, 'dispute'), label: 'Спорность', note: 'Повторный анализ' },
    ],
    drawer: [],
    command: [],
    allowedPrefixes: [PLATFORM_V7_LAB_ROUTE],
  },
  bank: {
    home: PLATFORM_V7_BANK_CLEAN_ROUTE,
    bottom: [
      { href: PLATFORM_V7_BANK_CLEAN_ROUTE, label: 'Основание', note: 'Пакет проверки' },
      { href: hash(PLATFORM_V7_BANK_CLEAN_ROUTE, 'documents'), label: 'Документы', note: 'СДИЗ, ЭПД, акты' },
      { href: hash(PLATFORM_V7_BANK_CLEAN_ROUTE, 'risks'), label: 'Риски', note: 'Стоп-факторы' },
      { href: hash(PLATFORM_V7_BANK_CLEAN_ROUTE, 'holds'), label: 'Удержания', note: 'Спорная часть' },
      { href: PLATFORM_V7_BANK_EVENTS_ROUTE, label: 'События', note: 'Журнал банка' },
    ],
    drawer: [
      { href: PLATFORM_V7_BANK_FACTORING_ROUTE, label: 'Факторинг', note: 'Заявка и проверка' },
      { href: PLATFORM_V7_BANK_ESCROW_ROUTE, label: 'Эскроу', note: 'Условия удержания' },
      { href: PLATFORM_V7_BANK_PAYMENT_BASIS_ROUTE, label: 'Платёжное основание', note: 'Проверка оплаты' },
    ],
    command: [],
    allowedPrefixes: [PLATFORM_V7_BANK_ROUTE, PLATFORM_V7_BANK_CLEAN_ROUTE, PLATFORM_V7_BANK_EVENTS_ROUTE, PLATFORM_V7_BANK_FACTORING_ROUTE, PLATFORM_V7_BANK_ESCROW_ROUTE, PLATFORM_V7_BANK_PAYMENT_BASIS_ROUTE],
  },
  arbitrator: {
    home: PLATFORM_V7_ARBITRATOR_ROUTE,
    bottom: [
      { href: PLATFORM_V7_ARBITRATOR_ROUTE, label: 'Споры', note: 'Очередь разбора' },
      { href: hash(PLATFORM_V7_ARBITRATOR_ROUTE, 'evidence'), label: 'Evidence', note: 'Доказательства' },
      { href: hash(PLATFORM_V7_ARBITRATOR_ROUTE, 'positions'), label: 'Позиции', note: 'Стороны' },
      { href: hash(PLATFORM_V7_ARBITRATOR_ROUTE, 'decision'), label: 'Решение', note: 'Основание' },
      { href: hash(PLATFORM_V7_ARBITRATOR_ROUTE, 'money'), label: 'Деньги', note: 'Финансовый эффект' },
    ],
    drawer: [],
    command: [],
    allowedPrefixes: [PLATFORM_V7_ARBITRATOR_ROUTE],
  },
  compliance: {
    home: PLATFORM_V7_COMPLIANCE_ROUTE,
    bottom: [
      { href: PLATFORM_V7_COMPLIANCE_ROUTE, label: 'Допуск', note: 'Статус участника' },
      { href: hash(PLATFORM_V7_COMPLIANCE_ROUTE, 'documents'), label: 'Документы', note: 'Пакет проверки' },
      { href: hash(PLATFORM_V7_COMPLIANCE_ROUTE, 'risks'), label: 'Риски', note: 'Стоп-факторы' },
      { href: hash(PLATFORM_V7_COMPLIANCE_ROUTE, 'blockers'), label: 'Блокеры', note: 'Причина стопа' },
      { href: hash(PLATFORM_V7_COMPLIANCE_ROUTE, 'review'), label: 'Проверка', note: 'Ручной шаг' },
    ],
    drawer: [],
    command: [],
    allowedPrefixes: [PLATFORM_V7_COMPLIANCE_ROUTE],
  },
  executive: {
    home: PLATFORM_V7_EXECUTIVE_ROUTE,
    bottom: [
      { href: PLATFORM_V7_EXECUTIVE_ROUTE, label: 'Сводка', note: 'Портфель' },
      { href: hash(PLATFORM_V7_EXECUTIVE_ROUTE, 'money'), label: 'Деньги', note: 'Риск и удержания' },
      { href: hash(PLATFORM_V7_EXECUTIVE_ROUTE, 'blockers'), label: 'Блокеры', note: 'Главные стопы' },
      { href: PLATFORM_V7_REPORTS_ROUTE, label: 'Отчёты', note: 'Срезы' },
      { href: hash(PLATFORM_V7_EXECUTIVE_ROUTE, 'risks'), label: 'Риски', note: 'Карта угроз' },
    ],
    drawer: [
      { href: PLATFORM_V7_CONTROL_TOWER_ROUTE, label: 'Центр управления', note: 'Операционная картина' },
      { href: PLATFORM_V7_DEALS_ROUTE, label: 'Сделки', note: 'Реестр исполнения' },
      { href: PLATFORM_V7_BANK_ROUTE, label: 'Деньги банка', note: 'Основания и удержания' },
      { href: PLATFORM_V7_DISPUTES_ROUTE, label: 'Споры', note: 'Разбор и доказательства' },
    ],
    command: [],
    allowedPrefixes: [...CONTROL_ROLE_PREFIXES],
  },
};

for (const role of Object.keys(PLATFORM_V7_ROLE_NAVIGATION) as PlatformRole[]) {
  const entry = PLATFORM_V7_ROLE_NAVIGATION[role];
  entry.command = [...entry.bottom, ...entry.drawer];
}

function normalizeHref(href: string) {
  return href.split('?')[0].split('#')[0].replace(/\/$/, '') || '/platform-v7';
}

function hrefMatchesPrefix(href: string, prefix: string) {
  const normalizedHref = normalizeHref(href);
  const normalizedPrefix = normalizeHref(prefix);
  return normalizedHref === normalizedPrefix || normalizedHref.startsWith(`${normalizedPrefix}/`);
}

export function platformV7RoleRoute(role: PlatformRole): PlatformV7ShellRouteSurface {
  return PLATFORM_V7_ROLE_ROUTES[role] as PlatformV7ShellRouteSurface;
}

export function platformV7NavByRole(role: PlatformRole): PlatformV7ShellNavItem[] {
  return PLATFORM_V7_ROLE_NAVIGATION[role].bottom;
}

export function platformV7DrawerNavByRole(role: PlatformRole): PlatformV7RoleNavItem[] {
  return PLATFORM_V7_ROLE_NAVIGATION[role].drawer;
}

export function platformV7CommandNavByRole(role: PlatformRole): PlatformV7RoleNavItem[] {
  return PLATFORM_V7_ROLE_NAVIGATION[role].command;
}

export function platformV7RoleCanOpenHref(role: PlatformRole, href: string) {
  const path = normalizeHref(href);
  if (ROLE_BLOCKED_PREFIXES.some((prefix) => hrefMatchesPrefix(path, prefix))) return false;
  if (SHARED_ROLE_PREFIXES.some((prefix) => hrefMatchesPrefix(path, prefix))) return true;
  const entry = PLATFORM_V7_ROLE_NAVIGATION[role];
  return entry.allowedPrefixes.some((prefix) => hrefMatchesPrefix(path, prefix));
}

export function platformV7ShellRouteSurface(): readonly PlatformV7ShellRouteSurface[] {
  return PLATFORM_V7_SHELL_ROUTE_SURFACE;
}
