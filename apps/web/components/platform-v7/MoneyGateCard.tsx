export type MoneyGateState = 'requested' | 'awaiting_bank' | 'reserved' | 'held' | 'ready' | 'released' | 'manual_review';

const labels: Record<MoneyGateState, string> = {
  requested: 'Запрошен',
  awaiting_bank: 'Ожидает банк',
  reserved: 'Резерв отмечен',
  held: 'Удержан',
  ready: 'Готово к проверке банка',
  released: 'Выплата по банковскому событию',
  manual_review: 'Ручная проверка',
};

const colors: Record<MoneyGateState, { bg: string; border: string; text: string }> = {
  requested:    { bg: 'rgba(180,83,9,0.05)',   border: 'rgba(180,83,9,0.18)',   text: '#B45309' },
  awaiting_bank:{ bg: 'rgba(180,83,9,0.05)',   border: 'rgba(180,83,9,0.18)',   text: '#B45309' },
  reserved:     { bg: 'rgba(10,122,95,0.06)',  border: 'rgba(10,122,95,0.18)',  text: '#0A7A5F' },
  held:         { bg: 'rgba(220,38,38,0.06)',  border: 'rgba(220,38,38,0.18)',  text: '#B91C1C' },
  ready:        { bg: 'rgba(10,122,95,0.06)',  border: 'rgba(10,122,95,0.18)',  text: '#0A7A5F' },
  released:     { bg: 'rgba(10,122,95,0.06)',  border: 'rgba(10,122,95,0.18)',  text: '#0A7A5F' },
  manual_review:{ bg: 'rgba(100,116,139,0.06)',border: 'rgba(100,116,139,0.18)',text: '#475569' },
};

type Props = {
  amount: string;
  state: MoneyGateState;
  note?: string;
  blockedBy?: string;
};

const bankControlledStates = new Set<MoneyGateState>(['reserved', 'ready', 'released']);

export function MoneyGateCard({ amount, state, note, blockedBy }: Props) {
  const c = colors[state];
  const requiresBankEvent = bankControlledStates.has(state);
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 14, padding: 14, display: 'grid', gap: 5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
        <span style={{ color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Деньги</span>
        <span style={{ color: c.text, fontSize: 11, fontWeight: 900, background: c.bg, border: `1px solid ${c.border}`, borderRadius: 999, padding: '3px 8px' }}>{labels[state]}</span>
      </div>
      <p style={{ margin: 0, color: '#0F1419', fontSize: 18, fontWeight: 950 }}>{amount}</p>
      {note && <p style={{ margin: 0, color: '#475569', fontSize: 12, lineHeight: 1.4 }}>{note}</p>}
      {requiresBankEvent && (
        <p style={{ margin: 0, color: '#475569', fontSize: 11, lineHeight: 1.4 }}>
          Денежный статус требует банковского события или ручной сверки.
        </p>
      )}
      {blockedBy && (
        <p style={{ margin: 0, color: '#B91C1C', fontSize: 12, lineHeight: 1.4 }}>
          Заблокировано: {blockedBy}
        </p>
      )}
    </div>
  );
}
