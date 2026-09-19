import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { InlineNotice, StatusChip } from '@pc/design-system-v8';
import {
  OperationalCockpitSection,
  OperationalDecisionCockpit,
  OperationalQueue,
  OperationalQueueLink,
  operationalCockpitClasses,
  type OperationalPriority,
} from '@/components/transaction-ux/OperationalDecisionCockpit';
import { getAuditServerState, type AuditServerEntry } from '@/lib/audit-server';

type Locale = 'ru' | 'en' | 'zh';

type Copy = Readonly<{
  metadataTitle: string;
  metadataDescription: string;
  eyebrow: string;
  title: string;
  description: string;
  statusAvailable: string;
  statusUnavailable: string;
  statusHashGap: string;
  labels: Readonly<{ blocker: string; owner: string; impact: string; result: string; nextAction: string; prioritySection: string; factsSection: string }>;
  facts: Readonly<{ records: string; actors: string; objects: string; hashes: string }>;
  values: Readonly<{ unavailable: string; confirmed: string; pending: string; none: string; system: string }>;
  actions: Readonly<{ controlTower: string; deals: string; status: string }>;
  unavailableTask: Readonly<{ title: string; description: string; blocker: string; impact: string; result: string }>;
  emptyTask: Readonly<{ title: string; description: string; blocker: string; impact: string; result: string }>;
  reviewTask: Readonly<{ title: string; description: string; blocker: string; impact: string; result: string }>;
  authorityTitle: string;
  authorityNotice: string;
  boundaryTitle: string;
  boundary: string;
  queueTitle: string;
  emptyQueue: string;
  entry: Readonly<{ actor: string; object: string; time: string; hashPresent: string; hashMissing: string }>;
}>;

const COPY: Record<Locale, Copy> = {
  ru: {
    metadataTitle: 'Журнал аудита · Прозрачная Цена',
    metadataDescription: 'Read-only журнал серверных audit-событий без локальных фактов и денежных выводов.',
    eyebrow: 'Контроль · аудит',
    title: 'Кто, когда и какой объект изменил',
    description: 'Экран показывает только записи, возвращённые защищённым API аудита. Он не подставляет тестовые сделки, суммы, последствия или локальную матрицу прав.',
    statusAvailable: 'серверный журнал доступен',
    statusUnavailable: 'серверный журнал недоступен',
    statusHashGap: 'есть записи без hash',
    labels: { blocker: 'Блокер', owner: 'Ответственный', impact: 'Влияние', result: 'Результат', nextAction: 'Следующее действие', prioritySection: 'Главная задача', factsSection: 'Подтверждённые факты' },
    facts: { records: 'Записей', actors: 'Акторов', objects: 'Типов объектов', hashes: 'Записей с hash' },
    values: { unavailable: 'Недоступно', confirmed: 'Подтверждено', pending: 'Требует проверки', none: 'Нет', system: 'Система' },
    actions: { controlTower: 'Открыть центр управления', deals: 'Открыть Сделки', status: 'Проверить состояние' },
    unavailableTask: {
      title: 'Восстановить серверный доступ к журналу',
      description: 'API `/audit` не подтвердил источник. Интерфейс не заменяет его локальными событиями.',
      blocker: 'нет успешного ответа защищённого audit API',
      impact: 'невозможно доказательно просмотреть историю действий',
      result: 'доступный read-only журнал для разрешённой staff-роли',
    },
    emptyTask: {
      title: 'Проверить корректность пустого журнала',
      description: 'API доступен, но не вернул валидных записей. Это не считается доказательством отсутствия действий.',
      blocker: 'нет audit-записей в текущем ответе',
      impact: 'операционная история не подтверждена данными',
      result: 'подтверждённая запись или документированное основание пустого ответа',
    },
    reviewTask: {
      title: 'Проверить последние серверные события',
      description: 'Сопоставьте действие, актора, объект и время с канонической Сделкой или операционной очередью.',
      blocker: 'автоматическая проверка hash-chain этим экраном не выполняется',
      impact: 'запись видна, но целостность всей цепочки требует отдельного серверного verify-контракта',
      result: 'проверенное событие и зафиксированный следующий шаг',
    },
    authorityTitle: 'Источник и права',
    authorityNotice: 'Данные читаются через `GET /audit` с server auth и `no-store`. API допускает только роли ADMIN и SUPPORT_MANAGER. Клиент не назначает себе роль и не фильтрует права.',
    boundaryTitle: 'Граница доказательности',
    boundary: 'Наличие hash у записи показывается как серверный факт, но не означает, что цепочка проверена этим экраном. Денежный эффект, юридическое последствие и корректность действия нельзя выводить из названия события без отдельного подтверждённого источника.',
    queueTitle: 'Последние серверные события',
    emptyQueue: 'Сервер не вернул валидных audit-событий.',
    entry: { actor: 'Актор', object: 'Объект', time: 'Время', hashPresent: 'hash есть', hashMissing: 'hash отсутствует' },
  },
  en: {
    metadataTitle: 'Audit log · Transparent Price',
    metadataDescription: 'A read-only server audit log without local facts or inferred money impact.',
    eyebrow: 'Control · audit',
    title: 'Who changed which object and when',
    description: 'This screen displays records returned by the protected audit API only. It does not substitute test Deals, amounts, consequences or a local permission matrix.',
    statusAvailable: 'server audit log available',
    statusUnavailable: 'server audit log unavailable',
    statusHashGap: 'some records have no hash',
    labels: { blocker: 'Blocker', owner: 'Owner', impact: 'Impact', result: 'Result', nextAction: 'Next action', prioritySection: 'Primary task', factsSection: 'Confirmed facts' },
    facts: { records: 'Records', actors: 'Actors', objects: 'Object types', hashes: 'Records with hash' },
    values: { unavailable: 'Unavailable', confirmed: 'Confirmed', pending: 'Review required', none: 'None', system: 'System' },
    actions: { controlTower: 'Open control tower', deals: 'Open Deals', status: 'Check status' },
    unavailableTask: {
      title: 'Restore server access to the audit log',
      description: 'The `/audit` API did not confirm the source. The UI does not replace it with local events.',
      blocker: 'no successful response from the protected audit API',
      impact: 'the action history cannot be inspected as evidence',
      result: 'a read-only log available to an authorized staff role',
    },
    emptyTask: {
      title: 'Validate the empty audit response',
      description: 'The API is available but returned no valid records. This is not proof that no actions occurred.',
      blocker: 'no audit records in the current response',
      impact: 'the operational history is not confirmed by data',
      result: 'a confirmed record or a documented reason for the empty response',
    },
    reviewTask: {
      title: 'Review the latest server events',
      description: 'Match the action, actor, object and time to the canonical Deal or operational queue.',
      blocker: 'this screen does not automatically verify the hash chain',
      impact: 'a record is visible, but full-chain integrity requires a separate server verify contract',
      result: 'a reviewed event and a recorded next action',
    },
    authorityTitle: 'Source and permissions',
    authorityNotice: 'Data is read through `GET /audit` with server authentication and `no-store`. The API allows ADMIN and SUPPORT_MANAGER only. The client does not assign its own role or filter permissions.',
    boundaryTitle: 'Evidence boundary',
    boundary: 'A record hash is displayed as a server fact, but it does not mean this screen verified the chain. Money impact, legal effect and action correctness cannot be inferred from the event name without a separate confirmed source.',
    queueTitle: 'Latest server events',
    emptyQueue: 'The server returned no valid audit events.',
    entry: { actor: 'Actor', object: 'Object', time: 'Time', hashPresent: 'hash present', hashMissing: 'hash missing' },
  },
  zh: {
    metadataTitle: '审计日志 · 透明价格',
    metadataDescription: '只读服务器审计日志，不使用本地事实，也不推断资金影响。',
    eyebrow: '控制 · 审计',
    title: '谁在何时更改了哪个对象',
    description: '该页面仅显示受保护审计 API 返回的记录，不会填充测试交易、金额、后果或本地权限矩阵。',
    statusAvailable: '服务器审计日志可用',
    statusUnavailable: '服务器审计日志不可用',
    statusHashGap: '部分记录没有 hash',
    labels: { blocker: '阻塞项', owner: '负责人', impact: '影响', result: '结果', nextAction: '下一步', prioritySection: '主要任务', factsSection: '已确认事实' },
    facts: { records: '记录数', actors: '操作人', objects: '对象类型', hashes: '含 hash 的记录' },
    values: { unavailable: '不可用', confirmed: '已确认', pending: '需要复核', none: '无', system: '系统' },
    actions: { controlTower: '打开控制中心', deals: '打开交易', status: '检查状态' },
    unavailableTask: {
      title: '恢复服务器审计日志访问',
      description: '`/audit` API 未确认数据源。界面不会用本地事件替代。',
      blocker: '受保护审计 API 没有成功响应',
      impact: '无法以证据方式查看操作历史',
      result: '授权 staff 角色可访问的只读日志',
    },
    emptyTask: {
      title: '核实空审计响应',
      description: 'API 可用，但没有返回有效记录。这不能证明没有发生操作。',
      blocker: '当前响应没有审计记录',
      impact: '运营历史未由数据确认',
      result: '已确认记录或空响应的书面原因',
    },
    reviewTask: {
      title: '复核最新服务器事件',
      description: '将操作、操作人、对象和时间与规范交易或运营队列对应。',
      blocker: '该页面不会自动验证 hash 链',
      impact: '记录可见，但完整链路完整性需要独立的服务器验证合同',
      result: '已复核事件和已记录的下一步',
    },
    authorityTitle: '来源与权限',
    authorityNotice: '数据通过带服务器认证和 `no-store` 的 `GET /audit` 读取。API 仅允许 ADMIN 和 SUPPORT_MANAGER。客户端不会自行分配角色或过滤权限。',
    boundaryTitle: '证据边界',
    boundary: '显示记录 hash 只是服务器事实，并不表示该页面已验证整条链。没有独立确认来源时，不能从事件名称推断资金影响、法律后果或操作正确性。',
    queueTitle: '最新服务器事件',
    emptyQueue: '服务器没有返回有效审计事件。',
    entry: { actor: '操作人', object: '对象', time: '时间', hashPresent: '存在 hash', hashMissing: '缺少 hash' },
  },
};

function localeOf(value: string): Locale {
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('zh')) return 'zh';
  return 'ru';
}

function dateLocale(locale: Locale): string {
  return locale === 'en' ? 'en-GB' : locale === 'zh' ? 'zh-CN' : 'ru-RU';
}

function formatDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(dateLocale(locale), { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value));
}

function entryHref(entry: AuditServerEntry): string {
  if (entry.entityId && entry.entityType.toLowerCase().includes('deal')) {
    return `/platform-v7/deals/${encodeURIComponent(entry.entityId)}`;
  }
  return '/platform-v7/control-tower';
}

export async function generateMetadata(): Promise<Metadata> {
  const copy = COPY[localeOf(await getLocale())];
  return { title: copy.metadataTitle, description: copy.metadataDescription, robots: { index: false, follow: false } };
}

export default async function PlatformV7AuditLogPage() {
  const locale = localeOf(await getLocale());
  const copy = COPY[locale];
  const state = await getAuditServerState();
  const entries = [...state.entries].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  const actorCount = new Set(entries.map((entry) => entry.actorUserId).filter(Boolean)).size;
  const objectTypeCount = new Set(entries.map((entry) => entry.entityType).filter(Boolean)).size;
  const hashCount = entries.filter((entry) => Boolean(entry.hash)).length;
  const hashGap = entries.length > 0 && hashCount !== entries.length;
  const latest = entries[0] ?? null;

  const task = !state.available ? copy.unavailableTask : entries.length === 0 ? copy.emptyTask : copy.reviewTask;
  const priority: OperationalPriority = {
    state: !state.available ? 'critical' : 'active',
    ...task,
    owner: 'Audit / Security / Support',
    primaryAction: latest
      ? <Link className={operationalCockpitClasses.primaryLink} href={entryHref(latest)}>{copy.actions.controlTower}</Link>
      : <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/status'>{copy.actions.status}</Link>,
    secondaryAction: <Link className={operationalCockpitClasses.secondaryLink} href='/platform-v7/deals'>{copy.actions.deals}</Link>,
  };

  return (
    <OperationalDecisionCockpit
      testId='platform-v7-audit-log-v8'
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      statusLabel={!state.available ? copy.statusUnavailable : hashGap ? copy.statusHashGap : copy.statusAvailable}
      statusTone={!state.available || hashGap ? 'warning' : 'success'}
      priority={priority}
      facts={[
        { label: copy.facts.records, value: state.available ? String(entries.length) : copy.values.unavailable, hint: copy.authorityTitle },
        { label: copy.facts.actors, value: state.available ? String(actorCount) : copy.values.unavailable },
        { label: copy.facts.objects, value: state.available ? String(objectTypeCount) : copy.values.unavailable },
        { label: copy.facts.hashes, value: state.available ? `${hashCount}/${entries.length}` : copy.values.unavailable, hint: copy.boundaryTitle },
      ]}
      boundary={copy.boundary}
      labels={copy.labels}
    >
      <InlineNotice tone='information' title={copy.authorityTitle}>{copy.authorityNotice}</InlineNotice>

      <OperationalCockpitSection id='audit-events'>
        <OperationalQueue>
          {entries.length > 0 ? entries.map((entry) => {
            const objectLabel = [entry.entityType, entry.entityId].filter(Boolean).join(' · ') || copy.values.none;
            const actor = entry.actorUserId ?? copy.values.system;
            return (
              <OperationalQueueLink
                key={entry.id}
                href={entryHref(entry)}
                title={entry.action}
                detail={`${copy.entry.actor}: ${actor} · ${copy.entry.object}: ${objectLabel} · ${copy.entry.time}: ${formatDate(entry.createdAt, locale)}`}
                status={<StatusChip tone={entry.hash ? 'success' : 'warning'}>{entry.hash ? copy.entry.hashPresent : copy.entry.hashMissing}</StatusChip>}
              />
            );
          }) : (
            <OperationalQueueLink
              href='/platform-v7/status'
              title={copy.queueTitle}
              detail={copy.emptyQueue}
              status={<StatusChip tone='warning'>{copy.values.pending}</StatusChip>}
            />
          )}
        </OperationalQueue>
      </OperationalCockpitSection>

      <InlineNotice tone='warning' title={copy.boundaryTitle}>{copy.boundary}</InlineNotice>
    </OperationalDecisionCockpit>
  );
}
