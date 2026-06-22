import Link from 'next/link';

/**
 * Presentational view of the live deal workspace aggregate returned by
 * GET /api/deals/:id/workspace (PrismaDealRepository.workspace). Pure render of
 * real DB data — no fixtures. Rendered only when the deal exists in the backend.
 */

type WorkspaceDoc = { id?: string; type?: string; status?: string; bankRequired?: boolean; bankAcceptance?: string };
type WorkspaceEvent = { id?: string; action?: string; outcome?: string; actorRole?: string; createdAt?: string };
type LiveWorkspace = {
  id: string;
  status?: string;
  lotId?: string | null;
  sellerOrgId?: string;
  buyerOrgId?: string;
  culture?: string | null;
  region?: string | null;
  volumeTons?: number | null;
  totalRub?: number | null;
  owner?: string | null;
  nextAction?: string | null;
  documents?: WorkspaceDoc[];
  blockers?: string[];
  completeness?: { total: number; signed: number; bankRequired: number; bankAccepted: number; isComplete: boolean };
  moneyImpact?: { amountRub?: number | null; status?: string; holdAmountRub?: number };
  timeline?: { events?: WorkspaceEvent[] };
};

const border = 'var(--pc-border, #E4E6EA)';
const text = 'var(--pc-text-primary, #0F1419)';
const muted = 'var(--pc-text-secondary, #475569)';
const green = '#0A7A5F';
const red = '#B91C1C';
const greenBg = 'rgba(10,122,95,0.08)';
const redBg = 'rgba(220,38,38,0.08)';

function rub(value?: number | null): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value);
}

function fmtTime(iso?: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('ru-RU');
  } catch {
    return iso;
  }
}

export function LiveDealWorkspace({ ws }: { ws: LiveWorkspace }) {
  const blockers = ws.blockers ?? [];
  const documents = ws.documents ?? [];
  const events = ws.timeline?.events ?? [];
  const completeness = ws.completeness;
  const isClosed = ws.status === 'CLOSED';

  return (
    <main style={{ display: 'grid', gap: 16 }}>
      <section style={card()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: '#10B981', boxShadow: '0 0 0 3px rgba(16,185,129,0.18)' }} />
              <span style={{ color: green, fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Живые данные · из базы</span>
            </div>
            <h1 style={{ margin: '8px 0 0', fontSize: 28, color: text }}>{ws.id}{ws.lotId ? ` · ${ws.lotId}` : ''}</h1>
            <p style={{ margin: '6px 0 0', color: muted, fontSize: 14 }}>
              {[ws.culture, ws.volumeTons != null ? `${ws.volumeTons} т` : null].filter(Boolean).join(' · ') || '—'}
              {` · ${ws.sellerOrgId ?? '—'} → ${ws.buyerOrgId ?? '—'}`}
            </p>
          </div>
          <span style={{ borderRadius: 999, padding: '6px 12px', background: blockers.length ? redBg : greenBg, color: blockers.length ? red : green, fontSize: 12, fontWeight: 900 }}>
            {ws.status ?? '—'}
          </span>
        </div>
      </section>

      <section style={grid()}>
        <Cell label='Сумма сделки' value={rub(ws.moneyImpact?.amountRub ?? ws.totalRub)} accent />
        <Cell label='Удержание' value={rub(ws.moneyImpact?.holdAmountRub ?? 0)} danger={(ws.moneyImpact?.holdAmountRub ?? 0) > 0} />
        <Cell label='Платёж' value={ws.moneyImpact?.status ?? 'NONE'} />
        <Cell label='Документы' value={completeness ? `${completeness.bankAccepted}/${completeness.bankRequired} приняты банком` : '—'} accent={completeness?.isComplete} />
      </section>

      <section style={{ ...card(), background: blockers.length ? redBg : greenBg, borderColor: blockers.length ? 'rgba(220,38,38,0.18)' : 'rgba(10,122,95,0.18)' }}>
        <p style={{ margin: 0, color: blockers.length ? red : green, fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {blockers.length ? 'Блокеры' : 'Блокеров нет'}
        </p>
        {blockers.length ? (
          <ul style={{ margin: '10px 0 0', paddingLeft: 18, display: 'grid', gap: 6, color: text, fontSize: 13, lineHeight: 1.45 }}>
            {blockers.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        ) : (
          <p style={{ margin: '8px 0 0', color: text, fontSize: 13 }}>Условия закрыты. {ws.nextAction ?? ''}</p>
        )}
      </section>

      {documents.length > 0 && (
        <section style={card()}>
          <p style={micro}>Документы сделки</p>
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            {documents.map((doc, i) => {
              const blocks = !!doc.bankRequired && doc.bankAcceptance !== 'ACCEPTED';
              return (
                <div key={doc.id ?? i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center', border: `1px solid ${blocks ? 'rgba(220,38,38,0.18)' : border}`, background: blocks ? redBg : '#fff', borderRadius: 14, padding: '10px 12px' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: text, fontSize: 13, fontWeight: 900 }}>{doc.type ?? 'Документ'}</div>
                    <div style={{ color: muted, fontSize: 12 }}>{doc.status ?? '—'}</div>
                  </div>
                  <span style={{ flexShrink: 0, padding: '5px 10px', borderRadius: 999, fontSize: 12, fontWeight: 900, background: blocks ? redBg : greenBg, color: blocks ? red : green, border: `1px solid ${blocks ? 'rgba(220,38,38,0.18)' : 'rgba(10,122,95,0.18)'}` }}>
                    {doc.bankRequired ? (doc.bankAcceptance === 'ACCEPTED' ? 'принят банком' : 'ждёт банк') : 'не блокирует'}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {events.length > 0 && (
        <section style={card()}>
          <p style={micro}>Журнал событий · из базы</p>
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            {events.slice(0, 12).map((ev, i) => (
              <div key={ev.id ?? i} style={{ display: 'grid', gridTemplateColumns: '10px 1fr', gap: 12, alignItems: 'start' }}>
                <span style={{ width: 10, height: 10, borderRadius: 999, background: green, marginTop: 5 }} />
                <div style={{ border: `1px solid ${border}`, borderRadius: 12, padding: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <strong style={{ color: text, fontSize: 13 }}>{ev.action ?? 'событие'}</strong>
                    <span style={{ color: muted, fontSize: 11 }}>{fmtTime(ev.createdAt)}</span>
                  </div>
                  <div style={{ color: muted, fontSize: 12, marginTop: 4 }}>{[ev.actorRole, ev.outcome].filter(Boolean).join(' · ')}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/deals' style={linkStyle()}>Все сделки</Link>
        <Link href={`/platform-v7/deals/${ws.id}/documents`} style={linkStyle()}>Документы сделки</Link>
        {isClosed ? <Link href={`/platform-v7/deals/${ws.id}/close`} style={linkStyle('accent')}>Закрытие сделки</Link> : null}
      </section>
    </main>
  );
}

function Cell({ label, value, accent = false, danger = false }: { label: string; value: string; accent?: boolean; danger?: boolean }) {
  return (
    <div style={card()}>
      <p style={{ margin: 0, color: muted, fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
      <p style={{ margin: '6px 0 0', color: danger ? red : accent ? green : text, fontSize: 17, fontWeight: 900 }}>{value}</p>
    </div>
  );
}

function card(): React.CSSProperties {
  return { background: '#fff', border: `1px solid ${border}`, borderRadius: 18, padding: 20 };
}

function grid(): React.CSSProperties {
  return { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 };
}

function linkStyle(tone: 'default' | 'accent' = 'default'): React.CSSProperties {
  if (tone === 'accent') {
    return { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', color: '#fff', background: green, border: `1px solid ${green}`, borderRadius: 12, padding: '10px 14px', fontWeight: 900 };
  }
  return { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', color: green, border: `1px solid ${border}`, borderRadius: 12, padding: '10px 14px', fontWeight: 900, background: '#fff' };
}

export type { LiveWorkspace };
