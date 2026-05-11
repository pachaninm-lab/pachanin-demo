export type DocumentGateState = 'missing' | 'attached' | 'under_review' | 'accepted' | 'blocked';

const labels: Record<DocumentGateState, string> = {
  missing:      'Отсутствует',
  attached:     'Приложен',
  under_review: 'На проверке',
  accepted:     'Принят',
  blocked:      'Заблокирован',
};

const colors: Record<DocumentGateState, { bg: string; border: string; text: string }> = {
  missing:      { bg: 'rgba(220,38,38,0.06)',  border: 'rgba(220,38,38,0.18)',  text: '#B91C1C' },
  attached:     { bg: 'rgba(180,83,9,0.05)',   border: 'rgba(180,83,9,0.18)',   text: '#B45309' },
  under_review: { bg: 'rgba(180,83,9,0.05)',   border: 'rgba(180,83,9,0.18)',   text: '#B45309' },
  accepted:     { bg: 'rgba(10,122,95,0.06)',  border: 'rgba(10,122,95,0.18)',  text: '#0A7A5F' },
  blocked:      { bg: 'rgba(220,38,38,0.06)',  border: 'rgba(220,38,38,0.18)',  text: '#B91C1C' },
};

type Props = {
  title: string;
  responsible: string;
  state: DocumentGateState;
  blocksMoney?: boolean;
  reason?: string;
};

export function DocumentGateCard({ title, responsible, state, blocksMoney, reason }: Props) {
  const c = colors[state];
  return (
    <div style={{ background: c.bg, border: `1px solid ${blocksMoney ? 'rgba(220,38,38,0.22)' : c.border}`, borderRadius: 14, padding: 14, display: 'grid', gap: 5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ color: '#0F1419', fontSize: 13, fontWeight: 900 }}>{title}</span>
        <span style={{ color: c.text, fontSize: 11, fontWeight: 900, background: c.bg, border: `1px solid ${c.border}`, borderRadius: 999, padding: '3px 8px' }}>{labels[state]}</span>
      </div>
      <p style={{ margin: 0, color: '#64748B', fontSize: 12 }}>Ответственный: {responsible}</p>
      {blocksMoney && (
        <p style={{ margin: 0, color: '#B91C1C', fontSize: 11, fontWeight: 900 }}>Блокирует выплату</p>
      )}
      {reason && <p style={{ margin: 0, color: '#475569', fontSize: 12, lineHeight: 1.4 }}>{reason}</p>}
    </div>
  );
}
