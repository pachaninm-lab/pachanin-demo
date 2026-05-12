type MoneyPilotState = 'active' | 'waiting' | 'blocked' | 'partial';

type MoneyImpactSummaryProps = {
  amountContext: string;
  pilotState: MoneyPilotState;
  pilotStateLabel: string;
  responsible: string;
  nextStep: string;
  stopReason?: string;
  requiredEvidence?: string;
  afterResolved?: string;
  bankPlatformBoundary?: string;
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
      <div data-testid={testId} style={{ marginTop: 3, fontSize: 13, fontWeight: 900, color: '#0F1419', lineHeight: 1.35, overflowWrap: 'anywhere' }}>{value}</div>
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
  requiredEvidence,
  afterResolved,
  bankPlatformBoundary,
}: MoneyImpactSummaryProps) {
  const tone = STATE_TONE[pilotState];
  const needsBankFallback = responsible.toLowerCase().includes('банк') && pilotState === 'blocked';
  const resolvedRequiredEvidence = requiredEvidence ?? (needsBankFallback ? 'закрытые документы, приёмка, качество и решение по спорной части' : undefined);
  const resolvedAfterResolved = afterResolved ?? (needsBankFallback ? 'после закрытия условий банк получает основание для проверки выплаты по своим правилам' : undefined);
  const resolvedBankPlatformBoundary = bankPlatformBoundary ?? (needsBankFallback ? 'платформа показывает основание, причину остановки и журнал; банк подтверждает проверку денег' : undefined);
  const hasResolutionContext = Boolean(resolvedRequiredEvidence || resolvedAfterResolved || resolvedBankPlatformBoundary);

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
            lineHeight: 1.2,
            whiteSpace: 'normal',
          }}
        >
          {pilotStateLabel}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px 16px' }}>
        <Slot label='сумма / контекст' value={amountContext} testId='platform-v7-money-impact-amount' />
        <Slot label='ответственный' value={responsible} testId='platform-v7-money-impact-responsible' />
        <Slot label='следующий шаг' value={nextStep} testId='platform-v7-money-impact-next' />
      </div>

      {stopReason && (
        <div
          data-testid="platform-v7-money-impact-stop"
          style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, auto) minmax(0, 1fr)', gap: 8, alignItems: 'start', background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.15)', borderRadius: 10, padding: '8px 10px', minWidth: 0 }}
        >
          <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', paddingTop: 1 }}>причина остановки</span>
          <span style={{ fontSize: 13, color: '#B91C1C', fontWeight: 850, lineHeight: 1.35, overflowWrap: 'anywhere' }}>{stopReason}</span>
        </div>
      )}

      {hasResolutionContext && (
        <div
          data-testid="platform-v7-money-impact-resolution"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px 16px', background: '#F8FAFB', border: '1px solid #E4E6EA', borderRadius: 12, padding: '10px 12px' }}
        >
          {resolvedRequiredEvidence && <Slot label='какое основание нужно' value={resolvedRequiredEvidence} testId='platform-v7-money-impact-evidence' />}
          {resolvedAfterResolved && <Slot label='после закрытия причины' value={resolvedAfterResolved} testId='platform-v7-money-impact-after-resolved' />}
          {resolvedBankPlatformBoundary && <Slot label='банк / платформа' value={resolvedBankPlatformBoundary} testId='platform-v7-money-impact-bank-boundary' />}
        </div>
      )}
    </section>
  );
}
