import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { InlineNotice, StatusChip } from '@pc/design-system-v8';
import { getDealsCanonical } from '@/lib/deals-server';
import {
  getDisputes,
  disputeTotalHeldRub,
  openDisputeCount,
  type DisputeServerItem,
} from '@/lib/disputes-server';
import {
  getShipments,
  activeShipmentCount,
  shipmentsWithBlockers,
  type ShipmentServerItem,
} from '@/lib/logistics-server';
import { getOutboxStatus, type OutboxServerEntry } from '@/lib/outbox-server';
import { OrganizationVerificationPanel } from '@/components/platform-v7/OrganizationVerificationPanel';
import {
  OperationalCockpitSection,
  OperationalDecisionCockpit,
  OperationalQueue,
  OperationalQueueLink,
  operationalCockpitClasses,
  type OperationalPriority,
} from '@/components/transaction-ux/OperationalDecisionCockpit';

type Locale = 'ru' | 'en' | 'zh';
type BlockerSeverity = 'critical' | 'warning';
type OperatorBlocker = Readonly<{
  id: string;
  title: string;
  detail: string;
  href: string;
  severity: BlockerSeverity;
  owner: string;
  impact: string;
  result: string;
}>;

type Copy = Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  statusAction: string;
  statusClean: string;
  statusUnavailable: string;
  nextAction: string;
  blocker: string;
  owner: string;
  impact: string;
  result: string;
  prioritySection: string;
  factsSection: string;
  unavailableTitle: string;
  unavailableDescription: string;
  unavailableImpact: string;
  unavailableResult: string;
  clearTitle: string;
  clearDescription: string;
  clearImpact: string;
  clearResult: string;
  openItem: string;
  openDeals: string;
  queueTitle: string;
  queueEmptyTitle: string;
  queueEmptyDescription: string;
  navigationTitle: string;
  boundary: string;
  facts: Readonly<{
    deals: string;
    dealsHint: string;
    disputes: string;
    disputesHint: string;
    held: string;
    heldHint: string;
    shipments: string;
    shipmentsHint: string;
    external: string;
    externalHint: string;
  }>;
  routes: ReadonlyArray<Readonly<{ href: string; title: string; detail: string }>>;
  disputePrefix: string;
  shipmentPrefix: string;
  bankPrefix: string;
  bankDetail: string;
  disputeOwner: string;
  shipmentOwner: string;
  bankOwner: string;
  disputeImpact: string;
  shipmentImpact: string;
  bankImpact: string;
  disputeResult: string;
  shipmentResult: string;
  bankResult: string;
}>;

const COPY: Record<Locale, Copy> = {
  ru: {
    eyebrow: 'Оператор · управление исполнением',
    title: 'Сначала критический блокер сделки',
    description: 'Оператор видит подтверждённую бизнес-очередь: что остановлено, кто отвечает и какое действие нужно выполнить сейчас.',
    statusAction: 'требует действий',
    statusClean: 'очередь чистая',
    statusUnavailable: 'источник недоступен',
    nextAction: 'Следующее действие',
    blocker: 'Блокер',
    owner: 'Ответственный',
    impact: 'Влияние',
    result: 'Результат',
    prioritySection: 'Главная операционная задача',
    factsSection: 'Ключевые факты',
    unavailableTitle: 'Восстановить серверную очередь',
    unavailableDescription: 'Сделки, споры, рейсы и внешние события не подтверждены. Интерфейс не показывает локальные сценарии вместо серверных данных.',
    unavailableImpact: 'операционные решения приостановлены',
    unavailableResult: 'повторно полученная подтверждённая очередь',
    clearTitle: 'Критических блокеров не обнаружено',
    clearDescription: 'Доступные серверные очереди не требуют немедленного вмешательства. Продолжайте контроль активных сделок.',
    clearImpact: 'деньги и исполнение не имеют подтверждённого стоп-фактора',
    clearResult: 'контроль следующего серверного события',
    openItem: 'Открыть объект',
    openDeals: 'Все сделки',
    queueTitle: 'Очередь исполнения',
    queueEmptyTitle: 'Очередь не содержит подтверждённых блокеров',
    queueEmptyDescription: 'Локальные примеры и демонстрационные карточки не подставляются.',
    navigationTitle: 'Рабочие контуры',
    boundary: 'Оператор управляет очередью и ответственными. Он не подменяет банк, лабораторию, элеватор, подписанта или арбитра и не выпускает деньги.',
    facts: {
      deals: 'Доступных сделок', dealsHint: 'только participant-scoped серверный список',
      disputes: 'Открытых споров', disputesHint: 'OPEN и UNDER_REVIEW',
      held: 'Удержано по спорам', heldHint: 'по подтверждённым money-hold фактам',
      shipments: 'Рейсов с блокерами', shipmentsHint: 'из серверного логистического контура',
      external: 'Внешних событий в очереди', externalHint: 'ожидают отправки или ручной проверки',
    },
    routes: [
      { href: '/platform-v7/deals', title: 'Сделки', detail: 'Канонический реестр и следующее действие' },
      { href: '/platform-v7/documents', title: 'Документы', detail: 'Комплектность и основание для денег' },
      { href: '/platform-v7/deal-logistics', title: 'Логистика', detail: 'Рейсы, допуски и доказательства доставки' },
      { href: '/platform-v7/disputes', title: 'Споры', detail: 'Удержание, доказательства и решение' },
      { href: '/platform-v7/bank/release-safety', title: 'Проверка денег', detail: 'Резерв, запрос, callback и reconciliation' },
      { href: '/platform-v7/status', title: 'Состояние системы', detail: 'Технические сигналы вынесены из бизнес-очереди' },
    ],
    disputePrefix: 'Спор', shipmentPrefix: 'Рейс', bankPrefix: 'Внешнее событие',
    bankDetail: 'Требуется ручная проверка внешнего события.',
    disputeOwner: 'Арбитр / оператор', shipmentOwner: 'Логистика', bankOwner: 'Банк / оператор',
    disputeImpact: 'удержание и закрытие сделки', shipmentImpact: 'приёмка, документы и расчёт', bankImpact: 'внешнее подтверждение денег',
    disputeResult: 'решение и доказательная база', shipmentResult: 'устранённый блокер рейса', bankResult: 'сверенное подтверждённое событие',
  },
  en: {
    eyebrow: 'Operator · execution control',
    title: 'Resolve the critical Deal blocker first',
    description: 'The operator sees a confirmed business queue: what is stopped, who owns it and which action is required now.',
    statusAction: 'action required', statusClean: 'queue clear', statusUnavailable: 'source unavailable',
    nextAction: 'Next action', blocker: 'Blocker', owner: 'Owner', impact: 'Impact', result: 'Result',
    prioritySection: 'Primary operational task', factsSection: 'Key facts',
    unavailableTitle: 'Restore the server queue',
    unavailableDescription: 'Deals, disputes, shipments and external events are not confirmed. The UI does not substitute local scenarios for server data.',
    unavailableImpact: 'operational decisions are paused', unavailableResult: 'a newly confirmed server queue',
    clearTitle: 'No critical blockers detected',
    clearDescription: 'The available server queues require no immediate intervention. Continue monitoring active Deals.',
    clearImpact: 'no confirmed stop factor for money or execution', clearResult: 'monitor the next server event',
    openItem: 'Open item', openDeals: 'All Deals', queueTitle: 'Execution queue',
    queueEmptyTitle: 'No confirmed blockers in the queue', queueEmptyDescription: 'Local examples and demonstration cards are not substituted.',
    navigationTitle: 'Work areas',
    boundary: 'The operator manages queues and owners. The operator does not replace the bank, laboratory, elevator, signatory or arbitrator and cannot release money.',
    facts: {
      deals: 'Accessible Deals', dealsHint: 'participant-scoped server list only',
      disputes: 'Open disputes', disputesHint: 'OPEN and UNDER_REVIEW',
      held: 'Held by disputes', heldHint: 'confirmed money-hold facts only',
      shipments: 'Blocked shipments', shipmentsHint: 'from the server logistics circuit',
      external: 'Queued external events', externalHint: 'pending delivery or manual review',
    },
    routes: [
      { href: '/platform-v7/deals', title: 'Deals', detail: 'Canonical registry and next action' },
      { href: '/platform-v7/documents', title: 'Documents', detail: 'Completeness and money basis' },
      { href: '/platform-v7/deal-logistics', title: 'Logistics', detail: 'Trips, admission and delivery evidence' },
      { href: '/platform-v7/disputes', title: 'Disputes', detail: 'Hold, evidence and decision' },
      { href: '/platform-v7/bank/release-safety', title: 'Money checks', detail: 'Reserve, request, callback and reconciliation' },
      { href: '/platform-v7/status', title: 'System status', detail: 'Technical signals stay outside the business queue' },
    ],
    disputePrefix: 'Dispute', shipmentPrefix: 'Shipment', bankPrefix: 'External event',
    bankDetail: 'The external event requires manual review.',
    disputeOwner: 'Arbitrator / operator', shipmentOwner: 'Logistics', bankOwner: 'Bank / operator',
    disputeImpact: 'hold and Deal closure', shipmentImpact: 'acceptance, documents and settlement', bankImpact: 'external money confirmation',
    disputeResult: 'decision and evidence package', shipmentResult: 'resolved shipment blocker', bankResult: 'reconciled confirmed event',
  },
  zh: {
    eyebrow: '运营方 · 履约控制', title: '先处理交易的关键阻塞项',
    description: '运营方只查看已确认的业务队列：什么被阻塞、谁负责以及现在需要执行什么操作。',
    statusAction: '需要处理', statusClean: '队列正常', statusUnavailable: '数据源不可用',
    nextAction: '下一步', blocker: '阻塞项', owner: '负责人', impact: '影响', result: '结果',
    prioritySection: '主要运营任务', factsSection: '关键事实',
    unavailableTitle: '恢复服务器队列',
    unavailableDescription: '交易、争议、运输和外部事件尚未确认。界面不会用本地场景替代服务器数据。',
    unavailableImpact: '运营决策暂停', unavailableResult: '重新取得已确认的服务器队列',
    clearTitle: '未发现关键阻塞项', clearDescription: '当前可用的服务器队列无需立即干预。继续监控活跃交易。',
    clearImpact: '资金和履约没有已确认的停止因素', clearResult: '监控下一个服务器事件',
    openItem: '打开对象', openDeals: '全部交易', queueTitle: '履约队列',
    queueEmptyTitle: '队列中没有已确认的阻塞项', queueEmptyDescription: '不会替换为本地示例或演示卡片。',
    navigationTitle: '工作区域',
    boundary: '运营方管理队列和负责人，但不能替代银行、实验室、仓储方、签署方或仲裁方，也不能释放资金。',
    facts: {
      deals: '可访问交易', dealsHint: '仅限参与方范围的服务器列表',
      disputes: '未结争议', disputesHint: 'OPEN 和 UNDER_REVIEW',
      held: '争议冻结金额', heldHint: '仅使用已确认的冻结事实',
      shipments: '有阻塞的运输', shipmentsHint: '来自服务器物流闭环',
      external: '排队中的外部事件', externalHint: '等待发送或人工复核',
    },
    routes: [
      { href: '/platform-v7/deals', title: '交易', detail: '规范登记册和下一步操作' },
      { href: '/platform-v7/documents', title: '文件', detail: '完整性和资金依据' },
      { href: '/platform-v7/deal-logistics', title: '物流', detail: '运输、准入和交付证据' },
      { href: '/platform-v7/disputes', title: '争议', detail: '冻结、证据和裁决' },
      { href: '/platform-v7/bank/release-safety', title: '资金检查', detail: '预留、请求、回调和对账' },
      { href: '/platform-v7/status', title: '系统状态', detail: '技术信号与业务队列分离' },
    ],
    disputePrefix: '争议', shipmentPrefix: '运输', bankPrefix: '外部事件',
    bankDetail: '该外部事件需要人工复核。',
    disputeOwner: '仲裁方 / 运营方', shipmentOwner: '物流方', bankOwner: '银行 / 运营方',
    disputeImpact: '冻结和交易关闭', shipmentImpact: '验收、文件和结算', bankImpact: '外部资金确认',
    disputeResult: '裁决和证据包', shipmentResult: '已解除的运输阻塞', bankResult: '已对账的确认事件',
  },
};

function localeOf(value: string): Locale {
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('zh')) return 'zh';
  return 'ru';
}

function money(value: number, locale: Locale): string {
  const language = locale === 'en' ? 'en-US' : locale === 'zh' ? 'zh-CN' : 'ru-RU';
  return new Intl.NumberFormat(language, { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value);
}

function activeDispute(value: DisputeServerItem): boolean {
  return value.status === 'OPEN' || value.status === 'UNDER_REVIEW';
}

function disputeBlocker(dispute: DisputeServerItem, copy: Copy, locale: Locale): OperatorBlocker {
  const critical = dispute.severity === 'CRITICAL' || dispute.severity === 'HIGH';
  return {
    id: dispute.id,
    title: `${copy.disputePrefix} ${dispute.id}`,
    detail: dispute.description,
    href: `/platform-v7/disputes/${encodeURIComponent(dispute.id)}`,
    severity: critical ? 'critical' : 'warning',
    owner: dispute.owner || copy.disputeOwner,
    impact: dispute.moneyHold?.amountRub ? money(dispute.moneyHold.amountRub, locale) : copy.disputeImpact,
    result: copy.disputeResult,
  };
}

function shipmentBlocker(shipment: ShipmentServerItem, copy: Copy): OperatorBlocker {
  return {
    id: shipment.id,
    title: `${copy.shipmentPrefix} ${shipment.id}`,
    detail: shipment.blockers[0] || shipment.nextAction || copy.shipmentImpact,
    href: `/platform-v7/deals/${encodeURIComponent(shipment.dealId)}`,
    severity: 'warning',
    owner: copy.shipmentOwner,
    impact: copy.shipmentImpact,
    result: copy.shipmentResult,
  };
}

function bankBlocker(entry: OutboxServerEntry, copy: Copy): OperatorBlocker {
  return {
    id: entry.id,
    title: `${copy.bankPrefix} ${entry.id}`,
    detail: entry.lastError || copy.bankDetail,
    href: entry.dealId
      ? `/platform-v7/deals/${encodeURIComponent(entry.dealId)}`
      : '/platform-v7/bank/release-safety',
    severity: 'critical',
    owner: copy.bankOwner,
    impact: copy.bankImpact,
    result: copy.bankResult,
  };
}

function priorityFor(
  blocker: OperatorBlocker | undefined,
  sourceUnavailable: boolean,
  copy: Copy,
): OperationalPriority {
  if (blocker) {
    return {
      state: blocker.severity === 'critical' ? 'critical' : 'active',
      title: blocker.title,
      description: blocker.detail,
      blocker: blocker.detail,
      owner: blocker.owner,
      impact: blocker.impact,
      result: blocker.result,
      primaryAction: <Link className={operationalCockpitClasses.primaryLink} href={blocker.href}>{copy.openItem}</Link>,
      secondaryAction: <Link className={operationalCockpitClasses.secondaryLink} href='/platform-v7/deals'>{copy.openDeals}</Link>,
    };
  }

  if (sourceUnavailable) {
    return {
      state: 'critical',
      title: copy.unavailableTitle,
      description: copy.unavailableDescription,
      impact: copy.unavailableImpact,
      result: copy.unavailableResult,
      primaryAction: <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/status'>{copy.routes[5].title}</Link>,
    };
  }

  return {
    state: 'ready',
    title: copy.clearTitle,
    description: copy.clearDescription,
    impact: copy.clearImpact,
    result: copy.clearResult,
    primaryAction: <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/deals'>{copy.openDeals}</Link>,
  };
}

export default async function PlatformV7OperatorPage() {
  const locale = localeOf(await getLocale());
  const copy = COPY[locale];
  const [dealsPayload, disputes, shipments, outbox] = await Promise.all([
    getDealsCanonical(),
    getDisputes(),
    getShipments(),
    getOutboxStatus(),
  ]);

  const deals = Array.isArray(dealsPayload) ? dealsPayload : [];
  const openDisputes = disputes.filter(activeDispute);
  const blockedShipments = shipmentsWithBlockers(shipments);
  const blockers = [
    ...openDisputes.map((dispute) => disputeBlocker(dispute, copy, locale)),
    ...outbox.manualReview.map((entry) => bankBlocker(entry, copy)),
    ...blockedShipments.map((shipment) => shipmentBlocker(shipment, copy)),
  ].sort((left, right) => Number(right.severity === 'critical') - Number(left.severity === 'critical'));

  const sourceUnavailable = !outbox.isApiAvailable
    && deals.length === 0
    && disputes.length === 0
    && shipments.length === 0;
  const priority = priorityFor(blockers[0], sourceUnavailable, copy);
  const disputeCount = openDisputeCount(disputes);
  const heldRub = disputeTotalHeldRub(disputes);
  const shipmentCount = activeShipmentCount(shipments);
  const queuedExternal = outbox.totalPending + outbox.manualReview.length;
  const statusLabel = sourceUnavailable
    ? copy.statusUnavailable
    : blockers.length > 0
      ? copy.statusAction
      : copy.statusClean;
  const statusTone = sourceUnavailable || blockers.some((item) => item.severity === 'critical')
    ? 'critical'
    : blockers.length > 0
      ? 'warning'
      : 'success';

  return (
    <>
    {/* Допуск организаций — первый рабочий вопрос оператора (ядро §3). */}
    <div style={{ margin: '0 0 var(--ds-space-4)' }}>
      <OrganizationVerificationPanel />
    </div>
    <OperationalDecisionCockpit
      testId='platform-v7-operator-v8'
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      statusLabel={statusLabel}
      statusTone={statusTone}
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
        { label: copy.facts.deals, value: sourceUnavailable ? '—' : String(deals.length), hint: copy.facts.dealsHint },
        { label: copy.facts.disputes, value: sourceUnavailable ? '—' : String(disputeCount), hint: copy.facts.disputesHint },
        { label: copy.facts.held, value: sourceUnavailable ? '—' : money(heldRub, locale), hint: copy.facts.heldHint },
        { label: copy.facts.shipments, value: sourceUnavailable ? '—' : String(blockedShipments.length), hint: copy.facts.shipmentsHint },
        { label: copy.facts.external, value: outbox.isApiAvailable ? String(queuedExternal) : '—', hint: copy.facts.externalHint },
      ]}
      boundary={copy.boundary}
    >
      <OperationalCockpitSection id='queue'>
        <OperationalQueue>
          {blockers.length > 0 ? blockers.map((item) => (
            <OperationalQueueLink
              key={`${item.id}:${item.href}`}
              href={item.href}
              title={item.title}
              detail={`${item.detail} · ${item.owner}`}
              status={<StatusChip tone={item.severity}>{copy.openItem}</StatusChip>}
            />
          )) : (
            <InlineNotice
              tone={sourceUnavailable ? 'critical' : 'success'}
              title={sourceUnavailable ? copy.unavailableTitle : copy.queueEmptyTitle}
            >
              {sourceUnavailable ? copy.unavailableDescription : copy.queueEmptyDescription}
            </InlineNotice>
          )}
        </OperationalQueue>
      </OperationalCockpitSection>

      <OperationalCockpitSection>
        <OperationalQueue>
          {copy.routes.map((route) => (
            <OperationalQueueLink key={route.href} {...route} />
          ))}
        </OperationalQueue>
      </OperationalCockpitSection>

      <InlineNotice tone='information' title={copy.navigationTitle}>
        {shipmentCount} · {queuedExternal}
      </InlineNotice>
    </OperationalDecisionCockpit>
    </>
  );
}
