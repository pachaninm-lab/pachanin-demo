import Link from 'next/link';
import type { CSSProperties } from 'react';
import { getPlatformV7OpenWalkthroughState } from '@/lib/platform-v7/runtime/open-walkthrough';
import { CollapsibleSection } from '@/components/platform-v7/CollapsibleSection';
import { CockpitHero, PremiumCtaButton, ProcessStepper } from '@/components/platform-v7/premium';

const EXECUTION_CHAIN: ReadonlyArray<{ readonly glyph: string; readonly label: string }> = [
  { glyph: '◳', label: 'Условия' },
  { glyph: '▤', label: 'Документы' },
  { glyph: '◈', label: 'Рейс' },
  { glyph: '⚖', label: 'Приёмка' },
  { glyph: '✦', label: 'Качество' },
  { glyph: '₽', label: 'Деньги' },
  { glyph: '⚑', label: 'Спор / Закрытие' },
];

export default function PlatformV7OpenPage() {
  const state = getPlatformV7OpenWalkthroughState();

  return (
    <main data-testid='platform-v7-open-walkthrough' className='pc-v7-public-entry' style={page}>
      <CockpitHero
        className='pc-v7-open-hero'
        eyebrow='Прозрачная Цена · контур исполнения сделки'
        title='Главный риск сделки начинается'
        accent='после согласования цены'
        lead='Прозрачная Цена — цифровой контур исполнения зерновой сделки: рейс, приёмка, качество, документы, деньги, спор и доказательства в одном процессе.'
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 8 }}>
          <PremiumCtaButton href='/platform-v7/#roles' glyph='users'>Выбрать роль</PremiumCtaButton>
          <PremiumCtaButton href='/platform-v7/login' variant='ghost'>Войти в кабинет</PremiumCtaButton>
          <PremiumCtaButton href='/platform-v7/support?role=operator' variant='ghost'>Запросить демонстрацию</PremiumCtaButton>
        </div>
        <div style={maturityChip}>Пилотный контур. Внешние подключения требуют доступов, договоров и проверки на реальных сделках.</div>
      </CockpitHero>

      <section style={chainCard} aria-label='Цепочка исполнения сделки'>
        <ProcessStepper ariaLabel='Цепочка исполнения сделки' steps={EXECUTION_CHAIN.map((node) => ({ label: node.label, state: 'upcoming' as const }))} />
      </section>

      <section style={block} aria-label='Как открывается путь сделки'>
        <h2 style={h2}>Как открывается путь сделки</h2>
        <div style={grid}>
          {state.steps.map((step, index) => (
            <Link href={step.href} key={step.id} style={card}>
              <span style={num}>{index + 1}</span>
              <strong style={title}>{step.title}</strong>
              <span style={text}>{step.text}</span>
            </Link>
          ))}
        </div>
      </section>

      <section style={block} aria-label='Роли в контуре сделки'>
        <h2 style={h2}>Что видит каждая роль</h2>
        <div style={grid}>
          {state.roles.map((role) => (
            <Link href={role.href} key={role.role} style={roleCard}>
              <strong style={roleName}>{role.role}</strong>
              <span style={roleSees}>{role.sees}</span>
              <span style={roleAction}>→ {role.action}</span>
            </Link>
          ))}
        </div>
      </section>

      <CollapsibleSection title='Контур доступа' summary={`${state.gates.length} шага · роль → контур → подключения`} defaultOpen={false}>
        <div style={gatesGrid}>
          {state.gates.map((gate) => (
            <div key={gate.label} style={gateItem}>
              <span style={gateBadge(gate.state)}>{gateStateLabel(gate.state)}</span>
              <strong style={gateLabel}>{gate.label}</strong>
              <span style={text}>{gate.text}</span>
            </div>
          ))}
        </div>
      </CollapsibleSection>
    </main>
  );
}

function gateStateLabel(stateValue: 'available' | 'requires-operator' | 'requires-agreement'): string {
  if (stateValue === 'available') return 'доступно';
  if (stateValue === 'requires-operator') return 'через оператора';
  return 'нужен договор';
}

function gateBadge(stateValue: 'available' | 'requires-operator' | 'requires-agreement'): CSSProperties {
  const tone = stateValue === 'available' ? { bg: 'var(--p7-color-success-soft, #ECFDF3)', fg: 'var(--pc-success, #027A48)' } : stateValue === 'requires-operator' ? { bg: 'var(--p7-color-warning-soft, #FFFAEB)', fg: 'var(--pc-warning, #B54708)' } : { bg: 'var(--p7-color-danger-soft, #FEF3F2)', fg: 'var(--pc-danger, #B42318)' };
  return { width: 'fit-content', padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', background: tone.bg, color: tone.fg };
}

const page: CSSProperties = { display: 'grid', gap: 16, padding: '0 0 32px' };
const maturityChip: CSSProperties = { marginTop: 6, width: 'fit-content', maxWidth: 720, background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(26,20,7,0.12)', borderRadius: 14, padding: '10px 14px', color: '#5A5440', fontSize: 12.5, lineHeight: 1.45, fontWeight: 600 };
const chainCard: CSSProperties = { background: 'var(--pc-bg-card, #fff)', border: '1px solid var(--pc-border, rgba(63,56,38,0.12))', borderRadius: 16, padding: '14px 16px' };
const block: CSSProperties = { display: 'grid', gap: 12 };
const h2: CSSProperties = { margin: 0, color: 'var(--pc-text-primary, #0F1419)', fontSize: 18, fontWeight: 800, letterSpacing: '-0.01em' };
const grid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 };
const card: CSSProperties = { textDecoration: 'none', color: 'inherit', background: 'var(--pc-bg-card, #fff)', border: '1px solid var(--pc-border, rgba(63,56,38,0.12))', borderRadius: 16, padding: 16, display: 'grid', gap: 8 };
const num: CSSProperties = { width: 30, height: 30, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--pc-text-primary, #0F1419)', color: '#fff', fontSize: 12, fontWeight: 800 };
const title: CSSProperties = { color: 'var(--pc-text-primary, #0F1419)', fontSize: 17, lineHeight: 1.2, fontWeight: 800 };
const text: CSSProperties = { color: 'var(--pc-text-secondary, #475569)', fontSize: 13, lineHeight: 1.5 };
const roleCard: CSSProperties = { ...card };
const roleName: CSSProperties = { color: 'var(--pc-text-primary, #0F1419)', fontSize: 16, fontWeight: 800 };
const roleSees: CSSProperties = { color: 'var(--pc-text-secondary, #475569)', fontSize: 13, lineHeight: 1.45 };
const roleAction: CSSProperties = { color: 'var(--pc-accent, #0A7A5F)', fontSize: 13, fontWeight: 700 };
const gatesGrid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 };
const gateItem: CSSProperties = { display: 'grid', gap: 6, alignContent: 'start' };
const gateLabel: CSSProperties = { color: 'var(--pc-text-primary, #0F1419)', fontSize: 15, fontWeight: 800 };
