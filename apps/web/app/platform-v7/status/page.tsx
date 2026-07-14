import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { InlineNotice, StatusChip } from '@pc/design-system-v8';
import { getOutboxStatus } from '@/lib/outbox-server';
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
  openOperator: string;
  openConnectors: string;
  integrationsTitle: string;
  boundaryTitle: string;
  boundary: string;
  facts: Readonly<{
    delivery: string;
    deliveryHint: string;
    pending: string;
    pendingHint: string;
    manualReview: string;
    manualReviewHint: string;
    external: string;
    externalHint: string;
  }>;
  states: Readonly<{
    available: string;
    unavailable: string;
    externalRequired: string;
  }>;
  integrations: ReadonlyArray<Readonly<{
    href: string;
    title: string;
    detail: string;
  }>>;
}>;

const COPY: Record<Locale, Copy> = {
  ru: {
    metadataTitle: 'Состояние контуров · Прозрачная Цена',
    metadataDescription: 'Подтверждаемая доступность внутреннего контура и честные границы внешних интеграций.',
    eyebrow: 'Состояние системы',
    title: 'Показываем только подтверждаемые сигналы',
    description: 'Внутренняя очередь событий проверяется через серверный контур. Для ФГИС, банка, ЭДО, ЭПД и лабораторных систем не отображаются выдуманные uptime или подключения.',
    statusAvailable: 'внутренний контур доступен',
    statusUnavailable: 'внутренний контур недоступен',
    blocker: 'Блокер',
    owner: 'Ответственный',
    impact: 'Влияние',
    result: 'Результат',
    nextAction: 'Следующее действие',
    prioritySection: 'Главная проверка',
    factsSection: 'Подтверждённые факты',
    availableTitle: 'Внутренняя очередь событий отвечает',
    availableDescription: 'Доступны серверные pending и manual-review состояния. Это не подтверждает доступность внешних систем.',
    unavailableTitle: 'Восстановить внутренний канал событий',
    unavailableDescription: 'Серверная очередь событий недоступна. Бизнес-экран не должен трактовать это как отсутствие проблем.',
    unavailableImpact: 'нельзя подтвердить доставку и ручную проверку внешних событий',
    unavailableResult: 'восстановленная серверная очередь и повторная сверка',
    openOperator: 'Вернуться оператору',
    openConnectors: 'Открыть интеграции',
    integrationsTitle: 'Внешние контуры',
    boundaryTitle: 'Граница статуса',
    boundary: 'Экран не измеряет uptime внешних систем и не объявляет интеграцию подключённой. Статус ФГИС, банка, ЭДО, ЭПД и лабораторий появляется только после подтверждённого внешнего обмена и эксплуатационного мониторинга.',
    facts: {
      delivery: 'Очередь событий', deliveryHint: 'серверный settlement/outbox reader',
      pending: 'Ожидают отправки', pendingHint: 'подтверждённые pending-записи',
      manualReview: 'Ручная проверка', manualReviewHint: 'подтверждённые manual-review записи',
      external: 'Внешние подключения', externalHint: 'production-доступность не подтверждена',
    },
    states: { available: 'Доступна', unavailable: 'Недоступна', externalRequired: 'Требует внешнего подтверждения' },
    integrations: [
      { href: '/platform-v7/fgis-access', title: 'ФГИС «Зерно» / СДИЗ', detail: 'Организация и полномочия не заменяют production-доступ и реальный обмен.' },
      { href: '/platform-v7/bank/release-safety', title: 'Банк / движение денег', detail: 'Резерв, запрос и callback подтверждаются только банковским контуром.' },
      { href: '/platform-v7/documents', title: 'ЭДО / ГИС ЭПД / КЭП', detail: 'Подписание, доставка и исправление документов требуют внешнего подтверждения.' },
      { href: '/platform-v7/lab', title: 'Лабораторные системы', detail: 'Протоколы и полномочия не доказывают live LIMS или реестр аккредитации.' },
    ],
  },
  en: {
    metadataTitle: 'Circuit status · Transparent Price',
    metadataDescription: 'Verifiable internal availability and explicit external-integration boundaries.',
    eyebrow: 'System status',
    title: 'Only verifiable signals are displayed',
    description: 'The internal event queue is checked through the server circuit. No invented uptime or connection state is shown for grain registry, bank, EDI, e-transport or laboratory systems.',
    statusAvailable: 'internal circuit available',
    statusUnavailable: 'internal circuit unavailable',
    blocker: 'Blocker', owner: 'Owner', impact: 'Impact', result: 'Result', nextAction: 'Next action',
    prioritySection: 'Primary check', factsSection: 'Confirmed facts',
    availableTitle: 'The internal event queue responds',
    availableDescription: 'Server-confirmed pending and manual-review states are available. This does not prove external-system availability.',
    unavailableTitle: 'Restore the internal event channel',
    unavailableDescription: 'The server event queue is unavailable. The business UI must not interpret this as an all-clear state.',
    unavailableImpact: 'external delivery and manual-review state cannot be confirmed',
    unavailableResult: 'restored server queue and repeated reconciliation',
    openOperator: 'Return to operator', openConnectors: 'Open integrations', integrationsTitle: 'External circuits', boundaryTitle: 'Status boundary',
    boundary: 'This screen does not measure external-system uptime or declare an integration connected. Grain registry, bank, EDI, e-transport and laboratory status requires confirmed external exchange and operational monitoring.',
    facts: {
      delivery: 'Event queue', deliveryHint: 'server settlement/outbox reader',
      pending: 'Pending delivery', pendingHint: 'confirmed pending records',
      manualReview: 'Manual review', manualReviewHint: 'confirmed manual-review records',
      external: 'External connections', externalHint: 'production availability is not confirmed',
    },
    states: { available: 'Available', unavailable: 'Unavailable', externalRequired: 'External confirmation required' },
    integrations: [
      { href: '/platform-v7/fgis-access', title: 'Grain registry / SDIZ', detail: 'Organization and authority do not replace production access or real exchange.' },
      { href: '/platform-v7/bank/release-safety', title: 'Bank / movement of money', detail: 'Reserve, request and callback are confirmed only by the bank circuit.' },
      { href: '/platform-v7/documents', title: 'EDI / e-transport / qualified signature', detail: 'Signing, delivery and correction require external confirmation.' },
      { href: '/platform-v7/lab', title: 'Laboratory systems', detail: 'Protocols and authority do not prove live LIMS or an accreditation registry.' },
    ],
  },
  zh: {
    metadataTitle: '系统闭环状态 · 透明价格',
    metadataDescription: '可验证的内部可用性以及明确的外部集成边界。',
    eyebrow: '系统状态',
    title: '仅显示可验证信号',
    description: '内部事件队列通过服务器闭环检查。粮食登记、银行、电子文件、电子运输和实验室系统不会显示虚构的在线率或连接状态。',
    statusAvailable: '内部闭环可用', statusUnavailable: '内部闭环不可用',
    blocker: '阻塞项', owner: '负责人', impact: '影响', result: '结果', nextAction: '下一步',
    prioritySection: '主要检查', factsSection: '已确认事实',
    availableTitle: '内部事件队列正常响应',
    availableDescription: '可以读取服务器确认的待发送和人工复核状态。这不代表外部系统可用。',
    unavailableTitle: '恢复内部事件通道',
    unavailableDescription: '服务器事件队列不可用。业务界面不能将其解释为没有问题。',
    unavailableImpact: '无法确认外部事件发送和人工复核状态',
    unavailableResult: '恢复服务器队列并重新对账',
    openOperator: '返回运营工作区', openConnectors: '打开集成', integrationsTitle: '外部闭环', boundaryTitle: '状态边界',
    boundary: '此页面不测量外部系统在线率，也不会宣布集成已连接。粮食登记、银行、电子文件、电子运输和实验室状态必须来自已确认的外部交换和运行监控。',
    facts: {
      delivery: '事件队列', deliveryHint: '服务器 settlement/outbox reader',
      pending: '等待发送', pendingHint: '已确认的 pending 记录',
      manualReview: '人工复核', manualReviewHint: '已确认的 manual-review 记录',
      external: '外部连接', externalHint: '尚未确认生产可用性',
    },
    states: { available: '可用', unavailable: '不可用', externalRequired: '需要外部确认' },
    integrations: [
      { href: '/platform-v7/fgis-access', title: '粮食登记 / SDIZ', detail: '组织和权限不能替代生产访问和真实交换。' },
      { href: '/platform-v7/bank/release-safety', title: '银行 / 资金流动', detail: '预留、请求和回调只能由银行闭环确认。' },
      { href: '/platform-v7/documents', title: '电子文件 / 电子运输 / 合格签名', detail: '签署、发送和更正都需要外部确认。' },
      { href: '/platform-v7/lab', title: '实验室系统', detail: '协议和权限不能证明 live LIMS 或资质登记可用。' },
    ],
  },
};

function localeOf(value: string): Locale {
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('zh')) return 'zh';
  return 'ru';
}

export async function generateMetadata(): Promise<Metadata> {
  const copy = COPY[localeOf(await getLocale())];
  return {
    title: copy.metadataTitle,
    description: copy.metadataDescription,
    robots: { index: false, follow: false },
  };
}

export default async function StatusPage() {
  const copy = COPY[localeOf(await getLocale())];
  const outbox = await getOutboxStatus();
  const available = outbox.isApiAvailable;
  const priority: OperationalPriority = available
    ? {
        state: 'ready',
        title: copy.availableTitle,
        description: copy.availableDescription,
        impact: `${outbox.totalPending} / ${outbox.manualReview.length}`,
        result: copy.states.available,
        primaryAction: <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/operator'>{copy.openOperator}</Link>,
      }
    : {
        state: 'critical',
        title: copy.unavailableTitle,
        description: copy.unavailableDescription,
        blocker: copy.unavailableDescription,
        impact: copy.unavailableImpact,
        result: copy.unavailableResult,
        primaryAction: <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/connectors'>{copy.openConnectors}</Link>,
        secondaryAction: <Link className={operationalCockpitClasses.secondaryLink} href='/platform-v7/operator'>{copy.openOperator}</Link>,
      };

  return (
    <OperationalDecisionCockpit
      testId='platform-v7-status-v8'
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      statusLabel={available ? copy.statusAvailable : copy.statusUnavailable}
      statusTone={available ? 'success' : 'critical'}
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
        { label: copy.facts.delivery, value: available ? copy.states.available : copy.states.unavailable, hint: copy.facts.deliveryHint },
        { label: copy.facts.pending, value: available ? String(outbox.totalPending) : '—', hint: copy.facts.pendingHint },
        { label: copy.facts.manualReview, value: available ? String(outbox.manualReview.length) : '—', hint: copy.facts.manualReviewHint },
        { label: copy.facts.external, value: copy.states.externalRequired, hint: copy.facts.externalHint },
      ]}
      boundary={copy.boundary}
    >
      <OperationalCockpitSection id='external-integrations'>
        <OperationalQueue>
          {copy.integrations.map((integration) => (
            <OperationalQueueLink
              key={integration.href}
              href={integration.href}
              title={integration.title}
              detail={integration.detail}
              status={<StatusChip tone='warning'>{copy.states.externalRequired}</StatusChip>}
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
