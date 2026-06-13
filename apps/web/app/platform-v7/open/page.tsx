import Link from 'next/link';
import type { CSSProperties } from 'react';
import { getPlatformV7OpenWalkthroughState } from '@/lib/platform-v7/runtime/open-walkthrough';
import { CollapsibleSection } from '@/components/platform-v7/CollapsibleSection';

// Цепочка исполнения сделки (макет product entry). Иконки — лёгкие глифы,
// статус контура честный: controlled-pilot / pre-integration, без фейковых сумм.
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
    <main data-testid='platform-v7-open-walkthrough' style={page}>
      <section style={hero}>
        <div style={heroOverlay} aria-hidden='true' />
        <div style={heroContent}>
          <div style={eyebrow}>Прозрачная Цена · контур исполнения сделки</div>
          <h1 style={h1}>Одна сделка. Полный контроль.</h1>
          <p style={lead}>
            Не доска объявлений, а сквозной контур: цена и допуск → документы → рейс → приёмка →
            качество → деньги → спор и доказательства. Видно, что блокирует деньги и кто следующий.
          </p>

          <div style={ctaRow}>
            <Link href='/platform-v7/seller/batches/new' style={ctaPrimary}>Выставить партию</Link>
            <Link href='/platform-v7/buyer/rfq/new' style={ctaSecondary}>Создать запрос на закупку</Link>
            <Link href='/platform-v7/role-preview' style={ctaGhost}>Открытый просмотр</Link>
          </div>

          <div style={maturityChip}>
            Контур: controlled-pilot · внешние подключения: pre-integration. Боевые подключения
            требуют доступов, договоров и проверки на реальных сделках.
          </div>
        </div>
      </section>

      <section style={chainCard} aria-label='Цепочка исполнения сделки'>
        <div style={chainScroll}>
          {EXECUTION_CHAIN.map((node, index) => (
            <div key={node.label} style={chainItem}>
              <span style={chainGlyph} aria-hidden='true'>{node.glyph}</span>
              <span style={chainLabel}>{node.label}</span>
              {index < EXECUTION_CHAIN.length - 1 ? <span style={chainArrow} aria-hidden='true'>→</span> : null}
            </div>
          ))}
        </div>
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
  const tone =
    stateValue === 'available'
      ? { bg: 'var(--p7-color-success-soft, #ECFDF3)', fg: 'var(--pc-success, #027A48)' }
      : stateValue === 'requires-operator'
        ? { bg: 'var(--p7-color-warning-soft, #FFFAEB)', fg: 'var(--pc-warning, #B54708)' }
        : { bg: 'var(--p7-color-danger-soft, #FEF3F2)', fg: 'var(--pc-danger, #B42318)' };
  return {
    width: 'fit-content',
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    background: tone.bg,
    color: tone.fg,
  };
}

const page: CSSProperties = { display: 'grid', gap: 16, padding: '0 0 32px' };

const hero: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  borderRadius: 24,
  border: '1px solid var(--pc-border, rgba(63,56,38,0.12))',
  // «Пшеничный» hero: тёплый кремовый верх → золотистое поле снизу + спокойный зелёный акцент
  background:
    'radial-gradient(120% 80% at 15% 0%, rgba(255,255,255,0.95) 0%, rgba(248,245,238,0.9) 45%, rgba(232,210,150,0.55) 100%), linear-gradient(180deg, #FBF8F1 0%, #F1E4BE 100%)',
};
const heroOverlay: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background:
    'linear-gradient(180deg, rgba(10,122,95,0) 60%, rgba(10,122,95,0.06) 100%), repeating-linear-gradient(95deg, rgba(180,150,60,0.05) 0px, rgba(180,150,60,0.05) 2px, transparent 2px, transparent 9px)',
  pointerEvents: 'none',
};
const heroContent: CSSProperties = { position: 'relative', display: 'grid', gap: 14, padding: 'clamp(20px, 4vw, 36px)' };
const eyebrow: CSSProperties = { color: 'var(--pc-accent, #0A7A5F)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' };
const h1: CSSProperties = { margin: 0, color: '#1A1407', fontSize: 'clamp(34px, 7vw, 60px)', lineHeight: 1.02, letterSpacing: '-0.04em', fontWeight: 850 };
const lead: CSSProperties = { margin: 0, color: '#4A4636', fontSize: 'clamp(14px, 2.2vw, 17px)', lineHeight: 1.55, maxWidth: 720, fontWeight: 500 };
const ctaRow: CSSProperties = { display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 };
const ctaBase: CSSProperties = {
  textDecoration: 'none',
  minHeight: 48,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 20px',
  borderRadius: 14,
  fontSize: 15,
  fontWeight: 700,
};
const ctaPrimary: CSSProperties = { ...ctaBase, background: 'var(--pc-accent, #0A7A5F)', color: '#fff', boxShadow: '0 12px 28px rgba(10,122,95,0.22)' };
const ctaSecondary: CSSProperties = { ...ctaBase, background: '#fff', border: '1px solid rgba(26,20,7,0.18)', color: '#1A1407' };
const ctaGhost: CSSProperties = { ...ctaBase, background: 'transparent', border: '1px solid rgba(26,20,7,0.22)', color: '#1A1407' };
const maturityChip: CSSProperties = {
  marginTop: 6,
  width: 'fit-content',
  maxWidth: 720,
  background: 'rgba(255,255,255,0.7)',
  border: '1px solid rgba(26,20,7,0.12)',
  borderRadius: 14,
  padding: '10px 14px',
  color: '#5A5440',
  fontSize: 12.5,
  lineHeight: 1.45,
  fontWeight: 600,
};

const chainCard: CSSProperties = {
  background: 'var(--pc-bg-card, #fff)',
  border: '1px solid var(--pc-border, rgba(63,56,38,0.12))',
  borderRadius: 16,
  padding: '14px 16px',
};
const chainScroll: CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto' };
const chainItem: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, flex: '0 0 auto' };
const chainGlyph: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 10,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--p7-color-surface-muted, #F5F1E8)',
  border: '1px solid var(--pc-border, rgba(63,56,38,0.12))',
  color: 'var(--pc-accent, #0A7A5F)',
  fontSize: 16,
};
const chainLabel: CSSProperties = { fontSize: 13, fontWeight: 700, color: 'var(--pc-text-primary, #0F1419)', whiteSpace: 'nowrap' };
const chainArrow: CSSProperties = { color: 'var(--pc-text-muted, #667085)', fontSize: 14, padding: '0 2px' };

const block: CSSProperties = { display: 'grid', gap: 12 };
const h2: CSSProperties = { margin: 0, color: 'var(--pc-text-primary, #0F1419)', fontSize: 18, fontWeight: 800, letterSpacing: '-0.01em' };
const grid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 };
const card: CSSProperties = {
  textDecoration: 'none',
  color: 'inherit',
  background: 'var(--pc-bg-card, #fff)',
  border: '1px solid var(--pc-border, rgba(63,56,38,0.12))',
  borderRadius: 16,
  padding: 16,
  display: 'grid',
  gap: 8,
};
const num: CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 999,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--pc-text-primary, #0F1419)',
  color: '#fff',
  fontSize: 12,
  fontWeight: 800,
};
const title: CSSProperties = { color: 'var(--pc-text-primary, #0F1419)', fontSize: 17, lineHeight: 1.2, fontWeight: 800 };
const text: CSSProperties = { color: 'var(--pc-text-secondary, #475569)', fontSize: 13, lineHeight: 1.5 };

const roleCard: CSSProperties = { ...card };
const roleName: CSSProperties = { color: 'var(--pc-text-primary, #0F1419)', fontSize: 16, fontWeight: 800 };
const roleSees: CSSProperties = { color: 'var(--pc-text-secondary, #475569)', fontSize: 13, lineHeight: 1.45 };
const roleAction: CSSProperties = { color: 'var(--pc-accent, #0A7A5F)', fontSize: 13, fontWeight: 700 };

const gatesCard: CSSProperties = { ...chainCard, display: 'grid', gap: 12, padding: '16px' };
const gatesGrid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 };
const gateItem: CSSProperties = { display: 'grid', gap: 6, alignContent: 'start' };
const gateLabel: CSSProperties = { color: 'var(--pc-text-primary, #0F1419)', fontSize: 15, fontWeight: 800 };
