import Link from 'next/link';
import { NextActionCard, StatusChip, Surface } from '@pc/design-system-v8';
import { DealRoleWorkbenchTemplate } from '@/components/transaction-ux/DealRoleWorkbenchTemplate';
import { KeyFact, KeyFactGrid } from '@/components/transaction-ux/FieldTaskTemplate';
import workspace from '@/components/transaction-ux/CommercialRoleWorkspace.module.css';
import { getDeal360Scenario } from '@/lib/platform-v7/deal360-source-of-truth';
import { BankCleanView } from '@/components/platform-v7/visual/BankCleanView';
import { RoleExecutionHandoff, type HandoffItem } from '@/components/platform-v7/RoleExecutionHandoff';
import { JournalPreview } from '@/components/platform-v7/JournalPreview';
import { DocumentReadinessMiniMatrix } from '@/components/platform-v7/DocumentReadinessMiniMatrix';
import { DocumentsMatrix } from '@/components/platform-v7/DocumentsMatrix';
import { DocumentsMatrixActions } from '@/components/platform-v7/DocumentsMatrixActions';
import { EvidenceReadinessMiniMatrix } from '@/components/platform-v7/EvidenceReadinessMiniMatrix';
import { MoneyImpactSummaryStrip } from '@/components/platform-v7/MoneyImpactSummaryStrip';
import { DecisionRecommendationStrip } from '@/components/platform-v7/DecisionRecommendationStrip';
import { DecisionPackMiniPanel } from '@/components/platform-v7/DecisionPackMiniPanel';
import { ActionFeedbackPreviewStrip } from '@/components/platform-v7/ActionFeedbackPreviewStrip';
import { BankCompliancePilotPanel } from '@/components/platform-v7/BankCompliancePilotPanel';
import { RoleExecutionCockpitPage } from '@/components/platform-v7/RoleExecutionCockpit';
import { LiveApiStatusBar } from '@/components/platform-v7/LiveApiStatusBar';
import { getOutboxStatus } from '@/lib/outbox-server';
import { getDisputes, disputeTotalHeldRub, openDisputeCount } from '@/lib/disputes-server';
import { CollapsibleSection } from '@/components/platform-v7/CollapsibleSection';
import { LedgerPanel } from '@/components/platform-v7/LedgerPanel';
import { MoneyLifecyclePanel } from '@/components/platform-v7/MoneyLifecyclePanel';
import { QuietIntelligenceHint } from '@/components/platform-v7/visual/QuietIntelligenceHint';

const bankHandoff: HandoffItem[] = [
  { direction: 'awaits', role: 'банк ← все роли', requirement: 'документы, приёмка, качество и спор закрыты до банковской проверки выплаты', documentImpact: true, moneyImpact: true },
  { direction: 'awaits', role: 'банк ← продавец', requirement: 'закрытые СДИЗ и ЭТрН', documentImpact: true, moneyImpact: true },
  { direction: 'sends', role: 'банк → оператор', requirement: 'статус проверки и причина остановки', moneyImpact: true },
  { direction: 'blockedBy', requirement: 'СДИЗ, ЭТрН, акт приёмки и протокол качества не закрыты', documentImpact: true, moneyImpact: true },
  { direction: 'next', requirement: 'ждать закрытия условий и провести банковскую проверку DL-9106', entity: 'DL-9106', href: '/platform-v7/deals/DL-9106/clean', moneyImpact: true },
];

const mainDeal = getDeal360Scenario('DL-9106');
const disputeDeal = getDeal360Scenario('DL-9102');

const bankQueue = [
  { id: mainDeal.dealId, lot: mainDeal.lotId, amount: '9,65 млн ₽', state: 'critical' as const, status: 'основание не готово', next: mainDeal.nextAction, href: `/platform-v7/deals/${mainDeal.dealId}/clean` },
  { id: disputeDeal.dealId, lot: disputeDeal.lotId, amount: '6,24 млн ₽', state: 'warning' as const, status: '624 тыс. ₽ удержано', next: disputeDeal.nextAction, href: `/platform-v7/deals/${disputeDeal.dealId}/clean` },
];

export default async function PlatformV7BankPage() {
  const [outbox, disputes] = await Promise.all([getOutboxStatus(), getDisputes()]);
  const apiOnline = outbox.isApiAvailable;
  const heldRub = disputeTotalHeldRub(disputes);
  const disputeCount = openDisputeCount(disputes);
  const liveStops = [
    ...(outbox.totalPending > 0 ? [{ id: 'bank-ops', label: `${outbox.totalPending} банковских операций в очереди`, severity: 'warn' as const, responsibleRole: 'ACCOUNTING', nextAction: 'Проверить статус операции' }] : []),
    ...(outbox.hasManualReview ? [{ id: 'manual', label: 'Операции требуют ручной проверки', severity: 'stop' as const, responsibleRole: 'OPERATOR', nextAction: 'Открыть ручную проверку' }] : []),
    ...disputes.filter((item) => item.status === 'OPEN' || item.status === 'UNDER_REVIEW').map((item) => ({
      id: item.id,
      label: `Спор ${item.id}: удержание ${item.claimAmountRub ? `${(item.claimAmountRub / 1_000_000).toFixed(2)} млн ₽` : 'активно'}`,
      severity: 'stop' as const,
      responsibleRole: 'ARBITRATOR',
      nextAction: 'Закрыть спор до банковской проверки выплаты',
    })),
  ];

  const primary = (
    <div className={workspace.stack}>
      <NextActionCard
        label='Одно следующее действие'
        action='Не подтверждать выплату по DL-9106'
        reason='Основание неполно: СДИЗ, ЭТрН, акт приёмки и протокол качества ещё не закрыты. Банк должен дождаться полного комплекта и повторной сверки.'
        blocked
        impact='9,65 млн ₽ · к подтверждению сейчас 0 ₽'
        owner='Банк и ответственные за документы'
        actions={(
          <div className={workspace.actions}>
            <Link className={workspace.primaryLink} href='/platform-v7/bank/release-safety'>Открыть проверку выплаты</Link>
            <Link className={workspace.secondaryLink} href={`/platform-v7/deals/${mainDeal.dealId}/clean`}>Карточка сделки</Link>
          </div>
        )}
      />

      <KeyFactGrid>
        <KeyFact label='В резерве' value='15,89 млн ₽' hint='по банковской очереди' />
        <KeyFact label='К подтверждению' value='0 ₽' hint='основание не сформировано' />
        <KeyFact label='Удержание' value={heldRub > 0 ? `${(heldRub / 1_000_000).toFixed(2)} млн ₽` : '624 тыс. ₽'} hint={`${disputeCount} открытых споров`} />
        <KeyFact label='Очередь' value={outbox.totalPending} hint='операции требуют сверки статусов' />
      </KeyFactGrid>

      <QuietIntelligenceHint
        problem='Документные и физические условия DL-9106 не закрыты, поэтому основание выплаты банку не передаётся.'
        action='Сохранить блокировку, дождаться закрытия документов, приёмки, качества и споров, затем выполнить банковскую сверку.'
        outcome='Только банк после проверки подтверждает резерв, частичную или финальную выплату. Платформа не двигает деньги самостоятельно.'
      />

      <CollapsibleSection title='Проверка основания DL-9106' summary='документы · риски · путь разблокировки' defaultOpen>
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
            { cause: { text: 'ЭТрН не подписана', tone: 'warning' }, relation: 'requires', effect: { text: 'ручная проверка', tone: 'money' }, moneyAmount: '0 ₽ к подтверждению', moneyTone: 'hold' },
          ]}
          unlockSteps={[
            { id: '1', label: 'Закрыть СДИЗ', status: 'current' },
            { id: '2', label: 'Подписать ЭТрН', status: 'upcoming' },
            { id: '3', label: 'Закрыть акт приёмки', status: 'upcoming' },
          ]}
          journalHref={`/platform-v7/deals/${mainDeal.dealId}/audit`}
          manualReviewNote='Выплата требует подтверждения банка. Платформа формирует основание при закрытых условиях.'
        />
      </CollapsibleSection>

      <CollapsibleSection title='Денежное влияние' summary='резерв · подтверждение · удержание' defaultOpen={false}>
        <MoneyImpactSummaryStrip
          amountContext='в резерве 15,89 млн ₽ · к подтверждению 0 ₽ · удержание 624 тыс. ₽'
          pilotState='blocked'
          pilotStateLabel='удержание до закрытия условий'
          responsible='банк · оператор · владельцы документов'
          nextStep='повторная сверка после закрытия всех условий'
          stopReason='банковская проверка остановлена: СДИЗ, ЭТрН, акт приёмки и качество не закрыты'
        />
      </CollapsibleSection>
    </div>
  );

  const context = (
    <div className={workspace.stack}>
      <StatusChip tone='critical'>Основание не готово</StatusChip>
      <ol className={workspace.contextList}>
        <li><span>1. Документы</span><strong>СДИЗ, ЭТрН, УПД</strong></li>
        <li><span>2. Физический факт</span><strong>акт приёмки и качество</strong></li>
        <li><span>3. Споры</span><strong>удержание до решения</strong></li>
        <li><span>Граница</span><strong>решение и деньги — только банк</strong></li>
      </ol>
      <div className={workspace.boundary}>Платформа не подтверждает выплату и не выпускает деньги. Она формирует проверяемое основание и журнал событий.</div>
    </div>
  );

  const details = (
    <div className={workspace.detailsStack}>
      <CollapsibleSection title='Денежная очередь' summary='сделка · сумма · причина остановки' defaultOpen={false}>
        <div className={workspace.queueList}>
          {bankQueue.map((deal) => (
            <Link key={deal.id} href={deal.href} className={workspace.queueCard}>
              <span className={workspace.queueCopy}><strong>{deal.id} · {deal.lot} · {deal.amount}</strong><span>{deal.status}</span><small>{deal.next}</small></span>
              <StatusChip tone={deal.state}>{deal.status}</StatusChip>
            </Link>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title='Документы и основания' summary='СДИЗ · ЭТрН · УПД · акт · качество' defaultOpen={false}>
        <div className={workspace.sectionStack}><DocumentsMatrix /><DocumentsMatrixActions /><DocumentReadinessMiniMatrix role='bank' /></div>
      </CollapsibleSection>

      <CollapsibleSection title='Рекомендации и доказательства' summary='факты · пакет решения · ограничения' defaultOpen={false}>
        <div className={workspace.sectionStack}><DecisionRecommendationStrip context='bank' /><DecisionPackMiniPanel context='bank_release_review' /><EvidenceReadinessMiniMatrix context='bank' /><ActionFeedbackPreviewStrip context='bank' /></div>
      </CollapsibleSection>

      <CollapsibleSection title='Передача между ролями и журнал' summary='кто ждёт · кто отправляет · что зафиксировано' defaultOpen={false}>
        <div className={workspace.sectionStack}><RoleExecutionHandoff items={bankHandoff} title='исполнение: что банк ожидает и отправляет' /><JournalPreview role='bank' maxEntries={3} /></div>
      </CollapsibleSection>

      <CollapsibleSection title='Банковый и комплаенс-контур' summary='готовность · ограничения · ручная проверка' defaultOpen={false}><BankCompliancePilotPanel mode='bank' /></CollapsibleSection>
      <CollapsibleSection title='Полный ролевой cockpit банка' summary='очередь · блокеры · действия' defaultOpen={false}><RoleExecutionCockpitPage role='bank' /></CollapsibleSection>
      <CollapsibleSection title='Ledger · двойная запись' summary='резерв · подтверждение · комиссии · idempotency' defaultOpen={false}><LedgerPanel /></CollapsibleSection>
      <CollapsibleSection title='Жизненный цикл денег' summary='RESERVE → RELEASE → COMMISSION · HOLD · REFUND' defaultOpen={false}><MoneyLifecyclePanel /></CollapsibleSection>
      <Surface><p className={workspace.muted}>Все статусы денег должны подтверждаться банковскими callback и reconciliation. UI не является источником финансовой истины.</p></Surface>
    </div>
  );

  return (
    <DealRoleWorkbenchTemplate
      testId='platform-v7-bank-v8'
      eyebrow='Банк · проверка основания'
      title='Резерв, условия и банковское решение'
      description='Первый уровень показывает сумму, стоп-фактор, удержание и одно следующее действие. Ledger, документы и доказательства раскрываются по запросу.'
      statusLabel='Выплата заблокирована'
      statusTone='critical'
      liveStatus={<LiveApiStatusBar apiOnline={apiOnline} liveStops={liveStops} pendingBankOps={outbox.totalPending} openDisputes={disputeCount} role='BANK · Проверка выплаты' summary={apiOnline ? `${outbox.totalPending} операций в очереди · ${disputeCount} открытых споров · ${heldRub > 0 ? `${(heldRub / 1_000_000).toFixed(2)} млн ₽ удержано` : 'удержаний нет'}` : 'Данные статичные — API недоступен'} />}
      primary={primary}
      context={context}
      details={details}
    />
  );
}
