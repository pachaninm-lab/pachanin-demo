import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { StatusChip } from '@pc/design-system-v8';
import { DEAL_ACCEPTANCE_STATE } from '@/lib/platform-v7/dealAcceptanceEngine';
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
} from '@/components/transaction-ux/physicalExecutionCopy';

const state = DEAL_ACCEPTANCE_STATE;

function isAcceptanceSigned() {
  return state.stage === 'acceptance_signed' || state.stage === 'documents_basis_ready';
}

export default async function DealAcceptancePage() {
  const locale = normalizePhysicalExecutionLocale(await getLocale());
  const copy = PHYSICAL_EXECUTION_COPY[locale];
  const qualityBlocked = state.quality.some((item) => item.status !== 'ok');
  const evidenceBlocked = state.evidence.some((item) => item.status !== 'ok');
  const acceptanceReady = isAcceptanceSigned() && !qualityBlocked && !evidenceBlocked;
  const phases = buildPhysicalExecutionPhases(locale, 'acceptance', {
    logistics: 'complete',
    acceptance: 'current',
    documents: acceptanceReady ? 'available' : 'blocked',
    bank: 'blocked',
  });
  const statusTone = (status: 'ok' | 'review' | 'dispute') => status === 'ok'
    ? 'success' as const
    : status === 'review'
      ? 'warning' as const
      : 'critical' as const;
  const weight = (value: number) => `${formatPhysicalNumber(value / 1000, locale)} t`;

  return (
    <PhysicalExecutionCockpit
      testId='platform-v7-deal-acceptance-v8'
      eyebrow={copy.acceptance.eyebrow}
      title={copy.acceptance.title}
      description={copy.acceptance.description}
      statusLabel={acceptanceReady ? copy.acceptance.statusReady : copy.acceptance.statusBlocked}
      statusTone={acceptanceReady ? 'success' : 'critical'}
      labels={copy.meta}
      priority={{
        state: acceptanceReady ? 'ready' : 'critical',
        title: acceptanceReady ? copy.acceptance.priorityReadyTitle : copy.acceptance.priorityBlockedTitle,
        description: acceptanceReady ? copy.acceptance.priorityReadyDescription : copy.acceptance.priorityBlockedDescription,
        blocker: acceptanceReady ? copy.acceptance.blockerReady : copy.acceptance.blockerBlocked,
        owner: copy.acceptance.owner,
        impact: acceptanceReady ? copy.acceptance.impactReady : copy.acceptance.impactBlocked,
        result: copy.acceptance.result,
        primaryAction: acceptanceReady
          ? <Link className={physicalExecutionClasses.primaryLink} href='/platform-v7/deal-documents-basis'>{copy.common.openDocuments}</Link>
          : <Link className={physicalExecutionClasses.primaryLink} href='#quality'>{copy.common.openLab}</Link>,
        secondaryAction: <Link className={physicalExecutionClasses.secondaryLink} href={`/platform-v7/deals/${encodeURIComponent(state.dealId)}/clean`}>{copy.common.openDeal}</Link>,
      }}
      facts={[
        { label: copy.acceptance.facts.deal, value: state.dealId, hint: copy.common.sourceSnapshot },
        { label: copy.acceptance.facts.route, value: state.routeId, hint: copy.acceptanceStages[state.stage] },
        { label: copy.acceptance.facts.lot, value: state.lotNumber, hint: copy.common.sourceSnapshot },
        { label: copy.acceptance.facts.certificate, value: state.sdizNumber, hint: copy.common.externalBoundary },
        { label: copy.acceptance.facts.vehicle, value: state.vehiclePlate, hint: state.driverName },
        { label: copy.acceptance.facts.elevator, value: state.elevatorName },
      ]}
      boundary={`${copy.common.projectionBoundary} ${copy.common.externalBoundary}`}
      phases={phases}
      phaseNavLabel={copy.phaseNavLabel}
    >
      <PhysicalExecutionSplit>
        <PhysicalExecutionPanel title={copy.acceptance.weightTitle} description={copy.acceptance.weightDescription}>
          <PhysicalExecutionList
            label={copy.acceptance.weightTitle}
            items={[
              { id: 'arrival-window', title: copy.acceptance.arrivalWindow, detail: state.arrival.expectedWindow },
              { id: 'arrival-fact', title: copy.acceptance.arrivalFact, detail: state.arrival.fixedAt },
              { id: 'geo', title: copy.acceptance.geo, detail: state.arrival.geoPoint },
              { id: 'gross', title: copy.acceptance.gross, detail: weight(state.weight.grossKg) },
              { id: 'tare', title: copy.acceptance.tare, detail: weight(state.weight.tareKg) },
              { id: 'net', title: copy.acceptance.net, detail: weight(state.weight.netKg) },
              { id: 'delta', title: copy.acceptance.delta, detail: weight(state.weight.deltaKg), status: <StatusChip tone={state.weight.deltaKg === 0 ? 'success' : 'warning'}>{state.weight.deltaKg === 0 ? copy.common.complete : copy.common.review}</StatusChip> },
            ]}
          />
        </PhysicalExecutionPanel>

        <PhysicalExecutionPanel id='quality' title={copy.acceptance.qualityTitle} description={copy.acceptance.qualityDescription}>
          <PhysicalExecutionList
            label={copy.acceptance.qualityTitle}
            items={state.quality.map((item, index) => ({
              id: `quality-${index}`,
              title: item.label,
              detail: `${copy.acceptance.contract}: ${item.contractValue} · ${copy.acceptance.actual}: ${item.actualValue}`,
              status: <StatusChip tone={statusTone(item.status)}>{copy.factStatuses[item.status]}</StatusChip>,
            }))}
          />
        </PhysicalExecutionPanel>
      </PhysicalExecutionSplit>

      <PhysicalExecutionPanel title={copy.acceptance.evidenceTitle} description={copy.acceptance.evidenceDescription}>
        <PhysicalExecutionList
          label={copy.acceptance.evidenceTitle}
          items={state.evidence.map((item) => ({
            id: item.id,
            title: item.label,
            detail: item.source,
            meta: item.fixedAt,
            status: <StatusChip tone={statusTone(item.status)}>{copy.factStatuses[item.status]}</StatusChip>,
          }))}
        />
      </PhysicalExecutionPanel>

      <PhysicalExecutionDetailGrid
        label={copy.phaseNavLabel}
        items={state.nextRoutes.map((route) => {
          const documentsRoute = route.href === '/platform-v7/deal-documents-basis';
          const bankRoute = route.href === '/platform-v7/bank/payment-basis';
          const blocked = (documentsRoute && !acceptanceReady) || bankRoute;
          const href = bankRoute ? '/platform-v7/bank/release-safety' : route.href;
          return {
            label: route.label,
            value: blocked ? copy.common.blocked : copy.common.review,
            hint: `${copy.common.owner}: ${route.owner} · ${blocked ? copy.common.required : href}`,
          };
        })}
      />

      {!acceptanceReady ? (
        <PhysicalExecutionPanel title={copy.common.blocked} description={copy.acceptance.priorityBlockedDescription}>
          <p className={physicalExecutionClasses.warningText}>{copy.acceptance.impactBlocked}</p>
          <Link className={physicalExecutionClasses.secondaryLink} href='/platform-v7/disputes'>{copy.common.openDisputes}</Link>
        </PhysicalExecutionPanel>
      ) : null}
    </PhysicalExecutionCockpit>
  );
}
