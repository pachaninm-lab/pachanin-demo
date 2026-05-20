/**
 * Platform-v7 routes manifest — baseline snapshot for harness and navigation.
 * Critical routes are tested in e2e/platform-v7-polish-matrix.spec.ts.
 */
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

export interface RouteEntry {
  path: string;
  label: string;
  roles: readonly PlatformRole[];
  critical: boolean;
}

export const PLATFORM_V7_ROUTES_MANIFEST: readonly RouteEntry[] = [
  // ── Operator / Control ──
  { path: '/platform-v7/control-tower', label: 'Центр управления', roles: ['operator', 'executive'], critical: true },
  { path: '/platform-v7/deals', label: 'Реестр сделок', roles: ['operator', 'buyer', 'seller', 'elevator', 'executive'], critical: true },
  { path: '/platform-v7/lots', label: 'Лоты и RFQ', roles: ['operator', 'buyer', 'seller'], critical: false },
  { path: '/platform-v7/money', label: 'Денежный контур', roles: ['operator', 'executive'], critical: false },
  { path: '/platform-v7/documents', label: 'Документы', roles: ['operator', 'buyer', 'seller', 'compliance'], critical: false },
  { path: '/platform-v7/disputes', label: 'Споры', roles: ['operator', 'arbitrator', 'surveyor'], critical: true },
  { path: '/platform-v7/executive', label: 'Управленческий срез', roles: ['executive', 'operator'], critical: false },
  { path: '/platform-v7/analytics', label: 'Аналитика', roles: ['operator', 'executive'], critical: false },

  // ── Role homescreens ──
  { path: '/platform-v7/buyer', label: 'Кабинет покупателя', roles: ['buyer'], critical: true },
  { path: '/platform-v7/seller', label: 'Кабинет продавца', roles: ['seller'], critical: false },
  { path: '/platform-v7/logistics', label: 'Диспетчерская', roles: ['logistics'], critical: false },
  { path: '/platform-v7/driver', label: 'Маршрут водителя', roles: ['driver'], critical: true },
  { path: '/platform-v7/surveyor', label: 'Кабинет сюрвейера', roles: ['surveyor'], critical: false },
  { path: '/platform-v7/elevator', label: 'Приёмка', roles: ['elevator'], critical: false },
  { path: '/platform-v7/lab', label: 'Лаборатория', roles: ['lab'], critical: false },
  { path: '/platform-v7/bank', label: 'Кабинет банка', roles: ['bank', 'operator'], critical: true },
  { path: '/platform-v7/arbitrator', label: 'Кабинет арбитра', roles: ['arbitrator'], critical: false },
  { path: '/platform-v7/compliance', label: 'Комплаенс', roles: ['compliance'], critical: false },

  // ── Bank sub-routes ──
  { path: '/platform-v7/bank/release-safety', label: 'Проверка выплаты', roles: ['bank', 'operator'], critical: true },
  { path: '/platform-v7/bank/escrow', label: 'Эскроу', roles: ['bank'], critical: false },
  { path: '/platform-v7/bank/factoring', label: 'Факторинг', roles: ['bank'], critical: false },
  { path: '/platform-v7/bank/payment-basis', label: 'Основание платежа', roles: ['bank', 'operator'], critical: false },

  // ── Deal sub-routes (DL-9106 as example) ──
  { path: '/platform-v7/deals/DL-9106/clean', label: 'Карточка DL-9106', roles: ['operator', 'buyer', 'seller', 'bank', 'arbitrator'], critical: false },
  { path: '/platform-v7/deals/DL-9106/documents', label: 'Документы DL-9106', roles: ['operator', 'buyer', 'seller', 'compliance'], critical: false },
  { path: '/platform-v7/deals/DL-9106/logistics', label: 'Логистика DL-9106', roles: ['operator', 'logistics'], critical: false },
  { path: '/platform-v7/deals/DL-9106/money', label: 'Деньги DL-9106', roles: ['operator', 'bank', 'buyer', 'seller'], critical: false },
  { path: '/platform-v7/deals/DL-9106/disputes', label: 'Споры DL-9106', roles: ['operator', 'arbitrator'], critical: false },

  // ── Field routes ──
  { path: '/platform-v7/driver/field', label: 'Поле водителя', roles: ['driver'], critical: false },
  { path: '/platform-v7/surveyor/acts/QC-DL-9102', label: 'Акт сюрвейера QC-DL-9102', roles: ['surveyor'], critical: false },

  // ── System ──
  { path: '/platform-v7/field', label: 'Полевой контур', roles: ['operator'], critical: true },
  { path: '/platform-v7/connectors', label: 'Подключения (ФГИС, ЭДО)', roles: ['operator', 'compliance'], critical: false },
  { path: '/platform-v7/readiness', label: 'Готовность сделки', roles: ['operator', 'seller', 'buyer'], critical: false },
  { path: '/platform-v7/anti-bypass', label: 'Анти-обход', roles: ['operator', 'compliance'], critical: false },
] as const;

/** Routes tested in the e2e matrix (§D harness). */
export const CRITICAL_ROUTES = PLATFORM_V7_ROUTES_MANIFEST
  .filter((r) => r.critical)
  .map((r) => r.path);

/** All distinct roles referenced in the manifest. */
export const MANIFEST_ROLES: PlatformRole[] = [
  'operator', 'buyer', 'seller', 'logistics', 'driver',
  'surveyor', 'elevator', 'lab', 'bank', 'arbitrator', 'compliance', 'executive',
];
