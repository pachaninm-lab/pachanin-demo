import Link from 'next/link';
import { getPlatformV7OpenWalkthroughState } from '@/lib/platform-v7/runtime/open-walkthrough';

export default function PlatformV7RolePreviewPage() {
  const state = getPlatformV7OpenWalkthroughState();

  return (
    <main data-testid='platform-v7-role-preview' style={page}>
      <section style={hero}>
        <div style={eyebrow}>Ролевой предпросмотр</div>
        <h1 style={h1}>Каждая сторона видит только свой рабочий вход</h1>
        <p style={lead}>Предпросмотр показывает, что будет видно продавцу, покупателю, логистике и банку в controlled-pilot контуре. Это не выдача боевого доступа.</p>
      </section>

      <section style={grid}>
        {state.roles.map((role) => (
          <Link key={role.role} href={role.href} style={card}>
            <strong style={title}>{role.role}</strong>
            <span style={label}>Видит</span>
            <span style={text}>{role.sees}</span>
            <span style={label}>Действие</span>
            <span style={action}>{role.action}</span>
          </Link>
        ))}
      </section>
    </main>
  );
}

const page = { display: 'grid', gap: 14, padding: '0 0 24px' } as const;
const hero = { background: '#fff', border: '1px solid #D7DEE3', borderRadius: 24, padding: 18, display: 'grid', gap: 10 } as const;
const eyebrow = { color: '#0A7A5F', fontSize: 11, fontWeight: 950, textTransform: 'uppercase', letterSpacing: '.08em' } as const;
const h1 = { margin: 0, color: '#0F1419', fontSize: 'clamp(28px,7vw,44px)', lineHeight: 1.05, letterSpacing: '-.045em', fontWeight: 950 } as const;
const lead = { margin: 0, color: '#475569', fontSize: 14, lineHeight: 1.5, maxWidth: 720 } as const;
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 } as const;
const card = { textDecoration: 'none', color: 'inherit', background: 'linear-gradient(180deg,#FFFFFF 0%,#F8FAFC 100%)', border: '1px solid #E4E6EA', borderRadius: 20, padding: 16, display: 'grid', gap: 7 } as const;
const title = { color: '#0F1419', fontSize: 19, lineHeight: 1.2, fontWeight: 950 } as const;
const label = { color: '#94A3B8', fontSize: 10, fontWeight: 950, textTransform: 'uppercase', letterSpacing: '.08em' } as const;
const text = { color: '#64748B', fontSize: 13, lineHeight: 1.45, fontWeight: 750 } as const;
const action = { color: '#0A7A5F', fontSize: 13, lineHeight: 1.4, fontWeight: 900 } as const;
