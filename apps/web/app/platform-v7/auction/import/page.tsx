import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { StatusChip } from '@pc/design-system-v8';
import { AUCTION_DEAL_BRIDGE, isAuctionDealBasisReady } from '@/lib/platform-v7/auctionDealBridge';
import { FGIS_AUCTION_STATE, canOpenAuction, kgToTons } from '@/lib/platform-v7/fgisAuctionEngine';
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
  normalizeAuctionLocale,
} from '@/components/transaction-ux/auctionExecutionCopy';

export default async function AuctionImportPage() {
  const locale = normalizeAuctionLocale(await getLocale());
  const copy = AUCTION_COPY[locale];
  const lot = FGIS_AUCTION_STATE.lot;
  const admissionReady = canOpenAuction(FGIS_AUCTION_STATE) && FGIS_AUCTION_STATE.admission === 'admitted';
  const winner = AUCTION_DEAL_BRIDGE.winnerBid;
  const basisReady = admissionReady && isAuctionDealBasisReady(AUCTION_DEAL_BRIDGE.dealBasis);
  const phases = buildAuctionPhases(locale, 'import', {
    import: lot.importStatus === 'matched' ? 'complete' : 'current',
    admission: lot.importStatus === 'matched' ? (admissionReady ? 'complete' : 'available') : 'blocked',
    bids: admissionReady ? (winner ? 'complete' : 'available') : 'blocked',
    'deal-basis': basisReady ? 'complete' : admissionReady && winner ? 'available' : 'blocked',
  });
  const culture = locale === 'en' ? 'Wheat' : locale === 'zh' ? '小麦' : lot.culture;
  const className = locale === 'en' ? 'Class 4' : locale === 'zh' ? '4 级' : lot.className;

  return (
    <AuctionExecutionCockpit
      testId='platform-v7-auction-import-v8'
      eyebrow={copy.importPage.eyebrow}
      title={copy.importPage.title}
      description={copy.importPage.description}
      statusLabel={copy.importPage.status}
      statusTone='warning'
      labels={copy.meta}
      priority={{
        state: 'critical',
        title: copy.importPage.priorityTitle,
        description: copy.importPage.priorityDescription,
        blocker: copy.importPage.blocker,
        owner: copy.importPage.owner,
        impact: copy.importPage.impact,
        result: copy.importPage.result,
        primaryAction: <Link className={auctionCockpitClasses.primaryLink} href='/platform-v7/fgis-access'>{copy.common.sourceSnapshot}</Link>,
        secondaryAction: <Link className={auctionCockpitClasses.secondaryLink} href='/platform-v7/auction/admission'>{copy.common.openAdmission}</Link>,
      }}
      facts={[
        { label: copy.importPage.facts.status, value: copy.importStatuses[lot.importStatus], hint: copy.common.externalBoundary },
        { label: copy.importPage.facts.lot, value: lot.lotNumber, hint: copy.common.sourceSnapshot },
        { label: copy.importPage.facts.certificate, value: lot.sdizNumber ?? copy.common.required, hint: copy.common.notConfirmed },
        { label: copy.importPage.facts.owner, value: lot.ownerName, hint: `INN ${lot.ownerInn}` },
        { label: copy.importPage.facts.batch, value: `${culture} · ${className}`, hint: lot.region },
        { label: copy.importPage.facts.volume, value: `${kgToTons(lot.availableWeightKg)} t`, hint: `${copy.common.available}: ${kgToTons(lot.availableWeightKg - lot.lockedWeightKg)} t` },
      ]}
      boundary={`${copy.common.boundary} ${copy.common.externalBoundary}`}
      phases={phases}
      phaseNavLabel={copy.phaseNavLabel}
    >
      <AuctionDetailGrid
        label={copy.importPage.facts.batch}
        items={[
          { label: copy.importPage.facts.lot, value: lot.lotNumber, hint: lot.elevatorName },
          { label: copy.importPage.facts.certificate, value: lot.sdizNumber ?? copy.common.required, hint: lot.purpose },
          { label: copy.importPage.facts.owner, value: lot.ownerName, hint: `INN ${lot.ownerInn}` },
          { label: copy.importPage.facts.volume, value: `${kgToTons(lot.availableWeightKg)} t`, hint: lot.region },
        ]}
      />

      <AuctionSplit>
        <AuctionPanel title={copy.importPage.qualityTitle} description={copy.importPage.qualityDescription}>
          <AuctionList
            label={copy.importPage.qualityTitle}
            items={lot.quality.map((item, index) => ({
              id: `quality-${index}`,
              title: copy.qualityLabels[item.label] ?? item.label,
              detail: item.value,
              status: <StatusChip tone='warning'>{copy.common.review}</StatusChip>,
            }))}
          />
        </AuctionPanel>
        <AuctionPanel title={copy.importPage.documentsTitle} description={copy.importPage.documentsDescription}>
          <AuctionList
            label={copy.importPage.documentsTitle}
            items={lot.documents.map((item, index) => ({
              id: `document-${index}`,
              title: copy.documentLabels[item.label] ?? item.label,
              status: <StatusChip tone={item.status === 'ok' ? 'success' : item.status === 'review' ? 'warning' : 'critical'}>{copy.documentStatuses[item.status]}</StatusChip>,
            }))}
          />
        </AuctionPanel>
      </AuctionSplit>
    </AuctionExecutionCockpit>
  );
}
