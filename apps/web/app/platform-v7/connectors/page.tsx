import Link from 'next/link';

const integrations = [
  { name: 'Сбер · Безопасные сделки', role: 'резерв и банковское подтверждение', status: 'условия на проверке', screen: '/platform-v7/bank', state: 'wait', mode: 'контур проверки', live: 'внешнее банковское подтверждение не заявлено' },
  { name: 'Сбер · Оплата в кредит', role: 'кредитный лимит покупателя', status: 'сценарий покупателя', screen: '/platform-v7/buyer', state: 'ok', mode: 'контур проверки', live: 'требуется банковский договор и доступ' },
  { name: 'ФГИС «Зерно»', role: 'СДИЗ и партия зерна', status: 'СДИЗ блокирует основание', screen: '/platform-v7/documents', state: 'stop', mode: 'адаптер требует доступа', live: 'внешний API не подтверждён' },
  { name: 'Контур.Диадок', role: 'договор, УПД, акт', status: 'УПД ждёт подписи', screen: '/platform-v7/documents', state: 'stop', mode: 'контур проверки', live: 'внешнее ЭДО не заявлено' },
  { name: 'СБИС / Saby ЭТрН', role: 'электронная транспортная накладная', status: 'ждёт подписи грузополучателя', screen: '/platform-v7/logistics', state: 'stop', mode: 'контур проверки', live: 'внешний ЭТрН-контур не заявлен' },
  { name: 'ГИС ЭПД', role: 'передача перевозочного документа', status: 'ожидает закрытия ЭТрН', screen: '/platform-v7/logistics', state: 'wait', mode: 'адаптер требует доступа', live: 'внешний обмен не подтверждён' },
  { name: 'КриптоПро DSS', role: 'КЭП и полномочия подписи', status: 'сертификат на проверке', screen: '/platform-v7/documents', state: 'ok', mode: 'контур проверки', live: 'внешнее подписание не заявлено' },
  { name: 'ATI.SU', role: 'расчёт перевозчика', status: 'перевозчик выбран в сценарии', screen: '/platform-v7/logistics', state: 'ok', mode: 'контур проверки', live: 'внешний подбор не заявлен' },
  { name: 'Wialon', role: 'телематика и GPS-события', status: 'точка водителя 62% пути', screen: '/platform-v7/driver', state: 'ok', mode: 'контур проверки', live: 'внешний GPS не подключён' },
  { name: 'Яндекс.Карты', role: 'визуальная карта маршрута', status: 'карта рейса', screen: '/platform-v7/driver', state: 'ok', mode: 'контур проверки', live: 'визуальный маршрут без внешнего трекинга' },
  { name: 'ФГБУ ЦОК АПК', role: 'протокол качества', status: 'протокол ожидается', screen: '/platform-v7/elevator', state: 'wait', mode: 'контур проверки', live: 'внешний лабораторный обмен не заявлен' },
] as const;

const connectorSummary = [
  { label: 'Что сейчас', value: '11 именных контуров', note: 'Это управляемые маршруты интеграции, а не заявление о внешнем подключении.' },
  { label: 'Что блокирует', value: 'ФГИС, ЭТрН, УПД', note: 'Эти контуры напрямую останавливают банковское основание.' },
  { label: 'Где деньги', value: 'банк · резерв · проверка основания', note: 'Банковый контур показывает основание, статус и причину остановки.' },
  { label: 'Где груз', value: 'логистика · водитель · карта', note: 'GPS и маршрут показаны как факты рейса без заявления внешнего трекинга.' },
  { label: 'Что нельзя обещать', value: 'готовность без подтверждений', note: 'Внешние подключения требуют договоров, доступов, сертификатов и проверок.' },
  { label: 'Следующий шаг', value: 'закрыть доступы и контуры проверки', note: 'После проверки — подтверждать на реальных сделках и документах.' },
] as const;

export default function PlatformV7ConnectorsPage() {
  const stop = integrations.filter((item) => item.state === 'stop').length;
  const ok = integrations.filter((item) => item.state === 'ok').length;
  const wait = integrations.filter((item) => item.state === 'wait').length;

  return (
    <main style={{ display: 'grid', gap: 14, padding: '4px 0 24px' }}>
      <section style={hero}>
        <div style={badge}>Реестр интеграций</div>
        <h1 style={h1}>Именные контуры сделки</h1>
        <p style={lead}>Интеграции показаны как контуры проверки по логике реального подключения. Пользователь видит влияние на сделку: деньги, документы, рейс и качество, без заявления внешнего интеграционного статуса.</p>
        <div style={actions}>
          <Link href='/platform-v7/deals/DL-9106/clean' style={primaryBtn}>Открыть сделку</Link>
          <Link href='/platform-v7/documents' style={ghostBtn}>Документы</Link>
          <Link href='/platform-v7/bank' style={ghostBtn}>Деньги</Link>
        </div>
      </section>

      <section style={darkCard}>
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ ...micro, color: '#0A7A5F' }}>статус подключений</div>
          <h2 style={{ margin: 0, color: '#0F1419', fontSize: 'clamp(24px,6vw,36px)', lineHeight: 1.08, letterSpacing: '-0.04em', fontWeight: 950 }}>Что должно быть понятно за 5 секунд</h2>
          <p style={{ margin: 0, color: '#475569', fontSize: 14, lineHeight: 1.55 }}>Экран отделяет рабочие статусы, ручную проверку, адаптеры с недостающими доступами и внешние подключения, которые пока нельзя заявлять.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10 }}>
          {connectorSummary.map((item) => <SummaryCard key={item.label} item={item} />)}
        </div>
      </section>

      <section style={metricsGrid}>
        <Metric label='Контуров' value={String(integrations.length)} />
        <Metric label='Останавливают основание' value={String(stop)} danger />
        <Metric label='Ждут подтверждения' value={String(wait)} warn />
        <Metric label='Статус закрыт' value={String(ok)} good />
      </section>

      <section style={card}>
        <div style={micro}>Интеграции по именам</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {integrations.map((item) => <IntegrationRow key={item.name} item={item} />)}
        </div>
      </section>
    </main>
  );
}

function SummaryCard({ item }: { item: typeof connectorSummary[number] }) {
  return <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 13, display: 'grid', gap: 7 }}><div style={{ ...micro, color: '#0A7A5F' }}>{item.label}</div><strong style={{ color: '#0F1419', fontSize: 14, lineHeight: 1.4 }}>{item.value}</strong><p style={{ margin: 0, color: '#475569', fontSize: 12, lineHeight: 1.45 }}>{item.note}</p></div>;
}

function IntegrationRow({ item }: { item: typeof integrations[number] }) {
  return (
    <Link href={item.screen} style={{ textDecoration: 'none', color: 'inherit', background: stateBg(item.state), border: `1px solid ${stateBorder(item.state)}`, borderRadius: 16, padding: 13, display: 'grid', gap: 8 }}>
      <div style={rowHead}>
        <div>
          <h2 style={h2}>{item.name}</h2>
          <p style={muted}>{item.role}</p>
        </div>
        <span style={{ ...pill, color: stateText(item.state), borderColor: stateBorder(item.state), background: '#fff' }}>{item.status}</span>
      </div>
      <div style={detailGrid}>
        <Small label='Режим' value={item.mode} />
        <Small label='Граница обещания' value={item.live} warning />
        <Small label='Экран влияния' value={item.screen.replace('/platform-v7/', '') || 'platform-v7'} />
      </div>
    </Link>
  );
}

function Small({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return <div style={small}><div style={micro}>{label}</div><div style={{ marginTop: 4, color: warning ? '#B45309' : '#0F1419', fontSize: 12, fontWeight: 900, lineHeight: 1.35 }}>{value}</div></div>;
}

function Metric({ label, value, good = false, warn = false, danger = false }: { label: string; value: string; good?: boolean; warn?: boolean; danger?: boolean }) {
  return <div style={metric}><div style={micro}>{label}</div><div style={{ marginTop: 8, color: danger ? '#B91C1C' : warn ? '#B45309' : good ? '#0A7A5F' : '#0F1419', fontSize: 28, lineHeight: 1, fontWeight: 950 }}>{value}</div></div>;
}

function stateBg(state: string) { return state === 'ok' ? 'rgba(10,122,95,0.06)' : state === 'stop' ? 'rgba(220,38,38,0.06)' : 'rgba(217,119,6,0.06)'; }
function stateBorder(state: string) { return state === 'ok' ? 'rgba(10,122,95,0.18)' : state === 'stop' ? 'rgba(220,38,38,0.18)' : 'rgba(217,119,6,0.18)'; }
function stateText(state: string) { return state === 'ok' ? '#0A7A5F' : state === 'stop' ? '#B91C1C' : '#B45309'; }

const hero = { background: 'linear-gradient(135deg,#FFFFFF 0%,#F8FAFB 62%,#EEF6F3 100%)', border: '1px solid #E4E6EA', borderRadius: 26, padding: 22, display: 'grid', gap: 12 } as const;
const darkCard = { background: '#F8FAFB', color: '#0F1419', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 13, boxShadow: '0 18px 44px rgba(15,23,42,0.06)' } as const;
const card = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 12 } as const;
const metric = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 16 } as const;
const badge = { display: 'inline-flex', width: 'fit-content', padding: '7px 11px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 12, fontWeight: 900 } as const;
const h1 = { margin: 0, color: '#0F1419', fontSize: 'clamp(30px,8vw,48px)', lineHeight: 1.03, letterSpacing: '-0.045em', fontWeight: 950 } as const;
const h2 = { margin: 0, color: '#0F1419', fontSize: 18, lineHeight: 1.1, fontWeight: 950 } as const;
const lead = { margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.55 } as const;
const muted = { margin: '6px 0 0', color: '#64748B', fontSize: 13 } as const;
const rowHead = { display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' } as const;
const micro = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' } as const;
const metricsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 } as const;
const detailGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 8 } as const;
const actions = { display: 'flex', gap: 8, flexWrap: 'wrap' } as const;
const primaryBtn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#0A7A5F', color: '#fff', fontSize: 14, fontWeight: 900 } as const;
const ghostBtn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#fff', border: '1px solid #CBD5E1', color: '#0F1419', fontSize: 14, fontWeight: 850 } as const;
const pill = { display: 'inline-flex', width: 'fit-content', alignItems: 'center', padding: '7px 10px', borderRadius: 999, border: '1px solid #E4E6EA', fontSize: 12, fontWeight: 900 } as const;
const small = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 12, padding: 10 } as const;
