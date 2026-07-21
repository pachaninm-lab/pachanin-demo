'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button, InlineNotice, StatusChip, Surface } from '@pc/design-system-v8';
import type {
  CommodityArchetype,
  CommodityProfileState,
  LocalizedDisplay,
} from '../../../../packages/domain-core/src/commodity-profile';
import {
  CommodityProfileRegistryView,
  type CommodityProfileRegistryAction,
  type CommodityProfileRegistryRecord,
} from './CommodityProfileRegistryView';
import styles from './LiveCommodityProfileRegistry.module.css';

type Locale = 'ru' | 'en' | 'zh';
type LiveKind = 'loading' | 'ready' | 'empty' | 'error' | 'forbidden' | 'conflict' | 'reconnecting';
type JsonObject = Record<string, unknown>;

type ApiAction = {
  id: string;
  allowed: boolean;
  reasonCode: string;
  requiresConfirmation: boolean;
  owner: string;
  impact: string;
};

type ApiSelectedVersion = {
  id: string;
  sequence: number;
  lifecycle: CommodityProfileState;
  sourceStatus: 'VERIFIED' | 'REVERIFY_REQUIRED' | 'BLOCKED_EXTERNAL';
  effectiveFrom: string | null;
  effectiveTo: string | null;
  contentHash: string;
  content: unknown;
};

type ApiProfile = {
  id: string;
  canonicalCode: string;
  archetype: CommodityArchetype;
  authoritativeNameRu: string;
  displayNameEn: string | null;
  displayNameZh: string | null;
  version: string;
  updatedAt: string;
  selectedVersion: ApiSelectedVersion | null;
  actions: ApiAction[];
};

type ApiList = { items: ApiProfile[]; nextCursor: string | null };
type ApiHistoryItem = {
  lifecycle: CommodityProfileState;
  approvedByUserId: string | null;
  approvedAt: string | null;
  approvalReason: string | null;
  updatedAt: string;
};
type ApiHistory = { profileId: string; aggregateVersion: string; items: ApiHistoryItem[] };

type LiveRecord = CommodityProfileRegistryRecord & {
  aggregateVersion: string;
  rawContent: JsonObject;
};

type PendingAction = {
  profileId: string;
  profileVersionId: string;
  actionCode: string;
  aggregateVersion: string;
  reason: string;
  effectiveFrom: string;
  commandId: string;
  idempotencyKey: string;
  correlationId: string;
};

type Copy = {
  reconnecting: string;
  offline: string;
  invalidPayload: string;
  unavailable: string;
  forbidden: string;
  sessionRequired: string;
  actionTitle: string;
  actionReason: string;
  reasonPlaceholder: string;
  effectiveFrom: string;
  cancel: string;
  confirm: string;
  executing: string;
  receipt: string;
  conflict: string;
  editorRequired: string;
  actionLabels: Record<string, string>;
  reasonLabels: Record<string, string>;
};

const COPY: Record<Locale, Copy> = {
  ru: {
    reconnecting: 'Восстанавливаем связь. Последние подтверждённые сервером данные сохранены на экране.',
    offline: 'Нет связи с сервером. Локальная копия не используется как authority.',
    invalidPayload: 'Сервер вернул несовместимый формат товарного реестра.',
    unavailable: 'Контур товарных профилей временно недоступен.',
    forbidden: 'Сервер не подтвердил доступ к товарным профилям.',
    sessionRequired: 'Для изменения профиля требуется активная staff/JIT-сессия.',
    actionTitle: 'Подтверждение управляемого действия',
    actionReason: 'Основание',
    reasonPlaceholder: 'Укажите проверяемое деловое или нормативное основание…',
    effectiveFrom: 'Начало действия',
    cancel: 'Отмена',
    confirm: 'Подтвердить на сервере',
    executing: 'Фиксируем команду…',
    receipt: 'Команда зафиксирована сервером. Реестр обновлён по receipt.',
    conflict: 'Серверная версия изменилась. Ваше основание сохранено; обновите реестр перед повтором.',
    editorRequired: 'Изменение содержания выполняется в отдельном структурированном редакторе версии.',
    actionLabels: {
      UPDATE_DRAFT: 'Изменить черновик', SUBMIT_REVIEW: 'Передать на проверку', APPROVE: 'Утвердить',
      ACTIVATE: 'Ввести в действие', DEPRECATE: 'Вывести из действия', REVOKE: 'Отозвать',
    },
    reasonLabels: {
      ROLE_READ_ONLY: 'Роль доступна только для чтения', STAFF_AUTHORITY_REQUIRED: 'Требуется staff-полномочие',
      MFA_REQUIRED: 'Требуется свежая MFA', JIT_AUTHORITY_REQUIRED: 'Требуется активная JIT-сессия',
      INVALID_LIFECYCLE_ACTION: 'Действие не соответствует текущему состоянию', ALLOWED: 'Разрешено сервером',
    },
  },
  en: {
    reconnecting: 'Restoring connectivity. The last server-confirmed data remains visible.',
    offline: 'The server is unreachable. No local copy is used as authority.',
    invalidPayload: 'The server returned an incompatible commodity registry payload.',
    unavailable: 'The commodity profile service is temporarily unavailable.',
    forbidden: 'The server did not confirm access to commodity profiles.',
    sessionRequired: 'An active staff/JIT session is required to change a profile.',
    actionTitle: 'Governed action confirmation',
    actionReason: 'Reason',
    reasonPlaceholder: 'Enter a verifiable business or regulatory reason…',
    effectiveFrom: 'Effective from',
    cancel: 'Cancel',
    confirm: 'Confirm on server',
    executing: 'Committing command…',
    receipt: 'The command was committed by the server. The registry was refreshed from the receipt.',
    conflict: 'The server version changed. Your reason is preserved; refresh before retrying.',
    editorRequired: 'Content changes are performed in the dedicated structured version editor.',
    actionLabels: {
      UPDATE_DRAFT: 'Edit draft', SUBMIT_REVIEW: 'Submit for review', APPROVE: 'Approve',
      ACTIVATE: 'Activate', DEPRECATE: 'Deprecate', REVOKE: 'Revoke',
    },
    reasonLabels: {
      ROLE_READ_ONLY: 'Role is read-only', STAFF_AUTHORITY_REQUIRED: 'Staff authority is required',
      MFA_REQUIRED: 'Fresh MFA is required', JIT_AUTHORITY_REQUIRED: 'An active JIT session is required',
      INVALID_LIFECYCLE_ACTION: 'Action is invalid for the current state', ALLOWED: 'Allowed by server',
    },
  },
  zh: {
    reconnecting: '正在恢复连接。界面保留最后一次由服务器确认的数据。',
    offline: '无法连接服务器。本地副本不会作为权威数据。',
    invalidPayload: '服务器返回了不兼容的商品配置数据。',
    unavailable: '商品配置服务暂时不可用。',
    forbidden: '服务器未确认商品配置访问权限。',
    sessionRequired: '修改配置需要有效的 staff/JIT 会话。',
    actionTitle: '受控操作确认',
    actionReason: '依据',
    reasonPlaceholder: '请输入可核验的业务或法规依据…',
    effectiveFrom: '生效时间',
    cancel: '取消',
    confirm: '在服务器确认',
    executing: '正在提交命令…',
    receipt: '服务器已记录命令，并根据 receipt 刷新登记。',
    conflict: '服务器版本已变化。你的依据已保留；请刷新后重试。',
    editorRequired: '内容修改在独立的结构化版本编辑器中完成。',
    actionLabels: {
      UPDATE_DRAFT: '编辑草稿', SUBMIT_REVIEW: '提交审核', APPROVE: '批准',
      ACTIVATE: '启用', DEPRECATE: '停用', REVOKE: '撤销',
    },
    reasonLabels: {
      ROLE_READ_ONLY: '角色仅可读取', STAFF_AUTHORITY_REQUIRED: '需要 staff 权限',
      MFA_REQUIRED: '需要新的 MFA', JIT_AUTHORITY_REQUIRED: '需要有效的 JIT 会话',
      INVALID_LIFECYCLE_ACTION: '当前状态不允许该操作', ALLOWED: '服务器已允许',
    },
  },
};

function localeOf(value?: string): Locale {
  if (value?.startsWith('en')) return 'en';
  if (value?.startsWith('zh')) return 'zh';
  return 'ru';
}

function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function number(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function boolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : [];
}

function localized(value: unknown, fallback: LocalizedDisplay): LocalizedDisplay {
  const source = object(value);
  return {
    ru: text(source.ru) || fallback.ru,
    ...(text(source.en) || fallback.en ? { en: text(source.en) || fallback.en } : {}),
    ...(text(source.zh) || fallback.zh ? { zh: text(source.zh) || fallback.zh } : {}),
  };
}

function actionFor(profile: ApiProfile, locale: Locale): CommodityProfileRegistryAction | undefined {
  const transitions = profile.actions.filter((action) => action.allowed && action.id !== 'UPDATE_DRAFT');
  const selected = transitions[0] || profile.actions.find((action) => action.allowed) || profile.actions[0];
  if (!selected) return undefined;
  return {
    code: selected.id,
    label: COPY[locale].actionLabels[selected.id] || selected.id,
    reason: COPY[locale].reasonLabels[selected.reasonCode] || selected.reasonCode,
    impact: selected.impact,
    owner: selected.owner,
    requiresConfirmation: selected.requiresConfirmation,
    disabled: !selected.allowed,
    disabledReason: selected.allowed ? undefined : COPY[locale].reasonLabels[selected.reasonCode] || selected.reasonCode,
  };
}

function mapProfile(profile: ApiProfile, locale: Locale): LiveRecord {
  const selected = profile.selectedVersion;
  const content = object(selected?.content);
  const fallbackDisplay: LocalizedDisplay = {
    ru: profile.authoritativeNameRu,
    ...(profile.displayNameEn ? { en: profile.displayNameEn } : {}),
    ...(profile.displayNameZh ? { zh: profile.displayNameZh } : {}),
  };
  const quality = Array.isArray(content.qualityIndicators)
    ? content.qualityIndicators
    : Array.isArray(content.quality) ? content.quality : [];
  const documents = Array.isArray(content.documentRequirements)
    ? content.documentRequirements
    : Array.isArray(content.documents) ? content.documents : [];
  const storage = object(content.storage);
  const acceptance = object(content.acceptance);
  const state = selected?.lifecycle || 'DRAFT';

  return {
    id: profile.id,
    canonicalCode: profile.canonicalCode,
    display: localized(content.display, fallbackDisplay),
    archetype: profile.archetype,
    purpose: text(content.purpose) || profile.canonicalCode,
    state,
    versionId: selected?.id || profile.id,
    sequence: selected?.sequence || 0,
    contentHash: selected?.contentHash || '',
    ...(selected?.effectiveFrom ? { effectiveFrom: selected.effectiveFrom } : {}),
    ...(selected?.effectiveTo ? { effectiveTo: selected.effectiveTo } : {}),
    updatedAt: profile.updatedAt,
    updatedBy: text(content.updatedBy) || '—',
    sourceStatus: selected?.sourceStatus || 'REVERIFY_REQUIRED',
    immutable: !['DRAFT', 'REVIEW'].includes(state),
    pinnedDealCount: number(content.pinnedDealCount) || 0,
    qualityIndicators: quality.map((item, index) => {
      const row = object(item);
      const code = text(row.code) || `QUALITY_${index + 1}`;
      const methodIds = strings(row.methodIds);
      return {
        code,
        display: localized(row.display, { ru: text(row.name) || code }),
        unitCode: text(row.unitCode) || text(row.unit) || '—',
        required: boolean(row.required) || false,
        methodCount: number(row.methodCount) ?? methodIds.length,
      };
    }),
    documents: documents.map((item, index) => {
      const row = object(item);
      const code = text(row.code) || `DOCUMENT_${index + 1}`;
      return {
        code,
        display: localized(row.display, { ru: text(row.name) || code }),
        releaseBlocking: boolean(row.releaseBlocking) || false,
        ...(text(row.signatureKind) ? { signatureKind: text(row.signatureKind) } : {}),
        ...(text(row.registry) ? { registry: text(row.registry) } : {}),
      };
    }),
    storage: {
      ...(text(storage.temperatureRange) ? { temperatureRange: text(storage.temperatureRange) } : {}),
      ...(text(storage.humidityRange) ? { humidityRange: text(storage.humidityRange) } : {}),
      ...(number(storage.shelfLifeHours) !== undefined ? { shelfLifeHours: number(storage.shelfLifeHours) } : {}),
      packagingKinds: strings(storage.packagingKinds),
      blendingMode: ['ALLOWED', 'PROHIBITED', 'CONTROLLED'].includes(String(storage.blendingMode))
        ? storage.blendingMode as 'ALLOWED' | 'PROHIBITED' | 'CONTROLLED'
        : 'CONTROLLED',
    },
    acceptance: {
      partialAcceptanceAllowed: boolean(acceptance.partialAcceptanceAllowed) || false,
      ...(number(acceptance.rapidDisputeHours) !== undefined ? { rapidDisputeHours: number(acceptance.rapidDisputeHours) } : {}),
      releaseBlockers: strings(acceptance.releaseBlockers),
    },
    sourceRefs: strings(content.sourceRefs),
    legalRuleIds: strings(content.legalRuleIds),
    approvalTrail: [],
    primaryAction: actionFor(profile, locale),
    aggregateVersion: profile.version,
    rawContent: content,
  };
}

function validProfile(value: unknown): value is ApiProfile {
  const row = object(value);
  return Boolean(
    text(row.id)
    && text(row.canonicalCode)
    && text(row.archetype)
    && text(row.authoritativeNameRu)
    && text(row.version)
    && text(row.updatedAt)
    && Array.isArray(row.actions),
  );
}

function newPending(profile: LiveRecord, actionCode: string): PendingAction {
  const uuid = () => crypto.randomUUID();
  return {
    profileId: profile.id,
    profileVersionId: profile.versionId,
    actionCode,
    aggregateVersion: profile.aggregateVersion,
    reason: '',
    effectiveFrom: '',
    commandId: `cp-${uuid()}`,
    idempotencyKey: `cp-${uuid()}`,
    correlationId: `cp-${uuid()}`,
  };
}

export function LiveCommodityProfileRegistry({
  locale: localeInput,
  csrfToken,
  selectedProfileId,
}: Readonly<{
  locale?: string;
  csrfToken: string;
  selectedProfileId?: string;
}>) {
  const locale = localeOf(localeInput);
  const copy = COPY[locale];
  const router = useRouter();
  const [kind, setKind] = React.useState<LiveKind>('loading');
  const [profiles, setProfiles] = React.useState<LiveRecord[]>([]);
  const [message, setMessage] = React.useState('');
  const [pending, setPending] = React.useState<PendingAction | null>(null);
  const [executing, setExecuting] = React.useState(false);
  const [receipt, setReceipt] = React.useState('');

  const load = React.useCallback(async (mode: 'initial' | 'retry' | 'reconnect' = 'initial') => {
    if (mode === 'reconnect') setKind('reconnecting');
    else if (profiles.length === 0) setKind('loading');
    setMessage('');

    const fetchRegistry = async (url: string) => fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(9_000),
    });

    try {
      let response = await fetchRegistry('/api/staff/commodity-profile-registry?limit=100');
      if (response.status === 401 || response.status === 403) {
        response = await fetchRegistry('/api/platform-v7/commodity-profiles?limit=100');
      }
      if (response.status === 401 || response.status === 403) {
        setKind('forbidden');
        setMessage(copy.forbidden);
        return;
      }
      if (!response.ok) throw new Error(`registry_${response.status}`);
      const payload = await response.json().catch(() => null) as ApiList | null;
      if (!payload || !Array.isArray(payload.items) || !payload.items.every(validProfile)) {
        setKind('error');
        setMessage(copy.invalidPayload);
        return;
      }
      const mapped = payload.items.map((profile) => mapProfile(profile, locale));
      setProfiles(mapped);
      setKind(mapped.length === 0 ? 'empty' : 'ready');
    } catch {
      setKind(profiles.length > 0 ? 'reconnecting' : 'error');
      setMessage(navigator.onLine ? copy.unavailable : copy.offline);
    }
  }, [copy.forbidden, copy.invalidPayload, copy.offline, copy.unavailable, locale, profiles.length]);

  React.useEffect(() => {
    void load('initial');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    const reconnect = () => void load('reconnect');
    window.addEventListener('online', reconnect);
    return () => window.removeEventListener('online', reconnect);
  }, [load]);

  const loadHistory = React.useCallback(async (profileId: string) => {
    try {
      let response = await fetch(`/api/staff/commodity-profile-registry/${encodeURIComponent(profileId)}/versions?limit=100`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(8_000),
      });
      if (response.status === 401 || response.status === 403) {
        response = await fetch(`/api/platform-v7/commodity-profiles/${encodeURIComponent(profileId)}/versions?limit=100`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(8_000),
        });
      }
      if (!response.ok) return;
      const payload = await response.json().catch(() => null) as ApiHistory | null;
      if (!payload || !Array.isArray(payload.items)) return;
      setProfiles((current) => current.map((profile) => profile.id === profileId
        ? {
            ...profile,
            approvalTrail: payload.items
              .filter((item) => item.approvedAt || item.approvalReason)
              .map((item) => ({
                state: item.lifecycle,
                actor: item.approvedByUserId || '—',
                occurredAt: item.approvedAt || item.updatedAt,
                ...(item.approvalReason ? { reason: item.approvalReason } : {}),
              })),
          }
        : profile));
    } catch {
      // History is additive evidence; the authoritative registry remains visible.
    }
  }, []);

  React.useEffect(() => {
    if (selectedProfileId) void loadHistory(selectedProfileId);
  }, [loadHistory, selectedProfileId]);

  const openAction = (profileId: string, actionCode: string) => {
    const profile = profiles.find((item) => item.id === profileId);
    if (!profile) return;
    if (actionCode === 'UPDATE_DRAFT') {
      router.push(`/platform-v7/commodity-profiles/${encodeURIComponent(profileId)}?mode=edit`);
      setReceipt(copy.editorRequired);
      return;
    }
    setPending(newPending(profile, actionCode));
    setReceipt('');
  };

  const execute = async () => {
    if (!pending || pending.reason.trim().length < 10 || !csrfToken) return;
    setExecuting(true);
    setReceipt('');
    try {
      const payload = pending.actionCode === 'ACTIVATE' && pending.effectiveFrom
        ? { effectiveFrom: new Date(pending.effectiveFrom).toISOString() }
        : undefined;
      const response = await fetch(
        `/api/staff/commodity-profiles/${encodeURIComponent(pending.profileId)}/commands/${encodeURIComponent(pending.actionCode)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
            'If-Match': `"${pending.aggregateVersion}"`,
          },
          body: JSON.stringify({
            commandId: pending.commandId,
            idempotencyKey: pending.idempotencyKey,
            correlationId: pending.correlationId,
            profileVersionId: pending.profileVersionId,
            reason: pending.reason.trim(),
            ...(payload ? { payload } : {}),
          }),
        },
      );
      const result = await response.json().catch(() => ({})) as JsonObject;
      if (response.status === 409) {
        setKind('conflict');
        setMessage(copy.conflict);
        return;
      }
      if (response.status === 401 || response.status === 403) {
        setMessage(copy.sessionRequired);
        return;
      }
      if (!response.ok) {
        setMessage(text(result.message) || text(result.code) || copy.unavailable);
        return;
      }
      setPending(null);
      setReceipt(copy.receipt);
      await load('retry');
    } catch {
      setMessage(copy.unavailable);
    } finally {
      setExecuting(false);
    }
  };

  const viewState = kind === 'reconnecting' && profiles.length > 0 ? 'ready' : kind === 'reconnecting' ? 'loading' : kind;

  return (
    <div className={styles.liveRoot} data-live-registry-state={kind}>
      {kind === 'reconnecting' ? (
        <InlineNotice tone='warning' title={copy.reconnecting} icon={<RefreshCw size={18} className={styles.spin} />}>
          {message || copy.reconnecting}
        </InlineNotice>
      ) : null}
      {receipt ? (
        <InlineNotice tone='success' title={copy.receipt} icon={<CheckCircle2 size={18} />}>
          {receipt}
        </InlineNotice>
      ) : null}
      {message && kind === 'ready' ? (
        <InlineNotice tone='warning' title={copy.unavailable} icon={<AlertTriangle size={18} />}>
          {message}
        </InlineNotice>
      ) : null}

      <CommodityProfileRegistryView
        locale={locale}
        state={viewState as 'loading' | 'ready' | 'empty' | 'error' | 'forbidden' | 'conflict'}
        profiles={profiles}
        selectedProfileId={selectedProfileId}
        message={message}
        onRetry={() => void load('retry')}
        onSelect={(profileId) => {
          void loadHistory(profileId);
          router.replace(`/platform-v7/commodity-profiles/${encodeURIComponent(profileId)}`);
        }}
        onPrimaryAction={openAction}
      />

      {pending ? (
        <Surface className={styles.confirmation} role='dialog' aria-modal='true' aria-labelledby='commodity-action-title'>
          <header>
            <StatusChip tone='warning'><ShieldCheck size={16} />{copy.actionTitle}</StatusChip>
            <h2 id='commodity-action-title'>{copy.actionLabels[pending.actionCode] || pending.actionCode}</h2>
          </header>
          <label>
            <span>{copy.actionReason}</span>
            <textarea
              value={pending.reason}
              minLength={10}
              maxLength={2000}
              placeholder={copy.reasonPlaceholder}
              onChange={(event) => setPending({ ...pending, reason: event.currentTarget.value })}
            />
          </label>
          {pending.actionCode === 'ACTIVATE' ? (
            <label>
              <span>{copy.effectiveFrom}</span>
              <input
                type='datetime-local'
                value={pending.effectiveFrom}
                onChange={(event) => setPending({ ...pending, effectiveFrom: event.currentTarget.value })}
              />
            </label>
          ) : null}
          {message ? <InlineNotice tone='critical' title={message}>{message}</InlineNotice> : null}
          <div className={styles.confirmationActions}>
            <Button variant='secondary' disabled={executing} onClick={() => setPending(null)}>{copy.cancel}</Button>
            <Button
              disabled={executing || pending.reason.trim().length < 10 || (pending.actionCode === 'ACTIVATE' && !pending.effectiveFrom)}
              onClick={() => void execute()}
            >
              {executing ? copy.executing : copy.confirm}
            </Button>
          </div>
        </Surface>
      ) : null}
    </div>
  );
}
