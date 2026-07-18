import Link from 'next/link';
import { StatusChip, Surface } from '@pc/design-system-v8';
import {
  MoneyBoundary,
  MoneyCockpitSection,
  MoneyObligationCockpit,
  MoneyQueue,
  MoneyQueueLink,
  moneyCockpitClasses,
} from '@/components/transaction-ux/MoneyObligationCockpit';
import { getDeal360Scenario } from '@/lib/platform-v7/deal360-source-of-truth';
import { BankCleanView } from '@/components/platform-v7/visual/BankCleanView';
import { RoleExecutionHandoff, type HandoffItem } from '@/components/platform-v7/RoleExecutionHandoff';
import { BatonStrip } from '@/components/platform-v7/BatonStrip';
import { P7ActionStateChip } from '@/components/platform-v7/P7ActionStateChip';
import { JournalPreview } from '@/components/platform-v7/JournalPreview';
import { ConditionReasonStrip } from '@/components/platform-v7/ConditionReasonStrip';
import { DocumentReadinessMiniMatrix } from '@/components/platform-v7/DocumentReadinessMiniMatrix';
import { DocumentsMatrix } from '@/components/platform-v7/DocumentsMatrix';
import { DocumentsMatrixActions } from '@/components/platform-v7/DocumentsMatrixActions';
import { EvidenceReadinessMiniMatrix } from '@/components/platform-v7/EvidenceReadinessMiniMatrix';
import { MoneyImpactSummaryStrip } from '@/components/platform-v7/MoneyImpactSummaryStrip';
import { DecisionRecommendationStrip } from '@/components/platform-v7/DecisionRecommendationStrip';
import { DecisionPackMiniPanel } from '@/components/platform-v7/DecisionPackMiniPanel';
import { ActionFeedbackPreviewStrip } from '@/components/platform-v7/ActionFeedbackPreviewStrip';
import { BankCompliancePilotPanel } from '@/components/platform-v7/BankCompliancePilotPanel';
import { RoleExecutionCockpitContent } from '@/components/platform-v7/RoleExecutionCockpit';
import { PRIMARY_ROLE_EXECUTION_COCKPITS } from '@/lib/platform-v7/role-execution-cockpit';
import { LiveApiStatusBar } from '@/components/platform-v7/LiveApiStatusBar';
import { getOutboxStatus } from '@/lib/outbox-server';
import { getDealsCanonical } from '@/lib/deals-server';
import { summarizeDeals, dealsSummaryLine } from '@/lib/platform-v7/deals-summary';
import { getDisputes, disputeTotalHeldRub, openDisputeCount } from '@/lib/disputes-server';
import { CollapsibleSection } from '@/components/platform-v7/CollapsibleSection';
import { CanonicalDealsList } from '@/components/platform-v7/CanonicalDealsList';
import { LedgerPanel } from '@/components/platform-v7/LedgerPanel';
import { MoneyLifecyclePanel } from '@/components/platform-v7/MoneyLifecyclePanel';

const bankHandoff: HandoffItem[] = [
  { direction: 'awaits', role: 'банк ← все роли', requirement: 'документы, приёмка, качество и спор должны быть закрыты до банковской проверки выплаты', documentImpact: true, moneyImpact: true },
  { direction: 'awaits', role: 'банк ← продавец', requirement: 'СДИЗ и ЭТрН ожидают закрытия — без этого основание не передаётся на банковскую проверку', documentImpact: true, moneyImpact: true },
  { direction: 'sends', role: 'банк → оператор', requirement: 'банк направляет статус проверки; оператор сверяет причину остановки и основание в сделке', moneyImpact: true },
  { direction: 'blockedBy', requirement: 'СДИЗ, ЭТрН, акт приёмки и протокол качества ещё не закрыты', documentImpact: true, moneyImpact: true },
  { direction: 'next', requirement: 'ждать закрытия всех условий для банковской проверки выплаты по DL-9106', entity: 'DL-9106', href: '/platform-v7/deals', moneyImpact: true },
];

const mainDeal = getDeal360Scenario('DL-9106');
const disputeDeal = getDeal360Scenario('DL-9102');

const bankQueue = [
  { id: mainDeal.dealId, lot: mainDeal.lotId, buyer: 'Покупатель 1', amount: '9,65 млн ₽', reserve: 'ожидает банковского подтверждения', releaseNow: '0 ₽', hold: '0 ₽', decision: 'основание не передавать', next: mainDeal.nextAction, href: '/platform-v7/deals', tone: 'critical' as const },
  { id: disputeDeal.dealId, lot: disputeDeal.lotId, buyer: 'Покупатель 2', amount: '6,24 млн ₽', reserve: 'резерв отмечен', releaseNow: '5,616 млн ₽', hold: '624 тыс. ₽', decision: 'частичная проверка после решения', next: disputeDeal.nextAction, href: '/platform-v7/deals', tone: 'warning' as const },
] as const;

const gates = mainDeal.providerGates
  .filter((gate) => ['Сбер · Безопасные сделки', 'Сбер · Оплата в кредит', 'ФГИС «Зерно»', 'Контур.Диадок', 'ЭДО-провайдер ЭТрН', 'Лабораторный контур качества'].includes(bankProviderLabel(gate.provider)))
  .map((gate) => ({ ...gate, provider: bankProviderLabel(gate.provider) }));

function bankProviderLabel(provider: string) {
  if (provider.includes('Saby') || provider.includes('СБИС')) return 'ЭДО-провайдер ЭТрН';
  return provider;
}

function gateTone(state: string): 'success' | 'warning' | 'critical' | 'neutral' {
  if (state === 'ok') return 'success';
  if (state === 'stop') return 'critical';
  if (state === 'wait') return 'warning';
  return 'neutral';
}

export default async function PlatformV7BankPage() {
  const [outbox, disputes, deals] = await Promise.all([getOutboxStatus(), getDisputes(), getDealsCanonical()]);
  const apiOnline = outbox.isApiAvailable;
  const heldRub = disputeTotalHeldRub(disputes);
  const disputeCount = openDisputeCount(disputes);
  const heldLabel = heldRub > 0 ? `${(heldRub / 1_000_000).toFixed(2)} млн ₽ удержано` : 'удержаний нет';

  const liveStops = [
    ...(outbox.totalPending > 0 ? [{ id: 'bank-ops', label: `${outbox.totalPending} банковских операций в очереди`, severity: 'warn' as const, responsibleRole: 'ACCOUNTING', nextAction: 'Проверить статус в bank-workspace' }] : []),
    ...(outbox.hasManualReview ? [{ id: 'manual', label: 'Операции требуют ручной проверки', severity: 'stop' as const, responsibleRole: 'OPERATOR', nextAction: 'Открыть outbox ручной проверки' }] : []),
    ...disputes.filter((dispute) => dispute.status === 'OPEN' || dispute.status === 'UNDER_REVIEW').map((dispute) => ({
      id: dispute.id,
      label: `Спор ${dispute.id}: удержание ${dispute.claimAmountRub ? `${(dispute.claimAmountRub / 1_000_000).toFixed(2)} млн ₽` : 'активно'}`,
      severity: 'stop' as const,
      responsibleRole: 'ARBITRATOR',
      nextAction: 'Закрыть спор до банковской проверки выплаты',
    })),
  ];

  return (
    <MoneyObligationCockpit
      testId='platform-v7-bank-cockpit'
      eyebrow='Банк · проверка основания'
      title='Сначала закрытые условия, затем банковское подтверждение'
      description='Банк получает очередь решений, сумму, основание, блокеры, документы и доказательства. Интерфейс не выпускает деньги и не подменяет банковский callback.'
      statusLabel={apiOnline ? 'Bank outbox доступен' : 'Статичный контур'}
      statusTone={apiOnline ? 'success' : 'warning'}
      liveStatus={(
        <LiveApiStatusBar
          apiOnline={apiOnline}
          liveStops={liveStops}
          pendingBankOps={outbox.totalPending}
          openDisputes={disputeCount}
          role='BANK · ПРОВЕРКА ВЫПЛАТЫ'
          summary={apiOnline ? `${outbox.totalPending} операций · ${dealsSummaryLine(summarizeDeals(deals))} · ${disputeCount} споров · ${heldLabel}` : 'Данные статичные — API недоступен'}
        />
      )}
      priority={{
        title: 'Не передавать основание по DL-9106',
        description: 'СДИЗ, ЭТрН, акт приёмки и протокол качества не закрыты. Ручная кнопка не может заменить банковскую проверку и подтверждённый callback.',
        state: 'critical',
        amount: '9,65 млн ₽ резерв · к передаче 0 ₽',
        blocker: 'неполный документный и доказательный пакет',
        owner: 'оператор и ответственные за документы',
        result: 'основание допускается к банковской проверке',
        primaryAction: <Link className={moneyCockpitClasses.primaryLink} href='/platform-v7/bank/release-safety'>Проверить основание</Link>,
        secondaryAction: <Link className={moneyCockpitClasses.secondaryLink} href={'/platform-v7/deals'}>Карточка сделки</Link>,
      }}
      facts={[
        { label: 'В резерве', value: '15,89 млн ₽', hint: 'по денежной очереди' },
        { label: 'К передаче банку', value: '0 ₽', hint: 'условия не закрыты' },
        { label: 'Под удержанием', value: '624 тыс. ₽', hint: 'активный спор' },
        { label: 'Требуют решения', value: `${bankQueue.length} сделки`, hint: 'с основанием и причиной' },
      ]}
    >
      <MoneyBoundary>
        Платформа формирует и показывает основание. Только банк подтверждает резерв, проверку и движение денег через защищённый банковский контур.
      </MoneyBoundary>

      <BatonStrip from='оператор и ответственный за документ' mine='проверка основания выплаты' to='оператор — подтверждённый статус банка' toHref='/platform-v7/control-tower' />

      <MoneyCockpitSection id='live-deals'>
        <CollapsibleSection title='Сделки на контроле' summary='реальные сделки с сервера · открыть исполнение' defaultOpen>
          <CanonicalDealsList />
        </CollapsibleSection>
      </MoneyCockpitSection>

      <MoneyCockpitSection id='overview'>
        <CollapsibleSection title='Обзор банковской роли' summary='очередь · основание · стоп · следующее действие' defaultOpen={false}>
          <RoleExecutionCockpitContent cockpit={PRIMARY_ROLE_EXECUTION_COCKPITS.bank} />
        </CollapsibleSection>
      </MoneyCockpitSection>

      <MoneyCockpitSection id='decision'>
        <BankCleanView
          dealId={mainDeal.dealId}
          amount='9,65 млн ₽'
          lockState='blocked-docs'
          trustState='test'
          basis='Основание для банковской проверки выплаты не сформировано — документы не закрыты'
          documents={[
            { id: 'sdiz', label: 'СДИЗ', status: 'missing', impact: 'блокирует' },
            { id: 'etrn', label: 'ЭТрН', status: 'missing', impact: 'блокирует' },
            { id: 'upd', label: 'УПД', status: 'pending', impact: 'ожидает' },
            { id: 'act', label: 'Акт приёмки', status: 'missing', impact: 'блокирует' },
            { id: 'quality', label: 'Протокол качества', status: 'pending', impact: 'в работе' },
          ]}
          risks={[
            { id: 'sdiz-risk', text: 'СДИЗ не закрыт — основание для банка не сформировано', severity: 'high' },
            { id: 'dispute-risk', text: 'Спор по DL-9102 · 624 тыс. ₽ под удержанием', severity: 'medium' },
          ]}
          causeLines={[
            { cause: { text: 'СДИЗ не закрыт', tone: 'blocked' }, relation: 'blocks', effect: { text: 'основание банку', tone: 'money' }, moneyAmount: '9,65 млн ₽', moneyTone: 'blocked' },
            { cause: { text: 'ЭТрН не подписана', tone: 'warning' }, relation: 'requires', effect: { text: 'ручная проверка', tone: 'money' }, moneyAmount: '0 ₽ к передаче', moneyTone: 'hold' },
          ]}
          unlockSteps={[
            { id: '1', label: 'Закрыть СДИЗ', status: 'current' },
            { id: '2', label: 'Подписать ЭТрН', status: 'upcoming' },
            { id: '3', label: 'Закрыть акт приёмки', status: 'upcoming' },
          ]}
          journalHref={`/platform-v7/deals/${mainDeal.dealId}/audit`}
          manualReviewNote='Выплата требует подтверждения банка. Платформа формирует основание при закрытых условиях.'
        />
      </MoneyCockpitSection>

      <MoneyCockpitSection id='queue'>
        <CollapsibleSection title='Денежная очередь' summary='сумма · резерв · удержание · решение' defaultOpen>
          <MoneyQueue>
            {bankQueue.map((deal) => (
              <MoneyQueueLink
                key={deal.id}
                href={deal.href}
                title={`${deal.id} · ${deal.lot} · ${deal.amount}`}
                detail={`${deal.buyer} · резерв: ${deal.reserve} · к передаче: ${deal.releaseNow} · удержано: ${deal.hold} · ${deal.next}`}
                status={<StatusChip tone={deal.tone}>{deal.decision}</StatusChip>}
              />
            ))}
          </MoneyQueue>
        </CollapsibleSection>
      </MoneyCockpitSection>

      <MoneyCockpitSection id='basis'>
        <CollapsibleSection title='Документы и основания' summary='СДИЗ · ЭТрН · УПД · акт · качество' defaultOpen={false}>
          <div className={moneyCockpitClasses.sectionStack}>
            <DocumentsMatrix />
            <DocumentsMatrixActions />
            <DocumentReadinessMiniMatrix role='bank' />
            <BankCompliancePilotPanel mode='bank' />
          </div>
        </CollapsibleSection>
      </MoneyCockpitSection>

      <MoneyCockpitSection id='gates'>
        <CollapsibleSection title='Внешние контуры' summary='банк · ФГИС · ЭДО · ЭТрН · качество' defaultOpen={false}>
          <div className={moneyCockpitClasses.toolGrid}>
            {gates.map((gate) => (
              <Surface key={`${gate.provider}-${gate.object}`}>
                <div className={moneyCockpitClasses.sectionStack}>
                  <StatusChip tone={gateTone(gate.state)}>{gate.provider}</StatusChip>
                  <strong>{gate.status}</strong>
                  <p className={moneyCockpitClasses.muted}>{gate.object}</p>
                  <p className={moneyCockpitClasses.muted}>{gate.impact}</p>
                </div>
              </Surface>
            ))}
          </div>
        </CollapsibleSection>
      </MoneyCockpitSection>

      <MoneyCockpitSection id='risk'>
        <CollapsibleSection title='Стопы и денежное влияние' summary='причина · удержание · ответственный' defaultOpen={false}>
          <div className={moneyCockpitClasses.sectionStack}>
            <MoneyImpactSummaryStrip amountContext='в резерве 15,89 млн ₽ · к передаче 0 ₽ · удержание 624 тыс. ₽' pilotState='blocked' pilotStateLabel='удержание до закрытия условий' responsible='банк · оператор' nextStep='ручная сверка после закрытия всех условий' stopReason='банковская проверка выплаты остановлена: СДИЗ, ЭТрН, акт приёмки и качество не закрыты' />
            <P7ActionStateChip status='blocked' label='банковская проверка выплаты' nextActor='оператор и ответственный за документ' stopReason='СДИЗ, ЭТрН, УПД, приёмка, качество' moneyEffect='удержание до закрытия условий' />
            <ConditionReasonStrip condition='банковская проверка выплаты' responsible='оператор и ответственный за документ' documentState='СДИЗ, ЭТрН, УПД, приёмка, качество' stopReason='удержание до закрытия условий' />
          </div>
        </CollapsibleSection>
      </MoneyCockpitSection>

      <MoneyCockpitSection id='evidence'>
        <CollapsibleSection title='Рекомендации, доказательства и журнал' summary='decision pack · evidence · handoff' defaultOpen={false}>
          <div className={moneyCockpitClasses.sectionStack}>
            <DecisionRecommendationStrip context='bank' />
            <DecisionPackMiniPanel context='bank_release_review' />
            <EvidenceReadinessMiniMatrix context='bank' />
            <ActionFeedbackPreviewStrip context='bank' />
            <RoleExecutionHandoff items={bankHandoff} title='исполнение: что банк ожидает и отправляет' />
            <JournalPreview role='bank' maxEntries={3} />
          </div>
        </CollapsibleSection>
      </MoneyCockpitSection>

      <MoneyCockpitSection>
        <CollapsibleSection title='Ledger и жизненный цикл денег' summary='двойная запись · reserve · hold · release · refund' defaultOpen={false}>
          <div className={moneyCockpitClasses.toolGrid}>
            <Surface><LedgerPanel /></Surface>
            <Surface><MoneyLifecyclePanel /></Surface>
          </div>
        </CollapsibleSection>
      </MoneyCockpitSection>
    </MoneyObligationCockpit>
  );
}
