/**
 * Critical platform-v7 routes for visual and smoke regression tests.
 *
 * Rules:
 *   - Only routes confirmed to exist on current main.
 *   - No invented or future routes.
 *   - No /demo routes (demo paths are excluded from production visual regression).
 *   - No /landing routes (landing is a separate app — apps/landing).
 *   - Priority covers routes with stacked operational strips (the densest UI).
 *
 * Update procedure:
 *   - When a new route is added to apps/web/app/platform-v7 and confirmed on main,
 *     add it here and update the test that checks ROUTE_COUNT.
 *   - When a route is removed from main, remove it here.
 *   - All metadata strings must avoid production-ready / live / bypass-impossible claims.
 */

export type VisualRegressionPriority = 'critical' | 'high' | 'standard';

export interface VisualRegressionRoute {
  readonly path: string;
  readonly label: string;
  readonly priority: VisualRegressionPriority;
  readonly hasStackedStrips: boolean;
  readonly pilotNote: string;
}

export const VISUAL_REGRESSION_ROUTES: readonly VisualRegressionRoute[] = [
  {
    path: '/platform-v7',
    label: 'платформа · главная',
    priority: 'critical',
    hasStackedStrips: true,
    pilotNote: 'пилотный контур · точка входа — содержит навигацию и обзор контуров',
  },
  {
    path: '/platform-v7/seller',
    label: 'кабинет продавца',
    priority: 'critical',
    hasStackedStrips: true,
    pilotNote: 'пилотный контур · лоты, предложения, документы, выплата',
  },
  {
    path: '/platform-v7/buyer',
    label: 'кабинет покупателя',
    priority: 'critical',
    hasStackedStrips: true,
    pilotNote: 'пилотный контур · запросы, партии, резерв денег',
  },
  {
    path: '/platform-v7/bank',
    label: 'кабинет банка',
    priority: 'critical',
    hasStackedStrips: true,
    pilotNote: 'пилотный контур · деньги, удержание, проверка условий выплаты',
  },
  {
    path: '/platform-v7/disputes',
    label: 'споры и удержания',
    priority: 'critical',
    hasStackedStrips: true,
    pilotNote: 'пилотный контур · споры, доказательства, решения по удержанию',
  },
  {
    path: '/platform-v7/control-tower',
    label: 'центр управления',
    priority: 'critical',
    hasStackedStrips: true,
    pilotNote: 'пилотный контур · операторский экран с деньгами, причинами и блокерами',
  },
  {
    path: '/platform-v7/operator',
    label: 'кабинет оператора',
    priority: 'high',
    hasStackedStrips: true,
    pilotNote: 'пилотный контур · блокеры, деньги под влиянием, ответственный',
  },
  {
    path: '/platform-v7/elevator',
    label: 'элеватор · приёмка',
    priority: 'high',
    hasStackedStrips: true,
    pilotNote: 'пилотный контур · вес, качество, акт приёмки',
  },
  {
    path: '/platform-v7/driver/field',
    label: 'полевой режим · водитель',
    priority: 'high',
    hasStackedStrips: false,
    pilotNote: 'пилотный контур · рейс, ЭТрН, доставка',
  },
];

export const CRITICAL_ROUTES = VISUAL_REGRESSION_ROUTES.filter(
  (r) => r.priority === 'critical',
);

export const STACKED_STRIP_ROUTES = VISUAL_REGRESSION_ROUTES.filter(
  (r) => r.hasStackedStrips,
);

export function getRouteByPath(path: string): VisualRegressionRoute | undefined {
  return VISUAL_REGRESSION_ROUTES.find((r) => r.path === path);
}

export const FORBIDDEN_ROUTE_PATTERNS = [
  '/platform-v7/demo',
  '/landing',
  '/platform-v7/landing',
] as const;
