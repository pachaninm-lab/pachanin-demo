import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { StatusChip } from '@pc/design-system-v8';
import { DEAL_ACCEPTANCE_STATE } from '@/lib/platform-v7/dealAcceptanceEngine';
import {
  PhysicalExecutionCockpit,
  PhysicalExecutionList,
  PhysicalExecutionPanel,
  PhysicalExecutionSplit,
  physicalExecutionClasses,
} from '@/components/transaction-ux/PhysicalExecutionCockpit';
import {
  PHYSICAL_EXECUTION_COPY,
  buildPhysicalExecutionPhases,
  normalizePhysicalExecutionLocale,
} from '@/components/transaction-ux/physicalExecutionCopy';

const state = DEAL_ACCEPTANCE_STATE;

type PackageStatus = 'ready' | 'review' | 'required';

export default async function DealDocumentsBasisPage() {
  const locale = normalizePhysicalExecutionLocale(await getLocale());
  const copy = PHYSICAL_EXECUTION_COPY[locale];
  const acceptanceSigned = state.stage === 'acceptance_signed' || state.stage === 'documents_basis_ready';
  const weightReady = ['EV-GROSS', 'EV-NET'].every((id) => state.evidence.some((item) => item.id === id && item.status === 'ok'));
  const qualityReady = state.quality.every((item) => item.status === 'ok')
    && state.evidence.some((item) => item.id === 'EV-QUALITY' && item.status === 'ok');

  const packageItems: Array<{ id: string; title: string; status: PackageStatus; detail: string }> = [
    { id: 'contract', title: copy.documents.items.contract, status: 'required', detail: copy.common.externalBoundary },
    { id: 'certificate', title: copy.documents.items.certificate, status: state.sdizNumber ? 'ready' : 'required', detail: state.sdizNumber || copy.common.required },
    { id: 'weight', title: copy.documents.items.weight, status: weightReady ? 'ready' : 'review', detail: `${state.routeId} · ${copy.common.sourceSnapshot}` },
    { id: 'quality', title: copy.documents.items.quality, status: qualityReady ? 'ready' : 'review', detail: copy.acceptanceStages[state.stage] },
    { id: 'acceptance', title: copy.documents.items.acceptance, status: acceptanceSigned ? 'ready' : 'required', detail: copy.acceptanceStages[state.stage] },
    { id: 'invoice', title: copy.documents.items.invoice, status: 'required', detail: copy.common.externalBoundary },
  ];
  const readyCount = packageItems.filter((item) => item.status === 'ready').length;
  const documentsReady = packageItems.every((item) => item.status === 'ready');
  const phases = buildPhysicalExecutionPhases(locale, 'documents', {
    logistics: 'complete',
    acceptance: acceptanceSigned && qualityReady ? 'complete' : 'available',
    documents: 'current',
    bank: documentsReady ? 'available' : 'blocked',
  });
  const tone = (status: PackageStatus) => status === 'ready'
    ? 'success' as const
    : status === 'review'
      ? 'warning' as const
      : 'critical' as const;

  return (
    <PhysicalExecutionCockpit
      testId='platform-v7-deal-documents-basis-v8'
      eyebrow={copy.documents.eyebrow}
      title={copy.documents.title}
      description={copy.documents.description}
      statusLabel={documentsReady ? copy.documents.statusReady : copy.documents.statusBlocked}
      statusTone={documentsReady ? 'success' : 'critical'}
      labels={copy.meta}
      priority={{
        state: documentsReady ? 'ready' : 'critical',
        title: documentsReady ? copy.documents.priorityReadyTitle : copy.documents.priorityBlockedTitle,
        description: documentsReady ? copy.documents.priorityReadyDescription : copy.documents.priorityBlockedDescription,
        blocker: documentsReady ? copy.documents.blockerReady : copy.documents.blockerBlocked,
        owner: copy.documents.owner,
        impact: documentsReady ? copy.documents.impactReady : copy.documents.impactBlocked,
        result: copy.documents.result,
        primaryAction: documentsReady
          ? <Link className={physicalExecutionClasses.primaryLink} href='/platform-v7/bank/release-safety'>{copy.common.bankReadiness}</Link>
          : <Link className={physicalExecutionClasses.primaryLink} href={`/platform-v7/deals/${encodeURIComponent(state.dealId)}/clean`}>{copy.common.openDeal}</Link>,
        secondaryAction: <Link className={physicalExecutionClasses.secondaryLink} href='/platform-v7/documents'>{copy.common.openDocuments}</Link>,
      }}
      facts={[
        { label: copy.documents.facts.deal, value: state.dealId, hint: copy.common.sourceSnapshot },
        { label: copy.documents.facts.route, value: state.routeId, hint: copy.acceptanceStages[state.stage] },
        { label: copy.documents.facts.lot, value: state.lotNumber, hint: copy.common.sourceSnapshot },
        { label: copy.documents.facts.certificate, value: state.sdizNumber, hint: copy.common.externalBoundary },
        { label: copy.documents.facts.package, value: `${readyCount}/${packageItems.length}`, hint: documentsReady ? copy.common.complete : copy.common.blocked },
        { label: copy.documents.facts.bank, value: documentsReady ? copy.common.review : copy.common.blocked, hint: copy.common.externalBoundary },
      ]}
      boundary={`${copy.common.projectionBoundary} ${copy.common.externalBoundary}`}
      phases={phases}
      phaseNavLabel={copy.phaseNavLabel}
    >
      <PhysicalExecutionSplit>
        <PhysicalExecutionPanel id='package' title={copy.documents.packageTitle} description={copy.documents.packageDescription}>
          <PhysicalExecutionList
            label={copy.documents.packageTitle}
            items={packageItems.map((item) => ({
              id: item.id,
              title: item.title,
              detail: item.detail,
              status: <StatusChip tone={tone(item.status)}>{copy.documents.statuses[item.status]}</StatusChip>,
            }))}
          />
        </PhysicalExecutionPanel>

        <PhysicalExecutionPanel title={copy.documents.sourceTitle} description={copy.documents.sourceDescription}>
          <PhysicalExecutionList
            label={copy.documents.sourceTitle}
            items={[
              { id: 'deal', title: copy.documents.facts.deal, detail: state.dealId, href: `/platform-v7/deals/${encodeURIComponent(state.dealId)}/clean`, status: <StatusChip tone='information'>{copy.common.openDeal}</StatusChip> },
              { id: 'acceptance', title: copy.documents.items.acceptance, detail: copy.acceptanceStages[state.stage], href: '/platform-v7/deal-acceptance', status: <StatusChip tone={acceptanceSigned ? 'success' : 'critical'}>{acceptanceSigned ? copy.common.complete : copy.common.blocked}</StatusChip> },
              { id: 'documents', title: copy.common.openDocuments, detail: copy.documents.sourceDescription, href: '/platform-v7/documents', status: <StatusChip tone='information'>{copy.common.review}</StatusChip> },
              { id: 'bank', title: copy.common.bankReadiness, detail: copy.common.externalBoundary, href: '/platform-v7/bank/release-safety', blocked: !documentsReady, status: <StatusChip tone={documentsReady ? 'warning' : 'critical'}>{documentsReady ? copy.common.review : copy.common.blocked}</StatusChip> },
            ]}
          />
        </PhysicalExecutionPanel>
      </PhysicalExecutionSplit>

      {!documentsReady ? <p className={physicalExecutionClasses.warningText}>{copy.documents.impactBlocked}</p> : null}
    </PhysicalExecutionCockpit>
  );
}
