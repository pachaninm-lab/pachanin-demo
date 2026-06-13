import { getPlatformV7OpenWalkthroughState } from '@/lib/platform-v7/runtime/open-walkthrough';

export default function PlatformV7OnboardingPage() {
  const state = getPlatformV7OpenWalkthroughState();

  return (
    <main data-testid='platform-v7-onboarding-draft' style={page}>
      <section style={hero}>
        <div style={eyebrow}>Доступ к управляемый запуск</div>
        <h1 style={h1}>Онбординг без ложных обещаний</h1>
        <p style={lead}>Экран фиксирует, что доступ к контуру сделки выдаётся по роли и сценарию. Внешние подключения остаются pre-integration до договоров, доступов и проверки на реальных сделках.</p>
      </section>

      <section style={grid}>
        {state.gates.map((gate) => (
          <article key={gate.label} style={card}>
            <span style={statePill(gate.state)}>{gate.state}</span>
            <strong style={title}>{gate.label}</strong>
            <span style={text}>{gate.text}</span>
          </article>
        ))}
      </section>
    </main>
  );
}

function statePill(state: string) {
  const bg = state === 'available' ? '#ECFDF5' : state === 'requires-operator' ? '#FFFBEB' : '#F8FAFC';
  const color = state === 'available' ? '#047857' : state === 'requires-operator' ? '#B45309' : 'var(--pc-text-secondary, #475569)';
  return { ...pill, background: bg, color } as const;
}

const page = { display: 'grid', gap: 14, padding: '0 0 24px' } as const;
const hero = { background: 'linear-gradient(135deg,#FFFFFF 0%,#F8FAFB 100%)', border: '1px solid #D7DEE3', borderRadius: 24, padding: 18, display: 'grid', gap: 10 } as const;
const eyebrow = { color: '#0A7A5F', fontSize: 11, fontWeight: 950, textTransform: 'uppercase', letterSpacing: '.08em' } as const;
const h1 = { margin: 0, color: 'var(--pc-text-primary, #0F1419)', fontSize: 'clamp(28px,7vw,44px)', lineHeight: 1.05, letterSpacing: '-.045em', fontWeight: 950 } as const;
const lead = { margin: 0, color: 'var(--pc-text-secondary, #475569)', fontSize: 14, lineHeight: 1.5, maxWidth: 720 } as const;
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 } as const;
const card = { background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 20, padding: 16, display: 'grid', gap: 8, boxShadow: '0 10px 24px rgba(15,23,42,.05)' } as const;
const pill = { justifySelf: 'start', borderRadius: 999, padding: '5px 8px', fontSize: 10, fontWeight: 950, textTransform: 'uppercase', letterSpacing: '.07em' } as const;
const title = { color: 'var(--pc-text-primary, #0F1419)', fontSize: 18, lineHeight: 1.2, fontWeight: 950 } as const;
const text = { color: 'var(--pc-text-muted, #64748B)', fontSize: 13, lineHeight: 1.45, fontWeight: 750 } as const;
