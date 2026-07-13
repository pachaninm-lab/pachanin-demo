import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { StatusChip } from '@pc/design-system-v8';
import { AUCTION_DEAL_BRIDGE, isAuctionDealBasisReady } from '@/lib/platform-v7/auctionDealBridge';
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

export default async function AuctionBidsPage() {
  const locale = normalizeAuctionLocale(await getLocale());
  const copy = AUCTION_COPY[locale];
  const lot = FGIS_AUCTION_STATE.lot;
  const bids = AUCTION_DEAL_BRIDGE.lot.bids;
  const winner = bids.find((bid) => bid.isWinner) ?? bids[0];
  const ready = canOpenAuction(FGIS_AUCTION_STATE) && FGIS_AUCTION_STATE.admission === 'admitted';
  const basisReady = ready && isAuctionDealBasisReady(AUCTION_DEAL_BRIDGE.dealBasis);
  const phases = buildAuctionPhases(locale, 'bids', {
    import: lot.importStatus === 'matched' ? 'complete' : 'blocked',
    admission: ready ? 'complete' : 'available',
    bids: ready ? (winner ? 'complete' : 'current') : 'blocked',
    'deal-basis': basisReady ? 'complete' : ready && winner ? 'available' : 'blocked',
  });

  return (
    <AuctionExecutionCockpit
      testId='platform-v7-auction-bids-v8'
      eyebrow={copy.bidsPage.eyebrow}
      title={copy.bidsPage.title}
      description={ready ? copy.bidsPage.descriptionReady : copy.bidsPage.descriptionBlocked}
      statusLabel={ready ? copy.bidsPage.statusReady : copy.bidsPage.statusBlocked}
      statusTone={ready ? 'success' : 'critical'}
      labels={copy.meta}
      priority={{
        state: ready ? 'ready' : 'critical',
        title: ready ? copy.bidsPage.priorityReadyTitle : copy.bidsPage.priorityBlockedTitle,
        description: ready ? copy.bidsPage.priorityReadyDescription : copy.bidsPage.priorityBlockedDescription,
        blocker: ready ? copy.bidsPage.blockerReady : copy.bidsPage.blockerBlocked,
        owner: copy.bidsPage.owner,
        impact: ready ? copy.bidsPage.impactReady : copy.bidsPage.impactBlocked,
        result: copy.bidsPage.result,
        primaryAction: ready
          ? <Link className={auctionCockpitClasses.primaryLink} href='/platform-v7/auction/deal-basis'>{copy.common.openBasis}</Link>
          : <Link className={auctionCockpitClasses.primaryLink} href='/platform-v7/auction/admission'>{copy.common.openAdmission}</Link>,
        secondaryAction: <Link className={auctionCockpitClasses.secondaryLink} href='/platform-v7/auction'>{copy.common.openAuction}</Link>,
      }}
      facts={[
        { label: copy.bidsPage.facts.leader, value: winner?.buyerName ?? copy.common.notConfirmed, hint: winner ? copy.bidsPage.winner : copy.common.blocked },
        { label: copy.bidsPage.facts.bid, value: winner ? `${formatAuctionMoney(winner.priceRubPerTon, locale)}/t` : copy.common.notConfirmed, hint: winner?.placedAt },
        { label: copy.bidsPage.facts.lot, value: lot.lotNumber, hint: lot.sdizNumber ?? copy.common.required },
        { label: copy.bidsPage.facts.volume, value: `${kgToTons(lot.availableWeightKg)} t`, hint: copy.common.available },
        { label: copy.bidsPage.facts.bids, value: String(bids.length), hint: copy.common.sourceSnapshot },
        { label: copy.bidsPage.facts.journal, value: ready ? copy.common.available : copy.bidsPage.historical, hint: copy.common.notConfirmed },
      ]}
      boundary={`${copy.common.boundary} ${copy.common.externalBoundary}`}
      phases={phases}
      phaseNavLabel={copy.phaseNavLabel}
    >
      <AuctionSplit>
        <AuctionPanel title={copy.bidsPage.journalTitle} description={copy.bidsPage.journalDescription}>
          <AuctionList
            label={copy.bidsPage.journalTitle}
            items={bids.map((bid) => ({
              id: bid.id,
              title: bid.buyerName,
              detail: `${formatAuctionMoney(bid.priceRubPerTon, locale)}/t · ${bid.volumeTons} t`,
              meta: `${bid.id} · ${bid.placedAt}`,
              status: bid.isWinner
                ? <StatusChip tone={ready ? 'success' : 'warning'}>{ready ? copy.bidsPage.winner : copy.bidsPage.historical}</StatusChip>
                : <StatusChip tone='neutral'>{copy.bidsPage.historical}</StatusChip>,
            }))}
          />
        </AuctionPanel>
        <AuctionPanel title={copy.bidsPage.rulesTitle} description={copy.bidsPage.rulesDescription}>
          <AuctionList
            label={copy.bidsPage.rulesTitle}
            items={FGIS_AUCTION_STATE.bidRules.map((rule) => ({
              id: rule.key,
              title: translateRule(rule.key, rule.label, locale),
              status: <StatusChip tone='information'>{copy.common.complete}</StatusChip>,
            }))}
          />
        </AuctionPanel>
      </AuctionSplit>
    </AuctionExecutionCockpit>
  );
}
