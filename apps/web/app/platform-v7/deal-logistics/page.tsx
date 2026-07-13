import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { StatusChip } from '@pc/design-system-v8';
import { DEAL_LOGISTICS_STATE } from '@/lib/platform-v7/dealLogisticsEngine';
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

const state = DEAL_LOGISTICS_STATE;

export default async function DealLogisticsPage() {
  const locale = normalizePhysicalExecutionLocale(await getLocale());
  const copy = PHYSICAL_EXECUTION_COPY[locale];
  const carrierReady = state.vehicle.admission === 'ok';
  const phases = buildPhysicalExecutionPhases(locale, 'logistics', {
    logistics: 'current',
    acceptance: carrierReady ? 'available' : 'blocked',
    documents: 'blocked',
    bank: 'blocked',
  });

  const controlStatus = (status: 'ok' | 'review' | 'block') => status === 'ok'
    ? { label: copy.common.complete, tone: 'success' as const }
    : status === 'review'
      ? { label: copy.common.review, tone: 'warning' as const }
      : { label: copy.common.blocked, tone: 'critical' as const };

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
        description: carrierReady ? copy.logistics.priorityReadyDescription : copy.logistics.priorityBlockedDescription,
        blocker: carrierReady ? copy.logistics.blockerReady : copy.logistics.blockerBlocked,
        owner: copy.logistics.owner,
        impact: carrierReady ? copy.logistics.impactReady : copy.logistics.impactBlocked,
        result: copy.logistics.result,
        primaryAction: carrierReady
          ? <Link className={physicalExecutionClasses.primaryLink} href='/platform-v7/deal-acceptance'>{copy.common.openAcceptance}</Link>
          : <Link className={physicalExecutionClasses.primaryLink} href='/platform-v7/logistics'>{copy.common.openLogistics}</Link>,
        secondaryAction: <Link className={physicalExecutionClasses.secondaryLink} href={`/platform-v7/deals/${encodeURIComponent(state.dealId)}/clean`}>{copy.common.openDeal}</Link>,
      }}
      facts={[
        { label: copy.logistics.facts.deal, value: state.dealId, hint: copy.common.sourceSnapshot },
        { label: copy.logistics.facts.lot, value: state.lotNumber, hint: copy.common.sourceSnapshot },
        { label: copy.logistics.facts.certificate, value: state.sdizNumber, hint: copy.common.externalBoundary },
        { label: copy.logistics.facts.seller, value: state.sellerName },
        { label: copy.logistics.facts.buyer, value: state.buyerName },
        { label: copy.logistics.facts.volume, value: `${formatPhysicalNumber(state.volumeTons, locale)} t`, hint: state.basis },
      ]}
      boundary={`${copy.common.projectionBoundary} ${copy.common.externalBoundary}`}
      phases={phases}
      phaseNavLabel={copy.phaseNavLabel}
    >
      <PhysicalExecutionDetailGrid
        label={copy.logistics.routeTitle}
        items={state.route.map((point, index) => ({
          label: `${index + 1}. ${point.label}`,
          value: point.address,
          hint: `${point.window} · ${point.owner}`,
        }))}
      />

      <PhysicalExecutionSplit>
        <PhysicalExecutionPanel title={copy.logistics.vehicleTitle} description={copy.logistics.vehicleDescription}>
          <PhysicalExecutionList
            label={copy.logistics.vehicleTitle}
            items={[
              { id: 'carrier', title: copy.logistics.carrier, detail: state.vehicle.carrierName },
              { id: 'vehicle', title: copy.logistics.vehicle, detail: state.vehicle.plate },
              { id: 'driver', title: copy.logistics.driver, detail: state.vehicle.driverName },
              { id: 'contact', title: copy.logistics.contact, detail: state.vehicle.driverPhoneMasked },
              { id: 'capacity', title: copy.logistics.capacity, detail: `${formatPhysicalNumber(state.vehicle.capacityTons, locale)} t` },
              {
                id: 'admission',
                title: copy.logistics.admission,
                detail: copy.admissions[state.vehicle.admission],
                status: <StatusChip tone={carrierReady ? 'success' : state.vehicle.admission === 'review' ? 'warning' : 'critical'}>{copy.admissions[state.vehicle.admission]}</StatusChip>,
              },
            ]}
          />
        </PhysicalExecutionPanel>

        <PhysicalExecutionPanel title={copy.logistics.controlsTitle} description={copy.logistics.controlsDescription}>
          <PhysicalExecutionList
            label={copy.logistics.controlsTitle}
            items={state.controls.map((item, index) => {
              const status = controlStatus(item.status);
              return {
                id: `control-${index}`,
                title: item.label,
                detail: `${copy.common.owner}: ${item.owner}`,
                status: <StatusChip tone={status.tone}>{status.label}</StatusChip>,
              };
            })}
          />
        </PhysicalExecutionPanel>
      </PhysicalExecutionSplit>

      <PhysicalExecutionPanel title={copy.logistics.nextTitle} description={copy.logistics.nextDescription}>
        <PhysicalExecutionList
          label={copy.logistics.nextTitle}
          items={state.nextRoutes.map((route) => {
            const isDriver = route.href === '/platform-v7/driver-field';
            const isAcceptance = route.href === '/platform-v7/deal-acceptance';
            const isDocuments = route.href === '/platform-v7/documents';
            const blocked = (isDriver || isAcceptance) ? !carrierReady : isDocuments;
            const href = isDriver ? '/platform-v7/driver/field' : route.href;
            return {
              id: route.href,
              title: route.label,
              detail: `${copy.common.owner}: ${route.owner}`,
              href,
              blocked,
              status: <StatusChip tone={blocked ? 'critical' : 'information'}>{blocked ? copy.common.blocked : copy.common.review}</StatusChip>,
            };
          })}
        />
      </PhysicalExecutionPanel>
    </PhysicalExecutionCockpit>
  );
}
