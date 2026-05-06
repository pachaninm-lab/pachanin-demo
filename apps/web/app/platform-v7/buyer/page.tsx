import Link from 'next/link';
import { WorkflowActionPanel } from '../../../components/platform-v7/WorkflowActionPanel';

type MetricItem = { label: string; value: string; note: string; good?: boolean; warn?: boolean; danger?: boolean };

const buyerMetrics: MetricItem[] = [
  { label: 'Подходящие партии', value: '7', note: 'отфильтрованы по культуре, региону и документам' },
  { label: 'Мой резерв', value: '9,65 млн ₽', note: 'готовность денег по DL-9106', good: true },
  { label: 'Под удержанием', value: '624 тыс. ₽', note: 'спорная часть по весу', danger: true },
  { label: 'Следующий шаг', value: 'резерв', note: 'подтвердить денежный guard', warn: true },
];

const buyerLots = [
  {
    id: 'LOT-2405',
    title: 'Пшеница 4 класса · 240 т · Тамбовская область',
    price: '16 120 ₽/т',
    status: 'лучшая ставка',
    next: 'повысить ставку или ждать окончания окна',
    href: '/platform-v7/lots/LOT-2405',
  },
  {
    id: 'LOT-2403',
    title: 'Пшеница 4 класса · 600 т · Тамбовская область',
    price: '16 080 ₽/т',
    status: 'ставка принята',
    next: 'подтвердить резерв денег',
    href: '/platform-v7/lots/LOT-2403',
  },
] as const;

const buyerPaths = [
  { title: 'Создать закупочный запрос', href: '/platform-v7/buyer/rfq/new', note: 'культура, объём, регион, базис, документы' },
  { title: 'Подобрать партии', href: '/platform-v7/buyer/matches', note: 'цена до точки, качество, логистика и риск' },
  { title: 'Предложения покупателя', href: '/platform-v7/buyer/offers', note: 'версии условий, срок действия и принятие' },
  { title: 'Резерв денег', href: '/platform-v7/deals/DL-9106/money', note: 'готовность денег без преждевременного выпуска' },
] as const;

export default function PlatformV7BuyerPage() {
  return (
    <main style={{ display: 'grid', gap: 14, padding: '4px 0 24px' }}>
      <section style={hero}>
        <div style={badge}>Кабинет покупателя</div>
        <h1 style={h1}>Запросы, партии, предложения и резерв денег</h1>
        <p style={lead}>Ставка должна сразу вести к сделке, резерву денег и логистике. Покупатель видит свой закупочный запрос, подходящие партии, собственные предложения, статус резерва, документы и следующий обязательный шаг.</p>
        <div style={actions}>
          <Link href='/platform-v7/buyer/rfq/new' style={primaryBtn}>Создать запрос</Link>
          <Link href='/platform-v7/buyer/matches' style={ghostBtn}>Подбор партий</Link>
          <Link href='/platform-v7/buyer/offers' style={ghostBtn}>Предложения</Link>
          <Link href='/platform-v7/buyer/financing' style={ghostBtn}>Оплата в кредит</Link>
          <Link href='/platform-v7/deals/DL-9106/clean' style={ghostBtn}>Карточка сделки</Link>
        </div>
      </section>

      <section style={metricsGrid}>
        {buyerMetrics.map((metric) => <Metric key={metric.label} metric={metric} />)}
      </section>

      <WorkflowActionPanel context='buyer' />

      <section style={card}>
        <div style={micro}>рабочие маршруты покупателя</div>
        <div style={pathGrid}>
          {buyerPaths.map((path) => (
            <Link key={path.href} href={path.href} style={pathCard}>
              <strong style={{ color: '#0F1419', fontSize: 16 }}>{path.title}</strong>
              <span style={{ color: '#64748B', fontSize: 13, lineHeight: 1.45 }}>{path.note}</span>
              <span style={{ color: '#2563EB', fontSize: 12, fontWeight: 900 }}>Открыть</span>
            </Link>
          ))}
        </div>
      </section>

      <section style={card}>
        <div style={micro}>партии для закупки</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {buyerLots.map((lot) => (
            <Link key={lot.id} href={lot.href} style={lotRow}>
              <div>
                <div style={idText}>{lot.id}</div>
                <h2 style={h2}>{lot.title}</h2>
              </div>
              <div style={rowGrid}>
                <Cell label='Цена' value={lot.price} strong />
                <Cell label='Статус' value={lot.status} />
                <Cell label='Следующее действие' value={lot.next} warning />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

function Metric({ metric }: { metric: MetricItem }) {
  return (
    <div style={metricCard}>
      <div style={micro}>{metric.label}</div>
      <div style={{ color: metric.danger ? '#B91C1C' : metric.warn ? '#B45309' : metric.good ? '#0A7A5F' : '#2563EB', fontSize: 28, lineHeight: 1, fontWeight: 950 }}>{metric.value}</div>
      <p style={{ margin: 0, color: '#64748B', fontSize: 12, lineHeight: 1.45, fontWeight: 750 }}>{metric.note}</p>
    </div>
  );
}

function Cell({ label, value, strong = false, warning = false }: { label: string; value: string; strong?: boolean; warning?: boolean }) {
  return <div style={cell}><div style={micro}>{label}</div><div style={{ marginTop: 4, color: warning ? '#B45309' : strong ? '#0A7A5F' : '#0F1419', fontSize: 13, lineHeight: 1.35, fontWeight: 900 }}>{value}</div></div>;
}

const hero = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 10 } as const;
const card = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 12 } as const;
const badge = { display: 'inline-flex', width: 'fit-content', padding: '7px 11px', borderRadius: 999, background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.18)', color: '#2563EB', fontSize: 12, fontWeight: 900 } as const;
const h1 = { margin: 0, color: '#0F1419', fontSize: 'clamp(30px,8vw,48px)', lineHeight: 1.03, letterSpacing: '-0.045em', fontWeight: 950 } as const;
const h2 = { margin: '4px 0 0', color: '#0F1419', fontSize: 22, lineHeight: 1.08, fontWeight: 950 } as const;
const lead = { margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.55 } as const;
const actions = { display: 'flex', gap: 8, flexWrap: 'wrap' } as const;
const primaryBtn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#2563EB', color: '#fff', fontSize: 14, fontWeight: 900 } as const;
const ghostBtn = { ...primaryBtn, background: '#fff', border: '1px solid #CBD5E1', color: '#0F1419' } as const;
const metricsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 } as const;
const metricCard = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 16, display: 'grid', gap: 8 } as const;
const pathGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 8 } as const;
const pathCard = { textDecoration: 'none', minHeight: 130, display: 'grid', alignContent: 'start', gap: 8, padding: 14, borderRadius: 18, background: '#F8FAFB', border: '1px solid #E4E6EA' } as const;
const lotRow = { textDecoration: 'none', color: 'inherit', background: '#F8FAFB', border: '1px solid #E4E6EA', borderRadius: 20, padding: 15, display: 'grid', gap: 12 } as const;
const rowGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(155px,1fr))', gap: 8 } as const;
const cell = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 13, padding: 10, minWidth: 0 } as const;
const idText = { color: '#2563EB', fontSize: 13, fontWeight: 950 } as const;
const micro = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' } as const;
