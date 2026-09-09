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
  providerId: string;
  name: string;
  category: ServiceProviderCategory;
  region?: string;
  regions?: string[];
  cultures?: string[];
  stages?: ServiceProviderStage[];
  evidenceMaturity: 'VERIFIED' | 'MANUAL_REVIEW';
  notes?: string[];
};

function includesNormalized(values: readonly string[] | undefined, target: string | undefined): boolean {
  if (!target?.trim() || !values?.length) return false;
  const normalized = target.trim().toLocaleLowerCase('ru-RU');
  return values.some((value) => value.trim().toLocaleLowerCase('ru-RU') === normalized);
}

function buildWhy(entry: ServiceProviderEntry, context: ProviderSelectionContext): string[] {
  const reasons = ['категория подтверждена реестром'];
  if (entry.evidenceMaturity === 'VERIFIED') reasons.push('обязательные evidence подтверждены');
  if (includesNormalized(entry.regions, context.region)) reasons.push(`регион: ${context.region}`);
  if (includesNormalized(entry.cultures, context.culture)) reasons.push(`культура: ${context.culture}`);
  return reasons;
}

function buildWarnings(entry: ServiceProviderEntry, context: ProviderSelectionContext): string[] {
  const warnings: string[] = [];
  if (entry.evidenceMaturity === 'MANUAL_REVIEW') warnings.push('требуется ручная проверка evidence');
  if (context.region && entry.regions?.length && !includesNormalized(entry.regions, context.region)) {
    warnings.push(`регион ${context.region} не указан в покрытии`);
  }
  if (context.culture && entry.cultures?.length && !includesNormalized(entry.cultures, context.culture)) {
    warnings.push(`культура ${context.culture} не указана в предложении`);
  }
  return warnings;
}

function scoreProvider(entry: ServiceProviderEntry, context: ProviderSelectionContext): number {
  // The score is a transparent coverage match, never a provider quality claim.
  // 50 = verified category, 20 = server-held evidence maturity,
  // 20 = requested region, 10 = requested culture.
  let score = 50;
  if (entry.evidenceMaturity === 'VERIFIED') score += 20;
  if (!context.region || includesNormalized(entry.regions, context.region)) score += 20;
  if (!context.culture || includesNormalized(entry.cultures, context.culture)) score += 10;
  return score;
}

export function listServiceProviders(
  entries: readonly ServiceProviderEntry[],
  category?: ServiceProviderCategory,
): ServiceProviderEntry[] {
  const filtered = category ? entries.filter((entry) => entry.category === category) : entries;
  return [...filtered].sort((left, right) =>
    left.name.localeCompare(right.name, 'ru') || left.id.localeCompare(right.id));
}

export function buildProviderSelection(
  category: ServiceProviderCategory,
  context: ProviderSelectionContext,
  entries: readonly ServiceProviderEntry[],
): { selection: ProviderSelection; category: ServiceProviderCategory; strategy: string; overridePolicy: string; fallbackPolicy: string } {
  const candidates = entries.filter((entry) => entry.category === category);
  const ranked: ProviderRankedItem[] = candidates
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      score: scoreProvider(entry, context),
      region: entry.region,
      why: buildWhy(entry, context),
      warnings: buildWarnings(entry, context),
    }))
    .sort((left, right) =>
      right.score - left.score
      || left.name.localeCompare(right.name, 'ru')
      || left.id.localeCompare(right.id));

  return {
    category,
    selection: {
      recommended: ranked[0] ?? null,
      ranked,
    },
    strategy: 'durable-coverage-match-v1',
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
  entries: readonly ServiceProviderEntry[],
): ProviderStagePlan {
  const categories = STAGE_CATEGORY_MAP[stage] ?? [];
  const items: ProviderCategoryPlan[] = categories.map((category) => {
    const stageCandidates = entries.filter((entry) =>
      !entry.stages?.length || entry.stages.includes(stage));
    const result = buildProviderSelection(category, context, stageCandidates);
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

export function buildProviderCategorySummary(
  entries: readonly ServiceProviderEntry[],
): { category: ServiceProviderCategory; count: number }[] {
  const categories: ServiceProviderCategory[] = ['LOGISTICS', 'INSURANCE', 'LAB', 'SURVEY', 'ELEVATOR', 'PORT', 'RAIL', 'BANK'];
  return categories.map((category) => ({
    category,
    count: entries.filter((entry) => entry.category === category).length,
  }));
}
