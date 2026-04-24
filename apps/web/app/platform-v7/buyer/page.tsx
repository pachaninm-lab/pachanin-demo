'use client';

import * as React from 'react';
import Link from 'next/link';
import { useDeals } from '@/lib/domain/hooks';
import type { DomainDeal } from '@/lib/domain/types';
import { formatCompactMoney, statusLabel } from '@/lib/v7r/helpers';

const SURFACE = 'var(--pc-bg-card)';
const SURFACE_SOFT = 'var(--pc-bg-elevated)';
const BORDER = 'var(--pc-border)';
const TEXT = 'var(--pc-text-primary)';
const MUTED = 'var(--pc-text-secondary)';
const ACCENT = 'var(--pc-accent-strong)';
const ACCENT_BG = 'var(--pc-accent-bg)';
const ACCENT_BORDER = 'var(--pc-accent-border)';
const DANGER_BG = 'rgba(255,139,144,0.08)';
const DANGER_BORDER = 'rgba(255,139,144,0.18)';
const DANGER_TEXT = '#FF8B90';

type SortMode = 'price_low' | 'price_high' | 'quality' | 'region';
type CropFilter = 'all' | 'Пшеница 3 кл.' | 'Пшеница 4 кл.' | 'Кукуруза' | 'Ячмень';

const BUYER_NAMES = ['Агрохолдинг СК', 'ЗерноТрейд ООО', 'Экспортёр Юг', 'КомбикормЦентр'];
const CROP_FILTERS: { value: CropFilter; label: string }[] = [
  { value: 'all', label: 'Все культуры' },
  { value: 'Пшеница 3 кл.', label: 'Пшеница 3 кл.' },
  { value: 'Пшеница 4 кл.', label: 'Пшеница 4 кл.' },
  { value: 'Кукуруза', label: 'Кукуруза' },
  { value: 'Ячмень', label: 'Ячмень' },
];

const SORTS: { value: SortMode; label: string }[] = [
  { value: 'price_low', label: 'Цена: от низкой' },
  { value: 'price_high', label: 'Цена: от высокой' },
  { value: 'quality', label: 'По качеству' },
  { value: 'region', label: 'По региону' },
];

function dealPrice(deal: DomainDeal) {
  return deal.pricePerTon ?? (deal.quantity ? Math.round(deal.reservedAmount / deal.quantity) : deal.reservedAmount);
}

function cropMatches(grain: string, filter: CropFilter) {
  if (filter === 'all') return true;
  if (filter === 'Кукуруза') return grain.includes('Кукуруза');
  if (filter === 'Ячмень') return grain.includes('Ячмень');
  return grain.includes(filter);
}

export default function PlatformV7BuyerPage() {
  const [sortMode, setSortMode] = React.useState<SortMode>('price_low');
  const [cropFilter, setCropFilter] = React.useState<CropFilter>('all');
  const deals = useDeals();

  const buyerDeals = deals.filter((deal) => BUYER_NAMES.includes(deal.buyer.name));
  const totalReserved = buyerDeals.reduce((sum, deal) => sum + deal.reservedAmount, 0);
  const totalHold = buyerDeals.reduce((sum, deal) => sum + deal.holdAmount, 0);
  const releaseReady = buyerDeals.filter((deal) => deal.status === 'release_requested' || deal.status === 'docs_complete').reduce((sum, deal) => sum + (deal.releaseAmount ?? Math.max(deal.reservedAmount - deal.holdAmount, 0)), 0);
  const problemDeals = buyerDeals.filter((deal) => deal.holdAmount > 0 || deal.blockers.length > 0);
  const nextActionDeal = problemDeals[0] ?? buyerDeals[0];

  const visibleDeals = [...buyerDeals]
    .filter((deal) => cropMatches(deal.grain, cropFilter))
    .sort((a, b) => {
      if (sortMode === 'price_low') return dealPrice(a) - dealPrice(b);
      if (sortMode === 'price_high') return dealPrice(b) - dealPrice(a);
      if (sortMode === 'quality') return a.riskScore - b.riskScore;
      return `${a.seller.name}-${a.id}`.localeCompare(`${b.seller.name}-${b.id}`, 'ru');
    });

  return (
    <div style={{ display: 'grid', gap: 18, padding: '8px 0' }}>
      <section style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 12, color: MUTED, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Кабинет покупателя</div>
            <div style={{ fontSize: 30, lineHeight: 1.1, fontWeight: 900, color: TEXT, marginTop: 8 }}>Резерв, проблемы и ближайшее решение</div>
            <div style={{ marginTop: 8, fontSize: 14, color: MUTED, maxWidth: 860 }}>Первый экран покупателя должен отвечать на три вопроса: сколько денег стоит в резерве, что сейчас блокирует выпуск и какую сделку нужно открыть первой.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href='/platform-v7/deals' style={btn('primary')}>Открыть сделки</Link>
            <Link href='/platform-v7/bank' style={btn()}>Открыть банк</Link>
          </div>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
        <Metric title='В резерве' value={formatCompactMoney(totalReserved)} note='Деньги, уже заведённые в контур сделки.' />
        <Metric title='К выпуску' value={formatCompactMoney(releaseReady)} note='Сделки, которые ближе всего к выпуску.' tone='green' />
        <Metric title='Под удержанием' value={formatCompactMoney(totalHold)} note='Сумма под спором, проверкой или документами.' tone='red' />
        <Metric title='Проблемные сделки' value={String(problemDeals.length)} note='Требуют вашего решения прямо сейчас.' tone='red' />
      </div>

      {nextActionDeal ? (
        <section style={{ background: DANGER_BG, border: `1px solid ${DANGER_BORDER}`, borderRadius: 18, padding: 18 }}>
          <div style={{ fontSize: 12, color: DANGER_TEXT, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Главное действие</div>
          <div style={{ fontSize: 24, lineHeight: 1.15, fontWeight: 900, color: TEXT, marginTop: 8 }}>{nextActionDeal.id} · {nextActionDeal.grain}</div>
          <div style={{ marginTop: 8, fontSize: 13, color: MUTED }}>Статус: {statusLabel(nextActionDeal.status)} · Удержано: {formatCompactMoney(nextActionDeal.holdAmount)}</div>
          <div style={{ marginTop: 8, fontSize: 14, color: MUTED }}>{nextActionDeal.holdAmount > 0 ? 'Решите спор или недостающие документы, чтобы снять удержание и довести сделку до выпуска.' : nextActionDeal.blockers.length ? 'Уберите препятствия по сделке, чтобы перейти к следующему этапу.' : 'Откройте сделку и доведите её до банкового выпуска.'}</div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href={`/platform-v7/deals/${nextActionDeal.id}`} style={btn('primary')}>Открыть сделку</Link>
            <Link href='/platform-v7/bank' style={btn()}>Открыть банк</Link>
          </div>
        </section>
      ) : null}

      <section style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: TEXT }}>Ваши сделки</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>Фильтр и сортировка помогают быстро найти лучший следующий шаг.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <select value={cropFilter} onChange={(e) => setCropFilter(e.target.value as CropFilter)} style={selectStyle()}>
              {CROP_FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)} style={selectStyle()}>
              {SORTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          {visibleDeals.length === 0 ? (
            <div style={{ border: `1px solid ${BORDER}`, borderRadius: 16, padding: 16, background: SURFACE_SOFT, color: MUTED, fontSize: 13 }}>По выбранному фильтру сделок нет.</div>
          ) : visibleDeals.map((deal) => (
            <Link key={deal.id} href={`/platform-v7/deals/${deal.id}`} style={{ textDecoration: 'none', color: 'inherit', border: `1px solid ${BORDER}`, borderRadius: 16, padding: 16, background: SURFACE_SOFT, display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 800, color: ACCENT }}>{deal.id}</div>
                <div style={{ fontSize: 12, color: MUTED }}>{statusLabel(deal.status)}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: TEXT }}>{deal.grain} · {deal.quantity} {deal.unit}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
                <Cell label='Резерв' value={formatCompactMoney(deal.reservedAmount)} />
                <Cell label='Цена/т' value={formatCompactMoney(dealPrice(deal))} />
                <Cell label='Риск качества' value={`${deal.riskScore}/100`} danger={deal.riskScore >= 70} />
                <Cell label='Удержано' value={formatCompactMoney(deal.holdAmount)} danger={deal.holdAmount > 0} />
                <Cell label='Продавец' value={deal.seller.name} />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Metric({ title, value, note, tone = 'default' }: { title: string; value: string; note: string; tone?: 'default' | 'green' | 'red' }) {
  const palette = tone === 'green'
    ? { bg: ACCENT_BG, border: ACCENT_BORDER, value: ACCENT }
    : tone === 'red'
      ? { bg: DANGER_BG, border: DANGER_BORDER, value: DANGER_TEXT }
      : { bg: SURFACE, border: BORDER, value: TEXT };
  return (
    <section style={{ background: palette.bg, border: `1px solid ${palette.border}`, borderRadius: 18, padding: 18 }}>
      <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 28, lineHeight: 1.1, fontWeight: 900, color: palette.value }}>{value}</div>
      <div style={{ marginTop: 8, fontSize: 12, color: MUTED }}>{note}</div>
    </section>
  );
}

function Cell({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div style={{ border: `1px solid ${BORDER}`, borderRadius: 12, padding: 12, background: SURFACE }}>
      <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 14, fontWeight: 800, color: danger ? DANGER_TEXT : TEXT, wordBreak: 'break-word' }}>{value}</div>
    </div>
  );
}

function selectStyle(): React.CSSProperties {
  return {
    borderRadius: 10,
    padding: '9px 12px',
    border: `1px solid ${BORDER}`,
    background: SURFACE,
    color: TEXT,
    fontSize: 13,
    fontWeight: 700,
    minHeight: 40,
  };
}

function btn(kind: 'default' | 'primary' = 'default') {
  if (kind === 'primary') return { textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: ACCENT_BG, border: `1px solid ${ACCENT_BORDER}`, color: ACCENT, fontSize: 13, fontWeight: 700 };
  return { textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: SURFACE_SOFT, border: `1px solid ${BORDER}`, color: TEXT, fontSize: 13, fontWeight: 700 };
}
