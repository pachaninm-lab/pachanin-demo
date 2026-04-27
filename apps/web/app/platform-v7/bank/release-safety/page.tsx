import Link from 'next/link';
import { selectAllDeals } from '@/lib/domain/selectors';
import { formatCompactMoney } from '@/lib/v7r/helpers';

const S = 'var(--pc-bg-card)';
const SS = 'var(--pc-bg-elevated)';
const B = 'var(--pc-border)';
const T = 'var(--pc-text-primary)';
const M = 'var(--pc-text-secondary)';
const BRAND = '#0A7A5F';
const BRAND_BG = 'rgba(10,122,95,0.08)';
const BRAND_BORDER = 'rgba(10,122,95,0.18)';
const WARN = '#B45309';
const WARN_BG = 'rgba(217,119,6,0.08)';
const WARN_BORDER = 'rgba(217,119,6,0.18)';
const ERR = '#B91C1C';
const ERR_BG = 'rgba(220,38,38,0.08)';
const ERR_BORDER = 'rgba(220,38,38,0.18)';

function gateState(blocked: boolean) {
  return blocked
    ? { label: 'Блокирован', bg: ERR_BG, border: ERR_BORDER, color: ERR }
    : { label: 'Разрешён', bg: BRAND_BG, border: BRAND_BORDER, color: BRAND };
}

export default function BankReleaseSafetyPage() {
  const deals = selectAllDeals();
  const rows = deals.slice(0, 12).map((deal) => {
    const blocked = deal.blockers.length > 0 || deal.holdAmount > 0;
    return {
      id: deal.id,
      grain: deal.grain,
      reserved: deal.reservedAmount,
      hold: deal.holdAmount,
      release: deal.releaseAmount ?? Math.max(deal.reservedAmount - deal.holdAmount, 0),
      blockers: [...deal.blockers, ...(deal.holdAmount > 0 ? ['active-hold'] : [])],
      blocked,
    };
  });

  const blockedRows = rows.filter((row) => row.blocked);
  const releaseCandidate = rows.filter((row) => !row.blocked).reduce((sum, row) => sum + row.release, 0);
  const blockedMoney = blockedRows.reduce((sum, row) => sum + row.hold, 0);

  return (
    <div style={{ display: 'grid', gap: 18, padding: '8px 0' }}>
      <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, color: WARN, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Release safety · sandbox audit</div>
            <div style={{ marginTop: 6, fontSize: 26, lineHeight: 1.1, fontWeight: 900, color: T }}>Проверка безопасности выпуска денег</div>
            <div style={{ marginTop: 8, fontSize: 14, color: M, maxWidth: 860 }}>
              Страница показывает, почему выпуск денег не должен обходить блокеры, удержания и ручную проверку. Это audit-view, а не платёжный механизм.
            </div>
          </div>
          <Link href='/platform-v7/bank' style={btn()}>← Банк</Link>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
        <Metric label='Кандидат к выпуску' value={formatCompactMoney(releaseCandidate)} tone='good' />
        <Metric label='Под блоком' value={String(blockedRows.length)} tone={blockedRows.length > 0 ? 'bad' : 'good'} />
        <Metric label='Удержано' value={formatCompactMoney(blockedMoney)} tone={blockedMoney > 0 ? 'bad' : 'good'} />
      </div>

      <section style={{ background: WARN_BG, border: `1px solid ${WARN_BORDER}`, borderRadius: 14, padding: 14 }}>
        <div style={{ fontSize: 12, color: WARN, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Правило</div>
        <div style={{ marginTop: 6, fontSize: 13, color: T, lineHeight: 1.55 }}>
          Деньги нельзя выпускать напрямую из карточки сделки. Выпуск допустим только после закрытия gate-проверок и отсутствия активных удержаний.
        </div>
      </section>

      <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: T, marginBottom: 14 }}>Сделки и release gate</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {rows.map((row) => {
            const tone = gateState(row.blocked);
            return (
              <div key={row.id} style={{ background: SS, border: `1px solid ${B}`, borderRadius: 14, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div>
                    <Link href={`/platform-v7/deals/${row.id}`} style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 900, color: BRAND, textDecoration: 'none' }}>{row.id}</Link>
                    <span style={{ marginLeft: 8, fontSize: 13, color: M }}>{row.grain}</span>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 800, background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color }}>{tone.label}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginTop: 12 }}>
                  <Cell label='Резерв' value={formatCompactMoney(row.reserved)} />
                  <Cell label='Удержано' value={formatCompactMoney(row.hold)} danger={row.hold > 0} />
                  <Cell label='К выпуску' value={formatCompactMoney(row.release)} />
                  <Cell label='Блокеры' value={row.blockers.length ? row.blockers.join(', ') : '—'} danger={row.blockers.length > 0} />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: 'good' | 'bad' }) {
  return (
    <div style={{ background: tone === 'good' ? BRAND_BG : ERR_BG, border: `1px solid ${tone === 'good' ? BRAND_BORDER : ERR_BORDER}`, borderRadius: 16, padding: 16 }}>
      <div style={{ fontSize: 11, color: M, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 26, fontWeight: 900, color: tone === 'good' ? BRAND : ERR, lineHeight: 1.1 }}>{value}</div>
    </div>
  );
}

function Cell({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: M, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 13, fontWeight: 800, color: danger ? ERR : T, wordBreak: 'break-word' }}>{value}</div>
    </div>
  );
}

function btn() {
  return { textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: SS, border: `1px solid ${B}`, color: T, fontSize: 13, fontWeight: 800 };
}
