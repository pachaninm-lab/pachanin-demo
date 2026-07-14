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
import { activeShipmentCount, getShipments, shipmentsWithBlockers } from '@/lib/logistics-server';

type Locale = 'ru' | 'en' | 'zh';

type Copy = Readonly<{
  metadataTitle: string;
  metadataDescription: string;
  eyebrow: string;
  title: string;
  description: string;
  statusAvailable: string;
  statusUnavailable: string;
  labels: Readonly<{ blocker: string; owner: string; impact: string; result: string; nextAction: string; prioritySection: string; factsSection: string }>;
  facts: Readonly<{ total: string; active: string; blocked: string; unassigned: string }>;
  values: Readonly<{ unavailable: string; confirmed: string; pending: string; none: string }>;
  actions: Readonly<{ logistics: string; dealLogistics: string; drivers: string }>;
  emptyTask: Readonly<{ title: string; description: string; blocker: string; impact: string; result: string }>;
  authorityTitle: string;
  authorityNotice: string;
  boundary: string;
  detail: Readonly<{ deal: string; route: string; driver: string; next: string }>;
}>;

const COPY: Record<Locale, Copy> = {
  ru: {
    metadataTitle: 'Очередь логистики · Прозрачная Цена',
    metadataDescription: 'Server-authoritative очередь рейсов, назначений и транспортных блокеров.',
    eyebrow: 'Логистика · входящая очередь',
    title: 'Очередь формируется из реальных рейсов Сделок',
    description: 'Экран показывает только tenant-scoped shipments, их блокеры и следующий шаг. Фиктивные заявки, тестовый водитель, локальный выбор машины и созданный в браузере рейс удалены.',
    statusAvailable: 'очередь подтверждена',
    statusUnavailable: 'очередь недоступна',
    labels: { blocker: 'Блокер', owner: 'Ответственный', impact: 'Влияние', result: 'Результат', nextAction: 'Следующее действие', prioritySection: 'Главная задача', factsSection: 'Подтверждённые факты' },
    facts: { total: 'Всего рейсов', active: 'Активных', blocked: 'С блокерами', unassigned: 'Без водителя' },
    values: { unavailable: 'Недоступно', confirmed: 'Подтверждено', pending: 'Ожидает', none: 'Нет' },
    actions: { logistics: 'Открыть диспетчерскую', dealLogistics: 'Открыть рейсы Сделки', drivers: 'Открыть водителей' },
    emptyTask: {
      title: 'Дождаться серверной заявки на перевозку',
      description: 'Реестр не вернул рейсов, доступных текущей организации. Интерфейс не создаёт LOG-REQ, TRIP или назначение локально.',
      blocker: 'нет tenant-scoped shipment records',
      impact: 'нельзя назначить водителя или подтвердить транспортный пакет',
      result: 'рейс, созданный серверной командой из канонической Сделки',
    },
    authorityTitle: 'Источник данных',
    authorityNotice: 'Очередь загружена через `/logistics/shipments`. Цена зерна, банковские статусы и кредитные данные в этот контур не передаются.',
    boundary: 'Логистика работает только с перевозкой и транспортными доказательствами. Назначение, смена статуса и создание рейса требуют серверной команды, RBAC, optimistic concurrency, идемпотентности, audit и outbox.',
    detail: { deal: 'Сделка', route: 'Маршрут', driver: 'Водитель', next: 'Дальше' },
  },
  en: {
    metadataTitle: 'Logistics queue · Transparent Price',
    metadataDescription: 'A server-authoritative queue of shipments, assignments and transport blockers.',
    eyebrow: 'Logistics · incoming queue',
    title: 'The queue is built from actual Deal shipments',
    description: 'This screen shows tenant-scoped shipments, their blockers and next action only. Fictional requests, test drivers, local vehicle selection and browser-created trips were removed.',
    statusAvailable: 'queue confirmed',
    statusUnavailable: 'queue unavailable',
    labels: { blocker: 'Blocker', owner: 'Owner', impact: 'Impact', result: 'Result', nextAction: 'Next action', prioritySection: 'Primary task', factsSection: 'Confirmed facts' },
    facts: { total: 'Total shipments', active: 'Active', blocked: 'Blocked', unassigned: 'Without driver' },
    values: { unavailable: 'Unavailable', confirmed: 'Confirmed', pending: 'Pending', none: 'None' },
    actions: { logistics: 'Open dispatch workspace', dealLogistics: 'Open Deal logistics', drivers: 'Open drivers' },
    emptyTask: {
      title: 'Wait for a server-side transport request',
      description: 'The registry returned no shipments accessible to the current organization. The UI does not create a LOG-REQ, TRIP or assignment locally.',
      blocker: 'no tenant-scoped shipment records',
      impact: 'a driver cannot be assigned and the transport package cannot be confirmed',
      result: 'a shipment created by a server command from the canonical Deal',
    },
    authorityTitle: 'Data authority',
    authorityNotice: 'The queue is loaded through `/logistics/shipments`. Grain price, bank status and credit data are not passed into this workspace.',
    boundary: 'Logistics works with transportation and transport evidence only. Assignment, status changes and shipment creation require a server command, RBAC, optimistic concurrency, idempotency, audit and outbox.',
    detail: { deal: 'Deal', route: 'Route', driver: 'Driver', next: 'Next' },
  },
  zh: {
    metadataTitle: '物流队列 · 透明价格',
    metadataDescription: '由服务器权威数据驱动的运输任务、指派和运输阻塞队列。',
    eyebrow: '物流 · 入站队列',
    title: '队列由真实交易运输任务构成',
    description: '该页面仅显示租户范围运输任务、阻塞项和下一步。虚构申请、测试司机、本地车辆选择和浏览器创建的行程已删除。',
    statusAvailable: '队列已确认',
    statusUnavailable: '队列不可用',
    labels: { blocker: '阻塞项', owner: '负责人', impact: '影响', result: '结果', nextAction: '下一步', prioritySection: '主要任务', factsSection: '已确认事实' },
    facts: { total: '运输任务总数', active: '活动任务', blocked: '存在阻塞', unassigned: '未指派司机' },
    values: { unavailable: '不可用', confirmed: '已确认', pending: '待处理', none: '无' },
    actions: { logistics: '打开调度工作区', dealLogistics: '打开交易物流', drivers: '打开司机列表' },
    emptyTask: {
      title: '等待服务器运输申请',
      description: '登记册未返回当前组织可访问的运输任务。界面不会在本地创建 LOG-REQ、TRIP 或指派。',
      blocker: '没有租户范围的运输任务记录',
      impact: '无法指派司机或确认运输单据包',
      result: '由规范交易的服务器命令创建的运输任务',
    },
    authorityTitle: '数据权威',
    authorityNotice: '队列通过 `/logistics/shipments` 加载。粮食价格、银行状态和信贷数据不会传入该工作区。',
    boundary: '物流角色只处理运输和运输证据。指派、状态变更和运输任务创建必须通过具备 RBAC、乐观并发、幂等、审计和 outbox 的服务器命令。',
    detail: { deal: '交易', route: '路线', driver: '司机', next: '下一步' },
  },
};

function localeOf(value: string): Locale {
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('zh')) return 'zh';
  return 'ru';
}

export async function generateMetadata(): Promise<Metadata> {
  const copy = COPY[localeOf(await getLocale())];
  return { title: copy.metadataTitle, description: copy.metadataDescription, robots: { index: false, follow: false } };
}

export default async function LogisticsInboxPage() {
  const copy = COPY[localeOf(await getLocale())];
  const shipments = (await getShipments()).sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
  const blocked = shipmentsWithBlockers(shipments);
  const unassigned = shipments.filter((shipment) => !(shipment.driverUserId || shipment.driverName));
  const focus = blocked[0] ?? unassigned[0] ?? shipments[0] ?? null;

  const priority: OperationalPriority = focus ? {
    state: focus.blockers.length > 0 || !(focus.driverUserId || focus.driverName) ? 'critical' : 'active',
    title: focus.blockers[0] ?? focus.nextAction ?? `${focus.id} · ${focus.status}`,
    description: `${focus.routeFrom ?? copy.values.unavailable} → ${focus.routeTo ?? copy.values.unavailable}`,
    blocker: focus.blockers[0] ?? (!(focus.driverUserId || focus.driverName) ? copy.facts.unassigned : copy.values.none),
    owner: focus.driverName ?? focus.carrierName ?? 'Logistics / Operations',
    impact: `${copy.detail.deal}: ${focus.dealId}`,
    result: focus.nextAction ?? copy.values.confirmed,
    primaryAction: <Link className={operationalCockpitClasses.primaryLink} href={`/platform-v7/logistics/${encodeURIComponent(focus.id)}`}>{copy.actions.dealLogistics}</Link>,
    secondaryAction: <Link className={operationalCockpitClasses.secondaryLink} href='/platform-v7/logistics/drivers'>{copy.actions.drivers}</Link>,
  } : {
    state: 'critical',
    ...copy.emptyTask,
    owner: 'Logistics / Operations',
    primaryAction: <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/logistics'>{copy.actions.logistics}</Link>,
    secondaryAction: <Link className={operationalCockpitClasses.secondaryLink} href='/platform-v7/deal-logistics'>{copy.actions.dealLogistics}</Link>,
  };

  return (
    <OperationalDecisionCockpit
      testId='platform-v7-logistics-inbox-v8'
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      statusLabel={shipments.length > 0 ? copy.statusAvailable : copy.statusUnavailable}
      statusTone={shipments.length > 0 ? (blocked.length > 0 ? 'warning' : 'success') : 'warning'}
      priority={priority}
      facts={[
        { label: copy.facts.total, value: String(shipments.length), hint: copy.authorityTitle },
        { label: copy.facts.active, value: String(activeShipmentCount(shipments)) },
        { label: copy.facts.blocked, value: String(blocked.length) },
        { label: copy.facts.unassigned, value: String(unassigned.length) },
      ]}
      boundary={copy.boundary}
      labels={copy.labels}
    >
      <InlineNotice tone='information' title={copy.authorityTitle}>{copy.authorityNotice}</InlineNotice>
      <OperationalCockpitSection id='shipment-queue'>
        <OperationalQueue>
          {shipments.length > 0 ? shipments.map((shipment) => {
            const requiresAction = shipment.blockers.length > 0 || !(shipment.driverUserId || shipment.driverName);
            return (
              <OperationalQueueLink
                key={shipment.id}
                href={`/platform-v7/logistics/${encodeURIComponent(shipment.id)}`}
                title={`${shipment.id} · ${shipment.status}`}
                detail={`${copy.detail.deal}: ${shipment.dealId} · ${copy.detail.route}: ${shipment.routeFrom ?? copy.values.unavailable} → ${shipment.routeTo ?? copy.values.unavailable} · ${copy.detail.driver}: ${shipment.driverName ?? copy.values.unavailable} · ${copy.detail.next}: ${shipment.nextAction ?? copy.values.unavailable}`}
                status={<StatusChip tone={requiresAction ? 'warning' : 'success'}>{requiresAction ? copy.values.pending : copy.values.confirmed}</StatusChip>}
              />
            );
          }) : (
            <OperationalQueueLink
              href='/platform-v7/logistics'
              title={copy.title}
              detail={copy.emptyTask.description}
              status={<StatusChip tone='warning'>{copy.values.pending}</StatusChip>}
            />
          )}
        </OperationalQueue>
      </OperationalCockpitSection>
    </OperationalDecisionCockpit>
  );
}
