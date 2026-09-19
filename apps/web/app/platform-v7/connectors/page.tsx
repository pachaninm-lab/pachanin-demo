import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { InlineNotice, StatusChip } from '@pc/design-system-v8';
import {
  getIntegrationDiagnostics,
  type IntegrationDiagnosticConnector,
} from '@/lib/integrations-server';
import {
  OperationalCockpitSection,
  OperationalDecisionCockpit,
  OperationalQueue,
  OperationalQueueLink,
  operationalCockpitClasses,
  type OperationalPriority,
} from '@/components/transaction-ux/OperationalDecisionCockpit';

type Locale = 'ru' | 'en' | 'zh';

type Copy = Readonly<{
  metadataTitle: string;
  metadataDescription: string;
  eyebrow: string;
  title: string;
  description: string;
  statusAvailable: string;
  statusUnavailable: string;
  blocker: string;
  owner: string;
  impact: string;
  result: string;
  nextAction: string;
  prioritySection: string;
  factsSection: string;
  availableTitle: string;
  availableDescription: string;
  unavailableTitle: string;
  unavailableDescription: string;
  unavailableImpact: string;
  unavailableResult: string;
  openStatus: string;
  openFgis: string;
  diagnosticTitle: string;
  diagnosticOnly: string;
  emptyTitle: string;
  emptyDescription: string;
  verificationTitle: string;
  boundaryTitle: string;
  boundary: string;
  ownerValue: string;
  impactValue: string;
  resultValue: string;
  callbacks: string;
  facts: Readonly<{
    endpoint: string;
    endpointHint: string;
    records: string;
    recordsHint: string;
    nonProduction: string;
    nonProductionHint: string;
    callbacks: string;
    callbacksHint: string;
    production: string;
    productionHint: string;
  }>;
  values: Readonly<{
    available: string;
    unavailable: string;
    notConfirmed: string;
  }>;
  statuses: Readonly<{
    sandbox: string;
    simulated: string;
    manual: string;
    diagnostic: string;
  }>;
  routes: ReadonlyArray<Readonly<{ href: string; title: string; detail: string }>>;
}>;

const COPY: Record<Locale, Copy> = {
  ru: {
    metadataTitle: 'Интеграционные контуры · Прозрачная Цена',
    metadataDescription: 'Внутренняя диагностика адаптеров и явная граница production-подключений.',
    eyebrow: 'Интеграционные контуры',
    title: 'Диагностика не равна подключению',
    description: 'Экран показывает только записи, возвращённые серверным диагностическим endpoint. Они не подтверждают договор, credentials, внешний обмен, callback, SLA или production-доступность.',
    statusAvailable: 'диагностика доступна',
    statusUnavailable: 'диагностика недоступна',
    blocker: 'Блокер', owner: 'Ответственный', impact: 'Влияние', result: 'Результат', nextAction: 'Следующее действие',
    prioritySection: 'Главная интеграционная задача', factsSection: 'Подтверждённые факты',
    availableTitle: 'Подтвердить внешний контур до использования в Сделке',
    availableDescription: 'Сервер вернул диагностические записи. Ни одна запись не повышается интерфейсом до production-подключения.',
    unavailableTitle: 'Восстановить диагностический endpoint',
    unavailableDescription: 'Серверный реестр адаптеров недоступен или вернул некорректный ответ. Локальные карточки вместо него не подставляются.',
    unavailableImpact: 'нельзя оценить даже внутреннее состояние адаптеров',
    unavailableResult: 'валидный серверный ответ и отдельное внешнее подтверждение',
    openStatus: 'Открыть состояние системы', openFgis: 'Проверить контур ФГИС',
    diagnosticTitle: 'Серверные диагностические записи', diagnosticOnly: 'Только диагностика',
    emptyTitle: 'Сервер не вернул записей адаптеров', emptyDescription: 'Интерфейс не создаёт отсутствующие интеграции и не показывает плановые системы как подключённые.',
    verificationTitle: 'Контуры внешнего подтверждения', boundaryTitle: 'Граница доказательства',
    boundary: 'Production-подключение подтверждается отдельно: договором и доступом, действующими credentials, успешным внешним обменом, проверенной подписью callback, reconciliation, мониторингом и эксплуатационным evidence. Внутренний status или имя адаптера этого не доказывают.',
    ownerValue: 'Integration owner / безопасность', impactValue: 'допуск Сделки к внешнему событию', resultValue: 'подтверждённый end-to-end обмен',
    callbacks: 'callback-событий в диагностике',
    facts: {
      endpoint: 'Диагностический endpoint', endpointHint: 'аутентифицированный /integrations/health',
      records: 'Записей адаптеров', recordsHint: 'только то, что вернул сервер',
      nonProduction: 'Непроизводственных состояний', nonProductionHint: 'sandbox, simulated или manual',
      callbacks: 'Callback-событий', callbacksHint: 'счётчик диагностики, не доказательство корректности',
      production: 'Production-подключения', productionHint: 'нужны внешние и эксплуатационные доказательства',
    },
    values: { available: 'Доступен', unavailable: 'Недоступен', notConfirmed: 'Не подтверждены' },
    statuses: { sandbox: 'Sandbox', simulated: 'Симуляция', manual: 'Ручной режим', diagnostic: 'Диагностический ответ' },
    routes: [
      { href: '/platform-v7/fgis-access', title: 'ФГИС «Зерно» / СДИЗ', detail: 'Организация, полномочия, доступ и фактический обмен.' },
      { href: '/platform-v7/bank/release-safety', title: 'Банковский контур', detail: 'Резерв, запрос, подписанный callback и reconciliation.' },
      { href: '/platform-v7/documents', title: 'ЭДО / ГИС ЭПД / КЭП', detail: 'Доставка, подписание, версии и подтверждение документа.' },
      { href: '/platform-v7/deal-logistics', title: 'Логистика / GPS / ЭТРАН', detail: 'Допуск перевозчика, рейс и подтверждённые события доставки.' },
      { href: '/platform-v7/api-docs', title: 'Партнёрский API', detail: 'Scope, отзыв, аудит и минимальные права вокруг конкретной Сделки.' },
    ],
  },
  en: {
    metadataTitle: 'Integration circuits · Transparent Price',
    metadataDescription: 'Internal adapter diagnostics and an explicit production-connection boundary.',
    eyebrow: 'Integration circuits', title: 'Diagnostics are not a connection',
    description: 'This screen shows only records returned by the server diagnostic endpoint. They do not prove a contract, credentials, external exchange, callback, SLA or production availability.',
    statusAvailable: 'diagnostics available', statusUnavailable: 'diagnostics unavailable',
    blocker: 'Blocker', owner: 'Owner', impact: 'Impact', result: 'Result', nextAction: 'Next action',
    prioritySection: 'Primary integration task', factsSection: 'Confirmed facts',
    availableTitle: 'Confirm the external circuit before using it in a Deal',
    availableDescription: 'The server returned diagnostic records. The UI never upgrades a record to a production connection.',
    unavailableTitle: 'Restore the diagnostic endpoint',
    unavailableDescription: 'The server adapter registry is unavailable or invalid. Local cards are not substituted.',
    unavailableImpact: 'even internal adapter state cannot be assessed',
    unavailableResult: 'a valid server response plus separate external confirmation',
    openStatus: 'Open system status', openFgis: 'Check grain-registry circuit',
    diagnosticTitle: 'Server diagnostic records', diagnosticOnly: 'Diagnostics only',
    emptyTitle: 'No adapter records returned', emptyDescription: 'The UI does not invent missing integrations or display planned systems as connected.',
    verificationTitle: 'External confirmation circuits', boundaryTitle: 'Evidence boundary',
    boundary: 'A production connection requires separate proof: contract and access, active credentials, successful external exchange, verified callback signature, reconciliation, monitoring and operational evidence. An internal status or adapter name proves none of these.',
    ownerValue: 'Integration owner / security', impactValue: 'Deal admission to an external event', resultValue: 'confirmed end-to-end exchange',
    callbacks: 'callback events in diagnostics',
    facts: {
      endpoint: 'Diagnostic endpoint', endpointHint: 'authenticated /integrations/health',
      records: 'Adapter records', recordsHint: 'only records returned by the server',
      nonProduction: 'Non-production states', nonProductionHint: 'sandbox, simulated or manual',
      callbacks: 'Callback events', callbacksHint: 'diagnostic counter, not correctness proof',
      production: 'Production connections', productionHint: 'external and operational evidence required',
    },
    values: { available: 'Available', unavailable: 'Unavailable', notConfirmed: 'Not confirmed' },
    statuses: { sandbox: 'Sandbox', simulated: 'Simulation', manual: 'Manual mode', diagnostic: 'Diagnostic response' },
    routes: [
      { href: '/platform-v7/fgis-access', title: 'Grain registry / SDIZ', detail: 'Organization, authority, access and actual exchange.' },
      { href: '/platform-v7/bank/release-safety', title: 'Bank circuit', detail: 'Reserve, request, signed callback and reconciliation.' },
      { href: '/platform-v7/documents', title: 'EDI / e-transport / qualified signature', detail: 'Delivery, signing, versions and document confirmation.' },
      { href: '/platform-v7/deal-logistics', title: 'Logistics / GPS / rail', detail: 'Carrier admission, trip and confirmed delivery events.' },
      { href: '/platform-v7/api-docs', title: 'Partner API', detail: 'Scope, revocation, audit and least privilege around a specific Deal.' },
    ],
  },
  zh: {
    metadataTitle: '集成闭环 · 透明价格', metadataDescription: '内部适配器诊断和明确的生产连接边界。',
    eyebrow: '集成闭环', title: '诊断不等于连接',
    description: '此页面仅显示服务器诊断 endpoint 返回的记录。它们不能证明合同、凭证、外部交换、回调、SLA 或生产可用性。',
    statusAvailable: '诊断可用', statusUnavailable: '诊断不可用',
    blocker: '阻塞项', owner: '负责人', impact: '影响', result: '结果', nextAction: '下一步',
    prioritySection: '主要集成任务', factsSection: '已确认事实',
    availableTitle: '在交易中使用前确认外部闭环',
    availableDescription: '服务器返回了诊断记录。界面不会把任何记录升级为生产连接。',
    unavailableTitle: '恢复诊断 endpoint',
    unavailableDescription: '服务器适配器登记不可用或响应无效。不会用本地卡片替代。',
    unavailableImpact: '无法评估内部适配器状态', unavailableResult: '有效服务器响应和单独的外部确认',
    openStatus: '打开系统状态', openFgis: '检查粮食登记闭环',
    diagnosticTitle: '服务器诊断记录', diagnosticOnly: '仅诊断',
    emptyTitle: '服务器未返回适配器记录', emptyDescription: '界面不会虚构缺失的集成，也不会把计划系统显示为已连接。',
    verificationTitle: '外部确认闭环', boundaryTitle: '证据边界',
    boundary: '生产连接需要单独证明：合同和访问权限、有效凭证、成功的外部交换、已验证的回调签名、对账、监控和运行证据。内部状态或适配器名称都不能证明这些条件。',
    ownerValue: '集成负责人 / 安全', impactValue: '交易获得外部事件准入', resultValue: '已确认的端到端交换',
    callbacks: '诊断中的回调事件',
    facts: {
      endpoint: '诊断 endpoint', endpointHint: '已认证的 /integrations/health',
      records: '适配器记录', recordsHint: '仅限服务器返回的记录',
      nonProduction: '非生产状态', nonProductionHint: 'sandbox、simulated 或 manual',
      callbacks: '回调事件', callbacksHint: '诊断计数，不代表正确性证明',
      production: '生产连接', productionHint: '需要外部和运行证据',
    },
    values: { available: '可用', unavailable: '不可用', notConfirmed: '未确认' },
    statuses: { sandbox: '沙箱', simulated: '模拟', manual: '手动模式', diagnostic: '诊断响应' },
    routes: [
      { href: '/platform-v7/fgis-access', title: '粮食登记 / SDIZ', detail: '组织、权限、访问和实际交换。' },
      { href: '/platform-v7/bank/release-safety', title: '银行闭环', detail: '预留、请求、签名回调和对账。' },
      { href: '/platform-v7/documents', title: '电子文件 / 电子运输 / 合格签名', detail: '发送、签署、版本和文件确认。' },
      { href: '/platform-v7/deal-logistics', title: '物流 / GPS / 铁路', detail: '承运方准入、运输和已确认的交付事件。' },
      { href: '/platform-v7/api-docs', title: '合作伙伴 API', detail: '围绕具体交易的 scope、撤销、审计和最小权限。' },
    ],
  },
};

function localeOf(value: string): Locale {
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('zh')) return 'zh';
  return 'ru';
}

function diagnosticLabel(status: string, copy: Copy): string {
  const normalized = status.trim().toUpperCase();
  if (normalized === 'SANDBOX_ONLY') return copy.statuses.sandbox;
  if (normalized === 'LIVE_SIMULATED') return copy.statuses.simulated;
  if (normalized === 'MANUAL') return copy.statuses.manual;
  return copy.statuses.diagnostic;
}

function isNonProduction(connector: IntegrationDiagnosticConnector): boolean {
  return ['SANDBOX_ONLY', 'LIVE_SIMULATED', 'MANUAL'].includes(connector.status.trim().toUpperCase());
}

export async function generateMetadata(): Promise<Metadata> {
  const copy = COPY[localeOf(await getLocale())];
  return {
    title: copy.metadataTitle,
    description: copy.metadataDescription,
    robots: { index: false, follow: false },
  };
}

export default async function ConnectorsPage() {
  const copy = COPY[localeOf(await getLocale())];
  const diagnostics = await getIntegrationDiagnostics();
  const nonProductionCount = diagnostics.connectors.filter(isNonProduction).length;
  const callbackCount = diagnostics.connectors.reduce((sum, connector) => sum + (connector.callbacks ?? 0), 0);

  const priority: OperationalPriority = diagnostics.available
    ? {
        state: 'active',
        title: copy.availableTitle,
        description: copy.availableDescription,
        owner: copy.ownerValue,
        impact: copy.impactValue,
        result: copy.resultValue,
        primaryAction: <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/status'>{copy.openStatus}</Link>,
        secondaryAction: <Link className={operationalCockpitClasses.secondaryLink} href='/platform-v7/fgis-access'>{copy.openFgis}</Link>,
      }
    : {
        state: 'critical',
        title: copy.unavailableTitle,
        description: copy.unavailableDescription,
        blocker: copy.unavailableDescription,
        owner: copy.ownerValue,
        impact: copy.unavailableImpact,
        result: copy.unavailableResult,
        primaryAction: <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/status'>{copy.openStatus}</Link>,
      };

  return (
    <OperationalDecisionCockpit
      testId='platform-v7-connectors-v8'
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      statusLabel={diagnostics.available ? copy.statusAvailable : copy.statusUnavailable}
      statusTone={diagnostics.available ? 'warning' : 'critical'}
      priority={priority}
      labels={{
        blocker: copy.blocker,
        owner: copy.owner,
        impact: copy.impact,
        result: copy.result,
        nextAction: copy.nextAction,
        prioritySection: copy.prioritySection,
        factsSection: copy.factsSection,
      }}
      facts={[
        { label: copy.facts.endpoint, value: diagnostics.available ? copy.values.available : copy.values.unavailable, hint: copy.facts.endpointHint },
        { label: copy.facts.records, value: diagnostics.available ? String(diagnostics.connectors.length) : '—', hint: copy.facts.recordsHint },
        { label: copy.facts.nonProduction, value: diagnostics.available ? String(nonProductionCount) : '—', hint: copy.facts.nonProductionHint },
        { label: copy.facts.callbacks, value: diagnostics.available ? String(callbackCount) : '—', hint: copy.facts.callbacksHint },
        { label: copy.facts.production, value: copy.values.notConfirmed, hint: copy.facts.productionHint },
      ]}
      boundary={copy.boundary}
    >
      <OperationalCockpitSection id='diagnostics'>
        <OperationalQueue>
          {diagnostics.connectors.length > 0 ? diagnostics.connectors.map((connector) => (
            <OperationalQueueLink
              key={connector.name}
              href='/platform-v7/status'
              title={connector.name.replaceAll('_', ' ')}
              detail={`${diagnosticLabel(connector.status, copy)}${connector.callbacks === undefined ? '' : ` · ${connector.callbacks} ${copy.callbacks}`}`}
              status={<StatusChip tone='warning'>{copy.diagnosticOnly}</StatusChip>}
            />
          )) : (
            <InlineNotice tone={diagnostics.available ? 'warning' : 'critical'} title={diagnostics.available ? copy.emptyTitle : copy.unavailableTitle}>
              {diagnostics.available ? copy.emptyDescription : copy.unavailableDescription}
            </InlineNotice>
          )}
        </OperationalQueue>
      </OperationalCockpitSection>

      <OperationalCockpitSection id='verification'>
        <OperationalQueue>
          {copy.routes.map((route) => (
            <OperationalQueueLink
              key={route.href}
              {...route}
              status={<StatusChip tone='warning'>{copy.values.notConfirmed}</StatusChip>}
            />
          ))}
        </OperationalQueue>
      </OperationalCockpitSection>

      <InlineNotice tone='information' title={copy.boundaryTitle}>
        {copy.boundary}
      </InlineNotice>
    </OperationalDecisionCockpit>
  );
}
