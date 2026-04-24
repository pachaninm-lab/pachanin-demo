import Link from 'next/link';
import { selectAllDeals } from '@/lib/domain/selectors';
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

export default function PlatformV7SellerPage() {
  const sellerDeals = selectAllDeals().filter((deal) => deal.seller.name === 'Агро-Юг ООО' || deal.seller.name === 'КФХ Мирный' || deal.seller.name === 'КФХ Петров' || deal.seller.name === 'АО СолнцеАгро');
  const totalExpected = sellerDeals.reduce((sum, deal) => sum + (deal.releaseAmount ?? Math.max(deal.reservedAmount - deal.holdAmount, 0)), 0);
  const totalHold = sellerDeals.reduce((sum, deal) => sum + deal.holdAmount, 0);
  const nextPayout = sellerDeals.filter((deal) => deal.status === 'release_requested' || deal.status === 'docs_complete').reduce((sum, deal) => sum + (deal.releaseAmount ?? Math.max(deal.reservedAmount - deal.holdAmount, 0)), 0);
  const blockedDeals = sellerDeals.filter((deal) => deal.holdAmount > 0 || deal.blockers.length > 0);
  const actionDeal = blockedDeals[0] ?? sellerDeals[0];

  return (
    <div style={{ display: 'grid', gap: 18, padding: '8px 0' }}>
      <section style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 12, color: MUTED, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Кабинет продавца</div>
            <div style={{ fontSize: 30, lineHeight: 1.1, fontWeight: 900, color: TEXT, marginTop: 8 }}>Деньги, сделки и ближайшее действие</div>
            <div style={{ marginTop: 8, fontSize: 14, color: MUTED, maxWidth: 860 }}>Первый экран продавца должен отвечать на три вопроса: сколько денег получите, что сейчас заблокировано и что нужно сделать прямо сейчас.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href='/platform-v7/lots/create' style={btn('primary')}>Создать лот</Link>
            <Link href='/platform-v7/deals' style={btn()}>Все сделки</Link>
          </div>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
        <Metric title='Получите' value={formatCompactMoney(totalExpected)} note='Общая сумма, которая должна прийти продавцу.' />
        <Metric title='Ближайшая выплата' value={formatCompactMoney(nextPayout)} note='Деньги, которые ближе всего к выпуску.' tone='green' />
        <Metric title='Удержано' value={formatCompactMoney(totalHold)} note='Сумма под спором, документами или проверкой.' tone='red' />
        <Metric title='Проблемные сделки' value={String(blockedDeals.length)} note='Требуют действия прямо сейчас.' tone='red' />
      </div>

      {actionDeal ? (
        <section style={{ background: DANGER_BG, border: `1px solid ${DANGER_BORDER}`, borderRadius: 18, padding: 18 }}>
          <div style={{ fontSize: 12, color: DANGER_TEXT, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Главное действие</div>
          <div style={{ fontSize: 24, lineHeight: 1.15, fontWeight: 900, color: TEXT, marginTop: 8 }}>{actionDeal.id} · {actionDeal.grain}</div>
          <div style={{ marginTop: 8, fontSize: 13, color: MUTED }}>Статус: {statusLabel(actionDeal.status)} · Удержано: {formatCompactMoney(actionDeal.holdAmount)}</div>
          <div style={{ marginTop: 8, fontSize: 14, color: MUTED }}>{actionDeal.holdAmount > 0 ? 'Закройте спор или недостающие документы, чтобы снять удержание.' : actionDeal.blockers.length ? 'Уберите блокеры, чтобы довести сделку до выпуска.' : 'Создайте новый лот или доведите текущую сделку до следующего этапа.'}</div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href={`/platform-v7/deals/${actionDeal.id}`} style={btn('primary')}>Открыть сделку</Link>
            <Link href='/platform-v7/lots/create' style={btn()}>Создать лот</Link>
          </div>
        </section>
      ) : null}

      <section style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: TEXT }}>Ваши сделки</div>
        <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
          {sellerDeals.map((deal) => (
            <Link key={deal.id} href={`/platform-v7/deals/${deal.id}`} style={{ textDecoration: 'none', color: 'inherit', border: `1px solid ${BORDER}`, borderRadius: 16, padding: 16, background: SURFACE_SOFT, display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 800, color: ACCENT }}>{deal.id}</div>
                <div style={{ fontSize: 12, color: MUTED }}>{statusLabel(deal.status)}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: TEXT }}>{deal.grain} · {deal.quantity} {deal.unit}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
                <Cell label='К выплате' value={formatCompactMoney(deal.releaseAmount ?? Math.max(deal.reservedAmount - deal.holdAmount, 0))} />
                <Cell label='Удержано' value={formatCompactMoney(deal.holdAmount)} danger={deal.holdAmount > 0} />
                <Cell label='Покупатель' value={deal.buyer.name} />
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

function btn(kind: 'default' | 'primary' = 'default') {
  if (kind === 'primary') return { textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: ACCENT_BG, border: `1px solid ${ACCENT_BORDER}`, color: ACCENT, fontSize: 13, fontWeight: 700 };
  return { textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: SURFACE_SOFT, border: `1px solid ${BORDER}`, color: TEXT, fontSize: 13, fontWeight: 700 };
}
