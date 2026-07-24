import type {
  CommodityProfileRegistryAction,
  CommodityProfileRegistryRecord,
} from './CommodityProfileRegistryView';
import type {
  CommodityArchetype,
  CommodityProfileState,
  LocalizedDisplay,
} from '../../../../packages/domain-core/src/commodity-profile';

export type CommodityProfileLocale = 'ru' | 'en' | 'zh';

export type ParsedCommodityProfilePage = Readonly<{
  items: CommodityProfileRegistryRecord[];
  nextCursor: string | null;
}>;

export type ParsedCommodityProfileHistory = Readonly<{
  profileId: string;
  aggregateVersion: string;
  trail: CommodityProfileRegistryRecord['approvalTrail'];
  nextCursor: string | null;
}>;

const ARCHETYPES = new Set<CommodityArchetype>([
  'DRY_BULK',
  'SEED_PLANTING',
  'ROOT_INDUSTRIAL',
  'FRESH_PACKED',
  'GREENHOUSE_RECURRING',
  'ORGANIC_EXPORT_QUARANTINE',
]);
const STATES = new Set<CommodityProfileState>([
  'DRAFT',
  'REVIEW',
  'APPROVED',
  'EFFECTIVE',
  'DEPRECATED',
  'REVOKED',
]);
const SOURCE_STATUSES = new Set([
  'VERIFIED',
  'REVERIFY_REQUIRED',
  'BLOCKED_EXTERNAL',
]);
const BLENDING_MODES = new Set(['ALLOWED', 'PROHIBITED', 'CONTROLLED']);
const IMPACTS = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const OWNERS = new Set(['OPERATOR', 'COMPLIANCE', 'PLATFORM_ADMIN']);
const SHA256 = /^[a-f0-9]{64}$/;
const INTEGER_STRING = /^(0|[1-9][0-9]{0,18})$/;

const ACTION_LABELS: Record<CommodityProfileLocale, Record<string, string>> = {
  ru: {
    UPDATE_DRAFT: 'Продолжить редактирование',
    SUBMIT_REVIEW: 'Передать на согласование',
    APPROVE: 'Утвердить версию',
    ACTIVATE: 'Ввести версию в действие',
    DEPRECATE: 'Заменить действующую версию',
    REVOKE: 'Отозвать версию',
  },
  en: {
    UPDATE_DRAFT: 'Continue editing',
    SUBMIT_REVIEW: 'Submit for review',
    APPROVE: 'Approve version',
    ACTIVATE: 'Activate version',
    DEPRECATE: 'Deprecate version',
    REVOKE: 'Revoke version',
  },
  zh: {
    UPDATE_DRAFT: '继续编辑',
    SUBMIT_REVIEW: '提交审核',
    APPROVE: '批准版本',
    ACTIVATE: '启用版本',
    DEPRECATE: '替代版本',
    REVOKE: '撤销版本',
  },
};

const REASON_LABELS: Record<CommodityProfileLocale, Record<string, string>> = {
  ru: {
    ALLOWED: 'Действие разрешено серверной политикой.',
    AUTH_CONTEXT_INCOMPLETE: 'Сервер не подтвердил полный контекст пользователя.',
    ROLE_READ_ONLY: 'Текущая роль имеет доступ только для чтения.',
    STAFF_AUTHORITY_REQUIRED: 'Нужна активная служебная роль управления профилями.',
    MFA_REQUIRED: 'Нужно повторно подтвердить многофакторную аутентификацию.',
    JIT_AUTHORITY_REQUIRED: 'Нужно временное JIT-полномочие.',
    HUMAN_REASON_REQUIRED: 'Нужно указать обоснование операции.',
    CLASSIFICATION_DENIED: 'Классификация профиля не допускает доступ этой роли.',
    INVALID_LIFECYCLE_ACTION: 'Действие недоступно на текущем этапе.',
  },
  en: {
    ALLOWED: 'The server policy allows this action.',
    AUTH_CONTEXT_INCOMPLETE: 'The server could not confirm the full user context.',
    ROLE_READ_ONLY: 'The current role has read-only access.',
    STAFF_AUTHORITY_REQUIRED: 'An active commodity-profile staff authority is required.',
    MFA_REQUIRED: 'Multi-factor authentication must be confirmed again.',
    JIT_AUTHORITY_REQUIRED: 'A time-bound JIT authority is required.',
    HUMAN_REASON_REQUIRED: 'A human reason is required.',
    CLASSIFICATION_DENIED: 'The profile classification denies access to this role.',
    INVALID_LIFECYCLE_ACTION: 'The action is unavailable at the current lifecycle stage.',
  },
  zh: {
    ALLOWED: '服务器策略允许此操作。',
    AUTH_CONTEXT_INCOMPLETE: '服务器无法确认完整的用户上下文。',
    ROLE_READ_ONLY: '当前角色只有读取权限。',
    STAFF_AUTHORITY_REQUIRED: '需要有效的商品配置管理权限。',
    MFA_REQUIRED: '需要重新确认多因素认证。',
    JIT_AUTHORITY_REQUIRED: '需要有时限的 JIT 权限。',
    HUMAN_REASON_REQUIRED: '需要填写人工操作理由。',
    CLASSIFICATION_DENIED: '配置的数据分类不允许该角色访问。',
    INVALID_LIFECYCLE_ACTION: '当前生命周期阶段不允许此操作。',
  },
};

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function requiredString(source: JsonRecord, field: string, max = 500): string | null {
  const value = source[field];
  return typeof value === 'string' && value.length > 0 && value.length <= max
    ? value
    : null;
}

function optionalString(source: JsonRecord, field: string, max = 500): string | null | undefined {
  const value = source[field];
  if (value === null || value === undefined || value === '') return null;
  return typeof value === 'string' && value.length <= max ? value : undefined;
}

function stringArray(value: unknown, maxItems = 500): string[] | null {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !item || item.length > 500) return null;
    result.push(item);
  }
  return result;
}

function localized(value: unknown, fallback: LocalizedDisplay): LocalizedDisplay | null {
  if (value === undefined || value === null) return fallback;
  const source = record(value);
  if (!source) return null;
  const ru = requiredString(source, 'ru');
  const en = optionalString(source, 'en');
  const zh = optionalString(source, 'zh');
  if (!ru || en === undefined || zh === undefined) return null;
  return {
    ru,
    ...(en ? { en } : {}),
    ...(zh ? { zh } : {}),
  };
}

function range(minimum: unknown, maximum: unknown): string | undefined {
  const min = typeof minimum === 'string' && minimum ? minimum : null;
  const max = typeof maximum === 'string' && maximum ? maximum : null;
  if (min && max) return `${min}–${max}`;
  return min ?? max ?? undefined;
}

function parsePrimaryAction(value: unknown, locale: CommodityProfileLocale): CommodityProfileRegistryAction | undefined | null {
  if (value === null || value === undefined) return undefined;
  const source = record(value);
  if (!source) return null;
  const id = requiredString(source, 'id', 80);
  const reasonCode = requiredString(source, 'reasonCode', 80);
  const allowed = source.allowed;
  const requiresConfirmation = source.requiresConfirmation;
  const owner = requiredString(source, 'owner', 80);
  const impact = requiredString(source, 'impact', 80);
  if (
    !id || !reasonCode || typeof allowed !== 'boolean'
    || typeof requiresConfirmation !== 'boolean'
    || !owner || !OWNERS.has(owner)
    || !impact || !IMPACTS.has(impact)
  ) return null;
  const reason = REASON_LABELS[locale][reasonCode] ?? reasonCode;
  return {
    code: id,
    label: ACTION_LABELS[locale][id] ?? id,
    reason: allowed ? reason : undefined,
    disabledReason: allowed ? undefined : reason,
    impact,
    owner,
    requiresConfirmation,
    disabled: !allowed,
  };
}

function parseContent(
  value: unknown,
  fallbackDisplay: LocalizedDisplay,
): Omit<CommodityProfileRegistryRecord,
  'id' | 'canonicalCode' | 'archetype' | 'state' | 'versionId' | 'sequence'
  | 'contentHash' | 'effectiveFrom' | 'effectiveTo' | 'updatedAt' | 'updatedBy'
  | 'sourceStatus' | 'immutable' | 'pinnedDealCount' | 'approvalTrail' | 'primaryAction'
> | null {
  const source = record(value);
  if (!source) return null;
  const purpose = requiredString(source, 'purpose', 500);
  const display = localized(source.display, fallbackDisplay);
  const quality = source.qualityIndicators;
  const documents = source.documentRequirements;
  const storage = record(source.storage);
  const acceptance = record(source.acceptance);
  const sourceRefs = stringArray(source.sourceRefs);
  const legalRuleIds = stringArray(source.legalRuleIds);
  if (
    !purpose || !display || !Array.isArray(quality) || !Array.isArray(documents)
    || !storage || !acceptance || !sourceRefs || !legalRuleIds
  ) return null;

  const qualityIndicators: CommodityProfileRegistryRecord['qualityIndicators'][number][] = [];
  for (const item of quality) {
    const row = record(item);
    if (!row) return null;
    const code = requiredString(row, 'code', 96);
    const itemDisplay = localized(row.display, { ru: code ?? '' });
    const unitCode = requiredString(row, 'unitCode', 96);
    const methods = stringArray(row.methodIds, 100);
    if (!code || !itemDisplay || !unitCode || typeof row.required !== 'boolean' || !methods) return null;
    qualityIndicators.push({
      code,
      display: itemDisplay,
      unitCode,
      required: row.required,
      methodCount: methods.length,
    });
  }

  const documentRecords: CommodityProfileRegistryRecord['documents'][number][] = [];
  for (const item of documents) {
    const row = record(item);
    if (!row) return null;
    const code = requiredString(row, 'code', 96);
    const itemDisplay = localized(row.display, { ru: code ?? '' });
    const signatureKind = optionalString(row, 'signatureKind', 40);
    const registry = optionalString(row, 'registry', 200);
    if (
      !code || !itemDisplay || typeof row.releaseBlocking !== 'boolean'
      || signatureKind === undefined || registry === undefined
    ) return null;
    documentRecords.push({
      code,
      display: itemDisplay,
      releaseBlocking: row.releaseBlocking,
      ...(signatureKind ? { signatureKind } : {}),
      ...(registry ? { registry } : {}),
    });
  }

  const packagingKinds = stringArray(storage.packagingKinds, 100);
  const blendingMode = requiredString(storage, 'blendingMode', 40);
  const shelfLifeHours = storage.shelfLifeHours;
  if (
    !packagingKinds || !blendingMode || !BLENDING_MODES.has(blendingMode)
    || (shelfLifeHours !== undefined && (!Number.isInteger(shelfLifeHours) || Number(shelfLifeHours) < 0))
  ) return null;

  const releaseBlockers = stringArray(acceptance.releaseBlockers, 500);
  if (!releaseBlockers || typeof acceptance.partialAcceptanceAllowed !== 'boolean') return null;
  const rapidDisputeHours = acceptance.rapidDisputeHours;
  if (rapidDisputeHours !== undefined && (!Number.isInteger(rapidDisputeHours) || Number(rapidDisputeHours) < 0)) return null;

  return {
    display,
    purpose,
    qualityIndicators,
    documents: documentRecords,
    storage: {
      temperatureRange: range(storage.temperatureMin, storage.temperatureMax),
      humidityRange: range(storage.humidityMin, storage.humidityMax),
      ...(typeof shelfLifeHours === 'number' ? { shelfLifeHours } : {}),
      packagingKinds,
      blendingMode: blendingMode as 'ALLOWED' | 'PROHIBITED' | 'CONTROLLED',
    },
    acceptance: {
      partialAcceptanceAllowed: acceptance.partialAcceptanceAllowed,
      ...(typeof rapidDisputeHours === 'number' ? { rapidDisputeHours } : {}),
      releaseBlockers,
    },
    sourceRefs,
    legalRuleIds,
  };
}

export function parseCommodityProfilePage(
  payload: unknown,
  locale: CommodityProfileLocale,
): ParsedCommodityProfilePage | null {
  const envelope = record(payload);
  if (!envelope || !Array.isArray(envelope.items)) return null;
  const nextCursor = optionalString(envelope, 'nextCursor', 4096);
  if (nextCursor === undefined) return null;

  const items: CommodityProfileRegistryRecord[] = [];
  for (const item of envelope.items) {
    const profile = record(item);
    if (!profile) return null;
    const id = requiredString(profile, 'id', 240);
    const canonicalCode = requiredString(profile, 'canonicalCode', 64);
    const archetype = requiredString(profile, 'archetype', 40);
    const authoritativeNameRu = requiredString(profile, 'authoritativeNameRu');
    const displayNameEn = optionalString(profile, 'displayNameEn');
    const displayNameZh = optionalString(profile, 'displayNameZh');
    const aggregateVersion = requiredString(profile, 'version', 20);
    const updatedAt = requiredString(profile, 'updatedAt', 80);
    const updatedByUserId = requiredString(profile, 'updatedByUserId', 240);
    if (
      !id || !canonicalCode || !archetype || !ARCHETYPES.has(archetype as CommodityArchetype)
      || !authoritativeNameRu || displayNameEn === undefined || displayNameZh === undefined
      || !aggregateVersion || !INTEGER_STRING.test(aggregateVersion)
      || !updatedAt || !updatedByUserId
    ) return null;

    if (profile.selectedVersion === null) continue;
    const selected = record(profile.selectedVersion);
    if (!selected) return null;

    const versionId = requiredString(selected, 'id', 240);
    const sequence = selected.sequence;
    const lifecycle = requiredString(selected, 'lifecycle', 40);
    const sourceStatus = requiredString(selected, 'sourceStatus', 40);
    const contentHash = requiredString(selected, 'contentHash', 64);
    const effectiveFrom = optionalString(selected, 'effectiveFrom', 80);
    const effectiveTo = optionalString(selected, 'effectiveTo', 80);
    const versionActor = requiredString(selected, 'updatedByUserId', 240);
    if (
      !versionId || !Number.isInteger(sequence) || Number(sequence) < 1
      || !lifecycle || !STATES.has(lifecycle as CommodityProfileState)
      || !sourceStatus || !SOURCE_STATUSES.has(sourceStatus)
      || !contentHash || !SHA256.test(contentHash)
      || effectiveFrom === undefined || effectiveTo === undefined || !versionActor
    ) return null;

    const fallbackDisplay: LocalizedDisplay = {
      ru: authoritativeNameRu,
      ...(displayNameEn ? { en: displayNameEn } : {}),
      ...(displayNameZh ? { zh: displayNameZh } : {}),
    };
    const content = parseContent(selected.content, fallbackDisplay);
    const primaryAction = parsePrimaryAction(profile.primaryAction, locale);
    if (!content || primaryAction === null) return null;

    items.push({
      id,
      canonicalCode,
      display: content.display,
      archetype: archetype as CommodityArchetype,
      purpose: content.purpose,
      state: lifecycle as CommodityProfileState,
      versionId,
      sequence: Number(sequence),
      contentHash,
      ...(effectiveFrom ? { effectiveFrom } : {}),
      ...(effectiveTo ? { effectiveTo } : {}),
      updatedAt,
      updatedBy: versionActor,
      sourceStatus: sourceStatus as 'VERIFIED' | 'REVERIFY_REQUIRED' | 'BLOCKED_EXTERNAL',
      immutable: lifecycle !== 'DRAFT',
      // Deal/Lot profile pinning is intentionally outside PC-CROP-01B.4. The
      // presentational count is hidden by the live route until pin authority exists.
      pinnedDealCount: 0,
      qualityIndicators: content.qualityIndicators,
      documents: content.documents,
      storage: content.storage,
      acceptance: content.acceptance,
      sourceRefs: content.sourceRefs,
      legalRuleIds: content.legalRuleIds,
      approvalTrail: [],
      ...(primaryAction ? { primaryAction } : {}),
    });
  }

  return { items, nextCursor };
}

export const COMMODITY_PROFILE_REGISTRY_MAX_PAGES = 20;
export const COMMODITY_PROFILE_REGISTRY_MAX_ITEMS = 2_000;

export async function collectCommodityProfilePages(
  loadPage: (cursor: string | null) => Promise<unknown>,
  locale: CommodityProfileLocale,
  limits: Readonly<{ maxPages?: number; maxItems?: number }> = {},
): Promise<CommodityProfileRegistryRecord[] | null> {
  const maxPages = limits.maxPages ?? COMMODITY_PROFILE_REGISTRY_MAX_PAGES;
  const maxItems = limits.maxItems ?? COMMODITY_PROFILE_REGISTRY_MAX_ITEMS;
  if (!Number.isInteger(maxPages) || maxPages < 1 || !Number.isInteger(maxItems) || maxItems < 1) {
    return null;
  }

  const records = new Map<string, CommodityProfileRegistryRecord>();
  const seenCursors = new Set<string>();
  let observedItems = 0;
  let cursor: string | null = null;

  for (let pageNumber = 0; pageNumber < maxPages; pageNumber += 1) {
    const page = parseCommodityProfilePage(await loadPage(cursor), locale);
    if (!page) return null;
    observedItems += page.items.length;
    if (observedItems > maxItems) return null;

    for (const item of page.items) {
      const existing = records.get(item.id);
      if (existing && JSON.stringify(existing) !== JSON.stringify(item)) return null;
      if (!existing) records.set(item.id, item);
    }

    if (page.nextCursor === null) return [...records.values()];
    if (seenCursors.has(page.nextCursor)) return null;
    seenCursors.add(page.nextCursor);
    cursor = page.nextCursor;
  }

  return null;
}

export function parseCommodityProfileHistory(payload: unknown): ParsedCommodityProfileHistory | null {
  const envelope = record(payload);
  if (!envelope || !Array.isArray(envelope.items)) return null;
  const profileId = requiredString(envelope, 'profileId', 240);
  const aggregateVersion = requiredString(envelope, 'aggregateVersion', 20);
  const nextCursor = optionalString(envelope, 'nextCursor', 4096);
  if (!profileId || !aggregateVersion || !INTEGER_STRING.test(aggregateVersion) || nextCursor === undefined) return null;

  const trail: Array<{
    state: CommodityProfileState;
    actor: string;
    occurredAt: string;
    reason?: string;
  }> = [];
  for (const item of envelope.items) {
    const row = record(item);
    if (!row) return null;
    const lifecycle = requiredString(row, 'lifecycle', 40);
    const approvedBy = optionalString(row, 'approvedByUserId', 240);
    const approvedAt = optionalString(row, 'approvedAt', 80);
    const approvalReason = optionalString(row, 'approvalReason', 2000);
    const updatedBy = requiredString(row, 'updatedByUserId', 240);
    const updatedAt = requiredString(row, 'updatedAt', 80);
    if (
      !lifecycle || !STATES.has(lifecycle as CommodityProfileState)
      || approvedBy === undefined || approvedAt === undefined || approvalReason === undefined
      || !updatedBy || !updatedAt
    ) return null;
    trail.push({
      state: lifecycle as CommodityProfileState,
      actor: approvedBy ?? updatedBy,
      occurredAt: approvedAt ?? updatedAt,
      ...(approvalReason ? { reason: approvalReason } : {}),
    });
  }
  return { profileId, aggregateVersion, trail, nextCursor };
}

export function withCommodityProfileHistory(
  records: readonly CommodityProfileRegistryRecord[],
  history: ParsedCommodityProfileHistory,
): CommodityProfileRegistryRecord[] {
  return records.map((record) => record.id === history.profileId
    ? { ...record, approvalTrail: history.trail }
    : record);
}
