import { buildEvidencePackReadinessUiModel } from '@/lib/v7r/evidence-pack-ui';

const DISPUTE_IDS = ['DK-2024-89', 'DK-2024-91'];

function toneToken(tone: 'success' | 'warning' | 'danger' | 'neutral') {
  if (tone === 'success') return { label: 'Готов к разбору', background: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' };
  if (tone === 'warning') return { label: 'Нужна проверка', background: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' };
  if (tone === 'danger') return { label: 'Неполный пакет', background: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)', color: '#B91C1C' };
  return { label: 'Зафиксирован', background: '#F8FAFB', border: '#E4E6EA', color: '#475569' };
}

export function P7EvidenceReadinessAuditStrip() {
  const rows = DISPUTE_IDS.map((disputeId) => buildEvidencePackReadinessUiModel(disputeId));

  return (
    <section data-testid="evidence-readiness-audit-strip" style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 20, lineHeight: 1.2, fontWeight: 900, color: '#0F1419' }}>Evidence readiness audit</div>
          <div style={{ marginTop: 8, maxWidth: 820, fontSize: 13, lineHeight: 1.65, color: '#5B6576' }}>
            E9 guard layer: пакет доказательств проверяется как набор evidence objects, а не как ручной счётчик документов.
          </div>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: 'rgba(15,20,25,0.04)', border: '1px solid #E4E6EA', color: '#475569', fontSize: 11, fontWeight: 900 }}>
          Controlled pilot · no live upload
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
        {rows.map((row) => {
          const token = toneToken(row.statusTone);
          const rowKey = row.statusTone === 'success' ? 'ready' : 'incomplete';

          return (
            <article key={row.disputeId} data-testid={`evidence-readiness-audit-row-${rowKey}`} style={{ display: 'grid', gap: 10, padding: 14, borderRadius: 14, background: token.background, border: `1px solid ${token.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 900, color: '#0F1419' }}>{row.disputeId}</div>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: '#fff', border: `1px solid ${token.border}`, color: token.color, fontSize: 11, fontWeight: 900 }}>
                  {token.label}
                </span>
              </div>

              <div style={{ fontSize: 14, lineHeight: 1.45, fontWeight: 900, color: '#0F1419' }}>{row.scoreLabel} · {row.requiredLabel}</div>
              <div style={{ fontSize: 12, lineHeight: 1.45, color: '#475569' }}>{row.totalLabel}</div>

              <div style={{ display: 'grid', gap: 6 }}>
                {(row.blockers.length ? row.blockers : ['Нет blockers']).slice(0, 4).map((label) => (
                  <div key={label} style={{ fontSize: 12, lineHeight: 1.45, color: '#475569' }}>• {label}</div>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
