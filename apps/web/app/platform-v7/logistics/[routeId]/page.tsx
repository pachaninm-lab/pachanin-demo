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
import { getShipmentWorkspace } from '@/lib/logistics-server';

type Locale = 'ru' | 'en' | 'zh';

type Copy = Readonly<{
  metadataTitle: string;
  metadataDescription: string;
  eyebrow: string;
  unavailableTitle: string;
  unavailableDescription: string;
  unavailableStatus: string;
  unavailableTask: Readonly<{ title: string; description: string; blocker: string; impact: string; result: string }>;
  labels: Readonly<{ blocker: string; owner: string; impact: string; result: string; nextAction: string; prioritySection: string; factsSection: string }>;
  values: Readonly<{ unavailable: string; confirmed: string; pending: string; none: string }>;
  facts: Readonly<{ shipment: string; deal: string; driver: string; vehicle: string; cargo: string; checkpoints: string; gps: string }>;
  actions: Readonly<{ logistics: string; dealLogistics: string; deal: string }>;
  authorityTitle: string;
  authorityNotice: string;
  boundary: string;
  sections: Readonly<{ blockers: string; checkpoints: string; gps: string }>;
  itemCopy: Readonly<{ noBlockers: string; noCheckpoints: string; noGps: string; completed: string; pending: string; latestPoint: string }>;
}>;

const COPY: Record<Locale, Copy> = {
  ru: {
    metadataTitle: 'Рейс логистики · Прозрачная Цена',
    metadataDescription: 'Server-authoritative карточка рейса, контрольных точек и GPS-доказательств.',
    eyebrow: 'Логистика · карточка рейса',
    unavailableTitle: 'Рейс не подтверждён серверным контуром',
    unavailableDescription: 'Маршрут не найден в tenant-scoped реестре перевозок. Интерфейс не подставляет локальные рейсы, водителей, ЭТрН или GPS.',
    unavailableStatus: 'данные недоступны',
    unavailableTask: {
      title: 'Вернуться в подтверждённую очередь логистики',
      description: 'Проверьте идентификатор рейса и доступ организации. Создание или восстановление рейса выполняется только серверной командой сделки.',
      blocker: 'рейс отсутствует или недоступен текущему tenant',
      impact: 'нельзя подтверждать маршрут, водителя, документы или прибытие',
      result: 'доступный tenant-scoped shipment workspace',
    },
    labels: { blocker: 'Блокер', owner: 'Ответственный', impact: 'Влияние', result: 'Результат', nextAction: 'Следующее действие', prioritySection: 'Главная задача', factsSection: 'Подтверждённые факты' },
    values: { unavailable: 'Недоступно', confirmed: 'Подтверждено', pending: 'Ожидает', none: 'Нет' },
    facts: { shipment: 'Рейс', deal: 'Сделка', driver: 'Водитель', vehicle: 'Транспорт', cargo: 'Загружено', checkpoints: 'Контрольные точки', gps: 'GPS-события' },
    actions: { logistics: 'Открыть диспетчерскую', dealLogistics: 'Открыть контур рейсов', deal: 'Открыть Сделку' },
    authorityTitle: 'Источник данных',
    authorityNotice: 'Карточка загружена через `/logistics/shipments/:id/workspace`. Пустой или ошибочный ответ закрывает экран без fixture-подстановки.',
    boundary: 'Логистика подтверждает маршрут, назначение, GPS и контрольные точки. Она не меняет качество, приёмку, банковский статус, деньги или решение по спору.',
    sections: { blockers: 'Блокеры рейса', checkpoints: 'Контрольные точки', gps: 'Последнее GPS-событие' },
    itemCopy: { noBlockers: 'Сервер не вернул блокеров', noCheckpoints: 'Контрольные точки не зарегистрированы', noGps: 'GPS-трек не подтверждён', completed: 'Выполнено', pending: 'Ожидает', latestPoint: 'Последняя подтверждённая точка' },
  },
  en: {
    metadataTitle: 'Logistics shipment · Transparent Price',
    metadataDescription: 'A server-authoritative shipment, checkpoint and GPS evidence workspace.',
    eyebrow: 'Logistics · shipment workspace',
    unavailableTitle: 'The shipment is not confirmed by the server authority',
    unavailableDescription: 'The route was not found in the tenant-scoped logistics registry. The UI does not substitute local shipments, drivers, transport documents or GPS data.',
    unavailableStatus: 'data unavailable',
    unavailableTask: {
      title: 'Return to the confirmed logistics queue',
      description: 'Check the shipment identifier and organization access. A shipment can only be created or restored by a server-side Deal command.',
      blocker: 'shipment missing or unavailable to the current tenant',
      impact: 'route, driver, documents and arrival cannot be confirmed',
      result: 'an accessible tenant-scoped shipment workspace',
    },
    labels: { blocker: 'Blocker', owner: 'Owner', impact: 'Impact', result: 'Result', nextAction: 'Next action', prioritySection: 'Primary task', factsSection: 'Confirmed facts' },
    values: { unavailable: 'Unavailable', confirmed: 'Confirmed', pending: 'Pending', none: 'None' },
    facts: { shipment: 'Shipment', deal: 'Deal', driver: 'Driver', vehicle: 'Vehicle', cargo: 'Loaded', checkpoints: 'Checkpoints', gps: 'GPS events' },
    actions: { logistics: 'Open dispatch workspace', dealLogistics: 'Open Deal logistics', deal: 'Open Deal' },
    authorityTitle: 'Data authority',
    authorityNotice: 'This workspace is loaded through `/logistics/shipments/:id/workspace`. An empty or invalid response closes the screen without fixture substitution.',
    boundary: 'Logistics confirms the route, assignment, GPS and checkpoints. It does not change quality, acceptance, bank status, money or a dispute decision.',
    sections: { blockers: 'Shipment blockers', checkpoints: 'Checkpoints', gps: 'Latest GPS event' },
    itemCopy: { noBlockers: 'The server returned no blockers', noCheckpoints: 'No checkpoints are registered', noGps: 'The GPS track is not confirmed', completed: 'Completed', pending: 'Pending', latestPoint: 'Latest confirmed point' },
  },
  zh: {
    metadataTitle: '物流运输任务 · 透明价格',
    metadataDescription: '由服务器权威数据驱动的运输任务、检查点和 GPS 证据工作区。',
    eyebrow: '物流 · 运输任务工作区',
    unavailableTitle: '服务器权威未确认该运输任务',
    unavailableDescription: '在租户范围的物流登记册中未找到该路线。界面不会填充本地运输任务、司机、运输单据或 GPS 数据。',
    unavailableStatus: '数据不可用',
    unavailableTask: {
      title: '返回已确认的物流队列',
      description: '请检查运输任务标识和组织访问权限。运输任务只能通过交易的服务器命令创建或恢复。',
      blocker: '运输任务不存在或当前租户无权访问',
      impact: '无法确认路线、司机、单据或到达事实',
      result: '可访问的租户范围运输任务工作区',
    },
    labels: { blocker: '阻塞项', owner: '负责人', impact: '影响', result: '结果', nextAction: '下一步', prioritySection: '主要任务', factsSection: '已确认事实' },
    values: { unavailable: '不可用', confirmed: '已确认', pending: '待处理', none: '无' },
    facts: { shipment: '运输任务', deal: '交易', driver: '司机', vehicle: '车辆', cargo: '已装载', checkpoints: '检查点', gps: 'GPS 事件' },
    actions: { logistics: '打开调度工作区', dealLogistics: '打开交易物流', deal: '打开交易' },
    authorityTitle: '数据权威',
    authorityNotice: '该工作区通过 `/logistics/shipments/:id/workspace` 加载。空响应或无效响应会关闭页面，不会使用夹具数据替代。',
    boundary: '物流角色确认路线、指派、GPS 和检查点，不得更改质量、验收、银行状态、资金或争议裁决。',
    sections: { blockers: '运输任务阻塞项', checkpoints: '检查点', gps: '最新 GPS 事件' },
    itemCopy: { noBlockers: '服务器未返回阻塞项', noCheckpoints: '尚未登记检查点', noGps: 'GPS 轨迹未确认', completed: '已完成', pending: '待处理', latestPoint: '最新确认位置' },
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

function formatDate(value: string | null, locale: Locale, fallback: string): string {
  if (!value) return fallback;
  return new Intl.DateTimeFormat(dateLocale(locale), { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

export async function generateMetadata(): Promise<Metadata> {
  const copy = COPY[localeOf(await getLocale())];
  return { title: copy.metadataTitle, description: copy.metadataDescription, robots: { index: false, follow: false } };
}

export default async function RouteDetailPage({ params }: { params: { routeId: string } }) {
  const locale = localeOf(await getLocale());
  const copy = COPY[locale];
  const routeId = decodeURIComponent(params.routeId);
  const workspace = await getShipmentWorkspace(routeId);

  if (!workspace) {
    return (
      <OperationalDecisionCockpit
        testId='platform-v7-logistics-shipment-v8-unavailable'
        eyebrow={copy.eyebrow}
        title={copy.unavailableTitle}
        description={copy.unavailableDescription}
        statusLabel={copy.unavailableStatus}
        statusTone='warning'
        priority={{
          state: 'critical',
          ...copy.unavailableTask,
          owner: 'Logistics / Operations',
          primaryAction: <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/logistics'>{copy.actions.logistics}</Link>,
          secondaryAction: <Link className={operationalCockpitClasses.secondaryLink} href='/platform-v7/deal-logistics'>{copy.actions.dealLogistics}</Link>,
        }}
        facts={[
          { label: copy.facts.shipment, value: routeId, hint: copy.unavailableStatus },
          { label: copy.facts.deal, value: copy.values.unavailable },
          { label: copy.facts.driver, value: copy.values.unavailable },
          { label: copy.facts.gps, value: copy.values.none },
        ]}
        boundary={copy.boundary}
        labels={copy.labels}
      >
        <OperationalCockpitSection>
          <InlineNotice tone='warning' title={copy.authorityTitle}>{copy.authorityNotice}</InlineNotice>
        </OperationalCockpitSection>
      </OperationalDecisionCockpit>
    );
  }

  const { shipment, checkpoints, gpsTrack } = workspace;
  const latestGps = gpsTrack.at(-1) ?? null;
  const completedCheckpoints = checkpoints.filter((item) => Boolean(item.completedAt)).length;
  const routeLabel = `${shipment.routeFrom ?? copy.values.unavailable} → ${shipment.routeTo ?? copy.values.unavailable}`;
  const blocker = shipment.blockers[0] ?? null;
  const priority: OperationalPriority = {
    state: blocker ? 'critical' : 'active',
    title: blocker ? blocker : (shipment.nextAction ?? copy.values.confirmed),
    description: blocker
      ? (shipment.nextAction ?? copy.boundary)
      : `${routeLabel} · ${shipment.status}`,
    blocker: blocker ?? copy.values.none,
    owner: shipment.driverName ?? shipment.carrierName ?? 'Logistics / Operations',
    impact: shipment.loadedTons === null ? copy.values.unavailable : `${shipment.loadedTons} t`,
    result: `${completedCheckpoints}/${checkpoints.length} ${copy.facts.checkpoints.toLowerCase()}`,
    primaryAction: <Link className={operationalCockpitClasses.primaryLink} href={`/platform-v7/deal-logistics?shipmentId=${encodeURIComponent(shipment.id)}`}>{copy.actions.dealLogistics}</Link>,
    secondaryAction: <Link className={operationalCockpitClasses.secondaryLink} href={`/platform-v7/deals/${encodeURIComponent(shipment.dealId)}`}>{copy.actions.deal}</Link>,
  };

  return (
    <OperationalDecisionCockpit
      testId='platform-v7-logistics-shipment-v8'
      eyebrow={copy.eyebrow}
      title={routeLabel}
      description={`${shipment.id} · ${shipment.status}`}
      statusLabel={blocker ? copy.values.pending : copy.values.confirmed}
      statusTone={blocker ? 'warning' : 'success'}
      priority={priority}
      facts={[
        { label: copy.facts.shipment, value: shipment.id, hint: `v${shipment.version}` },
        { label: copy.facts.deal, value: shipment.dealId, hint: shipment.tenantId },
        { label: copy.facts.driver, value: shipment.driverName ?? copy.values.unavailable, hint: shipment.driverUserId ?? undefined },
        { label: copy.facts.vehicle, value: shipment.vehicleNumber ?? copy.values.unavailable, hint: shipment.vehicleType ?? undefined },
        { label: copy.facts.cargo, value: shipment.loadedTons === null ? copy.values.unavailable : `${shipment.loadedTons} t` },
        { label: copy.facts.checkpoints, value: `${completedCheckpoints}/${checkpoints.length}` },
        { label: copy.facts.gps, value: String(gpsTrack.length), hint: formatDate(shipment.lastGeoAt, locale, copy.values.unavailable) },
      ]}
      boundary={copy.boundary}
      labels={copy.labels}
    >
      <InlineNotice tone='information' title={copy.authorityTitle}>{copy.authorityNotice}</InlineNotice>

      <OperationalCockpitSection id='blockers'>
        <OperationalQueue>
          {shipment.blockers.length > 0 ? shipment.blockers.map((item, index) => (
            <OperationalQueueLink
              key={`${shipment.id}-blocker-${index}`}
              href={`/platform-v7/deal-logistics?shipmentId=${encodeURIComponent(shipment.id)}`}
              title={`${copy.sections.blockers} · ${index + 1}`}
              detail={item}
              status={<StatusChip tone='warning'>{copy.values.pending}</StatusChip>}
            />
          )) : (
            <OperationalQueueLink
              href={`/platform-v7/deal-logistics?shipmentId=${encodeURIComponent(shipment.id)}`}
              title={copy.sections.blockers}
              detail={copy.itemCopy.noBlockers}
              status={<StatusChip tone='success'>{copy.values.confirmed}</StatusChip>}
            />
          )}
        </OperationalQueue>
      </OperationalCockpitSection>

      <OperationalCockpitSection id='checkpoints'>
        <OperationalQueue>
          {checkpoints.length > 0 ? checkpoints.map((checkpoint) => (
            <OperationalQueueLink
              key={checkpoint.id}
              href={`/platform-v7/deal-logistics?shipmentId=${encodeURIComponent(shipment.id)}`}
              title={`${copy.sections.checkpoints} · ${checkpoint.type}`}
              detail={`${formatDate(checkpoint.completedAt ?? checkpoint.createdAt, locale, copy.values.unavailable)}${checkpoint.note ? ` · ${checkpoint.note}` : ''}`}
              status={<StatusChip tone={checkpoint.completedAt ? 'success' : 'warning'}>{checkpoint.completedAt ? copy.itemCopy.completed : copy.itemCopy.pending}</StatusChip>}
            />
          )) : (
            <OperationalQueueLink
              href={`/platform-v7/deal-logistics?shipmentId=${encodeURIComponent(shipment.id)}`}
              title={copy.sections.checkpoints}
              detail={copy.itemCopy.noCheckpoints}
              status={<StatusChip tone='warning'>{copy.values.pending}</StatusChip>}
            />
          )}
        </OperationalQueue>
      </OperationalCockpitSection>

      <OperationalCockpitSection id='gps'>
        <OperationalQueue>
          <OperationalQueueLink
            href={`/platform-v7/deal-logistics?shipmentId=${encodeURIComponent(shipment.id)}`}
            title={copy.sections.gps}
            detail={latestGps
              ? `${copy.itemCopy.latestPoint}: ${formatDate(latestGps.recordedAt, locale, copy.values.unavailable)} · ${latestGps.lat.toFixed(5)}, ${latestGps.lng.toFixed(5)}`
              : copy.itemCopy.noGps}
            status={<StatusChip tone={latestGps ? 'success' : 'warning'}>{latestGps ? copy.values.confirmed : copy.values.pending}</StatusChip>}
          />
        </OperationalQueue>
      </OperationalCockpitSection>
    </OperationalDecisionCockpit>
  );
}
