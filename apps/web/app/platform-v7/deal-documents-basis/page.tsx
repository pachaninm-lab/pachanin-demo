import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { StatusChip } from '@pc/design-system-v8';
import {
  buildDocumentBasisProjection,
  getCanonicalDealExecutionWorkspace,
  type DocumentBasisProjection,
  type DocumentReadinessState,
  type RequiredReleaseDocumentType,
} from '@/lib/deal-execution-server';
import {
  PhysicalExecutionCockpit,
  PhysicalExecutionList,
  PhysicalExecutionPanel,
  PhysicalExecutionSplit,
  physicalExecutionClasses,
  type PhysicalExecutionPhase,
} from '@/components/transaction-ux/PhysicalExecutionCockpit';
import {
  PHYSICAL_EXECUTION_COPY,
  buildPhysicalExecutionPhases,
  normalizePhysicalExecutionLocale,
  type PhysicalExecutionLocale,
} from '@/components/transaction-ux/physicalExecutionCopy';

type PageSearchParams = {
  dealId?: string | string[];
  shipmentId?: string | string[];
};

const DOCUMENT_TYPE_COPY: Record<PhysicalExecutionLocale, Record<RequiredReleaseDocumentType, string>> = {
  ru: {
    CONTRACT: 'Договор',
    TTN: 'Транспортная накладная',
    WEIGHING_ACT: 'Акт взвешивания',
    LAB_PROTOCOL: 'Лабораторный протокол',
    ACCEPTANCE_ACT: 'Акт приёмки',
  },
  en: {
    CONTRACT: 'Contract',
    TTN: 'Transport consignment note',
    WEIGHING_ACT: 'Weighing act',
    LAB_PROTOCOL: 'Laboratory protocol',
    ACCEPTANCE_ACT: 'Acceptance act',
  },
  zh: {
    CONTRACT: '合同',
    TTN: '运输单据',
    WEIGHING_ACT: '称重文件',
    LAB_PROTOCOL: '实验室报告',
    ACCEPTANCE_ACT: '验收文件',
  },
};

const AUTHORITY_COPY = {
  ru: {
    unavailableTitle: 'Серверное документное основание недоступно',
    unavailableDescription: 'Экран закрыт: не указана Сделка, нет доступного рейса или канонический Deal workspace вернул неполный либо противоречивый комплект.',
    openDeals: 'Открыть реестр Сделок',
    serverBoundary: 'Каноническая серверная проекция Сделки. Интерфейс не создаёт, не подписывает, не принимает банком документы и не выпускает деньги.',
    dealVersion: 'Версия Сделки',
    documentVersion: 'Версия документа',
    noValue: 'не зафиксировано',
    signedAt: 'Подписан',
    storage: 'Хранилище',
    hash: 'Hash',
    bank: 'Банк',
    accepted: 'принято',
    notAccepted: 'не принято',
    immutable: 'неизменяемый',
    mutable: 'изменяемый',
    blockers: 'Серверные блокеры',
    allReady: 'Приёмка и пять обязательных документов подтверждены сервером',
    sourceDeal: 'Каноническая Сделка',
    sourceAcceptance: 'Подтверждённая приёмка',
    sourceDocuments: 'Серверный реестр документов',
    bankLocked: 'Банковская проверка закрыта до полного комплекта',
  },
  en: {
    unavailableTitle: 'Server document basis is unavailable',
    unavailableDescription: 'The screen is closed because no Deal was specified, no accessible shipment exists, or the canonical Deal workspace returned an incomplete or contradictory package.',
    openDeals: 'Open Deal registry',
    serverBoundary: 'Canonical server projection of the Deal. The interface cannot create, sign, bank-accept documents, or release funds.',
    dealVersion: 'Deal version',
    documentVersion: 'Document version',
    noValue: 'not recorded',
    signedAt: 'Signed at',
    storage: 'Storage',
    hash: 'Hash',
    bank: 'Bank',
    accepted: 'accepted',
    notAccepted: 'not accepted',
    immutable: 'immutable',
    mutable: 'mutable',
    blockers: 'Server blockers',
    allReady: 'Acceptance and all five mandatory documents are confirmed by the server',
    sourceDeal: 'Canonical Deal',
    sourceAcceptance: 'Confirmed acceptance',
    sourceDocuments: 'Server document registry',
    bankLocked: 'Bank review remains locked until the package is complete',
  },
  zh: {
    unavailableTitle: '服务器文件依据不可用',
    unavailableDescription: '页面已关闭：未指定交易、没有可访问的运输任务，或交易工作区返回不完整或矛盾的文件包。',
    openDeals: '打开交易列表',
    serverBoundary: '交易的规范服务器投影。界面不能创建、签署、由银行接收文件，也不能释放资金。',
    dealVersion: '交易版本',
    documentVersion: '文件版本',
    noValue: '未记录',
    signedAt: '签署时间',
    storage: '存储',
    hash: '哈希',
    bank: '银行',
    accepted: '已接收',
    notAccepted: '未接收',
    immutable: '不可变',
    mutable: '可变',
    blockers: '服务器阻塞项',
    allReady: '验收和五份必需文件均已由服务器确认',
    sourceDeal: '规范交易',
    sourceAcceptance: '已确认验收',
    sourceDocuments: '服务器文件登记簿',
    bankLocked: '文件包完整前，银行审核保持锁定',
  },
} as const;

export default async function DealDocumentsBasisPage(
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
  const projection = workspace ? buildDocumentBasisProjection(workspace, shipmentId) : null;
  if (!projection) return renderUnavailable(locale);

  return renderDocumentBasis(projection, locale);
}

function renderDocumentBasis(
  projection: DocumentBasisProjection,
  locale: PhysicalExecutionLocale,
) {
  const copy = PHYSICAL_EXECUTION_COPY[locale];
  const authorityCopy = AUTHORITY_COPY[locale];
  const documentNames = DOCUMENT_TYPE_COPY[locale];
  const context = `dealId=${encodeURIComponent(projection.dealId)}&shipmentId=${encodeURIComponent(projection.shipmentId)}`;
  const dealHref = `/platform-v7/deals/${encodeURIComponent(projection.dealId)}/execution`;
  const acceptanceHref = `/platform-v7/deal-acceptance?${context}`;
  const bankHref = `/platform-v7/bank/release-safety?dealId=${encodeURIComponent(projection.dealId)}`;
  const phases = contextualPhases(buildPhysicalExecutionPhases(locale, 'documents', {
    logistics: 'complete',
    acceptance: projection.acceptance.ready ? 'complete' : 'available',
    documents: 'current',
    bank: projection.ready ? 'available' : 'blocked',
  }), projection);
  const date = (value: string | null | undefined) => value
    ? new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-GB' : 'ru-RU', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(value))
    : authorityCopy.noValue;
  const certificate = projection.acceptance.laboratory?.certificateDocId ?? authorityCopy.noValue;

  return (
    <PhysicalExecutionCockpit
      testId='platform-v7-deal-documents-basis-v8'
      eyebrow={copy.documents.eyebrow}
      title={copy.documents.title}
      description={copy.documents.description}
      statusLabel={projection.ready ? copy.documents.statusReady : copy.documents.statusBlocked}
      statusTone={projection.ready ? 'success' : 'critical'}
      labels={copy.meta}
      priority={{
        state: projection.ready ? 'ready' : 'critical',
        title: projection.ready ? copy.documents.priorityReadyTitle : copy.documents.priorityBlockedTitle,
        description: projection.ready
          ? copy.documents.priorityReadyDescription
          : projection.blockers.join(' · ') || copy.documents.priorityBlockedDescription,
        blocker: projection.ready ? copy.documents.blockerReady : projection.blockers.join(' · '),
        owner: copy.documents.owner,
        impact: projection.ready ? copy.documents.impactReady : copy.documents.impactBlocked,
        result: copy.documents.result,
        primaryAction: projection.ready
          ? <Link className={physicalExecutionClasses.primaryLink} href={bankHref}>{copy.common.bankReadiness}</Link>
          : <Link className={physicalExecutionClasses.primaryLink} href={dealHref}>{copy.common.openDeal}</Link>,
        secondaryAction: <Link className={physicalExecutionClasses.secondaryLink} href='/platform-v7/documents'>{copy.common.openDocuments}</Link>,
      }}
      facts={[
        { label: copy.documents.facts.deal, value: projection.dealId, hint: `${authorityCopy.dealVersion}: ${projection.dealVersion}` },
        { label: copy.documents.facts.route, value: projection.shipmentId, hint: projection.acceptance.shipment.status },
        { label: copy.documents.facts.lot, value: projection.lotId ?? authorityCopy.noValue },
        { label: copy.documents.facts.certificate, value: certificate, hint: authorityCopy.serverBoundary },
        { label: copy.documents.facts.package, value: `${projection.readyCount}/${projection.documents.length}`, hint: projection.ready ? copy.common.complete : copy.common.blocked },
        { label: copy.documents.facts.bank, value: projection.ready ? copy.common.review : copy.common.blocked, hint: projection.ready ? authorityCopy.serverBoundary : authorityCopy.bankLocked },
      ]}
      boundary={authorityCopy.serverBoundary}
      phases={phases}
      phaseNavLabel={copy.phaseNavLabel}
    >
      <PhysicalExecutionSplit>
        <PhysicalExecutionPanel id='package' title={copy.documents.packageTitle} description={copy.documents.packageDescription}>
          <PhysicalExecutionList
            label={copy.documents.packageTitle}
            items={projection.documents.map((item) => ({
              id: item.type,
              title: documentNames[item.type],
              detail: item.document?.name ?? copy.common.required,
              meta: item.document
                ? `${authorityCopy.documentVersion}: ${item.document.version} · ${authorityCopy.signedAt}: ${date(item.document.signedAt)} · ${authorityCopy.bank}: ${item.document.bankRequired ? item.document.bankAcceptance : authorityCopy.accepted}`
                : item.blockers.join(' · '),
              status: <StatusChip tone={tone(item.state)}>{copy.documents.statuses[item.state]}</StatusChip>,
            }))}
          />
        </PhysicalExecutionPanel>

        <PhysicalExecutionPanel title={copy.documents.sourceTitle} description={copy.documents.sourceDescription}>
          <PhysicalExecutionList
            label={copy.documents.sourceTitle}
            items={[
              {
                id: 'deal',
                title: authorityCopy.sourceDeal,
                detail: projection.dealId,
                href: dealHref,
                status: <StatusChip tone='information'>{copy.common.openDeal}</StatusChip>,
              },
              {
                id: 'acceptance',
                title: authorityCopy.sourceAcceptance,
                detail: projection.acceptance.ready ? copy.common.complete : projection.acceptance.blockers.join(' · '),
                href: acceptanceHref,
                status: <StatusChip tone={projection.acceptance.ready ? 'success' : 'critical'}>{projection.acceptance.ready ? copy.common.complete : copy.common.blocked}</StatusChip>,
              },
              {
                id: 'documents',
                title: authorityCopy.sourceDocuments,
                detail: `${projection.readyCount}/${projection.documents.length}`,
                href: '/platform-v7/documents',
                status: <StatusChip tone={projection.ready ? 'success' : 'warning'}>{projection.ready ? copy.common.complete : copy.common.review}</StatusChip>,
              },
              {
                id: 'bank',
                title: copy.common.bankReadiness,
                detail: projection.ready ? authorityCopy.serverBoundary : authorityCopy.bankLocked,
                href: bankHref,
                blocked: !projection.ready,
                status: <StatusChip tone={projection.ready ? 'warning' : 'critical'}>{projection.ready ? copy.common.review : copy.common.blocked}</StatusChip>,
              },
            ]}
          />
        </PhysicalExecutionPanel>
      </PhysicalExecutionSplit>

      <PhysicalExecutionPanel title={authorityCopy.blockers} description={authorityCopy.serverBoundary}>
        <PhysicalExecutionList
          label={authorityCopy.blockers}
          items={projection.ready
            ? [{
                id: 'all-ready',
                title: authorityCopy.allReady,
                status: <StatusChip tone='success'>{copy.common.complete}</StatusChip>,
              }]
            : projection.blockers.map((blocker, index) => ({
                id: `document-blocker-${index}`,
                title: blocker,
                detail: authorityCopy.bankLocked,
                status: <StatusChip tone='critical'>{copy.common.blocked}</StatusChip>,
              }))}
        />
      </PhysicalExecutionPanel>
    </PhysicalExecutionCockpit>
  );
}

function renderUnavailable(locale: PhysicalExecutionLocale) {
  const copy = PHYSICAL_EXECUTION_COPY[locale];
  const authorityCopy = AUTHORITY_COPY[locale];
  const phases = buildPhysicalExecutionPhases(locale, 'documents', {
    logistics: 'blocked',
    acceptance: 'blocked',
    documents: 'current',
    bank: 'blocked',
  });

  return (
    <PhysicalExecutionCockpit
      testId='platform-v7-deal-documents-basis-v8'
      eyebrow={copy.documents.eyebrow}
      title={authorityCopy.unavailableTitle}
      description={authorityCopy.unavailableDescription}
      statusLabel={copy.common.blocked}
      statusTone='critical'
      labels={copy.meta}
      priority={{
        state: 'critical',
        title: authorityCopy.unavailableTitle,
        description: authorityCopy.unavailableDescription,
        blocker: copy.documents.blockerBlocked,
        owner: copy.documents.owner,
        impact: copy.documents.impactBlocked,
        result: copy.documents.result,
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
            id: 'document-authority-unavailable',
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
  projection: DocumentBasisProjection,
): PhysicalExecutionPhase[] {
  const context = `dealId=${encodeURIComponent(projection.dealId)}&shipmentId=${encodeURIComponent(projection.shipmentId)}`;
  return phases.map((phase) => {
    if (phase.state === 'blocked') return phase;
    if (phase.id === 'logistics') return { ...phase, href: `/platform-v7/deal-logistics?${context}` };
    if (phase.id === 'acceptance') return { ...phase, href: `/platform-v7/deal-acceptance?${context}` };
    if (phase.id === 'documents') return { ...phase, href: `/platform-v7/deal-documents-basis?${context}` };
    if (phase.id === 'bank') return { ...phase, href: `/platform-v7/bank/release-safety?dealId=${encodeURIComponent(projection.dealId)}` };
    return phase;
  });
}

function tone(state: DocumentReadinessState) {
  if (state === 'ready') return 'success' as const;
  if (state === 'review') return 'warning' as const;
  return 'critical' as const;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  const normalized = candidate?.trim();
  return normalized || undefined;
}
