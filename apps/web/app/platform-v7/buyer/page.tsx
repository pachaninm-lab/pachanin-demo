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
import { BuyerFavoritesPanel } from '@/components/platform-v7/BuyerFavoritesPanel';
import { CanonicalDealsList } from '@/components/platform-v7/CanonicalDealsList';
import { getDealsCanonical } from '@/lib/deals-server';
import { getDisputes, openDisputeCount, disputeTotalHeldRub } from '@/lib/disputes-server';
import { LiveApiStatusBar } from '@/components/platform-v7/LiveApiStatusBar';
import { WorkflowActionPanel } from '@/components/platform-v7/WorkflowActionPanel';
import { RoleExecutionHandoff, type HandoffItem } from '@/components/platform-v7/RoleExecutionHandoff';
import { P7ActionStateChip } from '@/components/platform-v7/P7ActionStateChip';
import { JournalPreview } from '@/components/platform-v7/JournalPreview';
import { ConditionReasonStrip } from '@/components/platform-v7/ConditionReasonStrip';
import { DocumentReadinessMiniMatrix } from '@/components/platform-v7/DocumentReadinessMiniMatrix';
import { MoneyImpactSummaryStrip } from '@/components/platform-v7/MoneyImpactSummaryStrip';
import { MoneyGateRing } from '@/components/v7r/MoneyGateRing';
import { RoleExecutionCockpitContent } from '@/components/platform-v7/RoleExecutionCockpit';
import { PRIMARY_ROLE_EXECUTION_COCKPITS } from '@/lib/platform-v7/role-execution-cockpit';
import { ActionFeedbackPreviewStrip } from '@/components/platform-v7/ActionFeedbackPreviewStrip';
import { SmartSectionSummary } from '@/components/platform-v7/visual/SmartSectionSummary';
import { CauseLine } from '@/components/platform-v7/visual/CauseLine';
import { UnlockPath } from '@/components/platform-v7/visual/UnlockPath';
import { P7ExecutionActionsPanel, type PlatformV7ExecutionActionUiItem } from '@/components/platform-v7/P7ExecutionActionsPanel';
import { CollapsibleSection } from '@/components/platform-v7/CollapsibleSection';
import { CreditBureauPanel } from '@/components/platform-v7/CreditBureauPanel';
import { EscrowPanel } from '@/components/platform-v7/EscrowPanel';
import { PLATFORM_V7_INITIAL_EXECUTION_ACTION_STATE, type PlatformV7ExecutionActionState } from '@/lib/platform-v7/execution-action-core';

const buyerHandoff: HandoffItem[] = [
  { direction: 'sends', role: 'покупатель → банк', requirement: 'запрос банковского подтверждения резерва', entity: 'DL-9106', href: '/platform-v7/deals/DL-9106/money', moneyImpact: true },
  { direction: 'sends', role: 'покупатель → продавец', requirement: 'предложение с условиями: цена, объём, базис и документы', entity: 'LOT-2403', href: '/platform-v7/lots/LOT-2403', documentImpact: true },
  { direction: 'awaits', role: 'от банка', requirement: 'резерв ожидает банковского подтверждения — до этого сделка не переходит к логистике', moneyImpact: true },
  { direction: 'awaits', role: 'от элеватора', requirement: 'акт приёмки и протокол качества влияют на итоговый расчёт и удержание', documentImpact: true, moneyImpact: true },
  { direction: 'next', requirement: 'запросить банковское подтверждение резерва и перейти к логистике после статуса банка', entity: 'DL-9106', href: '/platform-v7/deals', moneyImpact: true },
];

const buyerLots = [
  { id: 'LOT-2405', title: 'Пшеница 4 класса · 240 т · Тамбовская область', price: '16 120 ₽/т', status: 'лучшая ставка', next: 'повысить ставку или ждать окончания окна', href: '/platform-v7/lots/LOT-2405' },
  { id: 'LOT-2403', title: 'Пшеница 4 класса · 600 т · Тамбовская область', price: '16 080 ₽/т', status: 'ставка принята', next: 'запросить банковское подтверждение резерва', href: '/platform-v7/lots/LOT-2403' },
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
  { title: 'Отправить СДИЗ на ручную проверку', description: 'Создаёт задачу оператору проверить статус СДИЗ во ФГИС или по документу. Это не внешнее подтверждение ФГИС.', targetId: 'e4-send-sdiz-manual-review', actionId: 'sendSdizManualReview', actorRole: 'buyer', actorId: 'buyer-user-1', entityId: 'SDIZ-DL-9106', mode: 'manual' },
  { title: 'Погасить СДИЗ', description: 'Доступно только после оформления, подписи и передачи СДИЗ покупателю; результат остаётся ручной проверкой до внешнего подтверждения.', targetId: 'e4-redeem-sdiz', actionId: 'redeemSdiz', actorRole: 'buyer', actorId: 'buyer-user-1', entityId: 'SDIZ-DL-9106', mode: 'manual' },
  { title: 'Зафиксировать отказ от погашения', description: 'Блокирует выпуск и передаёт задачу поддержке/комплаенсу для обработки основания отказа.', targetId: 'e4-refuse-sdiz-redemption', actionId: 'refuseSdizRedemption', actorRole: 'buyer', actorId: 'buyer-user-1', entityId: 'SDIZ-DL-9106', mode: 'manual' },
] satisfies readonly PlatformV7ExecutionActionUiItem[];

export default async function PlatformV7BuyerPage() {
  const [deals, disputes] = await Promise.all([getDealsCanonical(), getDisputes()]);
  const apiOnline = deals.length > 0;
  const disputeCount = openDisputeCount(disputes);
  const heldRub = disputeTotalHeldRub(disputes);
  const heldLabel = heldRub > 0 ? `${(heldRub / 1_000_000).toFixed(2)} млн ₽ удержано` : 'удержаний нет';

  return (
    <MoneyObligationCockpit
      testId='platform-v7-buyer-cockpit'
      eyebrow='Покупатель · деньги и обязательства'
      title='Подтвердить резерв, чтобы сделка перешла к логистике'
      description='Первый экран показывает выбранную партию, резерв, удержание, блокер, ответственного и следующий шаг. Банковское подтверждение нельзя заменить действием интерфейса.'
      statusLabel={apiOnline ? 'Сервер подтверждён' : 'Статичный контур'}
      statusTone={apiOnline ? 'success' : 'warning'}
      liveStatus={(
        <LiveApiStatusBar
          apiOnline={apiOnline}
          openDisputes={disputeCount}
          role='BUYER · КАБИНЕТ ПОКУПАТЕЛЯ'
          summary={apiOnline ? `${deals.length} сделок · ${disputeCount} споров · ${heldLabel}` : 'Данные статичные — API недоступен'}
        />
      )}
      priority={{
        title: 'Запросить банковское подтверждение резерва по DL-9106',
        description: 'До подтверждённого банковского статуса логистика не стартует. Спорная часть остаётся под удержанием до закрытия расхождения по весу.',
        state: 'waiting',
        amount: '9,65 млн ₽ резерв · 624 тыс. ₽ удержание',
        blocker: 'банк ещё не подтвердил резерв',
        owner: 'покупатель запрашивает · банк подтверждает',
        result: 'сделка допускается к логистике',
        primaryAction: <Link className={moneyCockpitClasses.primaryLink} href='/platform-v7/deals/DL-9106/money'>Открыть деньги сделки</Link>,
        secondaryAction: <Link className={moneyCockpitClasses.secondaryLink} href='/platform-v7/deals'>Карточка сделки</Link>,
      }}
      facts={[
        { label: 'Сделка', value: 'LOT-2403 → DL-9106', hint: 'ставка принята' },
        { label: 'Резерв', value: '9,65 млн ₽', hint: 'ожидает банковского подтверждения' },
        { label: 'Удержание', value: '624 тыс. ₽', hint: 'расхождение по весу' },
        { label: 'Следующий контур', value: 'логистика', hint: 'только после статуса банка' },
      ]}
    >
      <MoneyBoundary>
        Платформа показывает основание, причину остановки и следующий шаг. Банк подтверждает резерв и дальнейшее движение денег.
      </MoneyBoundary>

      <MoneyCockpitSection id='live-deals'>
        <CollapsibleSection title='Мои сделки' summary='реальные сделки с сервера · открыть исполнение' defaultOpen>
          <CanonicalDealsList />
        </CollapsibleSection>
      </MoneyCockpitSection>

      <MoneyCockpitSection id='overview'>
        <CollapsibleSection title='Обзор закупки' summary='заявка · партия · статус' defaultOpen={false}>
          <RoleExecutionCockpitContent cockpit={PRIMARY_ROLE_EXECUTION_COCKPITS.buyer} />
        </CollapsibleSection>
      </MoneyCockpitSection>

      <MoneyCockpitSection id='money'>
        <CollapsibleSection title='Деньги, резерв и удержание' summary='резерв 9,65 млн ₽ · удержание 624 тыс. ₽' defaultOpen>
          <div className={moneyCockpitClasses.sectionStack}>
            <MoneyGateRing
              title='Деньги покупателя по сделке DL-9106'
              totalRub={9_648_000}
              segments={[
                { label: 'Банк подтвердил выплату', amountRub: 0, state: 'released' },
                { label: 'Резерв заявлен покупателем', amountRub: 9_024_000, state: 'reserved' },
                { label: 'Удержано по спору', amountRub: 624_000, state: 'held' },
              ]}
              caption='Резерв ожидает банковского подтверждения; спорная часть удержана до закрытия расхождения. Платформа деньги не выпускает.'
            />
            <MoneyImpactSummaryStrip
              amountContext='резерв 9,65 млн ₽ · удержание 624 тыс. ₽'
              pilotState='waiting'
              pilotStateLabel='ожидание подтверждения'
              responsible='покупатель · банк'
              nextStep='ожидать банковского подтверждения резерва'
              stopReason='сделка не переходит к логистике до банковского подтверждения'
              requiredEvidence='банковское подтверждение резерва; по спорной части — акт приёмки и протокол качества'
              afterResolved='после подтверждения резерва сделка переходит к логистике; спорная часть остаётся под удержанием'
              bankPlatformBoundary='платформа показывает причину и следующий шаг, банк подтверждает резерв и движение денег'
            />
          </div>
        </CollapsibleSection>
      </MoneyCockpitSection>

      <MoneyCockpitSection id='documents'>
        <CollapsibleSection title='Документы и СДИЗ покупателя' summary='СДИЗ · ручная проверка · действия' defaultOpen={false}>
          <div className={moneyCockpitClasses.sectionStack}>
            <DocumentReadinessMiniMatrix role='buyer' />
            <P7ExecutionActionsPanel
              title='СДИЗ покупателя'
              subtitle='Покупатель может погасить СДИЗ, зафиксировать отказ или отправить статус на ручную проверку. Банк получает основание для проверки, а не сигнал выплаты.'
              items={buyerSdizActionItems}
              initialState={buyerSdizInitialState}
            />
            <WorkflowActionPanel context='buyer' />
          </div>
        </CollapsibleSection>
      </MoneyCockpitSection>

      <MoneyCockpitSection id='blockers'>
        <CollapsibleSection title='Блокеры и путь разблокировки' summary='резерв → логистика → удержание' defaultOpen={false}>
          <div className={moneyCockpitClasses.sectionStack}>
            <P7ActionStateChip status='active' label='контур исполнения' nextActor='покупатель' moneyEffect='резерв после банковского подтверждения' />
            <ConditionReasonStrip condition='ожидание банковского статуса' responsible='покупатель' documentState='резерв не подтверждён банком' />
            <CauseLine cause={{ text: 'Банк не подтвердил резерв', tone: 'blocked' }} relation='blocks' effect={{ text: 'Логистика не стартует', tone: 'blocked' }} moneyAmount='9,65 млн ₽' moneyTone='hold' />
            <CauseLine cause={{ text: 'Вес расходится с актом', tone: 'warning' }} relation='affects' effect={{ text: 'Удержание на спорную часть', tone: 'warning' }} moneyAmount='624 тыс. ₽' moneyTone='hold' />
            <UnlockPath title='Чтобы открыть движение сделки:' steps={[
              { id: '1', label: 'Запросить банковское подтверждение резерва', status: 'current', detail: 'DL-9106 · 9,65 млн ₽' },
              { id: '2', label: 'Дождаться статуса банка', status: 'upcoming', detail: 'без этого логистика не стартует' },
              { id: '3', label: 'Закрыть расхождение веса через акт', status: 'upcoming', detail: 'снимет удержание 624 тыс. ₽' },
            ]} />
          </div>
        </CollapsibleSection>
      </MoneyCockpitSection>

      <MoneyCockpitSection id='actions'>
        <CollapsibleSection title='Передача и журнал' summary='действие · ответственный · ожидание' defaultOpen={false}>
          <div className={moneyCockpitClasses.sectionStack}>
            <ActionFeedbackPreviewStrip context='buyer' />
            <RoleExecutionHandoff items={buyerHandoff} title='исполнение: что покупатель отправляет и ожидает' />
            <SmartSectionSummary label='Журнал' items={[
              { text: 'Резерв 9,65 млн ₽ · ожидает банковского подтверждения', tone: 'warn' },
              { text: 'Удержание 624 тыс. ₽ · расхождение веса по LOT-2403', tone: 'warn' },
            ]} />
            <JournalPreview role='buyer' maxEntries={3} />
          </div>
        </CollapsibleSection>
      </MoneyCockpitSection>

      <MoneyCockpitSection id='procurement'>
        <CollapsibleSection title='Закупки, партии и маршруты' summary='заявки · предложения · партии' defaultOpen={false}>
          <div className={moneyCockpitClasses.sectionStack}>
            <MoneyQueue>
              {buyerPaths.map((path) => <MoneyQueueLink key={path.href} href={path.href} title={path.title} detail={path.note} status={<StatusChip tone='information'>Открыть</StatusChip>} />)}
            </MoneyQueue>
            <MoneyQueue>
              {buyerLots.map((lot) => <MoneyQueueLink key={lot.id} href={lot.href} title={`${lot.id} · ${lot.title}`} detail={`${lot.price} · ${lot.next}`} status={<StatusChip tone={lot.status === 'ставка принята' ? 'success' : 'warning'}>{lot.status}</StatusChip>} />)}
            </MoneyQueue>
            <Surface><BuyerFavoritesPanel /></Surface>
          </div>
        </CollapsibleSection>
      </MoneyCockpitSection>

      <MoneyCockpitSection>
        <CollapsibleSection title='Кредитный и безопасный расчётный контур' summary='скоринг · escrow · условия выпуска' defaultOpen={false}>
          <div className={moneyCockpitClasses.toolGrid}>
            <Surface><CreditBureauPanel /></Surface>
            <Surface><EscrowPanel /></Surface>
          </div>
        </CollapsibleSection>
      </MoneyCockpitSection>
    </MoneyObligationCockpit>
  );
}
