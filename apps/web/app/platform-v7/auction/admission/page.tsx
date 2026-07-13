import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { StatusChip } from '@pc/design-system-v8';
import { AUCTION_DEAL_BRIDGE, isAuctionDealBasisReady } from '@/lib/platform-v7/auctionDealBridge';
import { FGIS_AUCTION_STATE, canOpenAuction } from '@/lib/platform-v7/fgisAuctionEngine';
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
  translateCheck,
  translateOwner,
} from '@/components/transaction-ux/auctionExecutionCopy';

export default async function AuctionAdmissionPage() {
  const locale = normalizeAuctionLocale(await getLocale());
  const copy = AUCTION_COPY[locale];
  const state = FGIS_AUCTION_STATE;
  const ready = canOpenAuction(state) && state.admission === 'admitted';
  const winner = AUCTION_DEAL_BRIDGE.winnerBid;
  const basisReady = ready && isAuctionDealBasisReady(AUCTION_DEAL_BRIDGE.dealBasis);
  const passedChecks = state.checks.filter((check) => check.status === 'ok').length;
  const reviewChecks = state.checks.length - passedChecks;
  const admittedBuyers = state.buyers.filter((buyer) => buyer.admission === 'ok');
  const totalLimit = admittedBuyers.reduce((sum, buyer) => sum + buyer.limitRub, 0);
  const phases = buildAuctionPhases(locale, 'admission', {
    import: state.lot.importStatus === 'matched' ? 'complete' : 'blocked',
    admission: ready ? 'complete' : 'current',
    bids: ready ? (winner ? 'complete' : 'available') : 'blocked',
    'deal-basis': basisReady ? 'complete' : ready && winner ? 'available' : 'blocked',
  });

  const buyerReason = (admission: 'ok' | 'review' | 'blocked', fallback?: string) => {
    if (locale === 'en') return admission === 'ok' ? 'checks passed' : admission === 'review' ? 'authority review required' : 'procurement admission missing';
    if (locale === 'zh') return admission === 'ok' ? '检查已通过' : admission === 'review' ? '需要权限审查' : '没有采购准入';
    return fallback ?? (admission === 'ok' ? 'проверка пройдена' : admission === 'review' ? 'нужна проверка полномочий' : 'нет допуска к закупке');
  };

  return (
    <AuctionExecutionCockpit
      testId='platform-v7-auction-admission-v8'
      eyebrow={copy.admissionPage.eyebrow}
      title={ready ? copy.admissionPage.titleReady : copy.admissionPage.titleReview}
      description={copy.admissionPage.description}
      statusLabel={ready ? copy.admissionPage.statusReady : copy.admissionPage.statusReview}
      statusTone={ready ? 'success' : 'critical'}
      labels={copy.meta}
      priority={{
        state: ready ? 'ready' : 'critical',
        title: ready ? copy.admissionPage.priorityReadyTitle : copy.admissionPage.priorityReviewTitle,
        description: ready ? copy.admissionPage.priorityReadyDescription : copy.admissionPage.priorityReviewDescription,
        blocker: ready ? copy.admissionPage.blockerReady : copy.admissionPage.blockerReview,
        owner: copy.admissionPage.owner,
        impact: ready ? copy.admissionPage.impactReady : copy.admissionPage.impactReview,
        result: copy.admissionPage.result,
        primaryAction: ready
          ? <Link className={auctionCockpitClasses.primaryLink} href='/platform-v7/auction/bids'>{copy.common.openBids}</Link>
          : <Link className={auctionCockpitClasses.primaryLink} href='#checks'>{copy.admissionPage.checksTitle}</Link>,
        secondaryAction: <Link className={auctionCockpitClasses.secondaryLink} href='/platform-v7/auction/import'>{copy.common.openImport}</Link>,
      }}
      facts={[
        { label: copy.admissionPage.facts.checks, value: String(state.checks.length), hint: state.lot.lotNumber },
        { label: copy.admissionPage.facts.passed, value: String(passedChecks), hint: copy.common.complete },
        { label: copy.admissionPage.facts.review, value: String(reviewChecks), hint: ready ? copy.common.complete : copy.common.review },
        { label: copy.admissionPage.facts.buyers, value: String(state.buyers.length), hint: copy.admissionStatuses[state.admission] },
        { label: copy.admissionPage.facts.admittedBuyers, value: String(admittedBuyers.length), hint: copy.buyerStatuses.ok },
        { label: copy.admissionPage.facts.limit, value: formatAuctionMoney(totalLimit, locale), hint: copy.common.sourceSnapshot },
      ]}
      boundary={`${copy.common.boundary} ${copy.common.externalBoundary}`}
      phases={phases}
      phaseNavLabel={copy.phaseNavLabel}
    >
      <AuctionSplit>
        <AuctionPanel title={copy.admissionPage.checksTitle} description={copy.admissionPage.checksDescription}>
          <div id='checks'>
            <AuctionList
              label={copy.admissionPage.checksTitle}
              items={state.checks.map((check) => ({
                id: check.key,
                title: translateCheck(check, locale),
                detail: `${copy.common.owner}: ${translateOwner(check.owner, locale)}`,
                status: <StatusChip tone={check.status === 'ok' ? 'success' : check.status === 'review' ? 'warning' : 'critical'}>{copy.checkStatuses[check.status]}</StatusChip>,
              }))}
            />
          </div>
        </AuctionPanel>
        <AuctionPanel title={copy.admissionPage.buyersTitle} description={copy.admissionPage.buyersDescription}>
          <AuctionList
            label={copy.admissionPage.buyersTitle}
            items={state.buyers.map((buyer) => ({
              id: buyer.buyerId,
              title: buyer.buyerName,
              detail: `${buyerReason(buyer.admission, buyer.reason)} · ${formatAuctionMoney(buyer.limitRub, locale)}`,
              status: <StatusChip tone={buyer.admission === 'ok' ? 'success' : buyer.admission === 'review' ? 'warning' : 'critical'}>{copy.buyerStatuses[buyer.admission]}</StatusChip>,
            }))}
          />
        </AuctionPanel>
      </AuctionSplit>
    </AuctionExecutionCockpit>
  );
}
