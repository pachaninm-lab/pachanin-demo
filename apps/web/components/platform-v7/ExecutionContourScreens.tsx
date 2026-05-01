import type { CSSProperties, ReactNode } from 'react';
import { BidLifecyclePanel } from '@/components/platform-v7/BidLifecyclePanel';
import { P7Page } from '@/components/platform-v7/P7Page';
import { P7Section } from '@/components/platform-v7/P7Section';
import {
  acceptBid,
  acceptLogisticsQuoteCreateTrip,
  createLogisticsRequestFromDeal,
  driverFieldView,
  evaluateReleaseSafety,
  executionContourFixtures,
  getVisibleBidsForRole,
  submitLogisticsQuote,
  type Lot,
} from '@/lib/platform-v7/execution-contour';

const accepted = acceptBid({ lot: executionContourFixtures.lots[0], bids: executionContourFixtures.bids, bidId: 'BID-7002' });
const logisticsRequest = createLogisticsRequestFromDeal(accepted.deal);
const logisticsQuote = submitLogisticsQuote({
  requestId: logisticsRequest.requestId,
  carrierId: 'cp-carrier-1',
  rateType: 'per_ton',
  rate: 2400,
  vehicleType: 'зерновоз',
  vehicleNumber: 'А123ВС68',
  driverCandidate: 'driver-2041',
  etaPickup: '2026-05-02T08:00:00.000Z',
  etaDelivery: '2026-05-03T09:00:00.000Z',
  conditions: 'GPS, пломба и фото погрузки обязательны',
});
const assigned = acceptLogisticsQuoteCreateTrip({ request: logisticsRequest, quote: logisticsQuote, driverId: 'driver-2041', vehicleId: 'truck-2041' });
const completedTrip = {
  ...assigned.trip,
  status: 'completed' as const,
  sealNumber: 'PL-2041',
  weightGross: 52420,
  weightTare: 2410,
  weightNet: 50010,
  gpsTrack: [
    { at: '2026-05-02T08:20:00.000Z', lat: 52.721, lng: 41.452, source: 'gps' as const },
    { at: '2026-05-03T09:12:00.000Z', lat: 51.672, lng: 39.184, source: 'gps' as const },
  ],
  photoEvents: [
    { photoId: 'PHOTO-LOAD-1', at: '2026-05-02T08:28:00.000Z', type: 'loading' as const },
    { photoId: 'PHOTO-SEAL-1', at: '2026-05-02T08:41:00.000Z', type: 'seal' as const },
  ],
};
const receiving = { receivingId: 'RCV-2041', tripId: completedTrip.tripId, dealId: accepted.deal.dealId, weightNet: 500, weightStatus: 'confirmed' as const, actStatus: 'signed' as const };
const labResult = { labResultId: 'LAB-2041', dealId: accepted.deal.dealId, tripId: completedTrip.tripId, status: 'issued' as const, qualityDeltaAmount: 0 };
const documentPack = { packId: 'DOC-2041', dealId: accepted.deal.dealId, requiredDocuments: ['ЭТрН', 'путевой лист', 'СДИЗ', 'УПД'], signedDocuments: ['ЭТрН', 'путевой лист', 'СДИЗ', 'УПД'], status: 'complete' as const };
const cleanMoneyCheck = evaluateReleaseSafety({
  deal: accepted.deal,
  trip: completedTrip,
  receiving,
  labResult,
  documentPack,
  disputePack: { disputeId: 'DK-0', dealId: accepted.deal.dealId, tripId: completedTrip.tripId, status: 'none', evidenceIds: [], amountImpact: 0 },
  reserveConfirmed: true,
  fgisReady: true,
  edoReady: true,
  manualReviewOpen: false,
});
const blockedMoneyCheck = evaluateReleaseSafety({
  deal: accepted.deal,
  reserveConfirmed: true,
  fgisReady: true,
  edoReady: false,
  manualReviewOpen: false,
});

const pageSubtitle = 'Контролируемый пилот: демонстрационный набор данных показывает связку лот → ставка → сделка → логистика → рейс → приёмка → документы → деньги → спор.';

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
  gap: 16,
};
const cardStyle: CSSProperties = { border: '1px solid #E4E6EA', borderRadius: 20, background: '#FFFFFF', padding: 18, display: 'grid', gap: 12, minWidth: 0 };
const mutedStyle: CSSProperties = { color: '#667085', fontSize: 13, lineHeight: 1.55 };
const numberStyle: CSSProperties = { fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace', fontVariantNumeric: 'tabular-nums' };

function money(value: number): string {
  return new Intl.NumberFormat('ru-RU').format(value) + ' ₽';
}

function Pill({ children }: { readonly children: ReactNode }) {
  return <span style={{ display: 'inline-flex', minHeight: 28, alignItems: 'center', borderRadius: 999, border: '1px solid #D0D5DD', padding: '0 10px', color: '#344054', fontSize: 12, fontWeight: 700 }}>{children}</span>;
}

function Action({ children }: { readonly children: ReactNode }) {
  return <span style={{ display: 'inline-flex', minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, background: '#0A7A5F', color: '#FFFFFF', padding: '0 14px', fontSize: 14, fontWeight: 700 }}>{children}</span>;
}

function Metric({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={mutedStyle}>{label}</div>
      <div style={{ ...numberStyle, fontSize: 18, fontWeight: 800, color: '#101828' }}>{value}</div>
    </div>
  );
}

function LotCard({ lot, audience = 'seller' }: { readonly lot: Lot; readonly audience?: 'seller' | 'buyer' }) {
  const bids = executionContourFixtures.bids.filter((bid) => bid.lotId === lot.lotId);
  const bestBid = [...bids].sort((a, b) => b.pricePerTon - a.pricePerTon)[0];
  const isBuyer = audience === 'buyer';
  return (
    <article style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>{lot.crop} · {lot.grade} · {lot.volumeTons} т</h2>
          <div style={mutedStyle}>{lot.region} · {lot.basis}</div>
        </div>
        <Pill>{lot.status === 'bidding' ? 'идут ставки' : lot.status}</Pill>
      </div>
      <div style={gridStyle}>
        <Metric label={isBuyer ? 'Ориентир продавца' : 'Цена ожидания'} value={`${money(lot.targetPricePerTon)}/т`} />
        <Metric label={isBuyer ? 'Ваш режим' : 'Ставок'} value={isBuyer ? 'закрытые торги' : String(bids.length)} />
        {isBuyer ? <Metric label="Документы" value={`${lot.documentsReadiness}%`} /> : <Metric label="Лучшая ставка" value={bestBid ? `${money(bestBid.pricePerTon)}/т` : '—'} />}
        {!isBuyer ? <Metric label="Документы" value={`${lot.documentsReadiness}%`} /> : null}
      </div>
      <div style={mutedStyle}>ФГИС/СДИЗ: требуется проверка · до окончания: 3 ч 20 мин</div>
      {!isBuyer ? <a href={`/platform-v7/lots/${lot.lotId}/bids`} style={{ textDecoration: 'none' }}><Action>Открыть ставки</Action></a> : null}
    </article>
  );
}

export function PlatformV7LotsPage() {
  return (
    <P7Page title="Лоты и ставки" subtitle={pageSubtitle} testId="platform-v7-lots">
      <P7Section title="Активные лоты" subtitle="Каждый лот показывает цену, статус торгов, количество ставок, документы и готовность ФГИС/СДИЗ.">
        <div style={gridStyle}>{executionContourFixtures.lots.map((lot) => <LotCard key={lot.lotId} lot={lot} />)}</div>
      </P7Section>
    </P7Page>
  );
}

export function PlatformV7LotBidsPage() {
  const lot = executionContourFixtures.lots[0];
  const visibleBids = getVisibleBidsForRole({ role: 'seller', lot, bids: executionContourFixtures.bids });
  return (
    <P7Page title={`${lot.lotId}: Ставки по лоту`} subtitle="Продавец видит все ставки по своему лоту, сравнивает цену, объём, оплату и логистику. Покупатель в закрытом режиме видит только свою ставку." testId="platform-v7-lot-bids">
      <P7Section title="Сравнение ставок" subtitle="После принятия одной ставки условия замораживаются, остальные ставки закрываются, а сделка создаётся из принятого предложения.">
        <BidLifecyclePanel lot={lot} initialBids={visibleBids} mode="seller" />
      </P7Section>
    </P7Page>
  );
}

export function PlatformV7BuyerLotsPage() {
  const lot = executionContourFixtures.lots[0];
  const buyerBids = getVisibleBidsForRole({ role: 'buyer', lot, bids: executionContourFixtures.bids, viewerCounterpartyId: 'cp-buyer-2' });
  return (
    <P7Page title="Покупатель: Доступные лоты" subtitle="Покупатель ищет лоты, отправляет ставку и видит только собственную позицию в закрытом режиме." testId="platform-v7-buyer-lots">
      <P7Section title="Фильтры закупки" subtitle="Культура · класс · регион · объём · цена · базис · документы · срок вывоза · ФГИС/СДИЗ · логистика.">
        <LotCard lot={lot} audience="buyer" />
      </P7Section>
      <P7Section title="Ваша ставка" subtitle="После отправки покупатель видит статус и доступные действия: повысить, изменить или отозвать.">
        <BidLifecyclePanel lot={lot} initialBids={buyerBids} mode="buyer" />
      </P7Section>
    </P7Page>
  );
}

export function PlatformV7SellerLotsPage() {
  return (
    <P7Page title="Продавец: Мои лоты" subtitle="Управление лотами, ставками, документами, логистикой и историей действий." testId="platform-v7-seller-lots">
      <div style={gridStyle}>{executionContourFixtures.lots.map((lot) => <LotCard key={lot.lotId} lot={lot} />)}</div>
    </P7Page>
  );
}

export function PlatformV7DealPage() {
  const steps = ['Лот опубликован', 'Ставка принята', 'Сделка создана', 'Заявка в логистику создана', 'Перевозчик предложил условия', 'Рейс создан', 'Приёмка завершена', 'Документы собраны', 'К выпуску денег'];
  return (
    <P7Page title={`${accepted.deal.dealId}: путь сделки`} subtitle="Карточка сделки показывает непрерывную цепочку от принятой ставки до денег и доказательств." testId="platform-v7-deal-detail">
      <P7Section title="Деньги: экономика из принятой ставки">
        <div style={gridStyle}>
          <Metric label="Лот" value={accepted.deal.lotId} />
          <Metric label="Принятая ставка" value={accepted.deal.acceptedBidId} />
          <Metric label="Цена" value={`${money(accepted.deal.pricePerTon)}/т`} />
          <Metric label="Сумма" value={money(accepted.deal.totalAmount)} />
        </div>
      </P7Section>
      <P7Section title="Таймлайн исполнения">
        <div style={gridStyle}>{steps.map((step, index) => <article key={step} style={cardStyle}><Pill>шаг {index + 1}</Pill><strong>{step}</strong><div style={mutedStyle}>Ответственный и следующее действие фиксируются в журнале сделки.</div></article>)}</div>
      </P7Section>
    </P7Page>
  );
}

export function PlatformV7LogisticsRequestsPage() {
  return <P7Page title="Логистика: входящие заявки" subtitle="Логистическая компания видит только перевозочную часть: груз, маршрут, окна, требования к ТС, документы и срок ответа." testId="platform-v7-logistics-requests"><LogisticsRequestCard /></P7Page>;
}

function LogisticsRequestCard() {
  return (
    <article style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><h2 style={{ margin: 0 }}>{assigned.request.requestId}</h2><Pill>{assigned.request.status === 'assigned' ? 'назначено' : assigned.request.status}</Pill></div>
      <div style={gridStyle}>
        <Metric label="Груз" value={`${assigned.request.cargo.crop} · ${assigned.request.cargo.grade} · ${assigned.request.cargo.volumeTons} т`} />
        <Metric label="Маршрут" value="Тамбов → Воронеж" />
        <Metric label="Погрузка" value="02.05 08:00" />
        <Metric label="Выгрузка" value="03.05 09:00" />
      </div>
      <div style={mutedStyle}>GPS: обязателен · пломба: обязательна · документы: {assigned.request.documentsRequired.join(', ')} · SLA ответа: 2 часа.</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><Action>Предложить условия</Action><Pill>Принять заявку</Pill><Pill>Запросить уточнение</Pill></div>
    </article>
  );
}

export function PlatformV7LogisticsRequestPage() {
  return (
    <P7Page title={`${assigned.request.requestId}: заявка на перевозку`} subtitle="Оператор и перевозчик видят заявку, предложение перевозчика и действие по назначению рейса." testId="platform-v7-logistics-request-detail">
      <LogisticsRequestCard />
      <P7Section title="Предложение перевозчика"><article style={cardStyle}><div style={gridStyle}><Metric label="Перевозчик" value="Перевозчик A" /><Metric label="Ставка" value={`${money(assigned.quote.rate)}/т`} /><Metric label="ТС" value={assigned.quote.vehicleType} /><Metric label="Статус" value="выбрано" /></div><div style={mutedStyle}>После выбора предложения создан рейс {assigned.trip.tripId}, назначены машина и водитель.</div></article></P7Section>
    </P7Page>
  );
}

export function PlatformV7TripPage() {
  return (
    <P7Page title={`${completedTrip.tripId}: рейс`} subtitle="Рейс связан со сделкой, логистической заявкой, перевозчиком, водителем, GPS, фото, пломбой, весом и документами." testId="platform-v7-trip-detail">
      <div style={gridStyle}><Metric label="Сделка" value={completedTrip.dealId} /><Metric label="Заявка" value={completedTrip.logisticsRequestId} /><Metric label="Водитель" value={completedTrip.driverId} /><Metric label="Статус" value="закрыто" /></div>
      <P7Section title="Полевые подтверждения"><div style={gridStyle}><article style={cardStyle}><strong>Пломба</strong><div style={mutedStyle}>{completedTrip.sealNumber}</div></article><article style={cardStyle}><strong>Вес нетто</strong><div style={mutedStyle}>{completedTrip.weightNet} кг</div></article><article style={cardStyle}><strong>Фото</strong><div style={mutedStyle}>{completedTrip.photoEvents.length} события</div></article><article style={cardStyle}><strong>GPS</strong><div style={mutedStyle}>{completedTrip.gpsTrack.length} точки</div></article></div></P7Section>
    </P7Page>
  );
}

export function PlatformV7DriverPage() {
  const field = driverFieldView(assigned.trip);
  return (
    <main style={{ display: 'grid', gap: 18, minHeight: '100dvh', background: '#F8FAFC', padding: '16px 16px calc(24px + env(safe-area-inset-bottom))', color: '#101828' }} data-testid="platform-v7-driver-field-shell">
      <style>{`
        a[href="/platform-v7/investor"],
        a[href="/platform-v7/demo"],
        a[href="/platform-v7/roles"],
        .pc-shell-select,
        .pc-mobile-role {
          display: none !important;
        }
      `}</style>
      <header style={cardStyle}><Pill>Полевой экран</Pill><h1 style={{ margin: 0, fontSize: 24 }}>Рейс {field.tripId}</h1><div style={mutedStyle}>{field.route}</div></header>
      <section style={gridStyle}><article style={cardStyle}><strong>Погрузка</strong><div style={mutedStyle}>{field.pickupPoint}</div></article><article style={cardStyle}><strong>Выгрузка</strong><div style={mutedStyle}>{field.deliveryPoint}</div></article><article style={cardStyle}><strong>ETA</strong><div style={mutedStyle}>{field.eta}</div></article><article style={cardStyle}><strong>Диспетчер</strong><div style={mutedStyle}>{field.dispatcherContact}</div></article></section>
      <section style={cardStyle}><h2 style={{ margin: 0, fontSize: 18 }}>Полевые действия</h2><div style={{ display: 'grid', gap: 10 }}>{field.fieldActions.map((action) => <Action key={action}>{action}</Action>)}</div><div style={mutedStyle}>Без связи событие сохраняется локально и синхронизируется после восстановления: ожидает отправки / отправлено / ошибка.</div></section>
    </main>
  );
}

export function PlatformV7ElevatorPage() {
  return <P7Page title="Элеватор: приёмка" subtitle="Фиксация веса, акта и расхождений привязана к tripId и dealId." testId="platform-v7-elevator"><article style={cardStyle}><div style={gridStyle}><Metric label="Рейс" value={receiving.tripId} /><Metric label="Сделка" value={receiving.dealId} /><Metric label="Вес нетто" value={`${receiving.weightNet} т`} /><Metric label="Акт" value="подписан" /></div></article></P7Page>;
}

export function PlatformV7LabPage() {
  return <P7Page title="Лаборатория: протокол качества" subtitle="Лабораторный результат влияет на расчёт, удержание спорной части и пакет доказательств." testId="platform-v7-lab"><article style={cardStyle}><div style={gridStyle}><Metric label="Протокол" value={labResult.labResultId} /><Metric label="Сделка" value={labResult.dealId} /><Metric label="Статус" value="выдан" /><Metric label="Качественная дельта" value={money(labResult.qualityDeltaAmount)} /></div></article></P7Page>;
}

export function PlatformV7ReleaseSafetyPage() {
  return <P7Page title="Проверка выпуска денег" subtitle="Деньги не выпускаются, пока не закрыты принятая ставка, резерв, рейс, вес, лаборатория, ФГИС/СДИЗ, транспортный пакет, спор и ручная проверка." testId="platform-v7-money-safety"><div style={gridStyle}><MoneyCheckCard title="Сценарий с причиной остановки" check={blockedMoneyCheck} /><MoneyCheckCard title="Сценарий готовности" check={cleanMoneyCheck} /></div></P7Page>;
}

function MoneyCheckCard({ title, check }: { readonly title: string; readonly check: ReturnType<typeof evaluateReleaseSafety> }) {
  return <article style={cardStyle}><Pill>{title}</Pill><h2 style={{ margin: 0 }}>{check.title}</h2>{check.reasons.length > 0 ? <ul style={{ margin: 0, paddingLeft: 18 }}>{check.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul> : <div style={mutedStyle}>Все обязательные условия закрыты.</div>}<div style={mutedStyle}>Ответственный: {check.responsible} · следующее действие: {check.nextAction}</div></article>;
}
