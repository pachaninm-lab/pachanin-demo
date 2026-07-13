import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { StatusChip } from '@pc/design-system-v8';
import { AUCTION_DEAL_BRIDGE, auctionDealAmountRub, isAuctionDealBasisReady } from '@/lib/platform-v7/auctionDealBridge';
import { FGIS_AUCTION_STATE, canOpenAuction, kgToTons } from '@/lib/platform-v7/fgisAuctionEngine';
import {
  AuctionExecutionCockpit,
  AuctionList,
  AuctionPanel,
  AuctionSplit,
  auctionCockpitClasses,
} from '@/components/transaction-ux/AuctionExecutionCockpit';
import {
  AUCTION_COPY,
  buildAuctionPhases,
  formatAuctionMoney,
  normalizeAuctionLocale,
  translateRule,
} from '@/components/transaction-ux/auctionExecutionCopy';

export default async function PlatformV7AuctionPage() {
  const locale = normalizeAuctionLocale(await getLocale());
  const copy = AUCTION_COPY[locale];
  const lot = FGIS_AUCTION_STATE.lot;
  const admissionReady = canOpenAuction(FGIS_AUCTION_STATE) && FGIS_AUCTION_STATE.admission === 'admitted';
  const winner = AUCTION_DEAL_BRIDGE.winnerBid;
  const basisReady = admissionReady && isAuctionDealBasisReady(AUCTION_DEAL_BRIDGE.dealBasis);
  const phases = buildAuctionPhases(locale, admissionReady ? (basisReady ? 'deal-basis' : 'bids') : 'admission', {
    import: lot.importStatus === 'matched' ? 'complete' : 'current',
    admission: admissionReady ? 'complete' : lot.importStatus === 'matched' ? 'available' : 'blocked',
    bids: admissionReady ? (winner ? 'complete' : 'available') : 'blocked',
    'deal-basis': basisReady ? 'complete' : admissionReady && winner ? 'available' : 'blocked',
  });

  return (
    <AuctionExecutionCockpit
      testId='platform-v7-auction-overview-v8'
      eyebrow={copy.root.eyebrow}
      title={copy.root.title}
      description={copy.root.description}
      statusLabel={admissionReady ? copy.root.statusReady : copy.root.statusBlocked}
      statusTone={admissionReady ? 'success' : 'warning'}
      labels={copy.meta}
      priority={{
        state: admissionReady ? 'ready' : 'critical',
        title: admissionReady ? copy.root.priorityReadyTitle : copy.root.priorityBlockedTitle,
        description: admissionReady ? copy.root.priorityReadyDescription : copy.root.priorityBlockedDescription,
        blocker: admissionReady ? copy.root.blockerReady : copy.root.blockerBlocked,
        owner: copy.root.owner,
        impact: admissionReady ? copy.root.impactReady : copy.root.impactBlocked,
        result: copy.root.result,
        primaryAction: (
          <Link
            className={auctionCockpitClasses.primaryLink}
            href={admissionReady ? '/platform-v7/auction/deal-basis' : '/platform-v7/auction/admission'}
          >
            {admissionReady ? copy.common.openBasis : copy.common.openAdmission}
          </Link>
        ),
        secondaryAction: <Link className={auctionCockpitClasses.secondaryLink} href='/platform-v7/auction/import'>{copy.common.openImport}</Link>,
      }}
      facts={[
        { label: copy.root.facts.lot, value: lot.lotNumber, hint: copy.common.sourceSnapshot },
        { label: copy.root.facts.certificate, value: lot.sdizNumber ?? copy.common.required, hint: copy.common.notConfirmed },
        { label: copy.root.facts.import, value: copy.importStatuses[lot.importStatus], hint: copy.common.externalBoundary },
        { label: copy.root.facts.admission, value: copy.admissionStatuses[FGIS_AUCTION_STATE.admission], hint: admissionReady ? copy.common.complete : copy.common.review },
        { label: copy.root.facts.volume, value: `${kgToTons(lot.availableWeightKg)} t`, hint: copy.common.available },
        { label: copy.root.facts.basis, value: winner ? formatAuctionMoney(auctionDealAmountRub(), locale) : copy.common.blocked, hint: winner ? copy.stageStatuses[AUCTION_DEAL_BRIDGE.lot.stage] : copy.common.notConfirmed },
      ]}
      boundary={`${copy.common.boundary} ${copy.common.externalBoundary}`}
      phases={phases}
      phaseNavLabel={copy.phaseNavLabel}
    >
      <AuctionSplit>
        <AuctionPanel title={copy.root.rulesTitle} description={copy.root.rulesDescription}>
          <AuctionList
            label={copy.root.rulesTitle}
            items={FGIS_AUCTION_STATE.bidRules.map((rule) => ({
              id: rule.key,
              title: translateRule(rule.key, rule.label, locale),
              status: <StatusChip tone='information'>{copy.common.complete}</StatusChip>,
            }))}
          />
        </AuctionPanel>
        <AuctionPanel title={copy.root.controlsTitle} description={copy.root.controlsDescription}>
          <AuctionList
            label={copy.root.controlsTitle}
            items={[
              ...copy.controls.map((title, index) => ({ id: `control-${index}`, title, status: <StatusChip tone='success'>{copy.common.complete}</StatusChip> })),
              ...copy.risks.map((title, index) => ({ id: `risk-${index}`, title, status: <StatusChip tone='warning'>{copy.common.review}</StatusChip> })),
            ]}
          />
        </AuctionPanel>
      </AuctionSplit>
    </AuctionExecutionCockpit>
  );
}
