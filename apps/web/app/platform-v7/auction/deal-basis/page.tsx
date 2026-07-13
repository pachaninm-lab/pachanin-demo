import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { StatusChip } from '@pc/design-system-v8';
import {
  AUCTION_DEAL_BASIS,
  AUCTION_DEAL_BRIDGE,
  guardAuctionDealBasisReady,
  isAuctionDealBasisReady,
} from '@/lib/platform-v7/auctionDealBridge';
import { FGIS_AUCTION_STATE, canOpenAuction } from '@/lib/platform-v7/fgisAuctionEngine';
import {
  AuctionDetailGrid,
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
  translateGuard,
  translateOwner,
} from '@/components/transaction-ux/auctionExecutionCopy';

export default async function AuctionDealBasisPage() {
  const locale = normalizeAuctionLocale(await getLocale());
  const copy = AUCTION_COPY[locale];
  const basis = AUCTION_DEAL_BASIS;
  const admissionReady = canOpenAuction(FGIS_AUCTION_STATE) && FGIS_AUCTION_STATE.admission === 'admitted';
  const guards = guardAuctionDealBasisReady(basis);
  const basisGuardReady = isAuctionDealBasisReady(basis);
  const ready = Boolean(basis && admissionReady && basisGuardReady);
  const winner = AUCTION_DEAL_BRIDGE.winnerBid;
  const phases = buildAuctionPhases(locale, 'deal-basis', {
    import: FGIS_AUCTION_STATE.lot.importStatus === 'matched' ? 'complete' : 'blocked',
    admission: admissionReady ? 'complete' : 'available',
    bids: admissionReady && winner ? 'complete' : 'blocked',
    'deal-basis': ready ? 'complete' : 'blocked',
  });

  const statusLabel = !basis ? copy.basisPage.statusMissing : ready ? copy.basisPage.statusReady : copy.basisPage.statusBlocked;
  const priorityTitle = !basis ? copy.basisPage.priorityMissingTitle : ready ? copy.basisPage.priorityReadyTitle : copy.basisPage.priorityBlockedTitle;
  const priorityDescription = !basis ? copy.basisPage.priorityMissingDescription : ready ? copy.basisPage.priorityReadyDescription : copy.basisPage.priorityBlockedDescription;
  const priorityBlocker = !basis ? copy.basisPage.blockerMissing : ready ? copy.basisPage.blockerReady : copy.basisPage.blockerBlocked;
  const priorityImpact = ready ? copy.basisPage.impactReady : copy.basisPage.impactBlocked;
  const priorityResult = ready ? copy.basisPage.resultReady : copy.basisPage.resultBlocked;

  return (
    <AuctionExecutionCockpit
      testId='platform-v7-auction-deal-basis-v8'
      eyebrow={copy.basisPage.eyebrow}
      title={basis ? copy.basisPage.title : copy.basisPage.noBasisTitle}
      description={!basis ? copy.basisPage.noBasisDescription : ready ? copy.basisPage.descriptionReady : copy.basisPage.descriptionBlocked}
      statusLabel={statusLabel}
      statusTone={ready ? 'success' : 'critical'}
      labels={copy.meta}
      priority={{
        state: ready ? 'ready' : 'critical',
        title: priorityTitle,
        description: priorityDescription,
        blocker: priorityBlocker,
        owner: copy.basisPage.owner,
        impact: priorityImpact,
        result: priorityResult,
        primaryAction: ready
          ? <Link className={auctionCockpitClasses.primaryLink} href='/platform-v7/deal-logistics'>{copy.common.openLogistics}</Link>
          : <Link className={auctionCockpitClasses.primaryLink} href={basis ? '/platform-v7/auction/admission' : '/platform-v7/auction/bids'}>{basis ? copy.common.openAdmission : copy.common.openBids}</Link>,
        secondaryAction: <Link className={auctionCockpitClasses.secondaryLink} href='/platform-v7/auction/bids'>{copy.common.openBids}</Link>,
      }}
      facts={[
        { label: copy.basisPage.facts.winner, value: basis?.buyerName ?? copy.common.notConfirmed, hint: basis?.winnerBidId },
        { label: copy.basisPage.facts.price, value: basis ? `${formatAuctionMoney(basis.priceRubPerTon, locale)}/t` : copy.common.notConfirmed, hint: copy.common.sourceSnapshot },
        { label: copy.basisPage.facts.lot, value: basis?.lotNumber ?? FGIS_AUCTION_STATE.lot.lotNumber, hint: copy.common.sourceSnapshot },
        { label: copy.basisPage.facts.certificate, value: basis?.sdizNumber ?? FGIS_AUCTION_STATE.lot.sdizNumber ?? copy.common.required, hint: copy.common.notConfirmed },
        { label: copy.basisPage.facts.volume, value: basis ? `${basis.volumeTons} t` : copy.common.notConfirmed, hint: copy.common.available },
        { label: copy.basisPage.facts.amount, value: basis ? formatAuctionMoney(basis.amountRub, locale) : copy.common.notConfirmed, hint: copy.common.boundary },
      ]}
      boundary={`${copy.common.boundary} ${copy.common.externalBoundary}`}
      phases={phases}
      phaseNavLabel={copy.phaseNavLabel}
    >
      {basis ? (
        <AuctionDetailGrid
          label={copy.basisPage.title}
          items={[
            { label: copy.basisPage.facts.winner, value: basis.buyerName, hint: basis.winnerBidId },
            { label: copy.basisPage.facts.price, value: `${formatAuctionMoney(basis.priceRubPerTon, locale)}/t`, hint: basis.winner.placedAt },
            { label: copy.basisPage.facts.lot, value: basis.lotNumber, hint: basis.sdizNumber },
            { label: copy.basisPage.facts.seller, value: basis.sellerName, hint: `INN ${basis.ownerInn}` },
            { label: copy.basisPage.facts.buyer, value: basis.buyerName, hint: basis.region },
            { label: copy.basisPage.facts.volume, value: `${basis.volumeTons} t`, hint: basis.culture },
            { label: copy.basisPage.facts.amount, value: formatAuctionMoney(basis.amountRub, locale), hint: copy.common.boundary },
            { label: copy.basisPage.facts.terms, value: basis.deliveryTerms, hint: basis.region },
            { label: copy.basisPage.facts.storage, value: basis.storagePlace, hint: basis.className },
          ]}
        />
      ) : null}

      <AuctionSplit>
        <AuctionPanel title={copy.basisPage.journalTitle} description={copy.basisPage.journalDescription}>
          <AuctionList
            label={copy.basisPage.journalTitle}
            items={(basis?.journalLocks ?? []).map((item, index) => ({
              id: `journal-${index}`,
              title: copy.journalLocks[index] ?? item.label,
              detail: `${copy.common.owner}: ${translateOwner(item.owner, locale)}`,
              status: <StatusChip tone='information'>{copy.common.complete}</StatusChip>,
            }))}
          />
        </AuctionPanel>
        <AuctionPanel title={copy.basisPage.readinessTitle} description={copy.basisPage.readinessDescription}>
          <AuctionList
            label={copy.basisPage.readinessTitle}
            items={(basis?.readinessReasons ?? []).map((item, index) => ({
              id: `readiness-${index}`,
              title: copy.readinessReasons[index] ?? item,
              status: <StatusChip tone={ready ? 'success' : 'warning'}>{ready ? copy.common.complete : copy.common.review}</StatusChip>,
            }))}
          />
        </AuctionPanel>
      </AuctionSplit>

      <AuctionPanel title={copy.basisPage.guardsTitle} description={copy.basisPage.guardsDescription}>
        <AuctionList
          label={copy.basisPage.guardsTitle}
          items={guards.map((guard) => ({
            id: guard.key,
            title: translateGuard(guard, locale),
            detail: `${copy.common.owner}: ${translateOwner(guard.owner, locale)}`,
            status: <StatusChip tone={guard.status === 'ok' ? 'success' : 'critical'}>{guard.status === 'ok' ? copy.common.complete : copy.common.blocked}</StatusChip>,
          }))}
        />
      </AuctionPanel>

      <AuctionPanel title={copy.basisPage.nextTitle} description={copy.basisPage.nextDescription}>
        <AuctionList
          label={copy.basisPage.nextTitle}
          items={(basis?.nextRoutes ?? []).map((action) => {
            const translated = copy.nextActions[action.href] ?? { label: action.label, result: action.resultLabel };
            const disabled = action.href === '/platform-v7/deal-logistics' && !ready;
            return {
              id: action.href,
              title: translated.label,
              detail: translated.result,
              meta: `${copy.common.owner}: ${translateOwner(action.owner, locale)}`,
              href: disabled ? '/platform-v7/auction/admission' : action.href,
              status: <StatusChip tone={disabled ? 'critical' : 'information'}>{disabled ? copy.common.blocked : copy.common.available}</StatusChip>,
            };
          })}
        />
      </AuctionPanel>

      <AuctionPanel title={copy.basisPage.moneyTitle} description={copy.basisPage.moneyDescription}>
        <p className={auctionCockpitClasses.warningText}>{copy.basisPage.moneyDescription}</p>
      </AuctionPanel>
    </AuctionExecutionCockpit>
  );
}
