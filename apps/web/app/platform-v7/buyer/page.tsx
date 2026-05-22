import Link from 'next/link';
import { getDealsCanonical } from '@/lib/deals-server';
import { getDisputes, openDisputeCount, disputeTotalHeldRub } from '@/lib/disputes-server';
import { LiveApiStatusBar } from '@/components/platform-v7/LiveApiStatusBar';
import { WorkflowActionPanel } from '../../../components/platform-v7/WorkflowActionPanel';
import { RoleExecutionHandoff, type HandoffItem } from '../../../components/platform-v7/RoleExecutionHandoff';
import { P7ActionStateChip } from '../../../components/platform-v7/P7ActionStateChip';
import { JournalPreview } from '../../../components/platform-v7/JournalPreview';
import { ConditionReasonStrip } from '../../../components/platform-v7/ConditionReasonStrip';
import { DocumentReadinessMiniMatrix } from '../../../components/platform-v7/DocumentReadinessMiniMatrix';
import { MoneyImpactSummaryStrip } from '../../../components/platform-v7/MoneyImpactSummaryStrip';
import { ActionFeedbackPreviewStrip } from '../../../components/platform-v7/ActionFeedbackPreviewStrip';
import { QuietIntelligenceHint } from '@/components/platform-v7/visual/QuietIntelligenceHint';
import { TrustDot } from '@/components/platform-v7/visual/TrustDot';
import { SmartSectionSummary } from '@/components/platform-v7/visual/SmartSectionSummary';
import { CauseLine } from '@/components/platform-v7/visual/CauseLine';
import { UnlockPath } from '@/components/platform-v7/visual/UnlockPath';
import { P7ExecutionActionsPanel, type PlatformV7ExecutionActionUiItem } from '@/components/platform-v7/P7ExecutionActionsPanel';
import { PLATFORM_V7_INITIAL_EXECUTION_ACTION_STATE, type PlatformV7ExecutionActionState } from '@/lib/platform-v7/execution-action-core';

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
  { label: 'Подходящие партии', value: '7', note: 'отфильтрованы по культуре, региону и документам' },
  { label: 'Мой резерв', value: '9,65 млн ₽', note: 'пилотная готовность денег по DL-9106', good: true },
  { label: 'Под удержанием', value: '624 тыс. ₽', note: 'спорная часть по весу', danger: true },
  { label: 'Следующий шаг', value: 'резерв', note: 'запросить банковское подтверждение', warn: true },
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
    next: 'запросить банковское подтверждение резерва',
    href: '/platform-v7/lots/LOT-2403',
  },
] as const;

const buyerPaths = [
  { title: 'Создать закупочный запрос', href: '/platform-v7/buyer/rfq/new', note: 'культура, объём, регион, базис, документы' },
  { title: 'Подобрать партии', href: '/platform-v7/buyer/matches', note: 'цена до точки, качество, логистика и риск' },
  { title: 'Предложения покупателя', href: '/platform-v7/buyer/offers', note: 'версии условий, срок действия и принятие' },
  { title: 'Резерв денег', href: '/platform-v7/deals/DL-9106/money', note: 'готовность денег без преждевременного движения денег' },
] as const;

const buyerSdizInitialState = {
  ...PLATFORM_V7_INITIAL_EXECUTION_ACTION_STATE,
  dealId: 'DL-9106',
  draftDealId: 'DL-9106',
} satisfies PlatformV7ExecutionActionState;

const buyerSdizActionItems = [
  {
    title: 'Отправить СДИЗ на ручную проверку',
    description: 'Создаёт задачу оператору проверить статус СДИЗ во ФГИС или по документу пилота. Это не внешнее подтверждение ФГИС.',
    targetId: 'e4-send-sdiz-manual-review',
    actionId: 'sendSdizManualReview',
    actorRole: 'buyer',
    actorId: 'buyer-user-1',
    entityId: 'SDIZ-DL-9106',
    mode: 'manual',
  },
  {
    title: 'Погасить СДИЗ',
    description: 'Доступно только после оформления, подписи и передачи СДИЗ покупателю; результат остаётся ручной проверкой до внешнего подтверждения.',
    targetId: 'e4-redeem-sdiz',
    actionId: 'redeemSdiz',
    actorRole: 'buyer',
    actorId: 'buyer-user-1',
    entityId: 'SDIZ-DL-9106',
    mode: 'manual',
  },
  {
    title: 'Зафиксировать отказ от погашения',
    description: 'Блокирует выпуск и передаёт задачу поддержке/комплаенсу для обработки основания отказа.',
    targetId: 'e4-refuse-sdiz-redemption',
    actionId: 'refuseSdizRedemption',
    actorRole: 'buyer',
    actorId: 'buyer-user-1',
    entityId: 'SDIZ-DL-9106',
    mode: 'manual',
  },
] satisfies readonly PlatformV7ExecutionActionUiItem[];

export default async function PlatformV7BuyerPage() {
  const [deals, disputes] = await Promise.all([getDealsCanonical(), getDisputes()]);
  const apiOnline = deals.length > 0;
  const disputeCount = openDisputeCount(disputes);
  const heldRub = disputeTotalHeldRub(disputes);

  return (
    <main data-platform-v7-buyer-cockpit-pass='true' style={{ display: 'grid', gap: 14, padding: '4px 0 24px' }}>
      <LiveApiStatusBar
        apiOnline={apiOnline}
        openDisputes={disputeCount}
        role="BUYER · Кабинет покупателя"
        summary={
          apiOnline
            ? `${deals.length} сделок · ${disputeCount} споров · ${heldRub > 0 ? (heldRub / 1_000_000).toFixed(2) + ' млн ₽ удержано' : 'удержаний нет'}`
            : 'Данные статичные — API недоступен'
        }
      />
      <QuietIntelligenceHint
        problem='Резерв 9,65 млн ₽ ждёт банковского подтверждения — логистика не стартует.'
        action='Запросить подтверждение резерва через сделку DL-9106.'
        outcome='После подтверждения банка сделка перейдёт к логистике.'
      />
      <section style={hero}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: 9, maxWidth: 780 }}>
            <div style={badge}>Кабинет покупателя · запрос → резерв → логистика</div>
            <h1 style={h1}>Подтвердить резерв, чтобы сделка пошла в исполнение</h1>
            <p style={lead}>Покупатель видит не доску партий, а контур закупки: запрос, выбранную партию, ставку, резерв, удержание, документы и причину, почему сделка ещё не перешла к логистике.</p>
          </div>
          <div style={blockerCard}>
            <div style={micro}>главный блокер</div>
            <strong style={{ color: '#B45309', fontSize: 18, lineHeight: 1.2 }}>резерв ждёт подтверждение банка</strong>
            <span style={{ color: '#64748B', fontSize: 12, lineHeight: 1.45 }}>логистика не стартует до статуса банка</span>
          </div>
        </div>

        <div style={buyerCockpitGrid} aria-label='Buyer cockpit summary'>
          <CockpitFact label='запрос' value='пшеница 4 класса · 600 т' />
          <CockpitFact label='резерв' value='9,65 млн ₽ · ждёт банк' strong />
          <CockpitFact label='удержание' value='624 тыс. ₽ · вес' danger />
          <CockpitFact label='следующий шаг' value='подтвердить резерв' warning />
        </div>

        <div style={actions}>
          <Link href='/platform-v7/deals/DL-9106/money' style={primaryBtn}>Запросить подтверждение резерва</Link>
          <Link href='/platform-v7/deals/DL-9106/clean' style={ghostBtn}>Открыть сделку</Link>
        </div>
        <TrustDot state='test' size='sm' label='Тестовый контур · Внешние подключения требуют договоров' />
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

      <CauseLine
        cause={{ text: 'Банк не подтвердил резерв', tone: 'blocked' }}
        relation='blocks'
        effect={{ text: 'Логистика не стартует', tone: 'blocked' }}
        moneyAmount='9,65 млн ₽'
        moneyTone='hold'
      />
      <CauseLine
        cause={{ text: 'Вес расходится с актом', tone: 'warning' }}
        relation='affects'
        effect={{ text: 'Удержание на спорную часть', tone: 'warning' }}
        moneyAmount='624 тыс. ₽'
        moneyTone='hold'
      />

      <UnlockPath
        title='Чтобы открыть движение денег покупателя:'
        steps={[
          { id: '1', label: 'Запросить банковское подтверждение резерва', status: 'current', detail: 'DL-9106 · 9,65 млн ₽' },
          { id: '2', label: 'Дождаться статуса банка', status: 'upcoming', detail: 'без этого логистика не стартует' },
          { id: '3', label: 'Закрыть расхождение веса через акт', status: 'upcoming', detail: 'снимет удержание 624 тыс. ₽' },
        ]}
      />

      <DocumentReadinessMiniMatrix role='buyer' />

      <P7ExecutionActionsPanel
        title='СДИЗ покупателя'
        subtitle='Покупатель видит три честных действия: погасить СДИЗ, зафиксировать отказ или отправить статус на ручную проверку. Банк получает только основание для проверки, не сигнал выплаты.'
        items={buyerSdizActionItems}
        initialState={buyerSdizInitialState}
      />

      <WorkflowActionPanel context='buyer' />

      <ActionFeedbackPreviewStrip context='buyer' />

      <RoleExecutionHandoff items={buyerHandoff} title='исполнение: что покупатель отправляет и ожидает' />

      <SmartSectionSummary
        label='Журнал'
        items={[
          { text: 'Резерв 9,65 млн ₽ зарезервирован · ожидает банковского подтверждения', tone: 'warn' },
          { text: 'Удержание 624 тыс. ₽ · расхождение веса по LOT-2403', tone: 'warn' },
        ]}
      />
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

function CockpitFact({ label, value, strong = false, warning = false, danger = false }: { label: string; value: string; strong?: boolean; warning?: boolean; danger?: boolean }) {
  return (
    <div style={cockpitFact}>
      <div style={micro}>{label}</div>
      <strong style={{ color: danger ? '#B91C1C' : warning ? '#B45309' : strong ? '#0A7A5F' : '#0F1419', fontSize: 14, lineHeight: 1.3 }}>{value}</strong>
    </div>
  );
}

const hero = { background: 'linear-gradient(135deg,#FFFFFF 0%,#F8FAFB 58%,#EEF4FF 100%)', border: '1px solid #E4E6EA', borderRadius: 28, padding: 24, display: 'grid', gap: 14, boxShadow: '0 18px 44px rgba(15,23,42,0.08)' } as const;
const card = { background: 'linear-gradient(180deg,#FFFFFF 0%,#F8FAFB 100%)', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 12, boxShadow: '0 14px 34px rgba(15,23,42,0.055)' } as const;
const badge = { display: 'inline-flex', width: 'fit-content', padding: '7px 11px', borderRadius: 999, background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.18)', color: '#2563EB', fontSize: 12, fontWeight: 900 } as const;
const h1 = { margin: 0, color: '#0F1419', fontSize: 'clamp(30px,8vw,48px)', lineHeight: 1.03, letterSpacing: '-0.045em', fontWeight: 950 } as const;
const h2 = { margin: '4px 0 0', color: '#0F1419', fontSize: 22, lineHeight: 1.08, fontWeight: 950, letterSpacing: '-0.025em' } as const;
const lead = { margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.6 } as const;
const actions = { display: 'flex', gap: 8, flexWrap: 'wrap' } as const;
const primaryBtn = { textDecoration: 'none', minHeight: 46, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '12px 15px', borderRadius: 14, background: '#2563EB', color: '#fff', fontSize: 14, fontWeight: 900, boxShadow: '0 14px 30px rgba(37,99,235,0.18)' } as const;
const ghostBtn = { ...primaryBtn, background: '#fff', border: '1px solid #CBD5E1', color: '#0F1419', boxShadow: '0 10px 24px rgba(15,23,42,0.06)' } as const;
const blockerCard = { display: 'grid', gap: 6, minWidth: 220, maxWidth: 280, padding: 14, borderRadius: 18, background: '#FFFBEB', border: '1px solid #FDE68A', boxShadow: '0 12px 28px rgba(180,83,9,0.08)' } as const;
const buyerCockpitGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8 } as const;
const cockpitFact = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 16, padding: 12, display: 'grid', gap: 5, boxShadow: '0 8px 18px rgba(15,23,42,0.035)' } as const;
const metricsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 } as const;
const metricCard = { background: 'linear-gradient(180deg,#FFFFFF 0%,#F8FAFB 100%)', border: '1px solid #E4E6EA', borderRadius: 20, padding: 16, display: 'grid', gap: 8, boxShadow: '0 12px 28px rgba(15,23,42,0.055)' } as const;
const pathGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 8 } as const;
const pathCard = { textDecoration: 'none', minHeight: 132, display: 'grid', alignContent: 'start', gap: 8, padding: 14, borderRadius: 20, background: '#fff', border: '1px solid #E4E6EA', boxShadow: '0 10px 24px rgba(15,23,42,0.045)' } as const;
const lotRow = { textDecoration: 'none', color: 'inherit', background: 'linear-gradient(180deg,#FFFFFF 0%,#F8FAFB 100%)', border: '1px solid #E4E6EA', borderRadius: 22, padding: 16, display: 'grid', gap: 12, boxShadow: '0 12px 30px rgba(15,23,42,0.055)' } as const;
const rowGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(155px,1fr))', gap: 8 } as const;
const cell = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 14, padding: 10, minWidth: 0, boxShadow: '0 8px 18px rgba(15,23,42,0.035)' } as const;
const idText = { color: '#2563EB', fontSize: 13, fontWeight: 950 } as const;
const micro = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' } as const;
