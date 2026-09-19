import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { StatusChip } from '@pc/design-system-v8';
import {
  getShipmentWorkspace,
  getShipments,
  type ShipmentWorkspaceServer,
} from '@/lib/logistics-server';
import {
  PhysicalExecutionCockpit,
  PhysicalExecutionDetailGrid,
  PhysicalExecutionList,
  PhysicalExecutionPanel,
  PhysicalExecutionSplit,
  physicalExecutionClasses,
} from '@/components/transaction-ux/PhysicalExecutionCockpit';
import {
  PHYSICAL_EXECUTION_COPY,
  buildPhysicalExecutionPhases,
  formatPhysicalNumber,
  normalizePhysicalExecutionLocale,
  type PhysicalExecutionLocale,
} from '@/components/transaction-ux/physicalExecutionCopy';

type PageSearchParams = {
  shipmentId?: string | string[];
  dealId?: string | string[];
};

const AUTHORITY_COPY = {
  ru: {
    unavailableTitle: 'Серверное состояние рейса недоступно',
    unavailableDescription: 'Экран закрыт: рейс не найден, недоступен текущей роли или сервер вернул неполный ответ.',
    selectDeal: 'Открыть реестр Сделок',
    shipment: 'Рейс',
    status: 'Статус',
    route: 'Маршрут',
    version: 'Версия',
    checkpoints: 'Контрольные точки',
    gps: 'GPS-точки',
    serverProjection: 'PostgreSQL-backed серверная проекция. Интерфейс не создаёт и не изменяет рейс.',
    source: 'Откуда',
    destination: 'Куда',
    eta: 'Ожидаемое время',
    hours: 'ч',
    notAssigned: 'не назначено',
    noBlockers: 'Блокеров нет',
    blockers: 'Серверные блокеры',
    pin: 'ПИН водителя',
    verified: 'подтверждён',
    notVerified: 'не подтверждён',
  },
  en: {
    unavailableTitle: 'Server shipment state is unavailable',
    unavailableDescription: 'The screen is closed because the shipment is missing, outside the current role scope, or the server envelope is incomplete.',
    selectDeal: 'Open Deal registry',
    shipment: 'Shipment',
    status: 'Status',
    route: 'Route',
    version: 'Version',
    checkpoints: 'Checkpoints',
    gps: 'GPS points',
    serverProjection: 'PostgreSQL-backed server projection. The interface cannot create or mutate the shipment.',
    source: 'Origin',
    destination: 'Destination',
    eta: 'Estimated time',
    hours: 'h',
    notAssigned: 'not assigned',
    noBlockers: 'No blockers',
    blockers: 'Server blockers',
    pin: 'Driver PIN',
    verified: 'verified',
    notVerified: 'not verified',
  },
  zh: {
    unavailableTitle: '服务器运输状态不可用',
    unavailableDescription: '页面已关闭：运输任务不存在、当前角色无权访问，或服务器数据不完整。',
    selectDeal: '打开交易列表',
    shipment: '运输任务',
    status: '状态',
    route: '路线',
    version: '版本',
    checkpoints: '检查点',
    gps: 'GPS 点',
    serverProjection: '基于 PostgreSQL 的服务器投影。界面不能创建或修改运输任务。',
    source: '起点',
    destination: '终点',
    eta: '预计时间',
    hours: '小时',
    notAssigned: '未分配',
    noBlockers: '无阻塞项',
    blockers: '服务器阻塞项',
    pin: '司机 PIN',
    verified: '已确认',
    notVerified: '未确认',
  },
} as const;

export default async function DealLogisticsPage(
  props: {
    searchParams?: Promise<PageSearchParams>;
  }
) {
  const searchParams = await props.searchParams;
  const locale = normalizePhysicalExecutionLocale(await getLocale());
  const copy = PHYSICAL_EXECUTION_COPY[locale];
  const authorityCopy = AUTHORITY_COPY[locale];
  const shipments = await getShipments();
  const requestedShipmentId = firstParam(searchParams?.shipmentId);
  const requestedDealId = firstParam(searchParams?.dealId);
  const selected = requestedShipmentId
    ? shipments.find((shipment) => shipment.id === requestedShipmentId)
    : requestedDealId
      ? shipments.find((shipment) => shipment.dealId === requestedDealId)
      : shipments[0];
  const workspace = selected ? await getShipmentWorkspace(selected.id) : null;

  if (!workspace) {
    return renderUnavailable(locale);
  }

  return renderWorkspace(workspace, locale);
}

function renderWorkspace(workspace: ShipmentWorkspaceServer, locale: PhysicalExecutionLocale) {
  const copy = PHYSICAL_EXECUTION_COPY[locale];
  const authorityCopy = AUTHORITY_COPY[locale];
  const state = workspace.shipment;
  const carrierReady = Boolean(
    state.pinVerified
      && state.driverUserId
      && state.vehicleNumber
      && state.carrierOrgId
      && state.blockers.length === 0,
  );
  const phases = buildPhysicalExecutionPhases(locale, 'logistics', {
    logistics: 'current',
    acceptance: carrierReady ? 'available' : 'blocked',
    documents: 'blocked',
    bank: 'blocked',
  });
  const acceptanceHref = `/platform-v7/deal-acceptance?dealId=${encodeURIComponent(state.dealId)}&shipmentId=${encodeURIComponent(state.id)}`;
  const dealHref = `/platform-v7/deals/${encodeURIComponent(state.dealId)}/clean`;

  return (
    <PhysicalExecutionCockpit
      testId='platform-v7-deal-logistics-v8'
      eyebrow={copy.logistics.eyebrow}
      title={copy.logistics.title}
      description={copy.logistics.description}
      statusLabel={carrierReady ? copy.logistics.statusReady : copy.logistics.statusBlocked}
      statusTone={carrierReady ? 'success' : 'critical'}
      labels={copy.meta}
      priority={{
        state: carrierReady ? 'ready' : 'critical',
        title: carrierReady ? copy.logistics.priorityReadyTitle : copy.logistics.priorityBlockedTitle,
        description: carrierReady
          ? copy.logistics.priorityReadyDescription
          : state.blockers.join(' · ') || copy.logistics.priorityBlockedDescription,
        blocker: carrierReady ? copy.logistics.blockerReady : state.blockers.join(' · ') || copy.logistics.blockerBlocked,
        owner: copy.logistics.owner,
        impact: carrierReady ? copy.logistics.impactReady : copy.logistics.impactBlocked,
        result: copy.logistics.result,
        primaryAction: carrierReady
          ? <Link className={physicalExecutionClasses.primaryLink} href={acceptanceHref}>{copy.common.openAcceptance}</Link>
          : <Link className={physicalExecutionClasses.primaryLink} href={`/platform-v7/logistics?shipmentId=${encodeURIComponent(state.id)}`}>{copy.common.openLogistics}</Link>,
        secondaryAction: <Link className={physicalExecutionClasses.secondaryLink} href={dealHref}>{copy.common.openDeal}</Link>,
      }}
      facts={[
        { label: copy.logistics.facts.deal, value: state.dealId, hint: authorityCopy.serverProjection },
        { label: authorityCopy.shipment, value: state.id, hint: `${authorityCopy.version}: ${state.version}` },
        { label: authorityCopy.status, value: state.status },
        { label: authorityCopy.route, value: [state.routeFrom, state.routeTo].filter(Boolean).join(' → ') || authorityCopy.notAssigned },
        { label: authorityCopy.checkpoints, value: String(workspace.checkpoints.length) },
        { label: authorityCopy.gps, value: String(workspace.gpsTrack.length) },
      ]}
      boundary={authorityCopy.serverProjection}
      phases={phases}
      phaseNavLabel={copy.phaseNavLabel}
    >
      <PhysicalExecutionDetailGrid
        label={copy.logistics.routeTitle}
        items={[
          { label: authorityCopy.source, value: state.routeFrom || authorityCopy.notAssigned },
          { label: authorityCopy.destination, value: state.routeTo || authorityCopy.notAssigned },
          {
            label: authorityCopy.eta,
            value: state.etaHours === null
              ? authorityCopy.notAssigned
              : `${formatPhysicalNumber(state.etaHours, locale)} ${authorityCopy.hours}`,
          },
        ]}
      />

      <PhysicalExecutionSplit>
        <PhysicalExecutionPanel title={copy.logistics.vehicleTitle} description={copy.logistics.vehicleDescription}>
          <PhysicalExecutionList
            label={copy.logistics.vehicleTitle}
            items={[
              { id: 'carrier', title: copy.logistics.carrier, detail: state.carrierName || authorityCopy.notAssigned },
              { id: 'vehicle', title: copy.logistics.vehicle, detail: state.vehicleNumber || authorityCopy.notAssigned },
              { id: 'driver', title: copy.logistics.driver, detail: state.driverName || authorityCopy.notAssigned },
              {
                id: 'volume',
                title: copy.logistics.capacity,
                detail: state.loadedTons === null ? authorityCopy.notAssigned : `${formatPhysicalNumber(state.loadedTons, locale)} t`,
              },
              {
                id: 'pin',
                title: authorityCopy.pin,
                detail: state.pinVerified ? authorityCopy.verified : authorityCopy.notVerified,
                status: <StatusChip tone={state.pinVerified ? 'success' : 'critical'}>{state.pinVerified ? authorityCopy.verified : authorityCopy.notVerified}</StatusChip>,
              },
            ]}
          />
        </PhysicalExecutionPanel>

        <PhysicalExecutionPanel title={copy.logistics.controlsTitle} description={copy.logistics.controlsDescription}>
          <PhysicalExecutionList
            label={copy.logistics.controlsTitle}
            items={state.blockers.length > 0
              ? state.blockers.map((blocker, index) => ({
                  id: `blocker-${index}`,
                  title: blocker,
                  detail: authorityCopy.blockers,
                  status: <StatusChip tone='critical'>{copy.common.blocked}</StatusChip>,
                }))
              : [{
                  id: 'no-blockers',
                  title: authorityCopy.noBlockers,
                  status: <StatusChip tone='success'>{copy.common.complete}</StatusChip>,
                }]}
          />
        </PhysicalExecutionPanel>
      </PhysicalExecutionSplit>

      <PhysicalExecutionPanel title={copy.logistics.nextTitle} description={copy.logistics.nextDescription}>
        <PhysicalExecutionList
          label={copy.logistics.nextTitle}
          items={[
            {
              id: 'driver',
              title: copy.logistics.driver,
              detail: state.nextAction || copy.common.review,
              href: `/platform-v7/driver/field?shipmentId=${encodeURIComponent(state.id)}`,
              blocked: !carrierReady,
              status: <StatusChip tone={carrierReady ? 'information' : 'critical'}>{carrierReady ? copy.common.review : copy.common.blocked}</StatusChip>,
            },
            {
              id: 'acceptance',
              title: copy.common.openAcceptance,
              detail: state.nextAction || copy.common.review,
              href: acceptanceHref,
              blocked: !carrierReady,
              status: <StatusChip tone={carrierReady ? 'information' : 'critical'}>{carrierReady ? copy.common.review : copy.common.blocked}</StatusChip>,
            },
          ]}
        />
      </PhysicalExecutionPanel>
    </PhysicalExecutionCockpit>
  );
}

function renderUnavailable(locale: PhysicalExecutionLocale) {
  const copy = PHYSICAL_EXECUTION_COPY[locale];
  const authorityCopy = AUTHORITY_COPY[locale];
  const phases = buildPhysicalExecutionPhases(locale, 'logistics', {
    logistics: 'current',
    acceptance: 'blocked',
    documents: 'blocked',
    bank: 'blocked',
  });

  return (
    <PhysicalExecutionCockpit
      testId='platform-v7-deal-logistics-v8'
      eyebrow={copy.logistics.eyebrow}
      title={authorityCopy.unavailableTitle}
      description={authorityCopy.unavailableDescription}
      statusLabel={copy.common.blocked}
      statusTone='critical'
      labels={copy.meta}
      priority={{
        state: 'critical',
        title: authorityCopy.unavailableTitle,
        description: authorityCopy.unavailableDescription,
        blocker: copy.logistics.blockerBlocked,
        owner: copy.logistics.owner,
        impact: copy.logistics.impactBlocked,
        result: copy.logistics.result,
        primaryAction: <Link className={physicalExecutionClasses.primaryLink} href='/platform-v7/deals'>{authorityCopy.selectDeal}</Link>,
      }}
      facts={[]}
      boundary={authorityCopy.serverProjection}
      phases={phases}
      phaseNavLabel={copy.phaseNavLabel}
    >
      <PhysicalExecutionPanel title={copy.logistics.controlsTitle} description={copy.logistics.controlsDescription}>
        <PhysicalExecutionList
          label={copy.logistics.controlsTitle}
          items={[{
            id: 'authority-unavailable',
            title: authorityCopy.unavailableTitle,
            detail: authorityCopy.unavailableDescription,
            status: <StatusChip tone='critical'>{copy.common.blocked}</StatusChip>,
          }]}
        />
      </PhysicalExecutionPanel>
    </PhysicalExecutionCockpit>
  );
}

function firstParam(value: string | string[] | undefined): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  const normalized = candidate?.trim();
  return normalized || undefined;
}
