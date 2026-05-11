export type HandoffItem = {
  direction: 'sends' | 'awaits';
  role: string;
  requirement: string;
};

type Props = {
  items: HandoffItem[];
};

const SENDS_COLOR = { bg: 'rgba(10,122,95,0.06)', border: 'rgba(10,122,95,0.18)', label: '#0A7A5F', tag: '→' };
const AWAITS_COLOR = { bg: 'rgba(180,83,9,0.05)', border: 'rgba(180,83,9,0.18)', label: '#B45309', tag: '←' };

export function RoleHandoffStrip({ items }: Props) {
  return (
    <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 20, padding: 16, display: 'grid', gap: 10 }}>
      <p style={{ margin: 0, color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        Передача между ролями
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 8 }}>
        {items.map((item, i) => {
          const c = item.direction === 'sends' ? SENDS_COLOR : AWAITS_COLOR;
          return (
            <div key={i} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 12, padding: 11, display: 'grid', gap: 4 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ color: c.label, fontSize: 12, fontWeight: 950 }}>{c.tag}</span>
                <span style={{ color: c.label, fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {item.direction === 'sends' ? 'Передаёт' : 'Ожидает'}: {item.role}
                </span>
              </div>
              <p style={{ margin: 0, color: '#0F1419', fontSize: 13, lineHeight: 1.35, fontWeight: 700 }}>{item.requirement}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
