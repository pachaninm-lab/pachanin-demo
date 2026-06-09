import Link from 'next/link';

const blockers = [
  {
    id: 'DL-9106',
    title: 'СДИЗ не подтверждён',
    cause: 'партия не подтверждена в документальном контуре',
    money: '9,65 млн ₽',
    owner: 'Продавец',
    href: '/platform-v7/deals/DL-9106/clean',
    tone: 'red',
  },
  {
    id: 'DL-9102',
    title: 'Спорная часть по весу',
    cause: 'акт расхождения удерживает часть расчёта',
    money: '624 тыс. ₽',
    owner: 'Арбитр',
    href: '/platform-v7/disputes/DSP-9102',
    tone: 'amber',
  },
  {
    id: 'LOG-REQ-2403',
    title: 'ЭТрН ждёт подписи',
    cause: 'рейс есть, но транспортный пакет не завершён',
    money: 'основание банку',
    owner: 'Логистика',
    href: '/platform-v7/logistics',
    tone: 'amber',
  },
] as const;

const lanes = [
  { label: 'Деньги', value: '15,89 млн ₽', state: 'стоят до закрытия документов', tone: 'red' },
  { label: 'Документы', value: '2 стопа', state: 'СДИЗ · ЭТрН', tone: 'amber' },
  { label: 'Рейс', value: '1 под риском', state: 'подпись ЭТрН', tone: 'amber' },
  { label: 'Спор', value: '624 тыс. ₽', state: 'удержание по весу', tone: 'red' },
] as const;

const roles = [
  {
    role: 'Оператор',
    href: '/platform-v7/control-tower',
    focus: 'видит главный блокер и ответственного',
    action: 'разобрать очередь снятия стопов',
  },
  {
    role: 'Покупатель',
    href: '/platform-v7/buyer',
    focus: 'видит, что резерв не равен выплате',
    action: 'проверить основание для оплаты',
  },
  {
    role: 'Водитель',
    href: '/platform-v7/driver/field',
    focus: 'видит один рейс и одно действие',
    action: 'закрыть полевой статус без лишнего текста',
  },
  {
    role: 'Банк',
    href: '/platform-v7/bank/release-safety',
    focus: 'видит документы, риск и основание',
    action: 'проверить возможность выпуска денег',
  },
] as const;

const executionPath = [
  'цена и допуск',
  'сделка',
  'логистика',
  'приёмка',
  'документы',
  'деньги',
  'спор',
  'доказательства',
] as const;

const proofItems = [
  { label: 'Документы', text: 'СДИЗ, ЭТрН, акт расхождения и банковское основание сведены к сделке.' },
  { label: 'Деньги', text: 'Каждый стоп показывает сумму, причину, владельца и следующий шаг.' },
  { label: 'Статус зрелости', text: 'Controlled-pilot / pre-integration. Боевые подключения требуют доступов и договоров.' },
] as const;

export default function PlatformV7RootPage() {
  const primary = blockers[0];

  return (
    <main data-testid='platform-v7-root-execution-cockpit' style={page}>
      <section style={hero}>
        <div style={heroTop}>
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={eyebrow}>Цифровой контур исполнения сделки</div>
            <h1 style={h1}>От причины к деньгам за один экран</h1>
            <p style={lead}>
              Платформа показывает не просто разделы, а цепочку: документ, рейс, качество или спор → блокер → деньги → ответственный → действие.
            </p>
          </div>
          <Link href={primary.href} style={primaryAction}>Открыть главный блокер</Link>
        </div>

        <div style={heroGrid}>
          <div style={moneyCard}>
            <div style={moneyLabel}>Остановлено сейчас</div>
            <div style={moneyValue}>15,89 млн ₽</div>
            <div style={causeLine}>СДИЗ · ЭТрН · акт расхождения → расчёт не идёт дальше</div>
          </div>
          <div style={pilotCard}>
            <div style={pilotTitle}>Контролируемый предпилотный контур</div>
            <div style={pilotText}>Без заявлений о live-интеграциях. Банк, ФГИС, ЭДО и ЭПД подключаются только после доступов, договоров и проверки на реальных сделках.</div>
          </div>
        </div>
      </section>

      <section style={pathCard} aria-label='Путь исполнения сделки'>
        {executionPath.map((step, index) => (
          <div key={step} style={pathStep}>
            <span style={pathNumber}>{index + 1}</span>
            <span style={pathLabel}>{step}</span>
          </div>
        ))}
      </section>

      <section style={laneGrid} aria-label='Состояние контура'>
        {lanes.map((item) => <Lane key={item.label} item={item} />)}
      </section>

      <section style={twoColumn}>
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

        <section style={stack} aria-label='Ролевой вход'>
          <div style={sectionHead}>
            <div>
              <div style={eyebrow}>Ролевой вход</div>
              <h2 style={h2}>Каждая сторона видит своё действие</h2>
            </div>
          </div>
          {roles.map((item) => <RoleCard key={item.role} item={item} />)}
        </section>
      </section>

      <section style={proofGrid} aria-label='Почему можно доверять контуру'>
        {proofItems.map((item) => (
          <div key={item.label} style={proofCard}>
            <div style={proofLabel}>{item.label}</div>
            <div style={proofText}>{item.text}</div>
          </div>
        ))}
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
        <div style={blockerMeta}>{item.cause}</div>
        <div style={blockerMeta}>Держит: {item.money} · Ответственный: {item.owner}</div>
      </div>
      <div style={{ ...statusDot, background: dot(item.tone) }} />
    </Link>
  );
}

function RoleCard({ item }: { item: typeof roles[number] }) {
  return (
    <Link href={item.href} style={roleCard}>
      <div style={{ minWidth: 0 }}>
        <div style={roleTitle}>{item.role}</div>
        <div style={roleMeta}>{item.focus}</div>
      </div>
      <div style={roleAction}>{item.action}</div>
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
const heroGrid = { display: 'grid', gridTemplateColumns: 'minmax(0,1.15fr) minmax(260px,.85fr)', gap: 12 } as const;
const eyebrow = { color: '#0A7A5F', fontSize: 11, fontWeight: 950, textTransform: 'uppercase', letterSpacing: '.08em' } as const;
const h1 = { margin: 0, color: '#0F1419', fontSize: 'clamp(30px,8vw,50px)', lineHeight: 1.02, letterSpacing: '-.055em', fontWeight: 950 } as const;
const h2 = { margin: 0, color: '#0F1419', fontSize: 20, lineHeight: 1.15, letterSpacing: '-.025em', fontWeight: 950 } as const;
const lead = { margin: 0, color: '#475569', fontSize: 14, lineHeight: 1.5, maxWidth: 740 } as const;
const primaryAction = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#0A7A5F', color: '#fff', fontSize: 13, fontWeight: 900, boxShadow: '0 12px 24px rgba(10,122,95,.2)', whiteSpace: 'nowrap' } as const;
const ghostAction = { textDecoration: 'none', minHeight: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '8px 11px', borderRadius: 12, background: '#fff', border: '1px solid #CBD5E1', color: '#0F1419', fontSize: 12, fontWeight: 850, whiteSpace: 'nowrap' } as const;
const moneyCard = { background: '#fff', border: '1px solid rgba(37,99,235,.16)', borderRadius: 20, padding: 16, display: 'grid', gap: 5 } as const;
const moneyLabel = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.07em' } as const;
const moneyValue = { color: '#0F1419', fontSize: 34, lineHeight: 1, fontWeight: 950, letterSpacing: '-.045em' } as const;
const causeLine = { color: '#334155', fontSize: 13, lineHeight: 1.45, fontWeight: 750 } as const;
const pilotCard = { background: 'rgba(255,255,255,.72)', border: '1px solid #D7DEE3', borderRadius: 20, padding: 16, display: 'grid', gap: 7, alignContent: 'center' } as const;
const pilotTitle = { color: '#0F1419', fontSize: 15, lineHeight: 1.2, fontWeight: 950 } as const;
const pilotText = { color: '#475569', fontSize: 13, lineHeight: 1.45, fontWeight: 650 } as const;
const pathCard = { background: '#0F1419', borderRadius: 22, padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 } as const;
const pathStep = { display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr)', alignItems: 'center', gap: 8, minHeight: 42, padding: '8px 9px', borderRadius: 14, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.10)' } as const;
const pathNumber = { width: 22, height: 22, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', color: '#0F1419', fontSize: 11, fontWeight: 950 } as const;
const pathLabel = { color: '#F8FAFC', fontSize: 12, lineHeight: 1.2, fontWeight: 800 } as const;
const laneGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 } as const;
const lane = { border: '1px solid', borderRadius: 18, padding: 14, display: 'grid', gap: 6 } as const;
const laneLabel = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.07em' } as const;
const laneValue = { color: '#0F1419', fontSize: 20, lineHeight: 1, fontWeight: 950, letterSpacing: '-.03em' } as const;
const laneState = { color: '#64748B', fontSize: 12, lineHeight: 1.35, fontWeight: 750 } as const;
const twoColumn = { display: 'grid', gridTemplateColumns: 'minmax(0,1.08fr) minmax(280px,.92fr)', gap: 12, alignItems: 'start' } as const;
const stack = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 16, display: 'grid', gap: 10 } as const;
const sectionHead = { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start', flexWrap: 'wrap' } as const;
const blocker = { textDecoration: 'none', color: 'inherit', border: '1px solid', borderRadius: 18, padding: 14, display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto', gap: 12, alignItems: 'center', boxShadow: '0 8px 20px rgba(15,23,42,.04)' } as const;
const rank = { width: 32, height: 32, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', color: '#0F1419', fontSize: 12, fontWeight: 950 } as const;
const blockerTitle = { color: '#0F1419', fontSize: 15, lineHeight: 1.25, fontWeight: 950, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } as const;
const blockerMeta = { color: '#64748B', fontSize: 12, lineHeight: 1.4 } as const;
const statusDot = { width: 10, height: 10, borderRadius: 999, boxShadow: '0 0 0 4px rgba(15,23,42,.04)' } as const;
const roleCard = { textDecoration: 'none', color: 'inherit', display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 8, padding: 13, borderRadius: 16, border: '1px solid #E4E6EA', background: 'linear-gradient(180deg,#FFFFFF 0%,#F8FAFC 100%)' } as const;
const roleTitle = { color: '#0F1419', fontSize: 15, lineHeight: 1.2, fontWeight: 950 } as const;
const roleMeta = { color: '#64748B', fontSize: 12, lineHeight: 1.4, marginTop: 3 } as const;
const roleAction = { color: '#0A7A5F', fontSize: 12, lineHeight: 1.35, fontWeight: 850 } as const;
const proofGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 } as const;
const proofCard = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 14, display: 'grid', gap: 6 } as const;
const proofLabel = { color: '#0A7A5F', fontSize: 11, fontWeight: 950, textTransform: 'uppercase', letterSpacing: '.07em' } as const;
const proofText = { color: '#334155', fontSize: 13, lineHeight: 1.45, fontWeight: 700 } as const;
