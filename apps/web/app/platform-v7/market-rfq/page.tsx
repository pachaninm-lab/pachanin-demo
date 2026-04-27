'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  SANDBOX_MARKET_LOTS,
  SANDBOX_OFFERS,
  SANDBOX_RFQS,
  canAcceptOffer,
  type MarketLotStatus,
  type OfferStatus,
  type RFQStatus,
} from '@/lib/platform-v7/fgis-lot-passport';

const S = 'var(--pc-bg-card)';
const SS = 'var(--pc-bg-elevated)';
const B = 'var(--pc-border)';
const T = 'var(--pc-text-primary)';
const M = 'var(--pc-text-secondary)';
const BRAND = '#0A7A5F';
const BRAND_BG = 'rgba(10,122,95,0.08)';
const BRAND_BORDER = 'rgba(10,122,95,0.18)';
const WARN_BG = 'rgba(217,119,6,0.08)';
const WARN_BORDER = 'rgba(217,119,6,0.18)';
const WARN = '#B45309';
const ERR_BG = 'rgba(220,38,38,0.08)';
const ERR_BORDER = 'rgba(220,38,38,0.18)';
const ERR = '#B91C1C';
const INFO_BG = 'rgba(37,99,235,0.06)';
const INFO_BORDER = 'rgba(37,99,235,0.18)';
const INFO = '#2563EB';

type ViewMode = 'lots' | 'rfq' | 'offers';

type Tone = { bg: string; border: string; color: string; label: string };

function fmt(n: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n);
}

function lotStatus(status: MarketLotStatus): Tone {
  if (status === 'active') return { bg: BRAND_BG, border: BRAND_BORDER, color: BRAND, label: 'Активен' };
  if (status === 'reserved') return { bg: INFO_BG, border: INFO_BORDER, color: INFO, label: 'Резерв' };
  if (status === 'offer_received') return { bg: WARN_BG, border: WARN_BORDER, color: WARN, label: 'Есть оферта' };
  if (status === 'sold') return { bg: SS, border: B, color: M, label: 'Продан' };
  if (status === 'cancelled' || status === 'expired') return { bg: ERR_BG, border: ERR_BORDER, color: ERR, label: 'Не активен' };
  return { bg: WARN_BG, border: WARN_BORDER, color: WARN, label: 'Черновик' };
}

function rfqStatus(status: RFQStatus): Tone {
  if (status === 'open') return { bg: BRAND_BG, border: BRAND_BORDER, color: BRAND, label: 'Открыт' };
  if (status === 'offers_received') return { bg: WARN_BG, border: WARN_BORDER, color: WARN, label: 'Есть оферты' };
  if (status === 'offer_accepted') return { bg: INFO_BG, border: INFO_BORDER, color: INFO, label: 'Оферта принята' };
  if (status === 'expired' || status === 'cancelled') return { bg: ERR_BG, border: ERR_BORDER, color: ERR, label: 'Закрыт' };
  return { bg: SS, border: B, color: M, label: 'Черновик' };
}

function offerStatus(status: OfferStatus): Tone {
  if (status === 'submitted') return { bg: WARN_BG, border: WARN_BORDER, color: WARN, label: 'Подана' };
  if (status === 'under_review') return { bg: INFO_BG, border: INFO_BORDER, color: INFO, label: 'Проверка' };
  if (status === 'accepted') return { bg: BRAND_BG, border: BRAND_BORDER, color: BRAND, label: 'Принята' };
  if (status === 'rejected' || status === 'expired' || status === 'outbid') return { bg: ERR_BG, border: ERR_BORDER, color: ERR, label: 'Закрыта' };
  return { bg: SS, border: B, color: M, label: 'Черновик' };
}

export default function MarketRfqPage() {
  const [view, setView] = React.useState<ViewMode>('lots');
  const totalLotsValue = SANDBOX_MARKET_LOTS.reduce((sum, lot) => sum + lot.pricePerTon * lot.volumeTons, 0);
  const totalRfqVolume = SANDBOX_RFQS.reduce((sum, rfq) => sum + rfq.volumeTons, 0);
  const acceptableOffers = SANDBOX_OFFERS.filter(canAcceptOffer).length;

  return (
    <div style={{ display: 'grid', gap: 18, padding: '8px 0' }}>
      <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, color: M, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Market / RFQ · <span style={{ color: WARN }}>sandbox</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: T, marginTop: 8, lineHeight: 1.1 }}>Лоты, заявки и оферты</div>
            <div style={{ marginTop: 8, fontSize: 14, color: M, maxWidth: 800 }}>
              Предсделочный контур: лот или RFQ не равны сделке. Сделка создаётся только после acceptance и последующей проверки gates. Live-торги здесь не заявляются.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href='/platform-v7/lots' style={button()}>Текущие лоты</Link>
            <Link href='/platform-v7/control-tower' style={button()}>Башня управления</Link>
          </div>
        </div>
      </section>

      <section style={{ background: WARN_BG, border: `1px solid ${WARN_BORDER}`, borderRadius: 14, padding: 14 }}>
        <div style={{ fontSize: 12, color: WARN, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sandbox rule</div>
        <div style={{ marginTop: 6, fontSize: 13, color: T, lineHeight: 1.55 }}>
          Это витрина предсделочного спроса/предложения. Здесь нет боевых торгов, биржевой функции, автоматического заключения договора или списания денег.
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14 }}>
        <Metric label='Лоты' value={String(SANDBOX_MARKET_LOTS.length)} note={fmt(totalLotsValue)} color={BRAND} />
        <Metric label='RFQ' value={String(SANDBOX_RFQS.length)} note={`${totalRfqVolume} т спроса`} color={INFO} />
        <Metric label='Оферты' value={String(SANDBOX_OFFERS.length)} note={`${acceptableOffers} можно принять sandbox`} color={WARN} />
      </div>

      <div style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, overflow: 'hidden' }}>
        <div style={{ display: 'flex', overflowX: 'auto', borderBottom: `1px solid ${B}`, padding: '0 12px' }}>
          {[
            ['lots', 'Лоты'],
            ['rfq', 'RFQ'],
            ['offers', 'Оферты'],
          ].map(([id, label]) => (
            <button
              key={id}
              type='button'
              onClick={() => setView(id as ViewMode)}
              style={{ border: 0, background: 'transparent', cursor: 'pointer', padding: '13px 14px', color: view === id ? BRAND : M, borderBottom: view === id ? `2px solid ${BRAND}` : '2px solid transparent', fontSize: 13, fontWeight: 900 }}
            >
              {label}
            </button>
          ))}
        </div>
        <div style={{ padding: 18 }}>
          {view === 'lots' ? <LotsTable /> : null}
          {view === 'rfq' ? <RfqTable /> : null}
          {view === 'offers' ? <OffersTable /> : null}
        </div>
      </div>
    </div>
  );
}

function LotsTable() {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {SANDBOX_MARKET_LOTS.map((lot) => {
        const tone = lotStatus(lot.status);
        return (
          <Card key={lot.id}>
            <TopLine id={lot.id} tone={tone} />
            <div style={{ marginTop: 8, fontSize: 16, fontWeight: 900, color: T }}>{lot.grain} · {lot.volumeTons} т</div>
            <div style={{ marginTop: 6, fontSize: 13, color: M }}>{lot.region} · {lot.priceBasis} · {lot.seller.name}</div>
            <Grid>
              <Small label='Цена/т' value={fmt(lot.pricePerTon)} color={BRAND} />
              <Small label='Сумма' value={fmt(lot.pricePerTon * lot.volumeTons)} />
              <Small label='Качество' value={lot.quality?.gostClass ? `кл. ${lot.quality.gostClass}` : '—'} />
              <Small label='Источник' value={lot.lotPassportId ? 'Паспорт партии' : 'manual'} />
            </Grid>
          </Card>
        );
      })}
    </div>
  );
}

function RfqTable() {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {SANDBOX_RFQS.map((rfq) => {
        const tone = rfqStatus(rfq.status);
        return (
          <Card key={rfq.id}>
            <TopLine id={rfq.id} tone={tone} />
            <div style={{ marginTop: 8, fontSize: 16, fontWeight: 900, color: T }}>{rfq.grain} · {rfq.volumeTons} т</div>
            <div style={{ marginTop: 6, fontSize: 13, color: M }}>{rfq.deliveryRegion} · {rfq.buyer.name}</div>
            <Grid>
              <Small label='Целевая цена' value={rfq.targetPricePerTon ? fmt(rfq.targetPricePerTon) : '—'} color={INFO} />
              <Small label='Оферты' value={String(rfq.offerIds.length)} />
              <Small label='Качество' value={rfq.qualityRequirements?.gostClass ? `кл. ${rfq.qualityRequirements.gostClass}` : '—'} />
              <Small label='Maturity' value={rfq.maturity} />
            </Grid>
          </Card>
        );
      })}
    </div>
  );
}

function OffersTable() {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {SANDBOX_OFFERS.map((offer) => {
        const tone = offerStatus(offer.status);
        const canAccept = canAcceptOffer(offer);
        return (
          <Card key={offer.id}>
            <TopLine id={offer.id} tone={tone} />
            <div style={{ marginTop: 8, fontSize: 16, fontWeight: 900, color: T }}>{offer.grain} · {offer.volumeTons} т</div>
            <div style={{ marginTop: 6, fontSize: 13, color: M }}>{offer.seller.name} · {offer.priceBasis}</div>
            <Grid>
              <Small label='Цена/т' value={fmt(offer.pricePerTon)} color={BRAND} />
              <Small label='Сумма' value={fmt(offer.pricePerTon * offer.volumeTons)} />
              <Small label='Можно принять' value={canAccept ? 'sandbox yes' : 'no'} color={canAccept ? BRAND : M} />
              <Small label='Тип' value={offer.type} />
            </Grid>
            {canAccept ? (
              <div style={{ marginTop: 10, background: WARN_BG, border: `1px solid ${WARN_BORDER}`, borderRadius: 10, padding: 10, fontSize: 12, color: WARN }}>
                Acceptance не создаёт сделку автоматически. Следующий шаг: проверка контрагента, документов, ФГИС и банкового резерва.
              </div>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}

function Metric({ label, value, note, color }: { label: string; value: string; note: string; color: string }) {
  return (
    <div style={{ background: S, border: `1px solid ${B}`, borderRadius: 16, padding: 16 }}>
      <div style={{ fontSize: 11, color: M, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 28, fontWeight: 900, color, lineHeight: 1.1 }}>{value}</div>
      <div style={{ marginTop: 6, fontSize: 12, color: M }}>{note}</div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <article style={{ background: SS, border: `1px solid ${B}`, borderRadius: 14, padding: 16 }}>{children}</article>;
}

function TopLine({ id, tone }: { id: string; tone: Tone }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 900, color: BRAND }}>{id}</span>
      <span style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 800, background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color }}>{tone.label}</span>
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 8, marginTop: 12 }}>{children}</div>;
}

function Small({ label, value, color = T }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: M, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 13, fontWeight: 800, color, wordBreak: 'break-word' }}>{value}</div>
    </div>
  );
}

function button(): React.CSSProperties {
  return { textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: SS, border: `1px solid ${B}`, color: T, fontSize: 13, fontWeight: 800 };
}
