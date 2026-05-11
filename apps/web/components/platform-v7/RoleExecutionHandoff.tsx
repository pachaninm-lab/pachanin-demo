export type HandoffDirection = 'sends' | 'awaits' | 'blockedBy' | 'next';

export interface HandoffItem {
  direction: HandoffDirection;
  role?: string;
  requirement: string;
  entity?: string;
  href?: string;
  moneyImpact?: boolean;
  documentImpact?: boolean;
}

interface Props {
  items: HandoffItem[];
  title?: string;
}

const directionLabel: Record<HandoffDirection, string> = {
  sends: 'отправляет',
  awaits: 'ожидает',
  blockedBy: 'причина остановки',
  next: 'следующий шаг',
};

const directionColor: Record<HandoffDirection, string> = {
  sends: '#0A7A5F',
  awaits: '#B45309',
  blockedBy: '#B91C1C',
  next: '#2563EB',
};

const directionBg: Record<HandoffDirection, string> = {
  sends: 'rgba(10,122,95,0.07)',
  awaits: 'rgba(217,119,6,0.07)',
  blockedBy: 'rgba(220,38,38,0.07)',
  next: 'rgba(37,99,235,0.07)',
};

const directionBorder: Record<HandoffDirection, string> = {
  sends: 'rgba(10,122,95,0.18)',
  awaits: 'rgba(217,119,6,0.18)',
  blockedBy: 'rgba(220,38,38,0.18)',
  next: 'rgba(37,99,235,0.18)',
};

export function RoleExecutionHandoff({ items, title = 'передача между ролями' }: Props) {
  return (
    <section style={shell} data-testid="role-execution-handoff">
      <div style={micro}>{title}</div>
      <div style={grid}>
        {items.map((item, i) => (
          <HandoffCard key={i} item={item} />
        ))}
      </div>
    </section>
  );
}

function HandoffCard({ item }: { item: HandoffItem }) {
  const color = directionColor[item.direction];
  const bg = directionBg[item.direction];
  const border = directionBorder[item.direction];
  const label = directionLabel[item.direction];

  return (
    <div style={{ ...card, background: bg, borderColor: border }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <span style={{ ...dirTag, color, borderColor: border }}>{label}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {item.moneyImpact && <span style={impactTag}>выплата</span>}
          {item.documentImpact && <span style={impactTag}>документ</span>}
        </div>
      </div>
      {item.role && <div style={roleLabel}>{item.role}</div>}
      <p style={requirement}>{item.requirement}</p>
      {item.entity && (
        item.href
          ? <a href={item.href} style={{ ...entityLink, color }}>{item.entity}</a>
          : <span style={{ ...entityChip, color, borderColor: border }}>{item.entity}</span>
      )}
    </div>
  );
}

const shell = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 12 } as const;
const micro = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' } as const;
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 8 } as const;
const card = { border: '1px solid', borderRadius: 14, padding: 12, display: 'grid', gap: 7, minWidth: 0 } as const;
const dirTag = { display: 'inline-flex', alignItems: 'center', padding: '4px 9px', borderRadius: 999, border: '1px solid', background: '#fff', fontSize: 11, fontWeight: 900, whiteSpace: 'nowrap' } as const;
const impactTag = { display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: '#fff', border: '1px solid #CBD5E1', color: '#475569', fontSize: 11, fontWeight: 900 } as const;
const roleLabel = { color: '#94A3B8', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' } as const;
const requirement = { margin: 0, color: '#0F1419', fontSize: 13, lineHeight: 1.45, fontWeight: 900, overflowWrap: 'break-word' } as const;
const entityLink = { fontSize: 12, fontWeight: 900, textDecoration: 'none', overflowWrap: 'break-word' } as const;
const entityChip = { display: 'inline-flex', padding: '3px 8px', borderRadius: 8, border: '1px solid', fontSize: 11, fontWeight: 900 } as const;
