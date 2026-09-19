'use client';

import * as React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileCheck2,
  Filter,
  History,
  LockKeyhole,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { Button, InlineNotice, NextActionCard, StatusChip, Surface } from '@pc/design-system-v8';
import type {
  CommodityArchetype,
  CommodityProfileState,
  LocalizedDisplay,
} from '../../../../packages/domain-core/src/commodity-profile';
import styles from './CommodityProfileRegistryView.module.css';

type Locale = 'ru' | 'en' | 'zh';
type RegistryState = 'loading' | 'ready' | 'empty' | 'error' | 'forbidden' | 'conflict';
type SourceStatus = 'VERIFIED' | 'REVERIFY_REQUIRED' | 'BLOCKED_EXTERNAL';
type Tone = 'neutral' | 'success' | 'warning' | 'critical' | 'information';

export type CommodityProfileRegistryAction = Readonly<{
  code: string;
  label: string;
  reason?: string;
  impact?: string;
  owner?: string;
  deadline?: string;
  requiresConfirmation: boolean;
  disabled: boolean;
  disabledReason?: string;
}>;

export type CommodityProfileRegistryRecord = Readonly<{
  id: string;
  canonicalCode: string;
  display: LocalizedDisplay;
  archetype: CommodityArchetype;
  purpose: string;
  state: CommodityProfileState;
  versionId: string;
  sequence: number;
  contentHash: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  updatedAt: string;
  updatedBy: string;
  sourceStatus: SourceStatus;
  immutable: boolean;
  pinnedDealCount: number;
  qualityIndicators: ReadonlyArray<Readonly<{
    code: string;
    display: LocalizedDisplay;
    unitCode: string;
    required: boolean;
    methodCount: number;
  }>>;
  documents: ReadonlyArray<Readonly<{
    code: string;
    display: LocalizedDisplay;
    releaseBlocking: boolean;
    signatureKind?: string;
    registry?: string;
  }>>;
  storage: Readonly<{
    temperatureRange?: string;
    humidityRange?: string;
    shelfLifeHours?: number;
    packagingKinds: readonly string[];
    blendingMode: 'ALLOWED' | 'PROHIBITED' | 'CONTROLLED';
  }>;
  acceptance: Readonly<{
    partialAcceptanceAllowed: boolean;
    rapidDisputeHours?: number;
    releaseBlockers: readonly string[];
  }>;
  sourceRefs: readonly string[];
  legalRuleIds: readonly string[];
  approvalTrail: ReadonlyArray<Readonly<{
    state: CommodityProfileState;
    actor: string;
    occurredAt: string;
    reason?: string;
  }>>;
  primaryAction?: CommodityProfileRegistryAction;
}>;

export type CommodityProfileRegistryViewProps = Readonly<{
  locale?: string;
  state: RegistryState;
  profiles?: readonly CommodityProfileRegistryRecord[];
  selectedProfileId?: string;
  message?: string;
  canCreate?: boolean;
  onCreate?: () => void;
  onRetry?: () => void;
  onSelect?: (profileId: string) => void;
  onPrimaryAction?: (profileId: string, actionCode: string) => void;
}>;

type Copy = Readonly<{
  eyebrow: string;
  title: string;
  lead: string;
  verifiedBoundary: string;
  loadingTitle: string;
  loadingBody: string;
  emptyTitle: string;
  emptyBody: string;
  errorTitle: string;
  forbiddenTitle: string;
  conflictTitle: string;
  retry: string;
  create: string;
  searchLabel: string;
  searchPlaceholder: string;
  stateFilter: string;
  archetypeFilter: string;
  all: string;
  registry: string;
  profile: string;
  version: string;
  state: string;
  source: string;
  effective: string;
  none: string;
  results: string;
  noMatches: string;
  immutable: string;
  editableDraft: string;
  pinned: string;
  quality: string;
  documents: string;
  storage: string;
  acceptance: string;
  provenance: string;
  history: string;
  indicators: string;
  methods: string;
  required: string;
  optional: string;
  releaseBlocker: string;
  signature: string;
  registryField: string;
  temperature: string;
  humidity: string;
  shelfLife: string;
  hours: string;
  packaging: string;
  blending: string;
  partialAcceptance: string;
  rapidDispute: string;
  yes: string;
  no: string;
  legalRules: string;
  contentHash: string;
  updated: string;
  nextAction: string;
  confirmation: string;
  confirmationRequired: string;
  serverAuthority: string;
  facts: Readonly<{
    total: string;
    effective: string;
    reverify: string;
  }>;
}>;

const COPY: Record<Locale, Copy> = {
  ru: {
    eyebrow: 'Канонические правила продукции',
    title: 'Товарные профили растениеводства',
    lead: 'Один реестр управляет качеством, документами, хранением, приёмкой и блокерами выпуска денег. Версия закрепляется за Сделкой и не меняется задним числом.',
    verifiedBoundary: 'Интерфейс показывает только серверные версии и подтверждённые статусы источников. Непроверенные нормы помечаются отдельно.',
    loadingTitle: 'Загружаем канонический реестр',
    loadingBody: 'Получаем версии, сроки действия, источники и разрешённые действия с сервера.',
    emptyTitle: 'Товарные профили ещё не созданы',
    emptyBody: 'Нельзя начинать Сделку без утверждённого профиля продукции. Создай первый черновик либо запроси полномочие у ответственного.',
    errorTitle: 'Не удалось загрузить реестр',
    forbiddenTitle: 'Недостаточно полномочий',
    conflictTitle: 'Версия изменилась на сервере',
    retry: 'Обновить данные',
    create: 'Создать черновик профиля',
    searchLabel: 'Поиск профилей',
    searchPlaceholder: 'Культура, код, назначение',
    stateFilter: 'Состояние',
    archetypeFilter: 'Архетип',
    all: 'Все',
    registry: 'Реестр',
    profile: 'Профиль',
    version: 'Версия',
    state: 'Состояние',
    source: 'Источник',
    effective: 'Действует',
    none: 'не задано',
    results: 'Найдено',
    noMatches: 'По выбранным фильтрам профили не найдены.',
    immutable: 'Опубликованная версия неизменяема',
    editableDraft: 'Черновик допускает изменение',
    pinned: 'Закреплено Сделок',
    quality: 'Качество и методы',
    documents: 'Документы и реестры',
    storage: 'Хранение и упаковка',
    acceptance: 'Приёмка и блокеры',
    provenance: 'Источники и правовые основания',
    history: 'История согласования',
    indicators: 'Показатели',
    methods: 'методов',
    required: 'обязательный',
    optional: 'дополнительный',
    releaseBlocker: 'Блокирует выпуск',
    signature: 'Подпись',
    registryField: 'Реестр',
    temperature: 'Температура',
    humidity: 'Влажность',
    shelfLife: 'Срок годности',
    hours: 'ч',
    packaging: 'Упаковка',
    blending: 'Смешение',
    partialAcceptance: 'Частичная приёмка',
    rapidDispute: 'Окно быстрой рекламации',
    yes: 'Да',
    no: 'Нет',
    legalRules: 'Нормативные правила',
    contentHash: 'Хэш содержания',
    updated: 'Обновлено',
    nextAction: 'Разрешённое действие',
    confirmation: 'Подтверждение',
    confirmationRequired: 'Потребуется проверка последствий и явное подтверждение.',
    serverAuthority: 'Действие и полномочия рассчитаны сервером; интерфейс не выбирает роль или tenant.',
    facts: { total: 'Всего профилей', effective: 'Действующих', reverify: 'Требуют перепроверки' },
  },
  en: {
    eyebrow: 'Canonical product rules',
    title: 'Crop commodity profiles',
    lead: 'One registry controls quality, documents, storage, acceptance and money-release blockers. The exact version is pinned to the Deal and cannot change retroactively.',
    verifiedBoundary: 'The interface shows server versions and verified source states only. Unverified rules are marked separately.',
    loadingTitle: 'Loading the canonical registry',
    loadingBody: 'Retrieving versions, effective dates, sources and server-authorised actions.',
    emptyTitle: 'No commodity profiles exist yet',
    emptyBody: 'A Deal must not start without an approved product profile. Create the first draft or request the required authority.',
    errorTitle: 'Could not load the registry',
    forbiddenTitle: 'Insufficient authority',
    conflictTitle: 'The server version has changed',
    retry: 'Refresh data',
    create: 'Create profile draft',
    searchLabel: 'Search profiles',
    searchPlaceholder: 'Commodity, code or purpose',
    stateFilter: 'State',
    archetypeFilter: 'Archetype',
    all: 'All',
    registry: 'Registry',
    profile: 'Profile',
    version: 'Version',
    state: 'State',
    source: 'Source',
    effective: 'Effective',
    none: 'not set',
    results: 'Found',
    noMatches: 'No profiles match the selected filters.',
    immutable: 'Published version is immutable',
    editableDraft: 'Draft may be edited',
    pinned: 'Pinned Deals',
    quality: 'Quality and methods',
    documents: 'Documents and registries',
    storage: 'Storage and packaging',
    acceptance: 'Acceptance and blockers',
    provenance: 'Sources and legal basis',
    history: 'Approval history',
    indicators: 'Indicators',
    methods: 'methods',
    required: 'required',
    optional: 'optional',
    releaseBlocker: 'Blocks release',
    signature: 'Signature',
    registryField: 'Registry',
    temperature: 'Temperature',
    humidity: 'Humidity',
    shelfLife: 'Shelf life',
    hours: 'h',
    packaging: 'Packaging',
    blending: 'Blending',
    partialAcceptance: 'Partial acceptance',
    rapidDispute: 'Rapid claim window',
    yes: 'Yes',
    no: 'No',
    legalRules: 'Regulatory rules',
    contentHash: 'Content hash',
    updated: 'Updated',
    nextAction: 'Authorised action',
    confirmation: 'Confirmation',
    confirmationRequired: 'Impact review and explicit confirmation will be required.',
    serverAuthority: 'The action and authority are server-derived; the interface never selects role or tenant.',
    facts: { total: 'Total profiles', effective: 'Effective', reverify: 'Need re-verification' },
  },
  zh: {
    eyebrow: '规范化产品规则',
    title: '种植业商品配置',
    lead: '统一登记表管理质量、文件、储存、验收和资金释放阻断条件。交易固定使用精确版本，不能追溯修改。',
    verifiedBoundary: '界面仅显示服务器版本和已确认的来源状态。未核验规则会单独标记。',
    loadingTitle: '正在加载规范登记表',
    loadingBody: '正在获取版本、生效日期、来源和服务器授权操作。',
    emptyTitle: '尚未创建商品配置',
    emptyBody: '没有已批准的产品配置时不得启动交易。请创建首个草稿或申请相应权限。',
    errorTitle: '无法加载登记表',
    forbiddenTitle: '权限不足',
    conflictTitle: '服务器版本已变化',
    retry: '刷新数据',
    create: '创建配置草稿',
    searchLabel: '搜索配置',
    searchPlaceholder: '作物、代码或用途',
    stateFilter: '状态',
    archetypeFilter: '类型',
    all: '全部',
    registry: '登记表',
    profile: '配置',
    version: '版本',
    state: '状态',
    source: '来源',
    effective: '生效期',
    none: '未设置',
    results: '找到',
    noMatches: '没有符合当前筛选条件的配置。',
    immutable: '已发布版本不可修改',
    editableDraft: '草稿可修改',
    pinned: '已固定交易',
    quality: '质量与方法',
    documents: '文件与登记系统',
    storage: '储存与包装',
    acceptance: '验收与阻断条件',
    provenance: '来源与法律依据',
    history: '审批历史',
    indicators: '指标',
    methods: '种方法',
    required: '必填',
    optional: '可选',
    releaseBlocker: '阻断资金释放',
    signature: '签名',
    registryField: '登记系统',
    temperature: '温度',
    humidity: '湿度',
    shelfLife: '保质期',
    hours: '小时',
    packaging: '包装',
    blending: '混合',
    partialAcceptance: '部分验收',
    rapidDispute: '快速申诉时限',
    yes: '是',
    no: '否',
    legalRules: '法规规则',
    contentHash: '内容哈希',
    updated: '更新时间',
    nextAction: '授权操作',
    confirmation: '确认',
    confirmationRequired: '需要先审查影响并明确确认。',
    serverAuthority: '操作和权限由服务器计算；界面不选择角色或租户。',
    facts: { total: '配置总数', effective: '生效中', reverify: '需要重新核验' },
  },
};

const ARCHETYPE_LABELS: Record<Locale, Record<CommodityArchetype, string>> = {
  ru: {
    DRY_BULK: 'Сыпучие сухие',
    SEED_PLANTING: 'Семена и посадочный материал',
    ROOT_INDUSTRIAL: 'Корнеплоды и технические',
    FRESH_PACKED: 'Свежая упакованная продукция',
    GREENHOUSE_RECURRING: 'Серийные тепличные поставки',
    ORGANIC_EXPORT_QUARANTINE: 'Органика, экспорт и карантин',
  },
  en: {
    DRY_BULK: 'Dry bulk',
    SEED_PLANTING: 'Seed and planting',
    ROOT_INDUSTRIAL: 'Root and industrial',
    FRESH_PACKED: 'Fresh packed',
    GREENHOUSE_RECURRING: 'Greenhouse recurring',
    ORGANIC_EXPORT_QUARANTINE: 'Organic, export and quarantine',
  },
  zh: {
    DRY_BULK: '干散货',
    SEED_PLANTING: '种子与种植材料',
    ROOT_INDUSTRIAL: '根茎及工业作物',
    FRESH_PACKED: '鲜品包装',
    GREENHOUSE_RECURRING: '温室周期供应',
    ORGANIC_EXPORT_QUARANTINE: '有机、出口与检疫',
  },
};

const STATE_LABELS: Record<Locale, Record<CommodityProfileState, string>> = {
  ru: { DRAFT: 'Черновик', REVIEW: 'На согласовании', APPROVED: 'Утверждён', EFFECTIVE: 'Действует', DEPRECATED: 'Заменён', REVOKED: 'Отозван' },
  en: { DRAFT: 'Draft', REVIEW: 'In review', APPROVED: 'Approved', EFFECTIVE: 'Effective', DEPRECATED: 'Deprecated', REVOKED: 'Revoked' },
  zh: { DRAFT: '草稿', REVIEW: '审核中', APPROVED: '已批准', EFFECTIVE: '生效中', DEPRECATED: '已替代', REVOKED: '已撤销' },
};

const SOURCE_LABELS: Record<Locale, Record<SourceStatus, string>> = {
  ru: { VERIFIED: 'Проверен', REVERIFY_REQUIRED: 'Перепроверить', BLOCKED_EXTERNAL: 'Внешнее подтверждение' },
  en: { VERIFIED: 'Verified', REVERIFY_REQUIRED: 'Re-verify', BLOCKED_EXTERNAL: 'External confirmation' },
  zh: { VERIFIED: '已核验', REVERIFY_REQUIRED: '需重新核验', BLOCKED_EXTERNAL: '等待外部确认' },
};

function normalizeLocale(locale?: string): Locale {
  if (locale?.startsWith('en')) return 'en';
  if (locale?.startsWith('zh')) return 'zh';
  return 'ru';
}

function localize(value: LocalizedDisplay, locale: Locale): string {
  return value[locale] || value.ru;
}

function stateTone(state: CommodityProfileState): Tone {
  if (state === 'EFFECTIVE') return 'success';
  if (state === 'REVOKED') return 'critical';
  if (state === 'REVIEW' || state === 'APPROVED' || state === 'DEPRECATED') return 'warning';
  return 'neutral';
}

function sourceTone(status: SourceStatus): Tone {
  if (status === 'VERIFIED') return 'success';
  if (status === 'REVERIFY_REQUIRED') return 'warning';
  return 'critical';
}

function formatDate(value: string | undefined, locale: Locale): string {
  if (!value) return COPY[locale].none;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : locale === 'zh' ? 'zh-CN' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function StateSurface({
  kind,
  copy,
  message,
  canCreate,
  onCreate,
  onRetry,
}: Readonly<{
  kind: Exclude<RegistryState, 'ready'>;
  copy: Copy;
  message?: string;
  canCreate?: boolean;
  onCreate?: () => void;
  onRetry?: () => void;
}>) {
  const critical = kind === 'error' || kind === 'conflict';
  const icon = kind === 'loading'
    ? <RefreshCw className={styles.spin} size={28} />
    : kind === 'empty'
      ? <FileCheck2 size={30} />
      : kind === 'forbidden'
        ? <LockKeyhole size={30} />
        : <AlertTriangle size={30} />;
  const title = kind === 'loading'
    ? copy.loadingTitle
    : kind === 'empty'
      ? copy.emptyTitle
      : kind === 'forbidden'
        ? copy.forbiddenTitle
        : kind === 'conflict'
          ? copy.conflictTitle
          : copy.errorTitle;
  const body = message || (kind === 'loading' ? copy.loadingBody : kind === 'empty' ? copy.emptyBody : copy.serverAuthority);

  return (
    <Surface
      className={styles.stateSurface}
      role={critical ? 'alert' : undefined}
      aria-live={kind === 'loading' ? 'polite' : undefined}
      data-registry-state={kind}
    >
      <span className={critical ? styles.stateIconCritical : styles.stateIcon} aria-hidden='true'>{icon}</span>
      <h1>{title}</h1>
      <p>{body}</p>
      <div className={styles.stateActions}>
        {kind === 'empty' && canCreate && onCreate ? <Button onClick={onCreate}>{copy.create}</Button> : null}
        {(kind === 'error' || kind === 'conflict') && onRetry ? (
          <Button variant='secondary' onClick={onRetry}><RefreshCw size={18} aria-hidden='true' />{copy.retry}</Button>
        ) : null}
      </div>
    </Surface>
  );
}

export function CommodityProfileRegistryView({
  locale: localeInput,
  state,
  profiles = [],
  selectedProfileId,
  message,
  canCreate = false,
  onCreate,
  onRetry,
  onSelect,
  onPrimaryAction,
}: CommodityProfileRegistryViewProps) {
  const locale = normalizeLocale(localeInput);
  const copy = COPY[locale];
  const [query, setQuery] = React.useState('');
  const [stateFilter, setStateFilter] = React.useState<CommodityProfileState | 'ALL'>('ALL');
  const [archetypeFilter, setArchetypeFilter] = React.useState<CommodityArchetype | 'ALL'>('ALL');
  const [internalSelectedId, setInternalSelectedId] = React.useState(selectedProfileId || profiles[0]?.id || '');

  React.useEffect(() => {
    if (selectedProfileId) setInternalSelectedId(selectedProfileId);
  }, [selectedProfileId]);

  React.useEffect(() => {
    if (profiles.length > 0 && !profiles.some((profile) => profile.id === internalSelectedId)) {
      setInternalSelectedId(profiles[0].id);
    }
  }, [profiles, internalSelectedId]);

  const filtered = React.useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase(locale);
    return profiles.filter((profile) => {
      if (stateFilter !== 'ALL' && profile.state !== stateFilter) return false;
      if (archetypeFilter !== 'ALL' && profile.archetype !== archetypeFilter) return false;
      if (!normalizedQuery) return true;
      const haystack = [
        profile.canonicalCode,
        localize(profile.display, locale),
        profile.purpose,
        ARCHETYPE_LABELS[locale][profile.archetype],
      ].join(' ').toLocaleLowerCase(locale);
      return haystack.includes(normalizedQuery);
    });
  }, [profiles, stateFilter, archetypeFilter, query, locale]);

  const selected = profiles.find((profile) => profile.id === internalSelectedId) || filtered[0] || profiles[0];
  const effectiveCount = profiles.filter((profile) => profile.state === 'EFFECTIVE').length;
  const reverifyCount = profiles.filter((profile) => profile.sourceStatus !== 'VERIFIED').length;

  if (state !== 'ready') {
    return <StateSurface kind={state} copy={copy} message={message} canCreate={canCreate} onCreate={onCreate} onRetry={onRetry} />;
  }

  if (profiles.length === 0) {
    return <StateSurface kind='empty' copy={copy} message={message} canCreate={canCreate} onCreate={onCreate} />;
  }

  const selectProfile = (profileId: string) => {
    setInternalSelectedId(profileId);
    onSelect?.(profileId);
  };

  return (
    <section
      className={styles.registry}
      data-commodity-profile-registry='industrial-v1'
      data-authority='server-supplied'
      data-locale={locale}
      aria-labelledby='commodity-profile-registry-title'
    >
      <Surface className={styles.hero}>
        <div className={styles.heroCopy}>
          <StatusChip tone='information'>{copy.eyebrow}</StatusChip>
          <h1 id='commodity-profile-registry-title'>{copy.title}</h1>
          <p>{copy.lead}</p>
          <InlineNotice tone='neutral' title={copy.source} icon={<ShieldCheck size={18} />}>
            {copy.verifiedBoundary}
          </InlineNotice>
        </div>
        <dl className={styles.facts}>
          <div><dt>{copy.facts.total}</dt><dd>{profiles.length}</dd></div>
          <div><dt>{copy.facts.effective}</dt><dd>{effectiveCount}</dd></div>
          <div data-warning={reverifyCount > 0}><dt>{copy.facts.reverify}</dt><dd>{reverifyCount}</dd></div>
        </dl>
      </Surface>

      <Surface className={styles.toolbar} variant='subtle'>
        <label className={styles.searchField}>
          <span>{copy.searchLabel}</span>
          <span className={styles.inputShell}>
            <Search size={18} aria-hidden='true' />
            <input
              type='search'
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder={copy.searchPlaceholder}
              autoComplete='off'
            />
          </span>
        </label>
        <label className={styles.filterField}>
          <span><Filter size={16} aria-hidden='true' />{copy.stateFilter}</span>
          <select value={stateFilter} onChange={(event) => setStateFilter(event.currentTarget.value as CommodityProfileState | 'ALL')}>
            <option value='ALL'>{copy.all}</option>
            {Object.keys(STATE_LABELS[locale]).map((profileState) => (
              <option key={profileState} value={profileState}>{STATE_LABELS[locale][profileState as CommodityProfileState]}</option>
            ))}
          </select>
        </label>
        <label className={styles.filterField}>
          <span><Filter size={16} aria-hidden='true' />{copy.archetypeFilter}</span>
          <select value={archetypeFilter} onChange={(event) => setArchetypeFilter(event.currentTarget.value as CommodityArchetype | 'ALL')}>
            <option value='ALL'>{copy.all}</option>
            {Object.keys(ARCHETYPE_LABELS[locale]).map((archetype) => (
              <option key={archetype} value={archetype}>{ARCHETYPE_LABELS[locale][archetype as CommodityArchetype]}</option>
            ))}
          </select>
        </label>
        {canCreate && onCreate ? <Button className={styles.createButton} onClick={onCreate}>{copy.create}</Button> : null}
      </Surface>

      <div className={styles.workspace}>
        <Surface className={styles.listPanel} padded={false}>
          <div className={styles.panelHeader}>
            <div><span>{copy.registry}</span><strong>{copy.results}: {filtered.length}</strong></div>
          </div>
          {filtered.length === 0 ? (
            <div className={styles.noMatches} role='status'>{copy.noMatches}</div>
          ) : (
            <div className={styles.tableScroller}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{copy.profile}</th>
                    <th>{copy.state}</th>
                    <th>{copy.version}</th>
                    <th>{copy.source}</th>
                    <th>{copy.effective}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((profile) => {
                    const active = profile.id === selected?.id;
                    return (
                      <tr key={profile.id} data-selected={active}>
                        <td data-label={copy.profile}>
                          <button
                            type='button'
                            className={styles.profileButton}
                            aria-current={active ? 'true' : undefined}
                            onClick={() => selectProfile(profile.id)}
                          >
                            <strong>{localize(profile.display, locale)}</strong>
                            <span>{profile.canonicalCode}</span>
                            <small>{ARCHETYPE_LABELS[locale][profile.archetype]}</small>
                          </button>
                        </td>
                        <td data-label={copy.state}><StatusChip tone={stateTone(profile.state)}>{STATE_LABELS[locale][profile.state]}</StatusChip></td>
                        <td data-label={copy.version}>v{profile.sequence}</td>
                        <td data-label={copy.source}><StatusChip tone={sourceTone(profile.sourceStatus)}>{SOURCE_LABELS[locale][profile.sourceStatus]}</StatusChip></td>
                        <td data-label={copy.effective}>{formatDate(profile.effectiveFrom, locale)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Surface>

        {selected ? (
          <Surface className={styles.detailPanel} aria-live='polite'>
            <header className={styles.detailHeader}>
              <div>
                <div className={styles.detailChips}>
                  <StatusChip tone={stateTone(selected.state)}>{STATE_LABELS[locale][selected.state]}</StatusChip>
                  <StatusChip tone={sourceTone(selected.sourceStatus)}>{SOURCE_LABELS[locale][selected.sourceStatus]}</StatusChip>
                </div>
                <h2>{localize(selected.display, locale)}</h2>
                <p>{selected.purpose}</p>
              </div>
              <div className={styles.immutability} data-immutable={selected.immutable}>
                {selected.immutable ? <LockKeyhole size={18} aria-hidden='true' /> : <CheckCircle2 size={18} aria-hidden='true' />}
                <span>{selected.immutable ? copy.immutable : copy.editableDraft}</span>
                <small>{copy.pinned}: {selected.pinnedDealCount}</small>
              </div>
            </header>

            {selected.primaryAction ? (
              <NextActionCard
                className={styles.nextAction}
                label={copy.nextAction}
                action={selected.primaryAction.label}
                reason={selected.primaryAction.disabledReason || selected.primaryAction.reason || copy.serverAuthority}
                impact={selected.primaryAction.impact}
                owner={selected.primaryAction.owner}
                deadline={selected.primaryAction.deadline}
                blocked={selected.primaryAction.disabled}
                icon={<ArrowRight size={20} />}
                actions={
                  <div className={styles.actionControls}>
                    <Button
                      disabled={selected.primaryAction.disabled}
                      onClick={() => onPrimaryAction?.(selected.id, selected.primaryAction!.code)}
                    >
                      {selected.primaryAction.label}
                    </Button>
                    {selected.primaryAction.requiresConfirmation ? (
                      <span><ShieldCheck size={16} aria-hidden='true' />{copy.confirmationRequired}</span>
                    ) : null}
                  </div>
                }
              />
            ) : null}

            <div className={styles.detailSections}>
              <details open>
                <summary>{copy.quality}<span>{selected.qualityIndicators.length}</span></summary>
                <div className={styles.sectionBody}>
                  {selected.qualityIndicators.map((indicator) => (
                    <div className={styles.ruleRow} key={indicator.code}>
                      <div><strong>{localize(indicator.display, locale)}</strong><small>{indicator.code} · {indicator.unitCode}</small></div>
                      <div><StatusChip tone={indicator.required ? 'warning' : 'neutral'}>{indicator.required ? copy.required : copy.optional}</StatusChip><span>{indicator.methodCount} {copy.methods}</span></div>
                    </div>
                  ))}
                </div>
              </details>

              <details>
                <summary>{copy.documents}<span>{selected.documents.length}</span></summary>
                <div className={styles.sectionBody}>
                  {selected.documents.map((document) => (
                    <div className={styles.ruleRow} key={document.code}>
                      <div><strong>{localize(document.display, locale)}</strong><small>{document.code}</small></div>
                      <div>
                        {document.releaseBlocking ? <StatusChip tone='critical'>{copy.releaseBlocker}</StatusChip> : null}
                        {document.signatureKind ? <span>{copy.signature}: {document.signatureKind}</span> : null}
                        {document.registry ? <span>{copy.registryField}: {document.registry}</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </details>

              <details>
                <summary>{copy.storage}<span>{selected.storage.packagingKinds.length}</span></summary>
                <dl className={styles.definitionGrid}>
                  <div><dt>{copy.temperature}</dt><dd>{selected.storage.temperatureRange || copy.none}</dd></div>
                  <div><dt>{copy.humidity}</dt><dd>{selected.storage.humidityRange || copy.none}</dd></div>
                  <div><dt>{copy.shelfLife}</dt><dd>{selected.storage.shelfLifeHours ? `${selected.storage.shelfLifeHours} ${copy.hours}` : copy.none}</dd></div>
                  <div><dt>{copy.packaging}</dt><dd>{selected.storage.packagingKinds.join(', ') || copy.none}</dd></div>
                  <div><dt>{copy.blending}</dt><dd>{selected.storage.blendingMode}</dd></div>
                </dl>
              </details>

              <details>
                <summary>{copy.acceptance}<span>{selected.acceptance.releaseBlockers.length}</span></summary>
                <dl className={styles.definitionGrid}>
                  <div><dt>{copy.partialAcceptance}</dt><dd>{selected.acceptance.partialAcceptanceAllowed ? copy.yes : copy.no}</dd></div>
                  <div><dt>{copy.rapidDispute}</dt><dd>{selected.acceptance.rapidDisputeHours ? `${selected.acceptance.rapidDisputeHours} ${copy.hours}` : copy.none}</dd></div>
                  <div className={styles.wideDefinition}><dt>{copy.releaseBlocker}</dt><dd>{selected.acceptance.releaseBlockers.join(', ') || copy.none}</dd></div>
                </dl>
              </details>

              <details>
                <summary>{copy.provenance}<span>{selected.sourceRefs.length + selected.legalRuleIds.length}</span></summary>
                <dl className={styles.definitionGrid}>
                  <div><dt>{copy.source}</dt><dd>{selected.sourceRefs.join(', ') || copy.none}</dd></div>
                  <div><dt>{copy.legalRules}</dt><dd>{selected.legalRuleIds.join(', ') || copy.none}</dd></div>
                  <div className={styles.wideDefinition}><dt>{copy.contentHash}</dt><dd><code>{selected.contentHash}</code></dd></div>
                  <div><dt>{copy.version}</dt><dd>{selected.versionId} · v{selected.sequence}</dd></div>
                  <div><dt>{copy.updated}</dt><dd>{formatDate(selected.updatedAt, locale)} · {selected.updatedBy}</dd></div>
                </dl>
              </details>

              <details>
                <summary>{copy.history}<span>{selected.approvalTrail.length}</span></summary>
                <ol className={styles.timeline}>
                  {selected.approvalTrail.map((event, index) => (
                    <li key={`${event.state}-${event.occurredAt}-${index}`}>
                      <History size={16} aria-hidden='true' />
                      <div><strong>{STATE_LABELS[locale][event.state]}</strong><span>{event.actor} · {formatDate(event.occurredAt, locale)}</span>{event.reason ? <small>{event.reason}</small> : null}</div>
                    </li>
                  ))}
                </ol>
              </details>
            </div>
          </Surface>
        ) : null}
      </div>
    </section>
  );
}
