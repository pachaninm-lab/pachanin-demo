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
  type OperationalTone,
} from '@/components/transaction-ux/OperationalDecisionCockpit';
import {
  getPlatformV7HealthCockpitState,
  type PlatformV7AdapterHealthRow,
  type PlatformV7QueueItem,
} from '@/lib/platform-v7/runtime/health-cockpit-state';
import type {
  PlatformV7HealthArea,
  PlatformV7HealthSeverity,
} from '@/lib/platform-v7/runtime/observability-cockpit-state';

type Locale = 'ru' | 'en' | 'zh';
type AreaKey = PlatformV7HealthArea['key'];

type Copy = Readonly<{
  metadataTitle: string;
  metadataDescription: string;
  eyebrow: string;
  title: string;
  description: string;
  status: Readonly<Record<PlatformV7HealthSeverity, string>>;
  priority: Readonly<Record<PlatformV7HealthSeverity, Readonly<{
    title: string;
    description: string;
    result: string;
  }>>>;
  owner: string;
  impact: string;
  openQueues: string;
  openStatus: string;
  labels: Readonly<{
    blocker: string;
    owner: string;
    impact: string;
    result: string;
    nextAction: string;
    prioritySection: string;
    factsSection: string;
  }>;
  facts: Readonly<{
    source: string;
    sourceValue: string;
    manualReview: string;
    stuckDeals: string;
    adapters: string;
  }>;
  sections: Readonly<{
    areas: string;
    manualReview: string;
    stuckDeals: string;
    adapters: string;
  }>;
  area: Readonly<Record<AreaKey, string>>;
  areaDetail: Readonly<Record<PlatformV7HealthSeverity, string>>;
  manualDetail: string;
  disputeTitle: string;
  stuckDetail: string;
  adapterDetail: Readonly<Record<PlatformV7HealthSeverity, string>>;
  emptyManual: string;
  emptyStuck: string;
  boundaryTitle: string;
  boundary: string;
}>;

const COPY: Record<Locale, Copy> = {
  ru: {
    metadataTitle: 'Здоровье исполнения · Прозрачная Цена',
    metadataDescription: 'Read-only снимок контролируемого runtime: блокеры сделок, ручная проверка, очереди и готовность адаптеров.',
    eyebrow: 'Наблюдаемость исполнения',
    title: 'Где сделке требуется операционное внимание',
    description: 'Экран собирает read-only сигналы контролируемого runtime по сделкам, спорам, транспортным документам и готовности адаптеров. Он не объявляет внешние системы подключёнными и не измеряет production uptime.',
    status: { ok: 'критических сигналов нет', warning: 'требуется проверка', critical: 'есть критические блокеры' },
    priority: {
      ok: { title: 'Проверить очереди перед следующим операционным циклом', description: 'Снимок не содержит критического сигнала, но остаётся read-only индикатором controlled runtime.', result: 'подтверждённая операционная проверка' },
      warning: { title: 'Разобрать предупреждения и владельцев действий', description: 'Есть сигналы, которые требуют ручной проверки до продолжения затронутых процессов.', result: 'очередь предупреждений разобрана' },
      critical: { title: 'Снять критические блокеры исполнения', description: 'Спор, стоп-фактор или неподтверждённый контур требует вмешательства ответственного оператора.', result: 'критические блокеры назначены и обработаны' },
    },
    owner: 'Оператор исполнения', impact: 'Сделка, документы или деньги могут оставаться заблокированными', openQueues: 'Открыть очереди', openStatus: 'Статус контуров',
    labels: { blocker: 'Блокер', owner: 'Ответственный', impact: 'Влияние', result: 'Результат', nextAction: 'Следующее действие', prioritySection: 'Главная операционная задача', factsSection: 'Подтверждённые факты снимка' },
    facts: { source: 'Источник', sourceValue: 'controlled runtime · read-only', manualReview: 'Ручная проверка', stuckDeals: 'Сделки со стоп-фактором', adapters: 'Контуры адаптеров' },
    sections: { areas: 'Области здоровья', manualReview: 'Очередь ручной проверки', stuckDeals: 'Сделки со стоп-фактором', adapters: 'Готовность адаптеров' },
    area: { system: 'Системный контур', integration: 'Интеграционный контур', deal: 'Исполнение сделок', money: 'Денежный контур' },
    areaDetail: { ok: 'Снимок не содержит критического сигнала.', warning: 'Снимок требует операционной проверки.', critical: 'Снимок содержит критический стоп-фактор.' },
    manualDetail: 'Внешний или спорный факт не подтверждён автоматически; требуется назначенная ручная проверка.', disputeTitle: 'Спор', stuckDetail: 'Сделка содержит блокер или открытый спор и требует решения ответственного.',
    adapterDetail: { ok: 'Контур отмечен доступным только в рамках текущего runtime-снимка.', warning: 'Нужны ручная проверка, договор, доступ или подтверждённый внешний обмен.', critical: 'Контур содержит критический сигнал и не может считаться готовым.' },
    emptyManual: 'В текущем runtime-снимке нет элементов ручной проверки.', emptyStuck: 'В текущем runtime-снимке нет сделок со стоп-фактором.',
    boundaryTitle: 'Граница доказательности', boundary: 'Источник экрана — controlled-pilot-runtime. Это не production telemetry, не подтверждение live-интеграций и не основание считать внешний банк, ФГИС, ЭДО, ЭПД, лабораторию или телематику доступными.',
  },
  en: {
    metadataTitle: 'Execution health · Transparent Price', metadataDescription: 'Read-only controlled-runtime snapshot for deal blockers, manual review, queues and adapter readiness.',
    eyebrow: 'Execution observability', title: 'Where execution needs operational attention', description: 'This screen aggregates read-only controlled-runtime signals for deals, disputes, transport documents and adapter readiness. It does not declare external systems connected or measure production uptime.',
    status: { ok: 'no critical signal', warning: 'review required', critical: 'critical blockers present' },
    priority: {
      ok: { title: 'Review queues before the next operating cycle', description: 'The snapshot has no critical signal, but it remains a read-only controlled-runtime indicator.', result: 'operational review confirmed' },
      warning: { title: 'Resolve warnings and assign owners', description: 'Some signals require manual review before the affected process continues.', result: 'warning queue resolved' },
      critical: { title: 'Remove critical execution blockers', description: 'A dispute, stop factor or unconfirmed circuit requires an accountable operator.', result: 'critical blockers assigned and handled' },
    },
    owner: 'Execution operator', impact: 'A deal, document or money step may remain blocked', openQueues: 'Open queues', openStatus: 'Circuit status',
    labels: { blocker: 'Blocker', owner: 'Owner', impact: 'Impact', result: 'Result', nextAction: 'Next action', prioritySection: 'Primary operational task', factsSection: 'Confirmed snapshot facts' },
    facts: { source: 'Source', sourceValue: 'controlled runtime · read-only', manualReview: 'Manual review', stuckDeals: 'Deals with stop factors', adapters: 'Adapter circuits' },
    sections: { areas: 'Health areas', manualReview: 'Manual-review queue', stuckDeals: 'Deals with stop factors', adapters: 'Adapter readiness' },
    area: { system: 'System circuit', integration: 'Integration circuit', deal: 'Deal execution', money: 'Money circuit' },
    areaDetail: { ok: 'The snapshot contains no critical signal.', warning: 'The snapshot requires operational review.', critical: 'The snapshot contains a critical stop factor.' },
    manualDetail: 'An external or disputed fact was not confirmed automatically and requires assigned manual review.', disputeTitle: 'Dispute', stuckDetail: 'The deal contains a blocker or open dispute and requires an accountable decision.',
    adapterDetail: { ok: 'The circuit is marked available only inside the current runtime snapshot.', warning: 'Manual review, an agreement, access or confirmed external exchange is still required.', critical: 'The circuit contains a critical signal and cannot be treated as ready.' },
    emptyManual: 'The current runtime snapshot has no manual-review items.', emptyStuck: 'The current runtime snapshot has no deals with stop factors.',
    boundaryTitle: 'Evidence boundary', boundary: 'The source is controlled-pilot-runtime. This is not production telemetry, proof of live integrations, or evidence that an external bank, grain registry, EDI, e-transport, laboratory or telematics system is available.',
  },
  zh: {
    metadataTitle: '执行健康状态 · 透明价格', metadataDescription: '受控运行时的只读快照：交易阻塞、人工复核、队列和适配器准备度。',
    eyebrow: '执行可观测性', title: '哪些执行环节需要运营处理', description: '此页面汇总交易、争议、运输文件和适配器准备度的受控运行时只读信号。它不会宣称外部系统已连接，也不会测量生产在线率。',
    status: { ok: '无关键风险信号', warning: '需要复核', critical: '存在关键阻塞项' },
    priority: {
      ok: { title: '在下一运营周期前检查队列', description: '快照没有关键风险信号，但它仍只是受控运行时的只读指标。', result: '完成运营复核' },
      warning: { title: '处理警告并指定负责人', description: '部分信号需要人工复核后，相关流程才能继续。', result: '警告队列已处理' },
      critical: { title: '解除关键执行阻塞', description: '争议、停止因素或未确认闭环需要责任运营人员处理。', result: '关键阻塞已分派并处理' },
    },
    owner: '执行运营人员', impact: '交易、文件或资金步骤可能继续受阻', openQueues: '打开队列', openStatus: '闭环状态',
    labels: { blocker: '阻塞项', owner: '负责人', impact: '影响', result: '结果', nextAction: '下一步', prioritySection: '主要运营任务', factsSection: '已确认的快照事实' },
    facts: { source: '来源', sourceValue: '受控运行时 · 只读', manualReview: '人工复核', stuckDeals: '存在停止因素的交易', adapters: '适配器闭环' },
    sections: { areas: '健康领域', manualReview: '人工复核队列', stuckDeals: '存在停止因素的交易', adapters: '适配器准备度' },
    area: { system: '系统闭环', integration: '集成闭环', deal: '交易执行', money: '资金闭环' },
    areaDetail: { ok: '快照中没有关键风险信号。', warning: '快照需要运营复核。', critical: '快照中存在关键停止因素。' },
    manualDetail: '外部事实或争议事实未被自动确认，需要分派人工复核。', disputeTitle: '争议', stuckDetail: '交易包含阻塞项或未关闭争议，需要责任人作出决定。',
    adapterDetail: { ok: '该闭环仅在当前运行时快照内标记为可用。', warning: '仍需要人工复核、合同、访问权限或已确认的外部交换。', critical: '该闭环存在关键风险信号，不能视为已准备就绪。' },
    emptyManual: '当前运行时快照中没有人工复核项。', emptyStuck: '当前运行时快照中没有存在停止因素的交易。',
    boundaryTitle: '证据边界', boundary: '页面来源是 controlled-pilot-runtime。这不是生产遥测，不证明实时集成，也不能证明外部银行、粮食登记、电子文件、电子运输、实验室或车联网系统可用。',
  },
};

function localeOf(value: string): Locale {
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('zh')) return 'zh';
  return 'ru';
}

function tone(severity: PlatformV7HealthSeverity): OperationalTone {
  return severity === 'critical' ? 'critical' : severity === 'warning' ? 'warning' : 'success';
}

function disputeLabel(item: PlatformV7QueueItem, copy: Copy): string {
  if (!item.id.startsWith('mr-disp-')) return item.label;
  return `${copy.disputeTitle} ${item.id.replace('mr-disp-', '')}`;
}

function areaHref(key: AreaKey): string {
  if (key === 'integration') return '/platform-v7/connectors';
  if (key === 'deal') return '/platform-v7/deals';
  if (key === 'money') return '/platform-v7/money';
  return '/platform-v7/status';
}

function adapterStatus(adapter: PlatformV7AdapterHealthRow, copy: Copy) {
  return <StatusChip tone={tone(adapter.severity)}>{copy.status[adapter.severity]}</StatusChip>;
}

export async function generateMetadata(): Promise<Metadata> {
  const copy = COPY[localeOf(await getLocale())];
  return { title: copy.metadataTitle, description: copy.metadataDescription, robots: { index: false, follow: false } };
}

export default async function HealthPage() {
  const copy = COPY[localeOf(await getLocale())];
  const state = getPlatformV7HealthCockpitState();
  const priorityCopy = copy.priority[state.overall];
  const priority: OperationalPriority = {
    state: state.overall === 'critical' ? 'critical' : state.overall === 'ok' ? 'ready' : 'active',
    title: priorityCopy.title,
    description: priorityCopy.description,
    owner: copy.owner,
    impact: copy.impact,
    result: priorityCopy.result,
    primaryAction: <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/operator-cockpit/queues'>{copy.openQueues}</Link>,
    secondaryAction: <Link className={operationalCockpitClasses.secondaryLink} href='/platform-v7/status'>{copy.openStatus}</Link>,
  };

  return (
    <OperationalDecisionCockpit
      testId='platform-v7-health-v8'
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      statusLabel={copy.status[state.overall]}
      statusTone={tone(state.overall)}
      priority={priority}
      labels={copy.labels}
      facts={[
        { label: copy.facts.source, value: copy.facts.sourceValue, hint: state.sourceMeta.source },
        { label: copy.facts.manualReview, value: String(state.manualReviewQueue.length) },
        { label: copy.facts.stuckDeals, value: String(state.stuckDeals.length) },
        { label: copy.facts.adapters, value: String(state.adapters.length) },
      ]}
      boundary={copy.boundary}
    >
      <OperationalCockpitSection id='health-areas'>
        <InlineNotice tone='information' title={copy.sections.areas}>{copy.boundary}</InlineNotice>
        <OperationalQueue>
          {state.areas.map((area) => (
            <OperationalQueueLink
              key={`${area.key}-${area.label}`}
              href={areaHref(area.key)}
              title={copy.area[area.key]}
              detail={copy.areaDetail[area.severity]}
              status={<StatusChip tone={tone(area.severity)}>{copy.status[area.severity]}</StatusChip>}
            />
          ))}
        </OperationalQueue>
      </OperationalCockpitSection>

      <OperationalCockpitSection id='manual-review'>
        <InlineNotice tone={state.manualReviewQueue.length > 0 ? 'warning' : 'information'} title={copy.sections.manualReview}>
          {state.manualReviewQueue.length > 0 ? copy.manualDetail : copy.emptyManual}
        </InlineNotice>
        {state.manualReviewQueue.length > 0 ? (
          <OperationalQueue>
            {state.manualReviewQueue.map((item) => (
              <OperationalQueueLink
                key={item.id}
                href='/platform-v7/operator-cockpit/queues'
                title={disputeLabel(item, copy)}
                detail={copy.manualDetail}
                status={<StatusChip tone={tone(item.severity)}>{copy.status[item.severity]}</StatusChip>}
              />
            ))}
          </OperationalQueue>
        ) : null}
      </OperationalCockpitSection>

      <OperationalCockpitSection id='stuck-deals'>
        <InlineNotice tone={state.stuckDeals.length > 0 ? 'warning' : 'information'} title={copy.sections.stuckDeals}>
          {state.stuckDeals.length > 0 ? copy.stuckDetail : copy.emptyStuck}
        </InlineNotice>
        {state.stuckDeals.length > 0 ? (
          <OperationalQueue>
            {state.stuckDeals.map((item) => (
              <OperationalQueueLink
                key={item.id}
                href='/platform-v7/deals'
                title={item.label}
                detail={copy.stuckDetail}
                status={<StatusChip tone={tone(item.severity)}>{copy.status[item.severity]}</StatusChip>}
              />
            ))}
          </OperationalQueue>
        ) : null}
      </OperationalCockpitSection>

      <OperationalCockpitSection id='adapter-readiness'>
        <InlineNotice tone='information' title={copy.sections.adapters}>{copy.boundary}</InlineNotice>
        <OperationalQueue>
          {state.adapters.map((adapter) => (
            <OperationalQueueLink
              key={adapter.system}
              href='/platform-v7/connectors'
              title={adapter.system}
              detail={copy.adapterDetail[adapter.severity]}
              status={adapterStatus(adapter, copy)}
            />
          ))}
        </OperationalQueue>
      </OperationalCockpitSection>

      <InlineNotice tone='information' title={copy.boundaryTitle}>{copy.boundary}</InlineNotice>
    </OperationalDecisionCockpit>
  );
}
