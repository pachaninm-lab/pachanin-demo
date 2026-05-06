import Link from 'next/link';

export interface GrainWorkflowItem {
  title: string;
  value: string;
  href: string;
  note?: string;
  tone?: 'good' | 'warn' | 'bad' | 'neutral';
}

export function GrainWorkflowPage({ eyebrow, title, lead, primaryHref, primaryLabel, items }: { eyebrow: string; title: string; lead: string; primaryHref: string; primaryLabel: string; items: GrainWorkflowItem[] }) {
  return (
    <main style={{ display: 'grid', gap: 14, padding: '4px 0 24px' }}>
      <section style={card}>
        <div style={badge}>{eyebrow}</div>
        <h1 style={h1}>{title}</h1>
        <p style={leadStyle}>{lead}</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href={primaryHref} style={primaryBtn}>{primaryLabel}</Link>
          <Link href='/platform-v7/settlement/grain' style={ghostBtn}>Расчёт</Link>
          <Link href='/platform-v7/readiness/grain' style={ghostBtn}>Готовность</Link>
        </div>
      </section>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10 }}>
        {items.map((item, index) => <Link key={`${item.title}-${index}`} href={item.href} style={itemCard}><b style={{ color: '#0F1419' }}>{index + 1}. {item.title}</b><span style={{ color: toneColor(item.tone), fontWeight: 900 }}>{item.value}</span><span style={{ color: '#64748B', fontSize: 13, lineHeight: 1.45 }}>{item.note ?? 'Открыть связанный экран.'}</span></Link>)}
      </section>
    </main>
  );
}

function toneColor(tone: GrainWorkflowItem['tone']) {
  return tone === 'bad' ? '#B91C1C' : tone === 'warn' ? '#B45309' : tone === 'good' ? '#0A7A5F' : '#0F1419';
}

const card = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 12 } as const;
const badge = { display: 'inline-flex', width: 'fit-content', padding: '7px 11px', borderRadius: 999, background: 'rgba(15,23,42,0.08)', border: '1px solid rgba(15,23,42,0.18)', color: '#0F172A', fontSize: 12, fontWeight: 900 } as const;
const h1 = { margin: 0, color: '#0F1419', fontSize: 'clamp(30px,8vw,48px)', lineHeight: 1.03, letterSpacing: '-0.045em', fontWeight: 950 } as const;
const leadStyle = { margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.55 } as const;
const primaryBtn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#0F172A', color: '#fff', fontSize: 14, fontWeight: 900 } as const;
const ghostBtn = { ...primaryBtn, background: '#fff', border: '1px solid #CBD5E1', color: '#0F1419' } as const;
const itemCard = { textDecoration: 'none', minHeight: 150, display: 'grid', gap: 8, padding: 14, borderRadius: 18, background: '#fff', border: '1px solid #E4E6EA', color: '#0F1419' } as const;
