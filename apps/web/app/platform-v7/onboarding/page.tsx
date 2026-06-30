import type { Metadata } from 'next';
import { getPlatformV7OpenWalkthroughState } from '@/lib/platform-v7/runtime/open-walkthrough';
import { CockpitHero } from '@/components/platform-v7/premium';

export const metadata: Metadata = {
  title: 'Онбординг — Прозрачная Цена',
  description: 'Служебный экран управляемого запуска и допуска в controlled pilot / pre-integration контур исполнения зерновой сделки.',
  alternates: {
    canonical: 'https://xn----8sbjf4befbjgs9b.xn--p1ai/platform-v7/onboarding',
  },
  robots: {
    index: false,
    follow: true,
  },
};

export default function PlatformV7OnboardingPage() {
  const state = getPlatformV7OpenWalkthroughState();

  return (
    <main data-testid='platform-v7-onboarding-draft' style={page}>
      <CockpitHero
        eyebrow='Доступ · управляемый запуск'
        title='Онбординг без'
        accent='ложных обещаний'
        lead='Экран фиксирует, что доступ к контуру сделки выдаётся по роли и сценарию. Внешние подключения остаются pre-integration до договоров, доступов и проверки на реальных сделках.'
      />

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
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 } as const;
const card = { background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 20, padding: 16, display: 'grid', gap: 8, boxShadow: '0 10px 24px rgba(15,23,42,.05)' } as const;
const pill = { justifySelf: 'start', borderRadius: 999, padding: '5px 8px', fontSize: 10, fontWeight: 950, textTransform: 'uppercase', letterSpacing: '.07em' } as const;
const title = { color: 'var(--pc-text-primary, #0F1419)', fontSize: 18, lineHeight: 1.2, fontWeight: 950 } as const;
const text = { color: 'var(--pc-text-muted, #64748B)', fontSize: 13, lineHeight: 1.45, fontWeight: 750 } as const;
