import Link from 'next/link';
import { getPlatformV7EntryCockpitState } from '@/lib/platform-v7/runtime/entry-cockpit-state';

export default function PlatformV7RootPage() {
  const cockpit = getPlatformV7EntryCockpitState();
  const primary = cockpit.primaryBlocker;

  return (
    <main data-testid='platform-v7-root-execution-cockpit' style={page}>
      <section style={hero}>
        <div style={eyebrow}>Цифровой контур исполнения сделки</div>
        <h1 style={h1}>От причины к деньгам за один экран</h1>
        <p style={lead}>Платформа показывает цепочку: документ, рейс, качество или спор → блокер → деньги → ответственный → действие.</p>
        {primary ? <Link href={primary.href} style={primaryAction}>Открыть главный блокер</Link> : <span style={disabledAction}>Нет активных стопов</span>}
      </section>

      <section style={pathCard} aria-label='Путь исполнения сделки'>
        {cockpit.executionPath.map((step, index) => <div key={step} style={pathStep}>{index + 1}. {step}</div>)}
      </section>

      <section style={grid} aria-label='Состояние контура'>
        {cockpit.lanes.map((item) => <Card key={item.label} title={item.label} value={item.value} text={item.state} />)}
      </section>

      <section style={columns}>
        <section style={panel} aria-label='Очередь блокеров'>
          <div style={sectionHead}>
            <div>
              <div style={eyebrow}>Очередь снятия</div>
              <h2 style={h2}>{cockpit.blockers.length ? '3 действия вместо длинной ленты' : 'Нет активных стопов'}</h2>
            </div>
            <Link href='/platform-v7/control-tower' style={ghostAction}>Центр управления</Link>
          </div>
          {cockpit.blockers.length ? cockpit.blockers.map((item, index) => (
            <Link key={item.id} href={item.href} style={row}>
              <strong>#{index + 1} {item.id} · {item.title}</strong>
              <span>{item.cause}</span>
              <span>Держит: {item.money} · Ответственный: {item.owner}</span>
            </Link>
          )) : <div style={emptyState}>Нет активных стопов по текущему контуру.</div>}
        </section>

        <section style={panel} aria-label='Ролевой вход'>
          <div style={eyebrow}>Ролевой вход</div>
          <h2 style={h2}>Каждая сторона видит своё действие</h2>
          {cockpit.roleEntrypoints.map((item) => (
            <Link key={item.role} href={item.href} style={row}>
              <strong>{item.role}</strong>
              <span>{item.focus}</span>
              <span>{item.action}</span>
            </Link>
          ))}
        </section>
      </section>

      <section style={grid} aria-label='Почему можно доверять контуру'>
        {cockpit.proofItems.map((item) => <Card key={item.label} title={item.label} value='' text={item.text} />)}
      </section>
    </main>
  );
}

function Card({ title, value, text }: { title: string; value: string; text: string }) {
  return <div style={card}><strong>{title}</strong>{value ? <b style={valueStyle}>{value}</b> : null}<span>{text}</span></div>;
}

const page = { display: 'grid', gap: 14, padding: '0 0 24px' } as const;
const hero = { background: '#fff', border: '1px solid #D7DEE3', borderRadius: 26, padding: 18, display: 'grid', gap: 12 } as const;
const eyebrow = { color: '#0A7A5F', fontSize: 11, fontWeight: 950, textTransform: 'uppercase', letterSpacing: '.08em' } as const;
const h1 = { margin: 0, color: '#0F1419', fontSize: 'clamp(30px,8vw,50px)', lineHeight: 1.02, letterSpacing: '-.055em', fontWeight: 950 } as const;
const h2 = { margin: 0, color: '#0F1419', fontSize: 20, lineHeight: 1.15, fontWeight: 950 } as const;
const lead = { margin: 0, color: '#475569', fontSize: 14, lineHeight: 1.5, maxWidth: 760 } as const;
const primaryAction = { textDecoration: 'none', minHeight: 44, width: 'fit-content', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#0A7A5F', color: '#fff', fontSize: 13, fontWeight: 900 } as const;
const disabledAction = { minHeight: 44, width: 'fit-content', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#F1F5F9', color: '#64748B', fontSize: 13, fontWeight: 900 } as const;
const ghostAction = { textDecoration: 'none', minHeight: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '8px 11px', borderRadius: 12, background: '#fff', border: '1px solid #CBD5E1', color: '#0F1419', fontSize: 12, fontWeight: 850 } as const;
const pathCard = { background: '#0F1419', borderRadius: 22, padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 } as const;
const pathStep = { color: '#F8FAFC', minHeight: 42, padding: '10px', borderRadius: 14, background: 'rgba(255,255,255,.08)', fontSize: 12, fontWeight: 800 } as const;
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 } as const;
const columns = { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(280px,.9fr)', gap: 12, alignItems: 'start' } as const;
const panel = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 16, display: 'grid', gap: 10 } as const;
const sectionHead = { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start', flexWrap: 'wrap' } as const;
const row = { textDecoration: 'none', color: 'inherit', border: '1px solid #E4E6EA', borderRadius: 18, padding: 14, display: 'grid', gap: 5, background: '#fff' } as const;
const card = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 14, display: 'grid', gap: 6, color: '#334155', fontSize: 13, lineHeight: 1.45 } as const;
const valueStyle = { color: '#0F1419', fontSize: 20, lineHeight: 1, fontWeight: 950 } as const;
const emptyState = { minHeight: 74, borderRadius: 18, padding: 14, border: '1px dashed #CBD5E1', background: '#F8FAFC', color: '#64748B', fontSize: 13, lineHeight: 1.45, fontWeight: 750 } as const;
