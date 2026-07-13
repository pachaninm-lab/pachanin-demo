import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { StatusChip } from '@pc/design-system-v8';
import {
  buildDocumentBasisProjection,
  getCanonicalDealDocumentWorkspace,
  type DocumentBasisItem,
  type DocumentBasisKind,
  type DocumentBasisProjection,
} from '@/lib/deal-document-basis-server';
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
  normalizePhysicalExecutionLocale,
  type PhysicalExecutionLocale,
} from '@/components/transaction-ux/physicalExecutionCopy';

type PageSearchParams = {
  dealId?: string | string[];
  shipmentId?: string | string[];
};

const AUTHORITY_COPY = {
  ru: {
    unavailableTitle: 'Серверное документное основание недоступно',
    unavailableDescription: 'Экран закрыт: не указана Сделка, нет доступного рейса или канонический Deal workspace вернул неполный либо противоречивый пакет.',
    openDeals: 'Открыть реестр Сделок',
    serverBoundary: 'Каноническая серверная проекция документов Сделки. Интерфейс не создаёт версии, не проверяет КЭП, не подтверждает ЭДО и не формирует банковское решение.',
    version: 'Версия Сделки',
    noValue: 'не зафиксировано',
    blockers: 'Серверные блокеры',
    allReady: 'Обязательный пакет подтверждён сервером',
    readyForBank: 'готов к банковской проверке',
    bankBasisConfirmed: 'банковское основание подтверждено',
    bankBasisPending: 'банковское основание ещё не подтверждено',
    source: 'Источник authority',
    immutable: 'неизменяемая версия',
    missing: 'документ отсутствует',
    review: 'требуется серверная проверка',
    documents: {
      contract: 'Договор купли-продажи',
      sdiz: 'СДИЗ',
      transport_waybill: 'ТТН / ЭТрН',
      lab_protocol: 'Лабораторный протокол',
      quality_certificate: 'Сертификат качества',
      acceptance_act: 'Акт приёмки',
      bank_basis: 'Банковское основание',
    },
  },
  en: {
    unavailableTitle: 'Server document basis is unavailable',
    unavailableDescription: 'The screen is closed because no Deal was specified, no accessible shipment exists, or the canonical Deal workspace returned an incomplete or contradictory package.',
    openDeals: 'Open Deal registry',
    serverBoundary: 'Canonical server projection of Deal documents. The interface cannot create versions, verify signatures, confirm EDI, or issue a bank decision.',
    version: 'Deal version',
    noValue: 'not recorded',
    blockers: 'Server blockers',
    allReady: 'The mandatory package is confirmed by the server',
    readyForBank: 'ready for bank review',
    bankBasisConfirmed: 'bank basis confirmed',
    bankBasisPending: 'bank basis is not confirmed yet',
    source: 'Authority source',
    immutable: 'immutable version',
    missing: 'document is missing',
    review: 'server verification required',
    documents: {
      contract: 'Sale contract',
      sdiz: 'SDIZ',
      transport_waybill: 'Transport waybill / e-waybill',
      lab_protocol: 'Laboratory protocol',
      quality_certificate: 'Quality certificate',
      acceptance_act: 'Acceptance act',
      bank_basis: 'Bank basis',
    },
  },
  zh: {
    unavailableTitle: '服务器文件依据不可用',
    unavailableDescription: '页面已关闭：未指定交易、没有可访问的运输任务，或交易工作区返回不完整或矛盾的文件包。',
    openDeals: '打开交易列表',
    serverBoundary: '交易文件的规范服务器投影。界面不能创建版本、验证签名、确认电子文件交换，也不能作出银行决定。',
    version: '交易版本',
    noValue: '未记录',
    blockers: '服务器阻塞项',
    allReady: '必需文件包已由服务器确认',
    readyForBank: '可提交银行审核',
    bankBasisConfirmed: '银行依据已确认',
    bankBasisPending: '银行依据尚未确认',
    source: '权威来源',
    immutable: '不可变版本',
    missing: '文件缺失',
    review: '需要服务器验证',
    documents: {
      contract: '买卖合同',
      sdiz: 'SDIZ',
      transport_waybill: '运输单 / 电子运输单',
      lab_protocol: '实验室协议',
      quality_certificate: '质量证书',
      acceptance_act: '验收文件',
      bank_basis: '银行依据',
    },
  },
} as const;

export default async function DealDocumentsBasisPage({
  searchParams,
}: {
  searchParams?: PageSearchParams;
}) {
  const locale = normalizePhysicalExecutionLocale(await getLocale());
  const dealId = firstParam(searchParams?.dealId);
  const shipmentId = firstParam(searchParams?.shipmentId);
  if (!dealId) return renderUnavailable(locale);

  const workspace = await getCanonicalDealDocumentWorkspace(dealId);
  const projection = workspace ? buildDocumentBasisProjection(workspace, shipmentId) : null;
  if (!projection) return renderUnavailable(locale);

  return renderDocuments(projection, locale);
}

function renderDocuments(
  projection: DocumentBasisProjection,
  locale: PhysicalExecutionLocale,
) {
  const copy = PHYSICAL_EXECUTION_COPY[locale];
  const authorityCopy = AUTHORITY_COPY[locale];
  const context = `dealId=${encodeURIComponent(projection.dealId)}&shipmentId=${encodeURIComponent(projection.shipmentId)}`;
  const dealHref = `/platform-v7/deals/${encodeURIComponent(projection.dealId)}/clean`;
  const documentsHref = `/platform-v7/documents?dealId=${encodeURIComponent(projection.dealId)}`;
  const bankHref = `/platform-v7/bank/release-safety?${context}`;
  const acceptanceHref = `/platform-v7/deal-acceptance?${context}`;
  const readyCount = projection.items
    .filter((item) => item.kind !== 'bank_basis' && item.status === 'ready').length;
  const requiredCount = projection.items.filter((item) => item.kind !== 'bank_basis').length;
  const phases = contextualPhases(buildPhysicalExecutionPhases(locale, 'documents', {
    logistics: 'complete',
    acceptance: 'complete',
    documents: 'current',
    bank: projection.documentsReady ? 'available' : 'blocked',
  }), projection);

  return (
    <PhysicalExecutionCockpit
      testId='platform-v7-deal-documents-basis-v8'
      eyebrow={copy.documents.eyebrow}
      title={copy.documents.title}
      description={copy.documents.description}
      statusLabel={projection.documentsReady ? copy.documents.statusReady : copy.documents.statusBlocked}
      statusTone={projection.documentsReady ? 'success' : 'critical'}
      labels={copy.meta}
      priority={{
        state: projection.documentsReady ? 'ready' : 'critical',
        title: projection.documentsReady
          ? copy.documents.priorityReadyTitle
          : copy.documents.priorityBlockedTitle,
        description: projection.documentsReady
          ? copy.documents.priorityReadyDescription
          : projection.blockers.join(' · ') || copy.documents.priorityBlockedDescription,
        blocker: projection.documentsReady
          ? copy.documents.blockerReady
          : projection.blockers.join(' · '),
        owner: copy.documents.owner,
        impact: projection.documentsReady
          ? copy.documents.impactReady
          : copy.documents.impactBlocked,
        result: copy.documents.result,
        primaryAction: projection.documentsReady
          ? <Link className={physicalExecutionClasses.primaryLink} href={bankHref}>{copy.common.bankReadiness}</Link>
          : <Link className={physicalExecutionClasses.primaryLink} href={documentsHref}>{copy.common.openDocuments}</Link>,
        secondaryAction: <Link className={physicalExecutionClasses.secondaryLink} href={dealHref}>{copy.common.openDeal}</Link>,
      }}
      facts={[
        { label: copy.documents.facts.deal, value: projection.dealId, hint: `${authorityCopy.version}: ${projection.dealVersion}` },
        { label: copy.documents.facts.route, value: projection.shipmentId, hint: projection.acceptanceId ?? authorityCopy.noValue },
        { label: copy.documents.facts.lot, value: projection.lotId ?? authorityCopy.noValue },
        { label: copy.documents.facts.certificate, value: documentId(projection, 'quality_certificate') ?? authorityCopy.noValue },
        { label: copy.documents.facts.package, value: `${readyCount}/${requiredCount}`, hint: projection.documentsReady ? authorityCopy.readyForBank : copy.common.blocked },
        { label: copy.documents.facts.bank, value: projection.bankBasisReady ? authorityCopy.bankBasisConfirmed : authorityCopy.bankBasisPending, hint: copy.common.externalBoundary },
      ]}
      boundary={authorityCopy.serverBoundary}
      phases={phases}
      phaseNavLabel={copy.phaseNavLabel}
    >
      <PhysicalExecutionSplit>
        <PhysicalExecutionPanel id='package' title={copy.documents.packageTitle} description={copy.documents.packageDescription}>
          <PhysicalExecutionList
            label={copy.documents.packageTitle}
            items={projection.items.map((item) => packageItem(item, locale))}
          />
        </PhysicalExecutionPanel>

        <PhysicalExecutionPanel title={copy.documents.sourceTitle} description={copy.documents.sourceDescription}>
          <PhysicalExecutionList
            label={copy.documents.sourceTitle}
            items={[
              {
                id: 'deal',
                title: copy.documents.facts.deal,
                detail: projection.dealId,
                meta: `${authorityCopy.version}: ${projection.dealVersion}`,
                href: dealHref,
                status: <StatusChip tone='information'>{copy.common.openDeal}</StatusChip>,
              },
              {
                id: 'acceptance',
                title: authorityCopy.documents.acceptance_act,
                detail: projection.acceptanceId ?? authorityCopy.noValue,
                href: acceptanceHref,
                status: <StatusChip tone={projection.acceptanceId ? 'success' : 'critical'}>{projection.acceptanceId ? copy.common.complete : copy.common.blocked}</StatusChip>,
              },
              {
                id: 'laboratory',
                title: authorityCopy.documents.lab_protocol,
                detail: projection.laboratoryId ?? authorityCopy.noValue,
                href: `/platform-v7/lab?${context}`,
                status: <StatusChip tone={projection.laboratoryId ? 'success' : 'critical'}>{projection.laboratoryId ? copy.common.complete : copy.common.blocked}</StatusChip>,
              },
              {
                id: 'documents',
                title: copy.common.openDocuments,
                detail: authorityCopy.source,
                href: documentsHref,
                status: <StatusChip tone='information'>{copy.common.review}</StatusChip>,
              },
              {
                id: 'bank',
                title: copy.common.bankReadiness,
                detail: projection.bankBasisReady
                  ? authorityCopy.bankBasisConfirmed
                  : authorityCopy.bankBasisPending,
                href: bankHref,
                blocked: !projection.documentsReady,
                status: <StatusChip tone={projection.bankBasisReady ? 'success' : projection.documentsReady ? 'warning' : 'critical'}>{projection.bankBasisReady ? copy.common.complete : projection.documentsReady ? copy.common.review : copy.common.blocked}</StatusChip>,
              },
            ]}
          />
        </PhysicalExecutionPanel>
      </PhysicalExecutionSplit>

      <PhysicalExecutionDetailGrid
        label={copy.phaseNavLabel}
        items={[
          {
            label: authorityCopy.blockers,
            value: projection.documentsReady
              ? authorityCopy.allReady
              : projection.blockers.join(' · '),
            hint: authorityCopy.serverBoundary,
          },
          {
            label: copy.common.bankReadiness,
            value: projection.documentsReady
              ? authorityCopy.readyForBank
              : copy.common.blocked,
            hint: projection.bankBasisReady
              ? authorityCopy.bankBasisConfirmed
              : authorityCopy.bankBasisPending,
          },
        ]}
      />

      {!projection.documentsReady ? (
        <PhysicalExecutionPanel title={copy.common.blocked} description={copy.documents.priorityBlockedDescription}>
          <p className={physicalExecutionClasses.warningText}>{projection.blockers.join(' · ')}</p>
          <Link className={physicalExecutionClasses.secondaryLink} href={acceptanceHref}>{copy.common.openAcceptance}</Link>
        </PhysicalExecutionPanel>
      ) : null}
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

function packageItem(item: DocumentBasisItem, locale: PhysicalExecutionLocale) {
  const copy = PHYSICAL_EXECUTION_COPY[locale];
  const authorityCopy = AUTHORITY_COPY[locale];
  const detail = item.document
    ? `${item.document.id} · v${item.document.version} · ${item.document.status}`
    : authorityCopy.missing;
  const meta = item.document
    ? `${authorityCopy.immutable}: ${item.document.isImmutable ? copy.common.complete : copy.common.blocked}${item.document.edoStatus ? ` · EDO: ${item.document.edoStatus}` : ''}`
    : item.blocker ?? authorityCopy.missing;
  return {
    id: item.kind,
    title: authorityCopy.documents[item.kind],
    detail,
    meta,
    status: <StatusChip tone={item.status === 'ready' ? 'success' : item.status === 'review' ? 'warning' : 'critical'}>{item.status === 'ready' ? copy.common.complete : item.status === 'review' ? authorityCopy.review : copy.common.required}</StatusChip>,
  };
}

function documentId(
  projection: DocumentBasisProjection,
  kind: DocumentBasisKind,
): string | null {
  return projection.items.find((item) => item.kind === kind)?.document?.id ?? null;
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
    if (phase.id === 'bank') return { ...phase, href: `/platform-v7/bank/release-safety?${context}` };
    return phase;
  });
}

function firstParam(value: string | string[] | undefined): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  const normalized = candidate?.trim();
  return normalized || undefined;
}
