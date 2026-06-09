import Link from 'next/link';
import { getPlatformV7OpenWalkthroughState } from '@/lib/platform-v7/runtime/open-walkthrough';

export default function PlatformV7OpenPage() {
  const state = getPlatformV7OpenWalkthroughState();

  return (
    <main data-testid='platform-v7-open-walkthrough' style={page}>
      <section style={hero}>
        <div style={eyebrow}>Открытый просмотр</div>
        <h1 style={h1}>Покажи путь сделки до регистрации</h1>
        <p style={lead}>Пользователь видит не маркетплейс, а контур исполнения: цена и допуск → сделка → логистика → приёмка → документы → деньги → спор → доказательства.</p>
        <div style={notice}>Статус: {state.maturity} / {state.externalMode}. Боевые подключения требуют доступов, договоров и проверки на реальных сделках.</div>
      </section>

      <section style={grid}>
        {state.steps.map((step, index) => (
          <Link href={step.href} key={step.id} style={card}>
            <span style={num}>{index + 1}</span>
            <strong style={title}>{step.title}</strong>
            <span style={text}>{step.text}</span>
          </Link>
        ))}
      </section>
    </main>
  );
}

const page = { display: 'grid', gap: 14, padding: '0 0 24px' } as const;
const hero = { background: 'linear-gradient(135deg,#FFFFFF 0%,#F8FAFB 100%)', border: '1px solid #D7DEE3', borderRadius: 24, padding: 18, display: 'grid', gap: 12 } as const;
const eyebrow = { color: '#0A7A5F', fontSize: 11, fontWeight: 950, textTransform: 'uppercase', letterSpacing: '.08em' } as const;
const h1 = { margin: 0, color: '#0F1419', fontSize: 'clamp(28px,7vw,46px)', lineHeight: 1.04, letterSpacing: '-.045em', fontWeight: 950 } as const;
const lead = { margin: 0, color: '#475569', fontSize: 14, lineHeight: 1.5, maxWidth: 760 } as const;
const notice = { background: '#ECFDF5', border: '1px solid #BBF7D0', borderRadius: 16, padding: 12, color: '#065F46', fontSize: 13, lineHeight: 1.45, fontWeight: 800 } as const;
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 } as const;
const card = { textDecoration: 'none', color: 'inherit', background: '#fff', border: '1px solid #E4E6EA', borderRadius: 20, padding: 16, display: 'grid', gap: 8, boxShadow: '0 10px 24px rgba(15,23,42,.05)' } as const;
const num = { width: 30, height: 30, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#0F1419', color: '#fff', fontSize: 12, fontWeight: 950 } as const;
const title = { color: '#0F1419', fontSize: 18, lineHeight: 1.2, fontWeight: 950 } as const;
const text = { color: '#64748B', fontSize: 13, lineHeight: 1.45, fontWeight: 750 } as const;
