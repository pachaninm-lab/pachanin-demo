import Link from 'next/link';
import { getPlatformV7EntryCockpitState } from '@/lib/platform-v7/runtime/entry-cockpit-state';
import { CockpitHero, PremiumStatCard, PremiumCtaButton, type PremiumTone, type PremiumGlyph } from '@/components/platform-v7/premium';

function laneToPremTone(tone: string): PremiumTone {
  if (tone === 'red') return 'danger';
  if (tone === 'amber') return 'warning';
  if (tone === 'green') return 'success';
  if (tone === 'blue') return 'info';
  return 'neutral';
}

function laneGlyph(label: string): PremiumGlyph {
  if (label.includes('Деньги')) return 'coins';
  if (label.includes('Документ')) return 'doc';
  if (label.includes('Рейс')) return 'truck';
  if (label.includes('Спор')) return 'alert';
  return 'gauge';
}

export default function PlatformV7RootPage() {
  const cockpit = getPlatformV7EntryCockpitState();
  const primary = cockpit.primaryBlocker;
  const money = cockpit.lanes.find((item) => item.label === 'Деньги');

  return (
    <main data-testid='platform-v7-root-execution-cockpit' style={page}>
      <CockpitHero
        eyebrow='Цифровой контур исполнения сделки'
        title='От причины к деньгам за один экран'
        lead='Документ, рейс, качество или спор → блокер → деньги → ответственный → действие.'
        aside={
          <div style={maturityCard}>
            <strong style={maturityTitle}>Контролируемый предпилотный контур</strong>
            <span style={cardText}>{cockpit.maturityNotice}</span>
          </div>
        }
      >
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={moneyCard}>
            <span style={cardLabel}>Остановлено сейчас</span>
            <strong style={moneyValue}>{money?.value ?? '0 ₽'}</strong>
            <span style={cardText}>{money?.state ?? 'нет активных стопов'}</span>
          </div>
          <div style={{ flex: '1 1 240px', minWidth: 220 }}>
            {primary ? (
              <PremiumCtaButton href={primary.href} glyph='shield-check'>Открыть главный блокер</PremiumCtaButton>
            ) : (
              <span style={disabledAction}>Нет активных стопов</span>
            )}
          </div>
        </div>
      </CockpitHero>

      <section style={pathCard} aria-label='Путь исполнения сделки'>
        {cockpit.executionPath.map((step, index) => (
          <div key={step} style={pathStep}>
            <span style={pathNumber}>{index + 1}</span>
            <span style={pathText}>{step}</span>
          </div>
        ))}
      </section>

      <div className='pc-prem-kpis' aria-label='Состояние контура'>
        {cockpit.lanes.map((item) => (
          <PremiumStatCard
            key={item.label}
            glyph={laneGlyph(item.label)}
            tone={laneToPremTone(item.tone)}
            value={item.value}
            label={`${item.label} · ${item.state}`}
          />
        ))}
      </div>

      <section style={workGrid}>
        <section style={panel} aria-label='Очередь блокеров'>
          <div style={sectionHead}>
            <div>
              <div style={eyebrow}>Очередь снятия</div>
              <h2 style={h2}>{cockpit.blockers.length ? '3 действия вместо длинной ленты' : 'Нет активных стопов'}</h2>
            </div>
            <Link href='/platform-v7/control-tower' style={ghostAction}>Центр управления</Link>
          </div>
          {cockpit.blockers.length ? cockpit.blockers.map((item, index) => (
            <Link key={item.id} href={item.href} style={{ ...blockerCard, borderColor: toneBorder(item.tone), background: toneBg(item.tone) }}>
              <span style={rank}>#{index + 1}</span>
              <span style={blockerBody}>
                <strong style={blockerTitle}>{item.id} · {item.title}</strong>
                <span style={cardText}>{item.cause}</span>
                <span style={cardText}>Держит: {item.money} · Ответственный: {item.owner}</span>
              </span>
              <span style={{ ...dot, background: toneDot(item.tone) }} />
            </Link>
          )) : <div style={emptyState}>Нет активных стопов по текущему контуру.</div>}
        </section>

        <section style={panel} aria-label='Ролевой вход'>
          <div style={eyebrow}>Ролевой вход</div>
          <h2 style={h2}>Каждая сторона видит своё действие</h2>
          {cockpit.roleEntrypoints.map((item) => (
            <Link key={item.role} href={item.href} style={roleCard}>
              <strong style={roleTitle}>{item.role}</strong>
              <span style={cardText}>{item.focus}</span>
              <span style={roleAction}>{item.action}</span>
            </Link>
          ))}
        </section>
      </section>

      <section style={proofGrid} aria-label='Почему можно доверять контуру'>
        {cockpit.proofItems.map((item) => (
          <div key={item.label} style={proofCard}>
            <span style={eyebrow}>{item.label}</span>
            <strong style={proofText}>{item.text}</strong>
          </div>
        ))}
      </section>
    </main>
  );
}

function toneBorder(tone: string) {
  if (tone === 'red') return '#FECACA';
  if (tone === 'amber') return '#FED7AA';
  return '#BFDBFE';
}

function toneBg(tone: string) {
  if (tone === 'red') return 'linear-gradient(180deg,#FFF7F7 0%,#FFFFFF 100%)';
  if (tone === 'amber') return 'linear-gradient(180deg,#FFFBEB 0%,#FFFFFF 100%)';
  return 'linear-gradient(180deg,#EFF6FF 0%,#FFFFFF 100%)';
}

function toneDot(tone: string) {
  if (tone === 'red') return '#DC2626';
  if (tone === 'amber') return '#D97706';
  return '#2563EB';
}

const page = { display: 'grid', gap: 14, padding: '0 0 24px' } as const;
const eyebrow = { color: '#0A7A5F', fontSize: 11, fontWeight: 950, textTransform: 'uppercase', letterSpacing: '.08em' } as const;
const h2 = { margin: 0, color: '#0F1419', fontSize: 20, lineHeight: 1.15, letterSpacing: '-.025em', fontWeight: 950 } as const;
const moneyCard = { background: '#fff', border: '1px solid rgba(37,99,235,.16)', borderRadius: 20, padding: 16, display: 'grid', gap: 6 } as const;
const maturityCard = { background: 'rgba(255,255,255,.72)', border: '1px solid #D7DEE3', borderRadius: 20, padding: 16, display: 'grid', gap: 7 } as const;
const maturityTitle = { color: '#0F1419', fontSize: 15, lineHeight: 1.2, fontWeight: 950 } as const;
const disabledAction = { minHeight: 46, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 15, background: '#F1F5F9', color: 'var(--pc-text-muted, #64748B)', fontSize: 14, fontWeight: 900 } as const;
const ghostAction = { textDecoration: 'none', minHeight: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '8px 11px', borderRadius: 12, background: '#fff', border: '1px solid #CBD5E1', color: '#0F1419', fontSize: 12, fontWeight: 850, whiteSpace: 'nowrap' } as const;
const pathCard = { background: '#0F1419', borderRadius: 22, padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(118px,1fr))', gap: 8 } as const;
const pathStep = { display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr)', alignItems: 'center', gap: 8, minHeight: 44, padding: '8px 9px', borderRadius: 14, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.10)' } as const;
const pathNumber = { width: 22, height: 22, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', color: '#0F1419', fontSize: 11, fontWeight: 950 } as const;
const pathText = { color: '#F8FAFC', fontSize: 12, lineHeight: 1.2, fontWeight: 850 } as const;
const cardLabel = { color: 'var(--pc-text-muted, #64748B)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.07em' } as const;
const moneyValue = { color: '#0F1419', fontSize: 34, lineHeight: 1, fontWeight: 950, letterSpacing: '-.045em' } as const;
const cardText = { color: 'var(--pc-text-muted, #64748B)', fontSize: 13, lineHeight: 1.4, fontWeight: 700 } as const;
const workGrid = { display: 'grid', gridTemplateColumns: 'minmax(0,1.08fr) minmax(280px,.92fr)', gap: 12, alignItems: 'start' } as const;
const panel = { background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 24, padding: 16, display: 'grid', gap: 10 } as const;
const sectionHead = { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start', flexWrap: 'wrap' } as const;
const blockerCard = { textDecoration: 'none', color: 'inherit', border: '1px solid', borderRadius: 18, padding: 14, display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto', gap: 12, alignItems: 'center', boxShadow: '0 8px 20px rgba(15,23,42,.04)' } as const;
const blockerBody = { minWidth: 0, display: 'grid', gap: 5 } as const;
const rank = { width: 32, height: 32, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', color: '#0F1419', fontSize: 12, fontWeight: 950 } as const;
const blockerTitle = { color: '#0F1419', fontSize: 15, lineHeight: 1.25, fontWeight: 950, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } as const;
const dot = { width: 10, height: 10, borderRadius: 999, boxShadow: '0 0 0 4px rgba(15,23,42,.04)' } as const;
const roleCard = { textDecoration: 'none', color: 'inherit', display: 'grid', gap: 8, padding: 13, borderRadius: 16, border: '1px solid var(--pc-border, #E4E6EA)', background: 'linear-gradient(180deg,#FFFFFF 0%,#F8FAFC 100%)' } as const;
const roleTitle = { color: '#0F1419', fontSize: 15, lineHeight: 1.2, fontWeight: 950 } as const;
const roleAction = { color: '#0A7A5F', fontSize: 12, lineHeight: 1.35, fontWeight: 850 } as const;
const proofGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 } as const;
const proofCard = { background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 14, display: 'grid', gap: 6 } as const;
const proofText = { color: 'var(--pc-text-secondary, #334155)', fontSize: 13, lineHeight: 1.45, fontWeight: 800 } as const;
const emptyState = { minHeight: 74, borderRadius: 18, padding: 14, border: '1px dashed #CBD5E1', background: '#F8FAFC', color: 'var(--pc-text-muted, #64748B)', fontSize: 13, lineHeight: 1.45, fontWeight: 750 } as const;
