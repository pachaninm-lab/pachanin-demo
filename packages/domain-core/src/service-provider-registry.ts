// Service Provider Registry
// Defines types and functions for selecting and evaluating service providers
// across all deal stages (dispatch, lab, receiving, export, payment).

export type ServiceProviderCategory =
  | 'LOGISTICS'
  | 'INSURANCE'
  | 'LAB'
  | 'SURVEY'
  | 'ELEVATOR'
  | 'PORT'
  | 'RAIL'
  | 'BANK';

export type ServiceProviderStage =
  | 'DISPATCH'
  | 'LAB'
  | 'RECEIVING'
  | 'EXPORT'
  | 'PAYMENT';

export type ProviderSelectionContext = {
  region?: string;
  culture?: string;
  pilotMode?: boolean;
  exportFlow?: boolean;
  disputeSensitive?: boolean;
  requiresEpd?: boolean;
  requiresGpsEvidence?: boolean;
  needPortLink?: boolean;
  needRailLink?: boolean;
  docsReady?: boolean;
  targetHours?: number;
  urgency?: 'LOW' | 'MEDIUM' | 'HIGH';
  amountRub?: number;
  [key: string]: unknown;
};

export type ProviderRankedItem = {
  id: string;
  name: string;
  score: number;
  region?: string;
  why?: string[];
  warnings?: string[];
};

export type ProviderSelection = {
  recommended: ProviderRankedItem | null;
  ranked: ProviderRankedItem[];
  strategy?: string;
};

export type ProviderCategoryPlan = {
  category: ServiceProviderCategory;
  selection: ProviderSelection;
  strategy: string;
  overridePolicy: string;
  fallbackPolicy: string;
};

export type ProviderStagePlan = {
  stage: ServiceProviderStage;
  items: ProviderCategoryPlan[];
};

export type ServiceProviderEntry = {
  id: string;
  name: string;
  category: ServiceProviderCategory;
  region?: string;
  score: number;
  pilotReady: boolean;
  notes?: string[];
};

// Static seed catalog — used for pilot / demo / offline mode.
// Live integrations replace this via GosLog, lab accreditation APIs, and bank whitelist.
const PROVIDER_CATALOG: ServiceProviderEntry[] = [
  // LOGISTICS
  { id: 'prov-log-1', name: 'ТамбовЛогистик', category: 'LOGISTICS', region: 'Тамбовская обл.', score: 87, pilotReady: true, notes: ['Реестр ГосЛог не подключён — ручной контроль'] },
  { id: 'prov-log-2', name: 'ЦЧР АгроТранс', category: 'LOGISTICS', region: 'ЦФО', score: 79, pilotReady: true, notes: ['Interregional, доступен по ЦФО'] },
  // INSURANCE
  { id: 'prov-ins-1', name: 'АгроСтрах', category: 'INSURANCE', region: 'Федеральный', score: 83, pilotReady: true },
  // LAB
  { id: 'prov-lab-1', name: 'ЦентрЗерно', category: 'LAB', region: 'Тамбовская обл.', score: 91, pilotReady: true, notes: ['Аккредитован ГОСТ Р'] },
  { id: 'prov-lab-2', name: 'ФедЛаб', category: 'LAB', region: 'Федеральный', score: 85, pilotReady: false, notes: ['Sandbox-only: live EDO не подключён'] },
  // SURVEY
  { id: 'prov-srv-1', name: 'АгроИнспект', category: 'SURVEY', region: 'ЦФО', score: 88, pilotReady: true, notes: ['Спорный / экспортный контур'] },
  // ELEVATOR
  { id: 'prov-elv-1', name: 'ТамбовЭлеватор', category: 'ELEVATOR', region: 'Тамбовская обл.', score: 90, pilotReady: true },
  { id: 'prov-elv-2', name: 'ЦЧР-Хранение', category: 'ELEVATOR', region: 'ЦФО', score: 76, pilotReady: true },
  // PORT
  { id: 'prov-port-1', name: 'НовороссийскТерминал', category: 'PORT', region: 'Краснодарский кр.', score: 82, pilotReady: false, notes: ['Требует live-интеграции с ГосЛог'] },
  // RAIL
  { id: 'prov-rail-1', name: 'РЖД-Агро', category: 'RAIL', region: 'Федеральный', score: 80, pilotReady: false, notes: ['Sandbox-only'] },
  // BANK
  { id: 'prov-bank-sber', name: 'СберБизнес', category: 'BANK', region: 'Федеральный', score: 95, pilotReady: true, notes: ['Основной банк пилота'] },
];

function scoreProvider(entry: ServiceProviderEntry, context: ProviderSelectionContext): number {
  let score = entry.score;
  if (context.pilotMode && !entry.pilotReady) score -= 30;
  if (context.exportFlow && (entry.category === 'PORT' || entry.category === 'RAIL')) score += 5;
  if (context.disputeSensitive && entry.category === 'LAB') score += 5;
  if (context.urgency === 'HIGH') score += entry.pilotReady ? 3 : -10;
  if (context.region && entry.region && entry.region.toLowerCase().includes(context.region.toLowerCase())) score += 8;
  return Math.max(0, Math.min(100, score));
}

function buildWhy(entry: ServiceProviderEntry, context: ProviderSelectionContext): string[] {
  const reasons: string[] = [];
  if (entry.pilotReady) reasons.push('pilot-ready');
  if (context.disputeSensitive && entry.category === 'LAB') reasons.push('dispute-sensitive');
  if (context.exportFlow && (entry.category === 'PORT' || entry.category === 'RAIL')) reasons.push('export-flow');
  if (context.region && entry.region?.toLowerCase().includes(context.region.toLowerCase())) reasons.push(`регион: ${entry.region}`);
  return reasons;
}

function buildWarnings(entry: ServiceProviderEntry, context: ProviderSelectionContext): string[] {
  const warnings: string[] = [];
  if (!entry.pilotReady) warnings.push('не готов к пилоту — sandbox/manual');
  if (entry.notes?.some((n) => n.includes('не подключён'))) warnings.push('live-интеграция отсутствует');
  if (context.requiresGpsEvidence && entry.category === 'LOGISTICS' && !entry.pilotReady) warnings.push('GPS-evidence недоступно');
  return warnings;
}

export function listServiceProviders(category?: ServiceProviderCategory): ServiceProviderEntry[] {
  if (category) return PROVIDER_CATALOG.filter((p) => p.category === category);
  return PROVIDER_CATALOG;
}

export function buildProviderSelection(
  category: ServiceProviderCategory,
  context: ProviderSelectionContext,
): { selection: ProviderSelection; category: ServiceProviderCategory; strategy: string; overridePolicy: string; fallbackPolicy: string } {
  const candidates = PROVIDER_CATALOG.filter((p) => p.category === category);
  const ranked: ProviderRankedItem[] = candidates
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      score: scoreProvider(entry, context),
      region: entry.region,
      why: buildWhy(entry, context),
      warnings: buildWarnings(entry, context),
    }))
    .sort((a, b) => b.score - a.score);

  return {
    category,
    selection: {
      recommended: ranked[0] ?? null,
      ranked,
    },
    strategy: context.pilotMode ? 'pilot-manual' : 'auto-rank',
    overridePolicy: 'controlled',
    fallbackPolicy: 'manual review',
  };
}

const STAGE_CATEGORY_MAP: Record<ServiceProviderStage, ServiceProviderCategory[]> = {
  DISPATCH: ['LOGISTICS', 'INSURANCE'],
  LAB: ['LAB', 'SURVEY'],
  RECEIVING: ['ELEVATOR', 'PORT'],
  EXPORT: ['PORT', 'RAIL', 'SURVEY', 'INSURANCE'],
  PAYMENT: ['BANK'],
};

export function buildProviderStagePlan(
  stage: ServiceProviderStage,
  context: ProviderSelectionContext,
): ProviderStagePlan {
  const categories = STAGE_CATEGORY_MAP[stage] ?? [];
  const items: ProviderCategoryPlan[] = categories.map((category) => {
    const result = buildProviderSelection(category, context);
    return {
      category,
      selection: result.selection,
      strategy: result.strategy,
      overridePolicy: result.overridePolicy,
      fallbackPolicy: result.fallbackPolicy,
    };
  });
  return { stage, items };
}

export function buildProviderCategorySummary(): { category: ServiceProviderCategory; count: number }[] {
  const categories: ServiceProviderCategory[] = ['LOGISTICS', 'INSURANCE', 'LAB', 'SURVEY', 'ELEVATOR', 'PORT', 'RAIL', 'BANK'];
  return categories.map((category) => ({
    category,
    count: PROVIDER_CATALOG.filter((p) => p.category === category).length,
  }));
}
