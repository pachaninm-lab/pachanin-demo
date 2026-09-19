import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { StatusChip } from '@pc/design-system-v8';
import {
  buildAcceptanceProjection,
  getCanonicalDealExecutionWorkspace,
  type AcceptanceProjection,
  type DealLabTest,
} from '@/lib/deal-execution-server';
import {
  PhysicalExecutionCockpit,
  PhysicalExecutionDetailGrid,
  PhysicalExecutionList,
  PhysicalExecutionPanel,
  PhysicalExecutionSplit,
  physicalExecutionClasses,
  type PhysicalExecutionPhase,
} from '@/components/transaction-ux/PhysicalExecutionCockpit';
import {
  PHYSICAL_EXECUTION_COPY,
  buildPhysicalExecutionPhases,
  formatPhysicalNumber,
  normalizePhysicalExecutionLocale,
  type PhysicalExecutionLocale,
} from '@/components/transaction-ux/physicalExecutionCopy';

type PageSearchParams = {
  dealId?: string | string[];
  shipmentId?: string | string[];
};

const AUTHORITY_COPY = {
  ru: {
    unavailableTitle: 'Серверные факты приёмки недоступны',
    unavailableDescription: 'Экран закрыт: не указана Сделка, нет доступного рейса или канонический Deal workspace вернул неполный либо противоречивый ответ.',
    openDeals: 'Открыть реестр Сделок',
    serverBoundary: 'Каноническая серверная проекция Сделки. Интерфейс не фиксирует вес, качество, акт приёмки и не формирует банковское основание.',
    version: 'Версия Сделки',
    noValue: 'не зафиксировано',
    source: 'Источник',
    equipment: 'Оборудование',
    occurredAt: 'Зафиксировано',
    protocol: 'Протокол',
    sample: 'Проба',
    acceptanceAct: 'Акт приёмки',
    arrival: 'Прибытие',
    weighing: 'Взвешивание',
    laboratory: 'Лаборатория',
    signed: 'подписан',
    unsigned: 'не подписан',
    finalized: 'завершено',
    notFinalized: 'не завершено',
    qualityPassed: 'соответствует',
    qualityFailed: 'отклонение',
    norm: 'норма',
    actual: 'факт',
    blockers: 'Серверные блокеры',
    allFactsReady: 'Все обязательные факты подтверждены сервером',
    gross: 'Брутто',
    tare: 'Тара',
    net: 'Нетто',
  },
  en: {
    unavailableTitle: 'Server acceptance facts are unavailable',
    unavailableDescription: 'The screen is closed because no Deal was specified, no accessible shipment exists, or the canonical Deal workspace returned an incomplete or contradictory envelope.',
    openDeals: 'Open Deal registry',
    serverBoundary: 'Canonical server projection of the Deal. The interface cannot record weight, quality, acceptance acts, or create a bank basis.',
    version: 'Deal version',
    noValue: 'not recorded',
    source: 'Source',
    equipment: 'Equipment',
    occurredAt: 'Recorded at',
    protocol: 'Protocol',
    sample: 'Sample',
    acceptanceAct: 'Acceptance act',
    arrival: 'Arrival',
    weighing: 'Weighing',
    laboratory: 'Laboratory',
    signed: 'signed',
    unsigned: 'not signed',
    finalized: 'finalized',
    notFinalized: 'not finalized',
    qualityPassed: 'compliant',
    qualityFailed: 'deviation',
    norm: 'range',
    actual: 'actual',
    blockers: 'Server blockers',
    allFactsReady: 'All mandatory facts are confirmed by the server',
    gross: 'Gross',
    tare: 'Tare',
    net: 'Net',
  },
  zh: {
    unavailableTitle: '服务器验收事实不可用',
    unavailableDescription: '页面已关闭：未指定交易、没有可访问的运输任务，或交易工作区返回不完整或矛盾的数据。',
    openDeals: '打开交易列表',
    serverBoundary: '交易的规范服务器投影。界面不能记录重量、质量、验收文件，也不能创建银行依据。',
    version: '交易版本',
    noValue: '未记录',
    source: '来源',
    equipment: '设备',
    occurredAt: '记录时间',
    protocol: '协议',
    sample: '样本',
    acceptanceAct: '验收文件',
    arrival: '到达',
    weighing: '称重',
    laboratory: '实验室',
    signed: '已签署',
    unsigned: '未签署',
    finalized: '已完成',
    notFinalized: '未完成',
    qualityPassed: '符合要求',
    qualityFailed: '存在偏差',
    norm: '标准',
    actual: '实际',
    blockers: '服务器阻塞项',
    allFactsReady: '所有必需事实均已由服务器确认',
    gross: '毛重',
    tare: '皮重',
    net: '净重',
  },
} as const;

export default async function DealAcceptancePage(
  props: {
    searchParams?: Promise<PageSearchParams>;
  }
) {
  const searchParams = await props.searchParams;
  const locale = normalizePhysicalExecutionLocale(await getLocale());
  const dealId = firstParam(searchParams?.dealId);
  const shipmentId = firstParam(searchParams?.shipmentId);
  if (!dealId) return renderUnavailable(locale);

  const workspace = await getCanonicalDealExecutionWorkspace(dealId);
  const projection = workspace ? buildAcceptanceProjection(workspace, shipmentId) : null;
  if (!projection) return renderUnavailable(locale);

  return renderAcceptance(projection, locale);
}

function renderAcceptance(projection: AcceptanceProjection, locale: PhysicalExecutionLocale) {
  const copy = PHYSICAL_EXECUTION_COPY[locale];
  const authorityCopy = AUTHORITY_COPY[locale];
  const context = `dealId=${encodeURIComponent(projection.dealId)}&shipmentId=${encodeURIComponent(projection.shipment.id)}`;
  const documentsHref = `/platform-v7/deal-documents-basis?${context}`;
  const dealHref = `/platform-v7/deals/${encodeURIComponent(projection.dealId)}/clean`;
  const phases = contextualPhases(buildPhysicalExecutionPhases(locale, 'acceptance', {
    logistics: 'complete',
    acceptance: 'current',
    documents: projection.ready ? 'available' : 'blocked',
    bank: 'blocked',
  }), projection);
  const acceptanceSigned = Boolean(
    projection.acceptance?.status === 'ACCEPTED'
      && projection.acceptance.actSignedAt
      && projection.acceptance.actDocId,
  );
  const labFinal = Boolean(
    projection.laboratory?.status === 'DONE'
      && projection.laboratory.finalizedAt
      && projection.laboratory.certificateDocId,
  );
  const date = (value: string | null | undefined) => value
    ? new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-GB' : 'ru-RU', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(value))
    : authorityCopy.noValue;

  return (
    <PhysicalExecutionCockpit
      testId='platform-v7-deal-acceptance-v8'
      eyebrow={copy.acceptance.eyebrow}
      title={copy.acceptance.title}
      description={copy.acceptance.description}
      statusLabel={projection.ready ? copy.acceptance.statusReady : copy.acceptance.statusBlocked}
      statusTone={projection.ready ? 'success' : 'critical'}
      labels={copy.meta}
      priority={{
        state: projection.ready ? 'ready' : 'critical',
        title: projection.ready ? copy.acceptance.priorityReadyTitle : copy.acceptance.priorityBlockedTitle,
        description: projection.ready
          ? copy.acceptance.priorityReadyDescription
          : projection.blockers.join(' · ') || copy.acceptance.priorityBlockedDescription,
        blocker: projection.ready ? copy.acceptance.blockerReady : projection.blockers.join(' · '),
        owner: copy.acceptance.owner,
        impact: projection.ready ? copy.acceptance.impactReady : copy.acceptance.impactBlocked,
        result: copy.acceptance.result,
        primaryAction: projection.ready
          ? <Link className={physicalExecutionClasses.primaryLink} href={documentsHref}>{copy.common.openDocuments}</Link>
          : <Link className={physicalExecutionClasses.primaryLink} href={`/platform-v7/lab?${context}`}>{copy.common.openLab}</Link>,
        secondaryAction: <Link className={physicalExecutionClasses.secondaryLink} href={dealHref}>{copy.common.openDeal}</Link>,
      }}
      facts={[
        { label: copy.acceptance.facts.deal, value: projection.dealId, hint: `${authorityCopy.version}: ${projection.dealVersion}` },
        { label: copy.acceptance.facts.route, value: projection.shipment.id, hint: projection.shipment.status },
        { label: copy.acceptance.facts.lot, value: projection.lotId ?? authorityCopy.noValue },
        { label: copy.acceptance.facts.certificate, value: projection.laboratory?.certificateDocId ?? authorityCopy.noValue, hint: copy.common.externalBoundary },
        { label: copy.acceptance.facts.vehicle, value: projection.shipment.vehicleNumber ?? authorityCopy.noValue, hint: projection.shipment.driverName ?? authorityCopy.noValue },
        { label: copy.acceptance.facts.elevator, value: projection.shipment.routeTo ?? authorityCopy.noValue },
      ]}
      boundary={authorityCopy.serverBoundary}
      phases={phases}
      phaseNavLabel={copy.phaseNavLabel}
    >
      <PhysicalExecutionSplit>
        <PhysicalExecutionPanel title={copy.acceptance.weightTitle} description={copy.acceptance.weightDescription}>
          <PhysicalExecutionList
            label={copy.acceptance.weightTitle}
            items={[
              {
                id: 'arrival',
                title: authorityCopy.arrival,
                detail: date(projection.arrival?.completedAt),
                meta: projection.arrival && projection.arrival.lat !== null && projection.arrival.lng !== null
                  ? `${projection.arrival.lat}, ${projection.arrival.lng}`
                  : authorityCopy.noValue,
                status: <StatusChip tone={projection.arrival ? 'success' : 'critical'}>{projection.arrival ? copy.common.complete : copy.common.blocked}</StatusChip>,
              },
              {
                id: 'gross',
                title: authorityCopy.gross,
                detail: tons(projection.weight?.grossTons, locale, authorityCopy.noValue),
              },
              {
                id: 'tare',
                title: authorityCopy.tare,
                detail: tons(projection.weight?.tareTons, locale, authorityCopy.noValue),
              },
              {
                id: 'net',
                title: authorityCopy.net,
                detail: tons(projection.weight?.netTons, locale, authorityCopy.noValue),
                meta: projection.weight
                  ? `${authorityCopy.source}: ${projection.weight.weighingSource} · ${authorityCopy.equipment}: ${projection.weight.equipmentId} · ${authorityCopy.occurredAt}: ${date(projection.weight.occurredAt)}`
                  : authorityCopy.noValue,
                status: <StatusChip tone={projection.weight ? 'success' : 'critical'}>{projection.weight ? copy.common.complete : copy.common.blocked}</StatusChip>,
              },
            ]}
          />
        </PhysicalExecutionPanel>

        <PhysicalExecutionPanel id='quality' title={copy.acceptance.qualityTitle} description={copy.acceptance.qualityDescription}>
          <PhysicalExecutionList
            label={copy.acceptance.qualityTitle}
            items={projection.laboratory?.tests.length
              ? projection.laboratory.tests.map((test) => qualityItem(test, locale))
              : [{
                  id: 'quality-missing',
                  title: authorityCopy.laboratory,
                  detail: authorityCopy.notFinalized,
                  status: <StatusChip tone='critical'>{copy.common.blocked}</StatusChip>,
                }]}
          />
        </PhysicalExecutionPanel>
      </PhysicalExecutionSplit>

      <PhysicalExecutionPanel title={copy.acceptance.evidenceTitle} description={copy.acceptance.evidenceDescription}>
        <PhysicalExecutionList
          label={copy.acceptance.evidenceTitle}
          items={[
            {
              id: 'arrival-evidence',
              title: authorityCopy.arrival,
              detail: projection.arrival?.photoUrl ?? projection.arrival?.id ?? authorityCopy.noValue,
              meta: date(projection.arrival?.completedAt),
              status: <StatusChip tone={projection.arrival ? 'success' : 'critical'}>{projection.arrival ? copy.common.complete : copy.common.blocked}</StatusChip>,
            },
            {
              id: 'weight-evidence',
              title: authorityCopy.weighing,
              detail: projection.weight?.evidenceRef ?? authorityCopy.noValue,
              meta: projection.weight ? date(projection.weight.occurredAt) : authorityCopy.noValue,
              status: <StatusChip tone={projection.weight ? 'success' : 'critical'}>{projection.weight ? copy.common.complete : copy.common.blocked}</StatusChip>,
            },
            {
              id: 'lab-evidence',
              title: authorityCopy.laboratory,
              detail: projection.laboratory?.certificateDocId ?? authorityCopy.noValue,
              meta: projection.laboratory
                ? `${authorityCopy.sample}: ${projection.laboratory.sampleCode ?? projection.laboratory.id} · ${authorityCopy.protocol}: ${projection.laboratory.protocol ?? authorityCopy.noValue}`
                : authorityCopy.noValue,
              status: <StatusChip tone={labFinal ? 'success' : 'critical'}>{labFinal ? authorityCopy.finalized : authorityCopy.notFinalized}</StatusChip>,
            },
            {
              id: 'acceptance-act',
              title: authorityCopy.acceptanceAct,
              detail: projection.acceptance?.actDocId ?? authorityCopy.noValue,
              meta: date(projection.acceptance?.actSignedAt),
              status: <StatusChip tone={acceptanceSigned ? 'success' : 'critical'}>{acceptanceSigned ? authorityCopy.signed : authorityCopy.unsigned}</StatusChip>,
            },
          ]}
        />
      </PhysicalExecutionPanel>

      <PhysicalExecutionDetailGrid
        label={copy.phaseNavLabel}
        items={[
          {
            label: authorityCopy.blockers,
            value: projection.ready ? authorityCopy.allFactsReady : projection.blockers.join(' · '),
            hint: authorityCopy.serverBoundary,
          },
          {
            label: copy.common.openDocuments,
            value: projection.ready ? copy.common.review : copy.common.blocked,
            hint: projection.ready ? documentsHref : copy.common.required,
          },
          {
            label: copy.common.bankReadiness,
            value: copy.common.blocked,
            hint: copy.common.externalBoundary,
          },
        ]}
      />

      {!projection.ready ? (
        <PhysicalExecutionPanel title={copy.common.blocked} description={copy.acceptance.priorityBlockedDescription}>
          <p className={physicalExecutionClasses.warningText}>{projection.blockers.join(' · ')}</p>
          <Link className={physicalExecutionClasses.secondaryLink} href={`/platform-v7/disputes?dealId=${encodeURIComponent(projection.dealId)}`}>{copy.common.openDisputes}</Link>
        </PhysicalExecutionPanel>
      ) : null}
    </PhysicalExecutionCockpit>
  );
}

function renderUnavailable(locale: PhysicalExecutionLocale) {
  const copy = PHYSICAL_EXECUTION_COPY[locale];
  const authorityCopy = AUTHORITY_COPY[locale];
  const phases = buildPhysicalExecutionPhases(locale, 'acceptance', {
    logistics: 'blocked',
    acceptance: 'current',
    documents: 'blocked',
    bank: 'blocked',
  });

  return (
    <PhysicalExecutionCockpit
      testId='platform-v7-deal-acceptance-v8'
      eyebrow={copy.acceptance.eyebrow}
      title={authorityCopy.unavailableTitle}
      description={authorityCopy.unavailableDescription}
      statusLabel={copy.common.blocked}
      statusTone='critical'
      labels={copy.meta}
      priority={{
        state: 'critical',
        title: authorityCopy.unavailableTitle,
        description: authorityCopy.unavailableDescription,
        blocker: copy.acceptance.blockerBlocked,
        owner: copy.acceptance.owner,
        impact: copy.acceptance.impactBlocked,
        result: copy.acceptance.result,
        primaryAction: <Link className={physicalExecutionClasses.primaryLink} href='/platform-v7/deals'>{authorityCopy.openDeals}</Link>,
      }}
      facts={[]}
      boundary={authorityCopy.serverBoundary}
      phases={phases}
      phaseNavLabel={copy.phaseNavLabel}
    >
      <PhysicalExecutionPanel title={authorityCopy.blockers} description={authorityCopy.unavailableDescription}>
        <PhysicalExecutionList
          label={authorityCopy.blockers}
          items={[{
            id: 'acceptance-authority-unavailable',
            title: authorityCopy.unavailableTitle,
            detail: authorityCopy.unavailableDescription,
            status: <StatusChip tone='critical'>{copy.common.blocked}</StatusChip>,
          }]}
        />
      </PhysicalExecutionPanel>
    </PhysicalExecutionCockpit>
  );
}

function contextualPhases(
  phases: PhysicalExecutionPhase[],
  projection: AcceptanceProjection,
): PhysicalExecutionPhase[] {
  const context = `dealId=${encodeURIComponent(projection.dealId)}&shipmentId=${encodeURIComponent(projection.shipment.id)}`;
  return phases.map((phase) => {
    if (phase.state === 'blocked') return phase;
    if (phase.id === 'logistics') return { ...phase, href: `/platform-v7/deal-logistics?${context}` };
    if (phase.id === 'acceptance') return { ...phase, href: `/platform-v7/deal-acceptance?${context}` };
    if (phase.id === 'documents') return { ...phase, href: `/platform-v7/deal-documents-basis?${context}` };
    return phase;
  });
}

function qualityItem(test: DealLabTest, locale: PhysicalExecutionLocale) {
  const copy = PHYSICAL_EXECUTION_COPY[locale];
  const authorityCopy = AUTHORITY_COPY[locale];
  const norm = [
    test.normMin === null ? null : `≥ ${formatPhysicalNumber(test.normMin, locale)}`,
    test.normMax === null ? null : `≤ ${formatPhysicalNumber(test.normMax, locale)}`,
  ].filter(Boolean).join(' · ') || authorityCopy.noValue;
  const actual = `${formatPhysicalNumber(test.value, locale)}${test.unit ? ` ${test.unit}` : ''}`;
  return {
    id: test.id,
    title: test.parameter,
    detail: `${authorityCopy.norm}: ${norm} · ${authorityCopy.actual}: ${actual}`,
    meta: test.result ?? undefined,
    status: <StatusChip tone={test.passed ? 'success' : 'critical'}>{test.passed ? authorityCopy.qualityPassed : authorityCopy.qualityFailed}</StatusChip>,
  };
}

function tons(value: string | undefined, locale: PhysicalExecutionLocale, fallback: string): string {
  if (!value) return fallback;
  return `${formatPhysicalNumber(Number(value), locale)} t`;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  const normalized = candidate?.trim();
  return normalized || undefined;
}
