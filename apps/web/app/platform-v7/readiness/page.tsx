import Link from 'next/link';
import { P7ExecutionMachineReadOnlyStrip } from '@/components/platform-v7/P7ExecutionMachineReadOnlyStrip';
import { selectAllDeals } from '@/lib/domain/selectors';
import { formatCompactMoney, statusLabel } from '@/lib/v7r/helpers';
import {
  PLATFORM_V7_BANK_ROUTE,
  PLATFORM_V7_CONTROL_TOWER_ROUTE,
  PLATFORM_V7_DEALS_ROUTE,
  PLATFORM_V7_RELEASE_SAFETY_ROUTE,
} from '@/lib/platform-v7/routes';
import {
  PLATFORM_V7_EXECUTION_SOURCE,
  canRequestMoneyRelease,
  executionBlockers,
  executionReadinessScore,
  formatRub,
  formatTons,
} from '@/lib/platform-v7/deal-execution-source-of-truth';

const S = 'var(--pc-bg-card)';
const SS = 'var(--pc-bg-elevated)';
const B = 'var(--pc-border)';
const T = 'var(--pc-text-primary)';
const M = 'var(--pc-text-secondary)';
const BRAND = '#0A7A5F';
const WARN = '#B45309';
const ERR = '#B91C1C';

type Deal = ReturnType<typeof selectAllDeals>[number];
type Gate = { label: string; ready: boolean; note: string };

function hasBlocker(deal: Deal, words: string[]) {
  const text = deal.blockers.join(' ').toLowerCase();
  return words.some((word) => text.includes(word));
}

function gatesForDeal(deal: Deal): Gate[] {
  const blocked = deal.blockers.length > 0 || deal.holdAmount > 0;
  const docsReady = ['docs_complete', 'release_requested', 'released', 'closed'].includes(deal.status);
  const moneyReady = !blocked && (deal.releaseAmount ?? 0) > 0;

  return [
    { label: 'ФГИС', ready: !hasBlocker(deal, ['fgis', 'фгис']), note: 'Партия и базовые данные' },
    { label: 'Документы', ready: docsReady, note: 'Пакет и подписи' },
    { label: 'Логистика', ready: !hasBlocker(deal, ['transport', 'logistics', 'логистика', 'перевозка']), note: 'Перевозка и приёмка' },
    { label: 'Банк', ready: moneyReady, note: 'Удержания и выпуск' },
    { label: 'Спор', ready: deal.holdAmount === 0, note: 'Нет активного удержания' },
  ];
}

export default function PlatformV7ReadinessPage() {
  const deals = selectAllDeals().slice(0, 14);
  const rows = deals.map((deal) => {
    const gates = gatesForDeal(deal);
    const readyCount = gates.filter((gate) => gate.ready).length;
    const score = Math.round((readyCount / gates.length) * 100);
    return { deal, gates, score, blocked: deal.blockers.length > 0 || deal.holdAmount > 0 };
  });

  const readyToRelease = rows.filter((row) => row.score === 100).length;
  const blocked = rows.filter((row) => row.blocked).length;
  const hold = rows.reduce((sum, row) => sum + row.deal.holdAmount, 0);

  return (
    <div data-testid="platform-v7-readiness-page" style={{ display: 'grid', gap: 18, padding: '8px 0' }}>
      <style>{`
        @media(max-width:767px){
          [data-testid='platform-v7-readiness-page']{gap:10px!important;padding:0!important}
          [data-testid='platform-v7-readiness-hero']{padding:16px!important;border-radius:24px!important}
          [data-testid='platform-v7-readiness-hero'] > div{display:grid!important;gap:10px!important}
          [data-testid='platform-v7-readiness-hero'] > div > div:first-child > div:nth-child(2){font-size:clamp(24px,7vw,34px)!important;line-height:1.06!important}
          [data-testid='platform-v7-readiness-hero'] > div > div:first-child > div:nth-child(3){display:none!important}
          [data-testid='platform-v7-readiness-hero'] a{width:100%!important;min-height:54px!important;display:flex!important;align-items:center!important;justify-content:center!important;border-radius:16px!important}
          [data-testid='platform-v7-readiness-hero'] a:nth-of-type(2){display:none!important}
          [data-testid='platform-v7-readiness-metrics']{grid-template-columns:1fr 1fr!important;gap:8px!important}
          [data-testid='platform-v7-readiness-metrics'] > div{padding:12px!important;border-radius:16px!important}
          [data-testid='platform-v7-readiness-metrics'] > div:nth-child(3){display:none!important}
          [data-testid='platform-v7-readiness-demo']{padding:14px!important;border-radius:20px!important;gap:10px!important}
          [data-testid='platform-v7-readiness-demo'] > div:nth-child(2){grid-template-columns:1fr 1fr!important;gap:7px!important}
          [data-testid='platform-v7-readiness-demo'] > div:nth-child(2) > div:nth-child(n+5){display:none!important}
          [data-testid='platform-v7-readiness-demo'] > div:nth-child(3){gap:8px!important;font-size:11px!important}
          [data-testid='platform-v7-readiness-list']{padding:14px!important;border-radius:20px!important;gap:9px!important}
          [data-testid='platform-v7-readiness-list'] > div:nth-of-type(n+5){display:none!important}
          [data-testid='platform-v7-readiness-list'] > div:not(:first-child){padding:12px!important;border-radius:16px!important;gap:8px!important}
          [data-testid='platform-v7-readiness-list'] > div:not(:first-child) > div:nth-child(2){grid-template-columns:1fr 1fr!important;gap:7px!important}
          [data-testid='platform-v7-readiness-list'] > div:not(:first-child) > div:nth-child(2) > div:nth-child(n+4){display:none!important}
          [data-testid='platform-v7-readiness-list'] > div:not(:first-child) > div:nth-child(3){font-size:11px!important;line-height:1.35!important}
        }
      `}</style>
      <section data-testid="platform-v7-readiness-hero" style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, color: BRAND, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Матрица готовности · песочница</div>
            <div style={{ marginTop: 6, fontSize: 28, lineHeight: 1.1, fontWeight: 900, color: T }}>Готовность сделки к исполнению и выпуску денег</div>
            <div style={{ marginTop: 8, fontSize: 14, color: M, maxWidth: 900 }}>
              Один экран показывает, где сделка застряла: ФГИС, документы, логистика, банк или спор. Это не платёжный механизм, а проверочная панель оператора.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href={PLATFORM_V7_CONTROL_TOWER_ROUTE} style={btn()}>Центр управления</Link>
            <Link href={PLATFORM_V7_RELEASE_SAFETY_ROUTE} style={btn()}>Проверка денег</Link>
          </div>
        </div>
      </section>

      <P7ExecutionMachineReadOnlyStrip />

      <div data-testid="platform-v7-readiness-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12 }}>
        <Metric label='Готовы полностью' value={String(readyToRelease)} tone='good' />
        <Metric label='С блокерами' value={String(blocked)} tone={blocked > 0 ? 'bad' : 'good'} />
        <Metric label='Под удержанием' value={formatCompactMoney(hold)} tone={hold > 0 ? 'bad' : 'good'} />
      </div>

      <DL9102ReadinessCard />

      <section data-testid="platform-v7-readiness-list" style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: T }}>Сделки по готовности</div>
        {rows.map(({ deal, gates, score, blocked: isBlocked }) => (
          <div key={deal.id} style={{ background: SS, border: `1px solid ${B}`, borderRadius: 14, padding: 14, display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <Link href={`${PLATFORM_V7_DEALS_ROUTE}/${deal.id}`} style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 900, color: BRAND, textDecoration: 'none' }}>{deal.id}</Link>
                <span style={{ marginLeft: 8, fontSize: 13, color: M }}>{deal.grain} · {statusLabel(deal.status)}</span>
              </div>
              <span style={{ padding: '5px 10px', borderRadius: 999, background: isBlocked ? 'rgba(220,38,38,0.08)' : 'rgba(10,122,95,0.08)', border: `1px solid ${isBlocked ? 'rgba(220,38,38,0.18)' : 'rgba(10,122,95,0.18)'}`, color: isBlocked ? ERR : BRAND, fontSize: 12, fontWeight: 900 }}>
                {score}% готово
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8 }}>
              {gates.map((gate) => (
                <div key={gate.label} style={{ border: `1px solid ${gate.ready ? 'rgba(10,122,95,0.18)' : 'rgba(217,119,6,0.18)'}`, background: gate.ready ? 'rgba(10,122,95,0.06)' : 'rgba(217,119,6,0.08)', borderRadius: 12, padding: 10 }}>
                  <div style={{ fontSize: 12, color: gate.ready ? BRAND : WARN, fontWeight: 900 }}>{gate.ready ? 'Готово' : 'Проверить'}</div>
                  <div style={{ marginTop: 4, fontSize: 13, color: T, fontWeight: 900 }}>{gate.label}</div>
                  <div style={{ marginTop: 3, fontSize: 11, color: M }}>{gate.note}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: M }}>
              Резерв: <b style={{ color: T }}>{formatCompactMoney(deal.reservedAmount)}</b> · Удержано: <b style={{ color: deal.holdAmount > 0 ? ERR : T }}>{formatCompactMoney(deal.holdAmount)}</b> · Блокеры: <b style={{ color: deal.blockers.length ? ERR : T }}>{deal.blockers.length ? deal.blockers.join(', ') : '—'}</b>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function DL9102ReadinessCard() {
  const { deal, readiness, money } = PLATFORM_V7_EXECUTION_SOURCE;
  const score = executionReadinessScore();
  const blockers = executionBlockers();
  const canRelease = canRequestMoneyRelease();

  const gateLabels: Record<string, string> = {
    fgis: 'ФГИС', quality: 'Качество', logistics: 'Логистика',
    documents: 'Документы', bank: 'Банк', dispute: 'Спор', antiBypass: 'Антиобход',
  };
  const gates = Object.entries(readiness) as [string, typeof readiness.fgis][];

  return (
    <section data-testid="platform-v7-readiness-demo" style={{ background: S, border: `1px solid ${BRAND}`, borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, color: BRAND, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Демо-сделка · {deal.maturity}</div>
          <div style={{ marginTop: 4, fontSize: 20, fontWeight: 900, color: T }}>{deal.id} · {deal.lotId} · {deal.crop}</div>
          <div style={{ marginTop: 4, fontSize: 13, color: M }}>{deal.fgisPartyId} · {formatTons(deal.volumeTons)} · {deal.basis}</div>
        </div>
        <span style={{ padding: '6px 12px', borderRadius: 999, background: score === 100 ? 'rgba(10,122,95,0.08)' : 'rgba(217,119,6,0.08)', border: `1px solid ${score === 100 ? 'rgba(10,122,95,0.18)' : 'rgba(217,119,6,0.18)'}`, color: score === 100 ? BRAND : WARN, fontSize: 14, fontWeight: 900 }}>{score}% готово</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8 }}>
        {gates.map(([key, gate]) => (
          <div key={key} style={{ border: `1px solid ${gate.status === 'готово' ? 'rgba(10,122,95,0.18)' : gate.status === 'стоп' ? 'rgba(220,38,38,0.18)' : 'rgba(217,119,6,0.18)'}`, background: gate.status === 'готово' ? 'rgba(10,122,95,0.06)' : gate.status === 'стоп' ? 'rgba(220,38,38,0.06)' : 'rgba(217,119,6,0.06)', borderRadius: 12, padding: 10 }}>
            <div style={{ fontSize: 11, color: gate.status === 'готово' ? BRAND : gate.status === 'стоп' ? ERR : WARN, fontWeight: 900 }}>{gate.status}</div>
            <div style={{ marginTop: 3, fontSize: 13, color: T, fontWeight: 900 }}>{gateLabels[key] ?? key}</div>
            <div style={{ marginTop: 3, fontSize: 11, color: M, lineHeight: 1.4 }}>{gate.note}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: M }}>
        <span>Резерв: <b style={{ color: T }}>{formatRub(money.reservedRub)}</b></span>
        <span>Удержано: <b style={{ color: money.holdRub > 0 ? ERR : T }}>{formatRub(money.holdRub)}</b></span>
        <span>Выпуск: <b style={{ color: canRelease ? BRAND : ERR }}>{canRelease ? 'возможен' : 'заблокирован'}</b></span>
        {blockers.length > 0 && <span>Блокеры: <b style={{ color: WARN }}>{blockers.join(' · ')}</b></span>}
      </div>
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: 'good' | 'bad' }) {
  return (
    <div style={{ background: tone === 'good' ? 'rgba(10,122,95,0.08)' : 'rgba(220,38,38,0.08)', border: `1px solid ${tone === 'good' ? 'rgba(10,122,95,0.18)' : 'rgba(220,38,38,0.18)'}`, borderRadius: 16, padding: 16 }}>
      <div style={{ fontSize: 11, color: M, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 26, fontWeight: 900, color: tone === 'good' ? BRAND : ERR, lineHeight: 1.1 }}>{value}</div>
    </div>
  );
}

function btn() {
  return { textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: SS, border: `1px solid ${B}`, color: T, fontSize: 13, fontWeight: 800 };
}
