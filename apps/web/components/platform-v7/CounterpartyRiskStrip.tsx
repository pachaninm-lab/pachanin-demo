import {
  COUNTERPARTY_RISK_LEVEL_LABEL,
  getCounterpartyRiskSignals,
  getOverallRiskLevel,
  type CounterpartyRiskContext,
  type CounterpartyRiskLevel,
} from '@/lib/platform-v7/counterparty-risk';

function riskTone(level: CounterpartyRiskLevel) {
  if (level === 'low') return { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' };
  if (level === 'elevated') return { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)', color: '#B91C1C' };
  return { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' };
}

const CONTEXT_LABEL: Record<CounterpartyRiskContext, string> = {
  seller: 'продавец',
  buyer: 'покупатель',
  bank: 'банк · обе стороны',
};

export function CounterpartyRiskStrip({ context }: { context: CounterpartyRiskContext }) {
  const signals = getCounterpartyRiskSignals(context);
  const overallLevel = getOverallRiskLevel(context);
  const overallTone = riskTone(overallLevel);

  return (
    <section
      data-testid="platform-v7-counterparty-risk-strip"
      style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 16, display: 'grid', gap: 12 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 11, color: '#64748B', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            пилотный контур · сигналы надёжности контрагента
          </div>
          <div style={{ marginTop: 4, fontSize: 15, fontWeight: 950, color: '#0F1419', lineHeight: 1.2 }}>
            Сигналы надёжности — {CONTEXT_LABEL[context]}
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: '#64748B', lineHeight: 1.35 }}>
            Пилотный контур · не является боевым скорингом. Требует реальной интеграции перед live-исполнением.
          </div>
        </div>
        <span
          data-testid="platform-v7-counterparty-risk-strip-overall"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '5px 10px',
            borderRadius: 999,
            border: `1px solid ${overallTone.border}`,
            background: overallTone.bg,
            color: overallTone.color,
            fontSize: 11,
            fontWeight: 900,
          }}
        >
          {COUNTERPARTY_RISK_LEVEL_LABEL[overallLevel]}
        </span>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {signals.map((signal) => {
          const tone = riskTone(signal.riskLevel);
          return (
            <div
              key={signal.party}
              data-testid="platform-v7-counterparty-risk-strip-row"
              style={{
                background: '#F8FAFB',
                border: '1px solid #EEF1F4',
                borderRadius: 12,
                padding: '10px 12px',
                display: 'grid',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#0F1419' }}>{signal.partyLabel}</div>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '3px 8px',
                    borderRadius: 999,
                    background: tone.bg,
                    border: `1px solid ${tone.border}`,
                    color: tone.color,
                    fontSize: 11,
                    fontWeight: 900,
                  }}
                >
                  {COUNTERPARTY_RISK_LEVEL_LABEL[signal.riskLevel]}
                </span>
              </div>

              <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.4 }}>{signal.reason}</div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 6 }}>
                <EffectCell label='необходимая проверка' value={signal.requiredCheck} />
                {signal.effectOnPayment ? <EffectCell label='влияние на выплату' value={signal.effectOnPayment} /> : null}
                {signal.effectOnLogistics ? <EffectCell label='влияние на логистику' value={signal.effectOnLogistics} /> : null}
                {signal.effectOnDocuments ? <EffectCell label='влияние на документы' value={signal.effectOnDocuments} /> : null}
              </div>

              <div style={{ fontSize: 12, color: '#0A7A5F', fontWeight: 900, lineHeight: 1.35 }}>
                <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 2 }}>
                  следующее безопасное действие
                </span>
                {signal.nextSafeAction}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function EffectCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>
        {label}
      </span>
      <div style={{ marginTop: 2, fontSize: 12, color: '#475569', lineHeight: 1.35 }}>{value}</div>
    </div>
  );
}
