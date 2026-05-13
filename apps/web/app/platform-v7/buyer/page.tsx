import Link from 'next/link';
import { WorkflowActionPanel } from '../../../components/platform-v7/WorkflowActionPanel';
import { RoleExecutionHandoff, type HandoffItem } from '../../../components/platform-v7/RoleExecutionHandoff';
import { P7ActionStateChip } from '../../../components/platform-v7/P7ActionStateChip';
import { JournalPreview } from '../../../components/platform-v7/JournalPreview';
import { ConditionReasonStrip } from '../../../components/platform-v7/ConditionReasonStrip';
import { DocumentReadinessMiniMatrix } from '../../../components/platform-v7/DocumentReadinessMiniMatrix';
import { MoneyImpactSummaryStrip } from '../../../components/platform-v7/MoneyImpactSummaryStrip';
import { ActionFeedbackPreviewStrip } from '../../../components/platform-v7/ActionFeedbackPreviewStrip';

const buyerHandoff: HandoffItem[] = [
  {
    direction: 'sends',
    role: 'покупатель → банк',
    requirement: 'запрос банковского подтверждения резерва',
    entity: 'DL-9106',
    href: '/platform-v7/deals/DL-9106/money',
    moneyImpact: true,
  },
  {
    direction: 'sends',
    role: 'покупатель → продавец',
    requirement: 'предложение с условиями: цена, объём, базис и документы',
    entity: 'LOT-2403',
    href: '/platform-v7/lots/LOT-2403',
    documentImpact: true,
  },
  {
    direction: 'awaits',
    role: 'от банка',
    requirement: 'резерв ожидает банковского подтверждения — до этого сделка не переходит к логистике',
    moneyImpact: true,
  },
  {
    direction: 'awaits',
    role: 'от элеватора',
    requirement: 'акт приёмки и протокол качества влияют на итоговый расчёт и удержание',
    documentImpact: true,
    moneyImpact: true,
  },
  {
    direction: 'next',
    requirement: 'запросить банковское подтверждение резерва и перейти к логистике после статуса банка',
    entity: 'DL-9106',
    href: '/platform-v7/deals/DL-9106/clean',
    moneyImpact: true,
  },
];

type MetricItem = { label: string; value: string; note: string; good?: boolean; warn?: boolean; danger?: boolean };

const buyerMetrics: MetricItem[] = [
  { label: 'Подходящие партии', value: '7', note: 'по культуре, региону и документам' },
  { label: 'Мой резерв', value: '9,65 млн ₽', note: 'готовность денег по DL-9106', good: true },
  { label: 'Под удержанием', value: '624 тыс. ₽', note: 'спорная часть по весу', danger: true },
  { label: 'Следующий шаг', value: 'резерв', note: 'получить банковское подтверждение', warn: true },
];

const buyerLots = [
  {
    id: 'LOT-2405',
    title: 'Пшеница 4 класса · 240 т · Тамбовская область',
    price: '16 120 ₽/т',
    status: 'лучшее предложение',
    next: 'улучшить предложение или ждать окончания окна',
    href: '/platform-v7/lots/LOT-2405',
  },
  {
    id: 'LOT-2403',
    title: 'Пшеница 4 класса · 600 т · Тамбовская область',
    price: '16 080 ₽/т',
    status: 'предложение принято',
    next: 'запросить банковское подтверждение резерва',
    href: '/platform-v7/lots/LOT-2403',
  },
] as const;

const buyerPaths = [
  { title: 'Создать запрос', href: '/platform-v7/buyer/rfq/new', note: 'культура, объём, регион, базис, документы' },
  { title: 'Подобрать партии', href: '/platform-v7/buyer/matches', note: 'цена до точки, качество, логистика, риск' },
  { title: 'Мои предложения', href: '/platform-v7/buyer/offers', note: 'условия, срок действия и принятие' },
  { title: 'Резерв денег', href: '/platform-v7/deals/DL-9106/money', note: 'готовность денег без преждевременного движения' },
] as const;

export default function PlatformV7BuyerPage() {
  return (
    <main style={{ display: 'grid', gap: 14, padding: '4px 0 24px' }}>
      <section style={hero}>
        <div style={badge}>Кабинет покупателя</div>
        <h1 style={h1}>Закупка зерна: партии, предложения, резерв</h1>
        <p style={lead}>Покупатель видит запрос, подходящие партии, свои предложения, резерв денег, документы, логистику и следующий обязательный шаг.</p>
        <div style={actions}>
          <Link href='/platform-v7/buyer/rfq/new' style={primaryBtn}>Создать запрос</Link>
          <Link href='/platform-v7/deals/DL-9106/clean' style={ghostBtn}>Карточка сделки</Link>
        </div>
      </section>

      <section style={metricsGrid}>
        {buyerMetrics.map((metric) => <Metric key={metric.label} metric={metric} />)}
      </section>

      <MoneyImpactSummaryStrip
        amountContext='резерв 9,65 млн ₽ · удержание 624 тыс. ₽'
        pilotState='waiting'
        pilotStateLabel='пилотный контур · ожидание подтверждения'
        responsible='покупатель · банк'
        nextStep='ожидать банковского подтверждения резерва'
        stopReason='сделка не переходит к логистике до банковского подтверждения'
        requiredEvidence='банковское подтверждение резерва; по спорной части — акт приёмки и протокол качества'
        afterResolved='после подтверждения резерва сделка переходит к логистике; спорная часть остаётся под удержанием до закрытия расхождения'
        bankPlatformBoundary='платформа показывает причину и следующий шаг, банк подтверждает резерв и дальнейшее движение денег'
      />

      <P7ActionStateChip
        status='active'
        label='пилотный сценарий'
        nextActor='покупатель'
        moneyEffect='резерв после банковского подтверждения'
      />

      <ConditionReasonStrip
        condition='пилотный сценарий'
        responsible='покупатель'
        documentState='ожидает банковского подтверждения'
      />

      <DocumentReadinessMiniMatrix role='buyer' />

      <WorkflowActionPanel context='buyer' />

      <ActionFeedbackPreviewStrip context='buyer' />

      <RoleExecutionHandoff items={buyerHandoff} title='исполнение: что покупатель отправляет и ожидает' />

      <JournalPreview role='buyer' maxEntries={3} />

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
      <div style={{ color: metric.danger ? '#B91C1C' : metric.warn ? '#B45309' : metric.good ? '#0A7A5F' : '#2563EB', fontSize: 29, lineHeight: 1, fontWeight: 950, letterSpacing: '-0.035em' }}>{metric.value}</div>
      <p style={{ margin: 0, color: '#64748B', fontSize: 12, lineHeight: 1.5, fontWeight: 750 }}>{metric.note}</p>
    </div>
  );
}

function Cell({ label, value, strong = false, warning = false }: { label: string; value: string; strong?: boolean; warning?: boolean }) {
  return <div style={cell}><div style={micro}>{label}</div><div style={{ marginTop: 4, color: warning ? '#B45309' : strong ? '#0A7A5F' : '#0F1419', fontSize: 13, lineHeight: 1.35, fontWeight: 900 }}>{value}</div></div>;
}

const hero = { background: 'linear-gradient(135deg,#FFFFFF 0%,#F8FAFB 58%,#EEF4FF 100%)', border: '1px solid #E4E6EA', borderRadius: 28, padding: 22, display: 'grid', gap: 12, boxShadow: '0 18px 44px rgba(15,23,42,0.08)' } as const;
const card = { background: 'linear-gradient(180deg,#FFFFFF 0%,#F8FAFB 100%)', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 12, boxShadow: '0 14px 34px rgba(15,23,42,0.055)' } as const;
const badge = { display: 'inline-flex', width: 'fit-content', padding: '7px 11px', borderRadius: 999, background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.18)', color: '#2563EB', fontSize: 12, fontWeight: 900 } as const;
const h1 = { margin: 0, color: '#0F1419', fontSize: 'clamp(28px,7vw,42px)', lineHeight: 1.06, letterSpacing: '-0.04em', fontWeight: 950 } as const;
const h2 = { margin: '4px 0 0', color: '#0F1419', fontSize: 22, lineHeight: 1.08, fontWeight: 950, letterSpacing: '-0.025em' } as const;
const lead = { margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.56 } as const;
const actions = { display: 'flex', gap: 8, flexWrap: 'wrap' } as const;
const primaryBtn = { textDecoration: 'none', minHeight: 46, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '12px 15px', borderRadius: 14, background: '#2563EB', color: '#fff', fontSize: 14, fontWeight: 900, boxShadow: '0 14px 30px rgba(37,99,235,0.18)' } as const;
const ghostBtn = { ...primaryBtn, background: '#fff', border: '1px solid #CBD5E1', color: '#0F1419', boxShadow: '0 10px 24px rgba(15,23,42,0.06)' } as const;
const metricsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 } as const;
const metricCard = { background: 'linear-gradient(180deg,#FFFFFF 0%,#F8FAFB 100%)', border: '1px solid #E4E6EA', borderRadius: 20, padding: 16, display: 'grid', gap: 8, boxShadow: '0 12px 28px rgba(15,23,42,0.055)' } as const;
const pathGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 8 } as const;
const pathCard = { textDecoration: 'none', minHeight: 132, display: 'grid', alignContent: 'start', gap: 8, padding: 14, borderRadius: 20, background: '#fff', border: '1px solid #E4E6EA', boxShadow: '0 10px 24px rgba(15,23,42,0.045)' } as const;
const lotRow = { textDecoration: 'none', color: 'inherit', background: 'linear-gradient(180deg,#FFFFFF 0%,#F8FAFB 100%)', border: '1px solid #E4E6EA', borderRadius: 22, padding: 16, display: 'grid', gap: 12, boxShadow: '0 12px 30px rgba(15,23,42,0.055)' } as const;
const rowGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(155px,1fr))', gap: 8 } as const;
const cell = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 14, padding: 10, minWidth: 0, boxShadow: '0 8px 18px rgba(15,23,42,0.035)' } as const;
const idText = { color: '#2563EB', fontSize: 13, fontWeight: 950 } as const;
const micro = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' } as const;
