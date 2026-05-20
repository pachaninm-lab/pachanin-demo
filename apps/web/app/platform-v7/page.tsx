import Link from 'next/link';

const blockers = [
  { id: 'DL-9106', title: 'СДИЗ не подтверждён', money: '9,65 млн ₽', owner: 'Продавец', href: '/platform-v7/deals/DL-9106/clean', tone: 'red' },
  { id: 'DL-9102', title: 'Спорная часть по весу', money: '624 тыс. ₽', owner: 'Арбитр', href: '/platform-v7/disputes/DSP-9102', tone: 'amber' },
  { id: 'LOG-REQ-2403', title: 'ЭТрН ждёт подписи', money: 'основание банку', owner: 'Логистика', href: '/platform-v7/logistics', tone: 'amber' },
] as const;

const lanes = [
  { label: 'Деньги', value: '15,89 млн ₽', state: 'стоят', tone: 'red' },
  { label: 'Документы', value: '2 стопа', state: 'СДИЗ · ЭТрН', tone: 'amber' },
  { label: 'Рейс', value: '1 под риском', state: 'подпись ЭТрН', tone: 'amber' },
  { label: 'Спор', value: '624 тыс. ₽', state: 'удержание', tone: 'red' },
] as const;

export default function PlatformV7RootPage() {
  const primary = blockers[0];

  return (
    <main data-testid='platform-v7-root-execution-cockpit' style={page}>
      <section style={hero}>
        <div style={heroTop}>
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={eyebrow}>Центр исполнения</div>
            <h1 style={h1}>Что держит деньги сейчас</h1>
            <p style={lead}>Первым закрыть СДИЗ по DL-9106. Остальные блокеры ниже по очереди.</p>
          </div>
          <Link href={primary.href} style={primaryAction}>Открыть главный блокер</Link>
        </div>

        <div style={moneyCard}>
          <div style={moneyLabel}>Остановлено</div>
          <div style={moneyValue}>15,89 млн ₽</div>
          <div style={causeLine}>СДИЗ · ЭТрН · акт расхождения → деньги не идут дальше</div>
        </div>
      </section>

      <section style={laneGrid} aria-label='Состояние контура'>
        {lanes.map((item) => <Lane key={item.label} item={item} />)}
      </section>

      <section style={stack} aria-label='Очередь блокеров'>
        <div style={sectionHead}>
          <div>
            <div style={eyebrow}>Очередь снятия</div>
            <h2 style={h2}>3 действия вместо длинной ленты</h2>
          </div>
          <Link href='/platform-v7/control-tower' style={ghostAction}>Центр управления</Link>
        </div>

        {blockers.map((item, index) => <BlockerCard key={item.id} item={item} index={index} />)}
      </section>
    </main>
  );
}

function Lane({ item }: { item: typeof lanes[number] }) {
  return (
    <div style={{ ...lane, borderColor: border(item.tone), background: soft(item.tone) }}>
      <div style={laneLabel}>{item.label}</div>
      <div style={laneValue}>{item.value}</div>
      <div style={laneState}>{item.state}</div>
    </div>
  );
}

function BlockerCard({ item, index }: { item: typeof blockers[number]; index: number }) {
  return (
    <Link href={item.href} style={{ ...blocker, borderColor: border(item.tone), background: '#fff' }}>
      <div style={rank}>#{index + 1}</div>
      <div style={{ minWidth: 0, display: 'grid', gap: 5 }}>
        <div style={blockerTitle}>{item.id} · {item.title}</div>
        <div style={blockerMeta}>Держит: {item.money} · Ответственный: {item.owner}</div>
      </div>
      <div style={{ ...statusDot, background: dot(item.tone) }} />
    </Link>
  );
}

function soft(tone: string) {
  if (tone === 'red') return 'linear-gradient(180deg,#FEF2F2 0%,#FFFFFF 100%)';
  if (tone === 'amber') return 'linear-gradient(180deg,#FFFBEB 0%,#FFFFFF 100%)';
  return 'linear-gradient(180deg,#EFF6FF 0%,#FFFFFF 100%)';
}
function border(tone: string) {
  if (tone === 'red') return '#FECACA';
  if (tone === 'amber') return '#FED7AA';
  return '#BFDBFE';
}
function dot(tone: string) {
  if (tone === 'red') return '#DC2626';
  if (tone === 'amber') return '#D97706';
  return '#2563EB';
}

const page = { display: 'grid', gap: 14, padding: '0 0 24px' } as const;
const hero = { background: 'linear-gradient(135deg,#FFFFFF 0%,#F8FAFB 62%,#EEF6F3 100%)', border: '1px solid #D7DEE3', borderRadius: 26, padding: 18, display: 'grid', gap: 14, boxShadow: '0 18px 44px rgba(15,23,42,.07)' } as const;
const heroTop = { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 14, alignItems: 'start' } as const;
const eyebrow = { color: '#0A7A5F', fontSize: 11, fontWeight: 950, textTransform: 'uppercase', letterSpacing: '.08em' } as const;
const h1 = { margin: 0, color: '#0F1419', fontSize: 'clamp(30px,8vw,46px)', lineHeight: 1.03, letterSpacing: '-.05em', fontWeight: 950 } as const;
const h2 = { margin: 0, color: '#0F1419', fontSize: 20, lineHeight: 1.15, letterSpacing: '-.025em', fontWeight: 950 } as const;
const lead = { margin: 0, color: '#475569', fontSize: 14, lineHeight: 1.5 } as const;
const primaryAction = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#0A7A5F', color: '#fff', fontSize: 13, fontWeight: 900, boxShadow: '0 12px 24px rgba(10,122,95,.2)', whiteSpace: 'nowrap' } as const;
const ghostAction = { textDecoration: 'none', minHeight: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '8px 11px', borderRadius: 12, background: '#fff', border: '1px solid #CBD5E1', color: '#0F1419', fontSize: 12, fontWeight: 850, whiteSpace: 'nowrap' } as const;
const moneyCard = { background: '#fff', border: '1px solid rgba(37,99,235,.16)', borderRadius: 20, padding: 16, display: 'grid', gap: 5 } as const;
const moneyLabel = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.07em' } as const;
const moneyValue = { color: '#0F1419', fontSize: 34, lineHeight: 1, fontWeight: 950, letterSpacing: '-.045em' } as const;
const causeLine = { color: '#334155', fontSize: 13, lineHeight: 1.45, fontWeight: 750 } as const;
const laneGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 } as const;
const lane = { border: '1px solid', borderRadius: 18, padding: 14, display: 'grid', gap: 6 } as const;
const laneLabel = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.07em' } as const;
const laneValue = { color: '#0F1419', fontSize: 20, lineHeight: 1, fontWeight: 950, letterSpacing: '-.03em' } as const;
const laneState = { color: '#64748B', fontSize: 12, lineHeight: 1.35, fontWeight: 750 } as const;
const stack = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 16, display: 'grid', gap: 10 } as const;
const sectionHead = { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start', flexWrap: 'wrap' } as const;
const blocker = { textDecoration: 'none', color: 'inherit', border: '1px solid', borderRadius: 18, padding: 14, display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto', gap: 12, alignItems: 'center', boxShadow: '0 8px 20px rgba(15,23,42,.04)' } as const;
const rank = { width: 32, height: 32, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', color: '#0F1419', fontSize: 12, fontWeight: 950 } as const;
const blockerTitle = { color: '#0F1419', fontSize: 15, lineHeight: 1.25, fontWeight: 950, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } as const;
const blockerMeta = { color: '#64748B', fontSize: 12, lineHeight: 1.4 } as const;
const statusDot = { width: 10, height: 10, borderRadius: 999, boxShadow: '0 0 0 4px rgba(15,23,42,.04)' } as const;
