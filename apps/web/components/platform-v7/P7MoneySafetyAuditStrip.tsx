import { buildStableV7rMoneySafetyAuditRows } from '@/lib/v7r/money-audit-rows';
import type { P7MoneySafetyAuditRow } from '@/lib/platform-v7/money-safety-audit';

function toneToken(tone: P7MoneySafetyAuditRow['tone']) {
  if (tone === 'safe') {
    return {
      label: 'Можно выпускать',
      background: 'rgba(10,122,95,0.08)',
      border: 'rgba(10,122,95,0.18)',
      color: '#0A7A5F',
    };
  }

  if (tone === 'review') {
    return {
      label: 'Нужна сверка',
      background: 'rgba(217,119,6,0.08)',
      border: 'rgba(217,119,6,0.18)',
      color: '#B45309',
    };
  }

  return {
    label: 'Заблокировано',
    background: 'rgba(220,38,38,0.08)',
    border: 'rgba(220,38,38,0.18)',
    color: '#B91C1C',
  };
}

export function P7MoneySafetyAuditStrip() {
  const rows = buildStableV7rMoneySafetyAuditRows();

  return (
    <section
      data-testid="money-safety-audit-strip"
      style={{
        background: '#fff',
        border: '1px solid #E4E6EA',
        borderRadius: 18,
        padding: 18,
        display: 'grid',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 20, lineHeight: 1.2, fontWeight: 900, color: '#0F1419' }}>Money safety audit</div>
          <div style={{ marginTop: 8, maxWidth: 820, fontSize: 13, lineHeight: 1.65, color: '#5B6576' }}>
            E7 guard layer: выпуск денег решается через reserve, документы, bank callback, transport/FGIS gates, ledger и reconciliation. Источник строк — v7r money audit adapter.
          </div>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: 'rgba(15,20,25,0.04)', border: '1px solid #E4E6EA', color: '#475569', fontSize: 11, fontWeight: 900 }}>
          Data layer · no live money movement
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
        {rows.map((row) => {
          const token = toneToken(row.tone);

          return (
            <article
              key={row.dealId}
              data-testid={`money-safety-audit-row-${row.tone}`}
              style={{
                display: 'grid',
                gap: 10,
                padding: 14,
                borderRadius: 14,
                background: token.background,
                border: `1px solid ${token.border}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 900, color: '#0F1419' }}>{row.dealId}</div>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: '#fff', border: `1px solid ${token.border}`, color: token.color, fontSize: 11, fontWeight: 900 }}>
                  {token.label}
                </span>
              </div>

              <div style={{ fontSize: 14, lineHeight: 1.45, fontWeight: 900, color: '#0F1419' }}>{row.primaryLabel}</div>

              <div style={{ display: 'grid', gap: 6 }}>
                {row.reasonLabels.map((label) => (
                  <div key={label} style={{ fontSize: 12, lineHeight: 1.45, color: '#475569' }}>• {label}</div>
                ))}
              </div>

              <div style={{ display: 'grid', gap: 4, paddingTop: 4 }}>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 900, color: '#64748B' }}>Idempotency key</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, lineHeight: 1.5, color: '#334155', wordBreak: 'break-all' }}>{row.idempotencyKey}</div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
