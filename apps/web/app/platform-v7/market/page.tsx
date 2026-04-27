'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  SANDBOX_MARKET_LOTS,
  SANDBOX_RFQS,
  SANDBOX_OFFERS,
  canAcceptOffer,
  type MarketLot,
} from '@/lib/platform-v7/fgis-lot-passport';
import { P7ActionButton, type P7ActionButtonState } from '@/components/platform-v7/P7ActionButton';

// ─── palette ────────────────────────────────────────────────────────────────
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

type GrainFilter = 'all' | 'Пшеница 3 кл.' | 'Пшеница 4 кл.' | 'Кукуруза 1 кл.' | 'Ячмень 2 кл.';
type SortMode = 'price_asc' | 'price_desc' | 'volume_desc' | 'newest';
type ViewMode = 'lots' | 'rfq' | 'offers';

const GRAIN_FILTERS: { value: GrainFilter; label: string }[] = [
  { value: 'all', label: 'Все культуры' },
  { value: 'Пшеница 3 кл.', label: 'Пшеница 3 кл.' },
  { value: 'Пшеница 4 кл.', label: 'Пшеница 4 кл.' },
  { value: 'Кукуруза 1 кл.', label: 'Кукуруза' },
  { value: 'Ячмень 2 кл.', label: 'Ячмень' },
];

const SORTS: { value: SortMode; label: string }[] = [
  { value: 'price_asc', label: 'Цена: от низкой' },
  { value: 'price_desc', label: 'Цена: от высокой' },
  { value: 'volume_desc', label: 'По объёму' },
  { value: 'newest', label: 'Сначала новые' },
];

const PRICE_TRENDS = [
  { title: '30 дней', values: ['13.9', '14.1', '14.2', '14.4', '14.5'] },
  { title: '90 дней', values: ['13.2', '13.5', '13.8', '14.1', '14.5'] },
  { title: '365 дней', values: ['11.8', '12.4', '13.1', '13.9', '14.5'] },
];

function fmt(n: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n);
}

function lotStatusTone(s: MarketLot['status']) {
  if (s === 'active') return { bg: BRAND_BG, border: BRAND_BORDER, color: BRAND, label: 'Активен' };
  if (s === 'reserved') return { bg: WARN_BG, border: WARN_BORDER, color: WARN, label: 'Зарезервирован' };
  if (s === 'sold') return { bg: SS, border: B, color: M, label: 'Продан' };
  if (s === 'cancelled') return { bg: ERR_BG, border: ERR_BORDER, color: ERR, label: 'Отменён' };
  return { bg: SS, border: B, color: M, label: s };
}

function selectStyle(): React.CSSProperties {
  return {
    borderRadius: 10,
    padding: '9px 12px',
    border: `1px solid ${B}`,
    background: S,
    color: T,
    fontSize: 13,
    fontWeight: 700,
    minHeight: 40,
  };
}

function tabBtn(active: boolean): React.CSSProperties {
  return {
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    padding: '12px 16px',
    fontSize: 13,
    fontWeight: 700,
    color: active ? BRAND : M,
    borderBottom: active ? `2px solid ${BRAND}` : '2px solid transparent',
    whiteSpace: 'nowrap',
  };
}

function btn(kind: 'primary' | 'default' = 'default'): React.CSSProperties {
  if (kind === 'primary') return { textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: BRAND_BG, border: `1px solid ${BRAND_BORDER}`, color: BRAND, fontSize: 13, fontWeight: 700 };
  return { textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: SS, border: `1px solid ${B}`, color: T, fontSize: 13, fontWeight: 700 };
}

function QualityTag({ label }: { label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: BRAND_BG, border: `1px solid ${BRAND_BORDER}`, color: BRAND }}>
      {label}
    </span>
  );
}

// ─── RFQ Create Form ─────────────────────────────────────────────────────────

function RFQCreateForm() {
  const [grain, setGrain] = React.useState('Пшеница 4 кл.');
  const [volume, setVolume] = React.useState('');
  const [price, setPrice] = React.useState('');
  const [region, setRegion] = React.useState('');
  const [submitState, setSubmitState] = React.useState<P7ActionButtonState>('idle');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!volume || !region) return;
    setSubmitState('loading');
    setTimeout(() => setSubmitState('success'), 1600);
    setTimeout(() => setSubmitState('idle'), 3800);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
        <div style={{ display: 'grid', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 800, color: M, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Культура</label>
          <select value={grain} onChange={(e) => setGrain(e.target.value)} style={selectStyle()}>
            {GRAIN_FILTERS.filter((g) => g.value !== 'all').map((g) => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'grid', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 800, color: M, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Объём, тонн</label>
          <input
            type='number'
            placeholder='300'
            value={volume}
            onChange={(e) => setVolume(e.target.value)}
            required
            style={{ ...selectStyle(), fontFamily: 'inherit' }}
          />
        </div>
        <div style={{ display: 'grid', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 800, color: M, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Целевая цена, ₽/т</label>
          <input
            type='number'
            placeholder='13000'
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            style={{ ...selectStyle(), fontFamily: 'inherit' }}
          />
        </div>
        <div style={{ display: 'grid', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 800, color: M, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Регион доставки</label>
          <input
            type='text'
            placeholder='Тамбовская'
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            required
            style={{ ...selectStyle(), fontFamily: 'inherit' }}
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <P7ActionButton
          type='submit'
          variant='primary'
          state={submitState}
          loadingLabel='Отправляем RFQ…'
          successLabel='RFQ создан ✓ — ожидайте предложений'
          errorLabel='Ошибка — попробуйте ещё раз'
        >
          Создать запрос (RFQ)
        </P7ActionButton>
        <span style={{ fontSize: 12, color: M }}>sandbox — реальных заявок не создаётся</span>
      </div>
    </form>
  );
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function MarketPage() {
  const [grain, setGrain] = React.useState<GrainFilter>('all');
  const [sort, setSort] = React.useState<SortMode>('price_asc');
  const [view, setView] = React.useState<ViewMode>('lots');
  const [acceptStates, setAcceptStates] = React.useState<Record<string, P7ActionButtonState>>({});

  function handleAcceptOffer(offerId: string) {
    setAcceptStates((s) => ({ ...s, [offerId]: 'loading' }));
    setTimeout(() => setAcceptStates((s) => ({ ...s, [offerId]: 'success' })), 1400);
    setTimeout(() => setAcceptStates((s) => ({ ...s, [offerId]: 'idle' })), 3400);
  }

  const filteredLots = [...SANDBOX_MARKET_LOTS]
    .filter((l) => grain === 'all' || l.grain === grain)
    .sort((a, b) => {
      if (sort === 'price_asc') return a.pricePerTon - b.pricePerTon;
      if (sort === 'price_desc') return b.pricePerTon - a.pricePerTon;
      if (sort === 'volume_desc') return b.volumeTons - a.volumeTons;
      return b.createdAt.localeCompare(a.createdAt);
    });

  const activeLots = SANDBOX_MARKET_LOTS.filter((l) => l.status === 'active').length;
  const openRfqs = SANDBOX_RFQS.filter((r) => r.status === 'open').length;
  const pendingOffers = SANDBOX_OFFERS.filter((o) => o.status === 'submitted' || o.status === 'under_review').length;

  return (
    <div style={{ display: 'grid', gap: 18, padding: '8px 0' }}>
      {/* Header */}
      <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, color: M, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Рынок · <span style={{ color: WARN }}>sandbox</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: T, marginTop: 8, lineHeight: 1.1 }}>Торговая площадка</div>
            <div style={{ marginTop: 8, fontSize: 14, color: M, maxWidth: 700 }}>
              Лоты — из ФГИС ЗЕРНО. Покупатель создаёт запрос (RFQ), сравнивает предложения и создаёт сделку.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href='/platform-v7/lots/create' style={btn('primary')}>Создать лот</Link>
            <Link href='/platform-v7/lots/compare' style={btn()}>Сравнить лоты</Link>
            <Link href='/platform-v7/procurement' style={btn()}>Мои закупки</Link>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14 }}>
        {[
          { label: 'Активных лотов', value: String(activeLots), color: BRAND },
          { label: 'Открытых RFQ', value: String(openRfqs), color: INFO },
          { label: 'Предложений', value: String(pendingOffers), color: WARN },
          { label: 'Объём, т', value: SANDBOX_MARKET_LOTS.filter((l) => l.status === 'active').reduce((s, l) => s + l.volumeTons, 0).toLocaleString('ru-RU'), color: T },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: S, border: `1px solid ${B}`, borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 11, color: M, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 900, color, marginTop: 8, lineHeight: 1.1 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Tabs: Лоты / RFQ / Предложения */}
      <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: `1px solid ${B}`, padding: '0 16px', overflowX: 'auto' }}>
          <button style={tabBtn(view === 'lots')} onClick={() => setView('lots')}>Лоты ({activeLots})</button>
          <button style={tabBtn(view === 'rfq')} onClick={() => setView('rfq')}>RFQ ({openRfqs})</button>
          <button style={tabBtn(view === 'offers')} onClick={() => setView('offers')}>Предложения ({pendingOffers})</button>
        </div>

        <div style={{ padding: 18 }}>
          {view === 'lots' && (
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <select value={grain} onChange={(e) => setGrain(e.target.value as GrainFilter)} style={selectStyle()}>
                  {GRAIN_FILTERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
                <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)} style={selectStyle()}>
                  {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <span style={{ fontSize: 12, color: M }}>{filteredLots.length} лот{filteredLots.length !== 1 ? 'ов' : ''}</span>
              </div>

              <div style={{ display: 'grid', gap: 12 }}>
                {filteredLots.map((lot) => {
                  const tone = lotStatusTone(lot.status);
                  return (
                    <div key={lot.id} style={{ background: SS, border: `1px solid ${B}`, borderRadius: 14, padding: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 13, color: BRAND }}>{lot.id}</span>
                          <span style={{ marginLeft: 8, fontSize: 12, color: M }}>· {lot.seller.name}</span>
                          {lot.lotPassportId && <span style={{ marginLeft: 8, fontSize: 11, color: BRAND }}>ФГИС ✓</span>}
                        </div>
                        <span style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color }}>
                          {tone.label}
                        </span>
                      </div>
                      <div style={{ marginTop: 10, fontSize: 18, fontWeight: 900, color: T }}>
                        {lot.grain} · {lot.volumeTons.toLocaleString('ru-RU')} т
                      </div>
                      <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
                        <span style={{ fontSize: 22, fontWeight: 900, color: BRAND }}>
                          {fmt(lot.pricePerTon)}<span style={{ fontSize: 12, fontWeight: 700, color: M }}>/т</span>
                        </span>
                        <span style={{ fontSize: 13, color: M }}>{lot.priceBasis} · {lot.region}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: T }}>{fmt(lot.pricePerTon * lot.volumeTons)} итого</span>
                      </div>
                      {lot.quality && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                          {lot.quality.gostClass && <QualityTag label={`ГОСТ ${lot.quality.gostClass} кл.`} />}
                          {lot.quality.protein && <QualityTag label={`Белок ${lot.quality.protein}%`} />}
                          {lot.quality.moisture && <QualityTag label={`Влажность ${lot.quality.moisture}%`} />}
                          {lot.quality.natweight && <QualityTag label={`Нат. вес ${lot.quality.natweight} г/л`} />}
                          {lot.quality.fallingNumber && <QualityTag label={`ЧП ${lot.quality.fallingNumber}`} />}
                        </div>
                      )}
                      {lot.status === 'active' && (
                        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <Link
                            href={`/platform-v7/market/rfq?lot=${lot.id}&grain=${encodeURIComponent(lot.grain)}`}
                            style={{ display: 'inline-flex', alignItems: 'center', fontSize: 13, fontWeight: 700, color: BRAND, textDecoration: 'none', padding: '8px 14px', background: BRAND_BG, border: `1px solid ${BRAND_BORDER}`, borderRadius: 10 }}
                          >
                            Создать RFQ по лоту
                          </Link>
                          <Link
                            href='/platform-v7/lots/compare'
                            style={{ display: 'inline-flex', alignItems: 'center', fontSize: 13, fontWeight: 700, color: T, textDecoration: 'none', padding: '8px 14px', background: SS, border: `1px solid ${B}`, borderRadius: 10 }}
                          >
                            Сравнить
                          </Link>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {view === 'rfq' && (
            <div style={{ display: 'grid', gap: 16 }}>
              <div style={{ background: INFO_BG, border: `1px solid ${INFO_BORDER}`, borderRadius: 14, padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: INFO, marginBottom: 12 }}>Создать новый запрос (RFQ)</div>
                <RFQCreateForm />
              </div>
              <div style={{ fontSize: 12, fontWeight: 800, color: M, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Открытые запросы ({SANDBOX_RFQS.length})
              </div>
              {SANDBOX_RFQS.map((rfq) => (
                <div key={rfq.id} style={{ background: SS, border: `1px solid ${B}`, borderRadius: 14, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 13, color: INFO }}>{rfq.id}</span>
                    <span style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: BRAND_BG, border: `1px solid ${BRAND_BORDER}`, color: BRAND }}>
                      {rfq.status === 'open' ? 'Открыт' : rfq.status}
                    </span>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 16, fontWeight: 800, color: T }}>{rfq.grain} · {rfq.volumeTons} т</div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 6, flexWrap: 'wrap', fontSize: 13, color: M }}>
                    <span>Покупатель: {rfq.buyer.name}</span>
                    <span>Регион: {rfq.deliveryRegion}</span>
                    {rfq.targetPricePerTon && <span>Цель: {fmt(rfq.targetPricePerTon)}/т</span>}
                    <span>Предложений: {rfq.offerIds.length}</span>
                  </div>
                  {rfq.qualityRequirements && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                      {rfq.qualityRequirements.gostClass && <QualityTag label={`ГОСТ ${rfq.qualityRequirements.gostClass} кл.`} />}
                      {rfq.qualityRequirements.protein && <QualityTag label={`Белок ≥${rfq.qualityRequirements.protein}%`} />}
                      {rfq.qualityRequirements.moisture && <QualityTag label={`Влажность ≤${rfq.qualityRequirements.moisture}%`} />}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {view === 'offers' && (
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ fontSize: 13, color: M }}>
                Принятие предложения создаёт черновик сделки. Все данные — sandbox, реальных транзакций нет.
              </div>
              {SANDBOX_OFFERS.map((offer) => {
                const canAccept = canAcceptOffer(offer);
                const acceptState: P7ActionButtonState = acceptStates[offer.id] ?? 'idle';
                const statusBg = offer.status === 'submitted' ? INFO_BG : offer.status === 'under_review' ? WARN_BG : offer.status === 'accepted' ? BRAND_BG : SS;
                const statusBorder = offer.status === 'submitted' ? INFO_BORDER : offer.status === 'under_review' ? WARN_BORDER : offer.status === 'accepted' ? BRAND_BORDER : B;
                const statusColor = offer.status === 'submitted' ? INFO : offer.status === 'under_review' ? WARN : offer.status === 'accepted' ? BRAND : M;
                const statusLabel = offer.status === 'submitted' ? 'Отправлено' : offer.status === 'under_review' ? 'На проверке' : offer.status === 'accepted' ? 'Принято' : offer.status;
                return (
                  <div key={offer.id} style={{ background: SS, border: `1px solid ${B}`, borderRadius: 14, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 13, color: BRAND }}>{offer.id}</span>
                        <span style={{ marginLeft: 8, fontSize: 12, color: M }}>
                          {offer.type === 'rfq_response' ? `→ ${offer.rfqId}` : '→ Buy Now'}
                        </span>
                      </div>
                      <span style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: statusBg, border: `1px solid ${statusBorder}`, color: statusColor }}>
                        {statusLabel}
                      </span>
                    </div>
                    <div style={{ marginTop: 8, fontSize: 16, fontWeight: 800, color: T }}>{offer.grain} · {offer.volumeTons} т</div>
                    <div style={{ display: 'flex', gap: 16, marginTop: 6, flexWrap: 'wrap', alignItems: 'baseline' }}>
                      <span style={{ fontWeight: 900, color: BRAND, fontSize: 20 }}>
                        {fmt(offer.pricePerTon)}<span style={{ fontSize: 12, fontWeight: 400, color: M }}>/т</span>
                      </span>
                      <span style={{ fontSize: 13, color: M }}>{offer.priceBasis} · {offer.seller.name}</span>
                    </div>
                    {offer.quality && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                        {offer.quality.gostClass && <QualityTag label={`ГОСТ ${offer.quality.gostClass} кл.`} />}
                        {offer.quality.protein && <QualityTag label={`Белок ${offer.quality.protein}%`} />}
                        {offer.quality.moisture && <QualityTag label={`Влажность ${offer.quality.moisture}%`} />}
                      </div>
                    )}
                    {canAccept && (
                      <div style={{ marginTop: 12 }}>
                        <P7ActionButton
                          variant='primary'
                          state={acceptState}
                          loadingLabel='Принимаем предложение…'
                          successLabel='Черновик сделки создан ✓'
                          errorLabel='Ошибка'
                          onClick={() => handleAcceptOffer(offer.id)}
                        >
                          Принять → создать черновик сделки
                        </P7ActionButton>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Price trends (kept from original page) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 14 }}>
        {PRICE_TRENDS.map((trend) => (
          <section key={trend.title} style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18, display: 'grid', gap: 10 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: T }}>{trend.title}</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 100 }}>
              {trend.values.map((v, i) => (
                <div key={i} style={{ flex: 1, display: 'grid', alignItems: 'end', gap: 4 }}>
                  <div style={{ height: `${Number(v) * 6}px`, borderRadius: 8, background: `linear-gradient(180deg, rgba(10,122,95,0.75), rgba(10,122,95,0.18))`, minHeight: 24 }} />
                  <div style={{ fontSize: 10, color: M, textAlign: 'center' }}>{v}</div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
