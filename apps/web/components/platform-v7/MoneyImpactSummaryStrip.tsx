type MoneyPilotState = 'active' | 'waiting' | 'blocked' | 'partial';

type MoneyImpactSummaryProps = {
  amountContext: string;
  pilotState: MoneyPilotState;
  pilotStateLabel: string;
  responsible: string;
  nextStep: string;
  stopReason?: string;
};

const STATE_TONE: Record<MoneyPilotState, { bg: string; border: string; color: string }> = {
  active: { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' },
  waiting: { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' },
  blocked: { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)', color: '#B91C1C' },
  partial: { bg: 'rgba(37,99,235,0.08)', border: 'rgba(37,99,235,0.18)', color: '#1D4ED8' },
};

function Slot({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div data-testid={testId} style={{ marginTop: 3, fontSize: 13, fontWeight: 900, color: '#0F1419', lineHeight: 1.35 }}>{value}</div>
    </div>
  );
}

export function MoneyImpactSummaryStrip({
  amountContext,
  pilotState,
  pilotStateLabel,
  responsible,
  nextStep,
  stopReason,
}: MoneyImpactSummaryProps) {
  const tone = STATE_TONE[pilotState];

  return (
    <section
      data-testid="platform-v7-money-impact-strip"
      style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 16, padding: '12px 14px', display: 'grid', gap: 12 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ fontSize: 11, color: '#64748B', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          денежный контур сделки
        </div>
        <span
          data-testid="platform-v7-money-impact-state"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '4px 10px',
            borderRadius: 999,
            border: `1px solid ${tone.border}`,
            background: tone.bg,
            color: tone.color,
            fontSize: 11,
            fontWeight: 900,
          }}
        >
          {pilotStateLabel}
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fit, minmax(140px, 1fr))`,
          gap: '10px 16px',
        }}
      >
        <Slot label='сумма / контекст' value={amountContext} testId='platform-v7-money-impact-amount' />
        <Slot label='ответственный' value={responsible} testId='platform-v7-money-impact-responsible' />
        <Slot label='следующий шаг' value={nextStep} testId='platform-v7-money-impact-next' />
      </div>

      {stopReason && (
        <div
          data-testid="platform-v7-money-impact-stop"
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'flex-start',
            background: 'rgba(220,38,38,0.05)',
            border: '1px solid rgba(220,38,38,0.15)',
            borderRadius: 10,
            padding: '8px 10px',
          }}
        >
          <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', paddingTop: 1 }}>причина остановки</span>
          <span style={{ fontSize: 13, color: '#B91C1C', fontWeight: 850, lineHeight: 1.35 }}>{stopReason}</span>
        </div>
      )}
    </section>
  );
}
