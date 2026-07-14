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
import { activeShipmentCount, getShipments, shipmentsWithBlockers, type ShipmentServerItem } from '@/lib/logistics-server';

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
  facts: Readonly<{ drivers: string; vehicles: string; active: string; blocked: string }>;
  values: Readonly<{ unavailable: string; confirmed: string; pending: string; none: string }>;
  actions: Readonly<{ logistics: string; dealLogistics: string }>;
  emptyTask: Readonly<{ title: string; description: string; blocker: string; impact: string; result: string }>;
  queueTitle: string;
  authorityTitle: string;
  authorityNotice: string;
  boundary: string;
  detail: Readonly<{ deal: string; route: string; vehicle: string; next: string }>;
}>;

const COPY: Record<Locale, Copy> = {
  ru: {
    metadataTitle: 'Водители логистики · Прозрачная Цена',
    metadataDescription: 'Server-authoritative диспетчерский список назначенных водителей и машин.',
    eyebrow: 'Логистика · водители и транспорт',
    title: 'Назначения только из серверного реестра рейсов',
    description: 'Экран показывает водителей и машины, которые связаны с tenant-scoped рейсами. Локальные карточки, тестовые номера и имитация местоположения удалены.',
    statusAvailable: 'назначения подтверждены',
    statusUnavailable: 'назначения не подтверждены',
    labels: { blocker: 'Блокер', owner: 'Ответственный', impact: 'Влияние', result: 'Результат', nextAction: 'Следующее действие', prioritySection: 'Главная задача', factsSection: 'Подтверждённые факты' },
    facts: { drivers: 'Назначенных водителей', vehicles: 'Назначенных машин', active: 'Активных рейсов', blocked: 'Рейсов с блокерами' },
    values: { unavailable: 'Недоступно', confirmed: 'Подтверждено', pending: 'Ожидает', none: 'Нет' },
    actions: { logistics: 'Открыть диспетчерскую', dealLogistics: 'Открыть рейсы Сделки' },
    emptyTask: {
      title: 'Получить назначения из серверного контура',
      description: 'Реестр не вернул водителей, связанных с рейсами. Интерфейс не создаёт тестовые назначения и не подставляет транспорт.',
      blocker: 'нет tenant-scoped shipment assignment',
      impact: 'невозможно подтвердить водителя и транспорт конкретной Сделки',
      result: 'назначение, сохранённое серверной командой с аудитом',
    },
    queueTitle: 'Подтверждённые назначения',
    authorityTitle: 'Источник данных',
    authorityNotice: 'Список построен только из `/logistics/shipments`. Водитель, машина, статус и следующий шаг не хранятся в браузере.',
    boundary: 'Логист просматривает серверные назначения. Создание водителя, изменение роли, назначение машины и перевод рейса выполняются отдельными авторизованными командами с RBAC, идемпотентностью и аудитом.',
    detail: { deal: 'Сделка', route: 'Маршрут', vehicle: 'Транспорт', next: 'Дальше' },
  },
  en: {
    metadataTitle: 'Logistics drivers · Transparent Price',
    metadataDescription: 'A server-authoritative dispatch list of assigned drivers and vehicles.',
    eyebrow: 'Logistics · drivers and vehicles',
    title: 'Assignments come from the server shipment registry only',
    description: 'This screen shows drivers and vehicles linked to tenant-scoped shipments. Local cards, test plates and simulated location data were removed.',
    statusAvailable: 'assignments confirmed',
    statusUnavailable: 'assignments not confirmed',
    labels: { blocker: 'Blocker', owner: 'Owner', impact: 'Impact', result: 'Result', nextAction: 'Next action', prioritySection: 'Primary task', factsSection: 'Confirmed facts' },
    facts: { drivers: 'Assigned drivers', vehicles: 'Assigned vehicles', active: 'Active shipments', blocked: 'Blocked shipments' },
    values: { unavailable: 'Unavailable', confirmed: 'Confirmed', pending: 'Pending', none: 'None' },
    actions: { logistics: 'Open dispatch workspace', dealLogistics: 'Open Deal logistics' },
    emptyTask: {
      title: 'Load assignments from the server authority',
      description: 'The registry returned no drivers linked to shipments. The UI does not create test assignments or substitute vehicles.',
      blocker: 'no tenant-scoped shipment assignment',
      impact: 'the driver and vehicle for a Deal cannot be confirmed',
      result: 'an assignment persisted by an audited server command',
    },
    queueTitle: 'Confirmed assignments',
    authorityTitle: 'Data authority',
    authorityNotice: 'The list is built from `/logistics/shipments` only. Driver, vehicle, status and next action are not stored in the browser.',
    boundary: 'The logistician reads server assignments. Creating a driver, changing a role, assigning a vehicle and advancing a shipment require separate authorized commands with RBAC, idempotency and audit.',
    detail: { deal: 'Deal', route: 'Route', vehicle: 'Vehicle', next: 'Next' },
  },
  zh: {
    metadataTitle: '物流司机 · 透明价格',
    metadataDescription: '由服务器权威数据驱动的司机和车辆调度列表。',
    eyebrow: '物流 · 司机与车辆',
    title: '指派仅来自服务器运输任务登记册',
    description: '该页面仅显示与租户范围运输任务关联的司机和车辆。本地卡片、测试车牌和模拟位置数据已删除。',
    statusAvailable: '指派已确认',
    statusUnavailable: '指派未确认',
    labels: { blocker: '阻塞项', owner: '负责人', impact: '影响', result: '结果', nextAction: '下一步', prioritySection: '主要任务', factsSection: '已确认事实' },
    facts: { drivers: '已指派司机', vehicles: '已指派车辆', active: '活动运输任务', blocked: '存在阻塞的运输任务' },
    values: { unavailable: '不可用', confirmed: '已确认', pending: '待处理', none: '无' },
    actions: { logistics: '打开调度工作区', dealLogistics: '打开交易物流' },
    emptyTask: {
      title: '从服务器权威加载指派',
      description: '登记册未返回与运输任务关联的司机。界面不会创建测试指派或填充车辆。',
      blocker: '没有租户范围的运输任务指派',
      impact: '无法确认交易对应的司机和车辆',
      result: '由带审计的服务器命令持久化的指派',
    },
    queueTitle: '已确认指派',
    authorityTitle: '数据权威',
    authorityNotice: '列表仅由 `/logistics/shipments` 构建。司机、车辆、状态和下一步不会存储在浏览器中。',
    boundary: '物流人员只读取服务器指派。创建司机、变更角色、指派车辆和推进运输任务必须通过具备 RBAC、幂等和审计的独立授权命令。',
    detail: { deal: '交易', route: '路线', vehicle: '车辆', next: '下一步' },
  },
};

function localeOf(value: string): Locale {
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('zh')) return 'zh';
  return 'ru';
}

function assignedDrivers(shipments: ShipmentServerItem[]): ShipmentServerItem[] {
  const ordered = [...shipments]
    .filter((shipment) => Boolean(shipment.driverUserId || shipment.driverName))
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
  const unique = new Map<string, ShipmentServerItem>();
  for (const shipment of ordered) {
    const key = shipment.driverUserId ?? `${shipment.driverName ?? 'unknown'}:${shipment.vehicleNumber ?? 'none'}`;
    if (!unique.has(key)) unique.set(key, shipment);
  }
  return [...unique.values()];
}

export async function generateMetadata(): Promise<Metadata> {
  const copy = COPY[localeOf(await getLocale())];
  return { title: copy.metadataTitle, description: copy.metadataDescription, robots: { index: false, follow: false } };
}

export default async function LogisticsDriversPage() {
  const copy = COPY[localeOf(await getLocale())];
  const shipments = await getShipments();
  const drivers = assignedDrivers(shipments);
  const blocked = shipmentsWithBlockers(shipments);
  const vehicles = new Set(drivers.map((shipment) => shipment.vehicleNumber).filter((value): value is string => Boolean(value)));
  const firstBlocked = blocked.find((shipment) => Boolean(shipment.driverUserId || shipment.driverName));
  const focus = firstBlocked ?? drivers[0] ?? null;

  const priority: OperationalPriority = focus ? {
    state: focus.blockers.length > 0 ? 'critical' : 'active',
    title: focus.blockers[0] ?? focus.nextAction ?? `${focus.driverName ?? copy.values.unavailable} · ${focus.status}`,
    description: `${focus.routeFrom ?? copy.values.unavailable} → ${focus.routeTo ?? copy.values.unavailable}`,
    blocker: focus.blockers[0] ?? copy.values.none,
    owner: focus.driverName ?? focus.carrierName ?? 'Logistics / Operations',
    impact: `${copy.detail.deal}: ${focus.dealId}`,
    result: `${copy.detail.vehicle}: ${focus.vehicleNumber ?? copy.values.unavailable}`,
    primaryAction: <Link className={operationalCockpitClasses.primaryLink} href={`/platform-v7/logistics/${encodeURIComponent(focus.id)}`}>{copy.queueTitle}</Link>,
    secondaryAction: <Link className={operationalCockpitClasses.secondaryLink} href='/platform-v7/deal-logistics'>{copy.actions.dealLogistics}</Link>,
  } : {
    state: 'critical',
    ...copy.emptyTask,
    owner: 'Logistics / Operations',
    primaryAction: <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/logistics'>{copy.actions.logistics}</Link>,
    secondaryAction: <Link className={operationalCockpitClasses.secondaryLink} href='/platform-v7/deal-logistics'>{copy.actions.dealLogistics}</Link>,
  };

  return (
    <OperationalDecisionCockpit
      testId='platform-v7-logistics-drivers-v8'
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      statusLabel={drivers.length > 0 ? copy.statusAvailable : copy.statusUnavailable}
      statusTone={drivers.length > 0 ? 'success' : 'warning'}
      priority={priority}
      facts={[
        { label: copy.facts.drivers, value: String(drivers.length), hint: copy.authorityTitle },
        { label: copy.facts.vehicles, value: String(vehicles.size), hint: copy.authorityTitle },
        { label: copy.facts.active, value: String(activeShipmentCount(shipments)) },
        { label: copy.facts.blocked, value: String(blocked.length) },
      ]}
      boundary={copy.boundary}
      labels={copy.labels}
    >
      <InlineNotice tone='information' title={copy.authorityTitle}>{copy.authorityNotice}</InlineNotice>
      <OperationalCockpitSection id='assignments'>
        <OperationalQueue>
          {drivers.length > 0 ? drivers.map((shipment) => (
            <OperationalQueueLink
              key={shipment.id}
              href={`/platform-v7/logistics/${encodeURIComponent(shipment.id)}`}
              title={`${shipment.driverName ?? copy.values.unavailable} · ${shipment.vehicleNumber ?? copy.values.unavailable}`}
              detail={`${copy.detail.deal}: ${shipment.dealId} · ${copy.detail.route}: ${shipment.routeFrom ?? copy.values.unavailable} → ${shipment.routeTo ?? copy.values.unavailable} · ${copy.detail.next}: ${shipment.nextAction ?? copy.values.unavailable}`}
              status={<StatusChip tone={shipment.blockers.length > 0 ? 'warning' : 'success'}>{shipment.blockers.length > 0 ? copy.values.pending : copy.values.confirmed}</StatusChip>}
            />
          )) : (
            <OperationalQueueLink
              href='/platform-v7/logistics'
              title={copy.queueTitle}
              detail={copy.emptyTask.description}
              status={<StatusChip tone='warning'>{copy.values.pending}</StatusChip>}
            />
          )}
        </OperationalQueue>
      </OperationalCockpitSection>
    </OperationalDecisionCockpit>
  );
}
