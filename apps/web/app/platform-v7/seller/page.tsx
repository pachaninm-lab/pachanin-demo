import Link from 'next/link';
import { WorkflowActionPanel } from '../../../components/platform-v7/WorkflowActionPanel';
import { RoleExecutionHandoff, type HandoffItem } from '../../../components/platform-v7/RoleExecutionHandoff';
import { P7ActionStateChip } from '../../../components/platform-v7/P7ActionStateChip';
import { JournalPreview } from '../../../components/platform-v7/JournalPreview';
import { ConditionReasonStrip } from '../../../components/platform-v7/ConditionReasonStrip';
import { DocumentReadinessMiniMatrix } from '../../../components/platform-v7/DocumentReadinessMiniMatrix';
import { MoneyImpactSummaryStrip } from '../../../components/platform-v7/MoneyImpactSummaryStrip';
import { ActionGuardPreviewMatrix } from '../../../components/platform-v7/ActionGuardPreviewMatrix';

const sellerHandoff: HandoffItem[] = [
  {
    direction: 'sends',
    role: 'продавец → покупатель',
    requirement: 'публикует лот и ждёт встречного предложения от покупателя',
    entity: 'LOT-2403',
    href: '/platform-v7/lots/LOT-2403',
    documentImpact: true,
  },
  {
    direction: 'awaits',
    role: 'от покупателя и банка',
    requirement: 'резерв ожидает банковского подтверждения',
    moneyImpact: true,
  },
  {
    direction: 'awaits',
    role: 'от ФГИС «Зерно»',
    requirement: 'СДИЗ ожидает закрытия — без этого выплата не передаётся на проверку банка',
    moneyImpact: true,
    documentImpact: true,
  },
  {
    direction: 'blockedBy',
    requirement: 'ЭТрН, акт приёмки и протокол качества ещё не закрыты',
    documentImpact: true,
    moneyImpact: true,
  },
  {
    direction: 'next',
    requirement: 'закрыть СДИЗ, ЭТрН и акт приёмки для передачи выплаты на банковскую проверку',
    entity: 'DL-9106',
    href: '/platform-v7/deals/DL-9106/clean',
    moneyImpact: true,
  },
];

type MetricItem = { label: string; value: string; note: string; good?: boolean; warn?: boolean; danger?: boolean };

const sellerMetrics: MetricItem[] = [
  { label: 'Активные лоты', value: '2', note: 'оба связаны с партиями и документами', good: true },
  { label: 'Резерв покупателя', value: '9,65 млн ₽', note: 'виден как готовность денег, не как выплата', good: true },
  { label: 'К выплате сейчас', value: '0 ₽', note: 'СДИЗ и ЭТрН ещё блокируют проверку выплаты', danger: true },
  { label: 'Следующий шаг', value: 'СДИЗ', note: 'без документа выплата не передаётся на банковскую проверку', warn: true },
];

const sellerLots = [
  {
    id: 'LOT-2403',
    title: 'Пшеница 4 класса · 600 т · EXW',
    status: 'предложение принято',
    money: 'резерв 9,65 млн ₽ · к выплате 0 ₽',
    next: 'закрыть СДИЗ, ЭТрН и приёмку',
    href: '/platform-v7/lots/LOT-2403',
  },
  {
    id: 'LOT-2405',
    title: 'Пшеница 4 класса · 240 т · EXW',
    status: 'идут предложения',
    money: 'лучшая ставка 16 120 ₽/т',
    next: 'проверить рейтинг покупателя и условия резерва',
    href: '/platform-v7/lots/LOT-2405',
  },
] as const;

const sellerPaths = [
  { title: 'Создать партию', href: '/platform-v7/seller/batches/new', note: 'культура, объём, качество, документы, ФГИС' },
  { title: 'Опубликовать лот', href: '/platform-v7/seller/lots/new', note: 'управляемая публикация без раскрытия контактов' },
  { title: 'Проверить запросы', href: '/platform-v7/seller/rfq', note: 'сравнение спроса, netback и рисков покупателя' },
  { title: 'Открыть сделку', href: '/platform-v7/deals/DL-9106/clean', note: 'деньги, документы, рейс, спор и аудит' },
] as const;

export default function PlatformV7SellerPage() {
  return (
    <main style={{ display: 'grid', gap: 14, padding: '4px 0 24px' }}>
      <section style={hero}>
        <div style={badge}>Кабинет продавца</div>
        <h1 style={h1}>Лоты, предложения, документы и проверка выплаты</h1>
        <p style={lead}>Лот должен приводить к сделке, документам и получению денег. Продавец видит рабочий контур: партия → лот → предложение → черновик сделки → резерв → документы → рейс → приёмка → банковская проверка выплаты.</p>
        <div style={actions}>
          <Link href='/platform-v7/seller/batches/new' style={primaryBtn}>Создать партию</Link>
          <Link href='/platform-v7/deals/DL-9106/clean' style={ghostBtn}>Открыть сделку</Link>
        </div>
      </section>

      <section style={metricsGrid}>
        {sellerMetrics.map((metric) => <Metric key={metric.label} metric={metric} />)}
      </section>

      <MoneyImpactSummaryStrip
        amountContext='резерв 9,65 млн ₽ · к выплате 0 ₽'
        pilotState='waiting'
        pilotStateLabel='пилотный контур · ожидание документов'
        responsible='продавец · ФГИС «Зерно»'
        nextStep='закрыть СДИЗ и ЭТрН для передачи выплаты на банковскую проверку'
        stopReason='проверка выплаты остановлена: СДИЗ и ЭТрН не закрыты'
      />

      <P7ActionStateChip
        status='waiting'
        label='пилотный сценарий'
        nextActor='ФГИС «Зерно» и банк'
        blocker='СДИЗ и ЭТрН не закрыты'
        moneyEffect='проверка выплаты остановлена'
      />

      <ConditionReasonStrip
        condition='пилотный сценарий'
        responsible='ФГИС «Зерно» и банк'
        documentState='СДИЗ и ЭТрН не закрыты'
        stopReason='проверка выплаты остановлена'
      />

      <DocumentReadinessMiniMatrix role='seller' />

      <ActionGuardPreviewMatrix context='seller' />

      <WorkflowActionPanel context='seller' />

      <RoleExecutionHandoff items={sellerHandoff} title='исполнение: что продавец отправляет и ожидает' />

      <JournalPreview role='seller' maxEntries={3} />

      <section style={card}>
        <div style={micro}>рабочие маршруты продавца</div>
        <div style={pathGrid}>
          {sellerPaths.map((path) => (
            <Link key={path.href} href={path.href} style={pathCard}>
              <strong style={{ color: '#0F1419', fontSize: 16 }}>{path.title}</strong>
              <span style={{ color: '#64748B', fontSize: 13, lineHeight: 1.45 }}>{path.note}</span>
              <span style={{ color: '#0A7A5F', fontSize: 12, fontWeight: 900 }}>Открыть</span>
            </Link>
          ))}
        </div>
      </section>

      <section style={card}>
        <div style={micro}>лоты продавца</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {sellerLots.map((lot) => (
            <Link key={lot.id} href={lot.href} style={lotRow}>
              <div>
                <div style={idText}>{lot.id}</div>
                <h2 style={h2}>{lot.title}</h2>
              </div>
              <div style={rowGrid}>
                <Cell label='Статус' value={lot.status} />
                <Cell label='Деньги' value={lot.money} strong />
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
      <div style={{ color: metric.danger ? '#B91C1C' : metric.warn ? '#B45309' : metric.good ? '#0A7A5F' : '#0F1419', fontSize: 28, lineHeight: 1, fontWeight: 950 }}>{metric.value}</div>
      <p style={{ margin: 0, color: '#64748B', fontSize: 12, lineHeight: 1.45, fontWeight: 750 }}>{metric.note}</p>
    </div>
  );
}

function Cell({ label, value, strong = false, warning = false }: { label: string; value: string; strong?: boolean; warning?: boolean }) {
  return <div style={cell}><div style={micro}>{label}</div><div style={{ marginTop: 4, color: warning ? '#B45309' : strong ? '#0A7A5F' : '#0F1419', fontSize: 13, lineHeight: 1.35, fontWeight: 900 }}>{value}</div></div>;
}

const hero = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 10 } as const;
const card = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 12 } as const;
const badge = { display: 'inline-flex', width: 'fit-content', padding: '7px 11px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 12, fontWeight: 900 } as const;
const h1 = { margin: 0, color: '#0F1419', fontSize: 'clamp(30px,8vw,48px)', lineHeight: 1.03, letterSpacing: '-0.045em', fontWeight: 950 } as const;
const h2 = { margin: '4px 0 0', color: '#0F1419', fontSize: 22, lineHeight: 1.08, fontWeight: 950 } as const;
const lead = { margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.55 } as const;
const actions = { display: 'flex', gap: 8, flexWrap: 'wrap' } as const;
const primaryBtn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#0A7A5F', color: '#fff', fontSize: 14, fontWeight: 900 } as const;
const ghostBtn = { ...primaryBtn, background: '#fff', border: '1px solid #CBD5E1', color: '#0F1419' } as const;
const metricsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 } as const;
const metricCard = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 16, display: 'grid', gap: 8 } as const;
const pathGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 8 } as const;
const pathCard = { textDecoration: 'none', minHeight: 130, display: 'grid', alignContent: 'start', gap: 8, padding: 14, borderRadius: 18, background: '#F8FAFB', border: '1px solid #E4E6EA' } as const;
const lotRow = { textDecoration: 'none', color: 'inherit', background: '#F8FAFB', border: '1px solid #E4E6EA', borderRadius: 20, padding: 15, display: 'grid', gap: 12 } as const;
const rowGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(155px,1fr))', gap: 8 } as const;
const cell = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 13, padding: 10, minWidth: 0 } as const;
const idText = { color: '#0A7A5F', fontSize: 13, fontWeight: 950 } as const;
const micro = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' } as const;
