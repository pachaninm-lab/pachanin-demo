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
import { MoneyGateRing } from '@/components/v7r/MoneyGateRing';
import { RoleExecutionCockpitContent } from '@/components/platform-v7/RoleExecutionCockpit';
import { PRIMARY_ROLE_EXECUTION_COCKPITS } from '@/lib/platform-v7/role-execution-cockpit';
import { ActionFeedbackPreviewStrip } from '../../../components/platform-v7/ActionFeedbackPreviewStrip';
import { QuietIntelligenceHint } from '@/components/platform-v7/visual/QuietIntelligenceHint';
import { TrustDot } from '@/components/platform-v7/visual/TrustDot';
import { SmartSectionSummary } from '@/components/platform-v7/visual/SmartSectionSummary';
import { CauseLine } from '@/components/platform-v7/visual/CauseLine';
import { UnlockPath } from '@/components/platform-v7/visual/UnlockPath';
import { P7ExecutionActionsPanel, type PlatformV7ExecutionActionUiItem } from '@/components/platform-v7/P7ExecutionActionsPanel';
import { PLATFORM_V7_INITIAL_EXECUTION_ACTION_STATE, type PlatformV7ExecutionActionState } from '@/lib/platform-v7/execution-action-core';
import {
  CockpitHero,
  PremiumStatCard,
  DonutGauge,
  TrendSparkline,
  StatusPill,
  PremiumCtaButton,
} from '@/components/platform-v7/premium';

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
      <CockpitHero
        eyebrow='Кабинет покупателя · запрос → резерв → логистика'
        title='Подтвердить резерв,'
        accent='чтобы сделка пошла в исполнение'
        lead='Покупатель видит не доску партий, а контур закупки: запрос, выбранную партию, ставку, резерв, удержание, документы и причину, почему сделка ещё не перешла к логистике.'
        aside={
          <div style={blockerCard}>
            <div style={micro}>главный блокер</div>
            <strong style={{ color: 'var(--pc-prem-warn, #B45309)', fontSize: 18, lineHeight: 1.2 }}>резерв ждёт подтверждение банка</strong>
            <span style={{ color: 'var(--pc-text-muted, #64748B)', fontSize: 12, lineHeight: 1.45 }}>логистика не стартует до статуса банка</span>
          </div>
        }
      >
        <div className='pc-prem-kpis' aria-label='Ключевые показатели закупки'>
          <PremiumStatCard glyph='bag' tone='info' value={String(deals.length)} label='Сделок в работе' />
          <PremiumStatCard glyph='coins' tone='success' value='9,65 млн ₽' label='Резерв · ждёт банк' />
          <PremiumStatCard glyph='scale' tone='warning' value='624 тыс. ₽' label='Под удержанием · вес' />
          <PremiumStatCard glyph='alert' tone={disputeCount > 0 ? 'danger' : 'neutral'} value={String(disputeCount)} label='Открытых споров' />
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <DonutGauge value={78} sublabel='готовность' caption='Уверенность к поставке' tone='success' />
          <div style={{ flex: '1 1 220px', minWidth: 200, display: 'grid', gap: 8 }}>
            <StatusPill tone='warning'>Резерв ждёт банковского подтверждения</StatusPill>
            <TrendSparkline points={[58, 61, 60, 67, 71, 74, 78]} deltaLabel='+20 п.п.' caption='Динамика готовности · сценарий' />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 8 }}>
          <PremiumCtaButton href='/platform-v7/deals/DL-9106/money' glyph='shield-check'>Запросить подтверждение резерва</PremiumCtaButton>
          <PremiumCtaButton href='/platform-v7/deals/DL-9106/clean' variant='ghost'>Открыть сделку</PremiumCtaButton>
        </div>
        <TrustDot state='test' size='sm' label='Контур исполнения · Внешние подключения требуют договоров' />
      </CockpitHero>


      <RoleExecutionCockpitContent cockpit={PRIMARY_ROLE_EXECUTION_COCKPITS.buyer} />

      <MoneyGateRing
        title='Деньги покупателя по сделке DL-9106'
        totalRub={9_648_000}
        segments={[
          { label: 'Банк подтвердил выплату', amountRub: 0, state: 'released' },
          { label: 'Резерв заявлен покупателем', amountRub: 9_024_000, state: 'reserved' },
          { label: 'Удержано по спору', amountRub: 624_000, state: 'held' },
        ]}
        caption='Резерв ожидает банковского подтверждения; спорная часть удержана до закрытия расхождения по весу. Платформа деньги не выпускает.'
      />

      <MoneyImpactSummaryStrip
        amountContext='резерв 9,65 млн ₽ · удержание 624 тыс. ₽'
        pilotState='waiting'
        pilotStateLabel='контур исполнения · ожидание подтверждения'
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
              <strong style={{ color: 'var(--pc-text-primary, #0F1419)', fontSize: 16 }}>{path.title}</strong>
              <span style={{ color: 'var(--pc-text-muted, #64748B)', fontSize: 13, lineHeight: 1.45 }}>{path.note}</span>
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


function Cell({ label, value, strong = false, warning = false }: { label: string; value: string; strong?: boolean; warning?: boolean }) {
  return <div style={cell}><div style={micro}>{label}</div><div style={{ marginTop: 4, color: warning ? '#B45309' : strong ? '#0A7A5F' : 'var(--pc-text-primary, #0F1419)', fontSize: 13, lineHeight: 1.35, fontWeight: 900 }}>{value}</div></div>;
}

const card = { background: 'linear-gradient(180deg,#FFFFFF 0%,#F8FAFB 100%)', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 24, padding: 18, display: 'grid', gap: 12, boxShadow: '0 14px 34px rgba(15,23,42,0.055)' } as const;
const h2 = { margin: '4px 0 0', color: 'var(--pc-text-primary, #0F1419)', fontSize: 22, lineHeight: 1.08, fontWeight: 950, letterSpacing: '-0.025em' } as const;
const blockerCard = { display: 'grid', gap: 6, minWidth: 220, maxWidth: 280, padding: 14, borderRadius: 18, background: '#FFFBEB', border: '1px solid #FDE68A', boxShadow: '0 12px 28px rgba(180,83,9,0.08)' } as const;
const pathGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 8 } as const;
const pathCard = { textDecoration: 'none', minHeight: 132, display: 'grid', alignContent: 'start', gap: 8, padding: 14, borderRadius: 20, background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', boxShadow: '0 10px 24px rgba(15,23,42,0.045)' } as const;
const lotRow = { textDecoration: 'none', color: 'inherit', background: 'linear-gradient(180deg,#FFFFFF 0%,#F8FAFB 100%)', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 22, padding: 16, display: 'grid', gap: 12, boxShadow: '0 12px 30px rgba(15,23,42,0.055)' } as const;
const rowGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(155px,1fr))', gap: 8 } as const;
const cell = { background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 14, padding: 10, minWidth: 0, boxShadow: '0 8px 18px rgba(15,23,42,0.035)' } as const;
const idText = { color: '#2563EB', fontSize: 13, fontWeight: 950 } as const;
const micro = { color: 'var(--pc-text-muted, #64748B)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' } as const;
