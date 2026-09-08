import { LiveApiStatusBar } from '@/components/platform-v7/LiveApiStatusBar';
import { PriceChart } from '@/components/platform-v7/PriceChart';
import { ExecutiveSignalWall, type ExecutiveSignal } from '@/components/platform-v7/ExecutiveSignalWall';
import { EmptyState } from '@/components/platform-v7/EmptyState';
import { getDealsSnapshot } from '@/lib/deals-server';
import { getDisputesSnapshot, disputeTotalHeldRub, openDisputeCount } from '@/lib/disputes-server';
import { getOutboxStatus, getPaymentsSnapshot } from '@/lib/outbox-server';
import { CollapsibleSection } from '@/components/platform-v7/CollapsibleSection';
import { getPlatformV7BiCockpitState } from '@/lib/platform-v7/runtime/bi-cockpit-state';
import { UnitEconomicsPassport } from '@/components/platform-v7/UnitEconomicsPassport';
import { ClickHouseAnalyticsPanel } from '@/components/platform-v7/ClickHouseAnalyticsPanel';
import { MlPricePredictorPanel } from '@/components/platform-v7/MlPricePredictorPanel';
import {
  OperationalCockpitSection,
  OperationalDecisionCockpit,
  OperationalQueue,
  OperationalQueueLink,
  operationalCockpitClasses,
} from '@/components/transaction-ux/OperationalDecisionCockpit';

function formatMoney(rub: number): string {
  if (rub >= 1_000_000_000) return `${(rub / 1_000_000_000).toFixed(2)} млрд ₽`;
  if (rub >= 1_000_000) return `${(rub / 1_000_000).toFixed(2)} млн ₽`;
  if (rub >= 1_000) return `${(rub / 1_000).toFixed(0)} тыс. ₽`;
  return `${rub} ₽`;
}

export default async function ExecutivePage() {
  const [dealsSnapshot, disputesSnapshot, outbox, paymentsSnapshot] = await Promise.all([
    getDealsSnapshot(),
    getDisputesSnapshot(),
    getOutboxStatus(),
    getPaymentsSnapshot(),
  ]);

  const dealsAvailable = dealsSnapshot.isApiAvailable;
  const disputes = disputesSnapshot.disputes;
  const disputesAvailable = disputesSnapshot.isApiAvailable;
  const dealList: any[] = dealsSnapshot.deals;
  const activeDeals = dealList.filter((deal) => !['CLOSED', 'CANCELLED'].includes(deal.status));
  const totalVolume = dealList.reduce((sum, deal) => sum + (deal.totalRub ?? 0), 0);
  const heldRub = disputeTotalHeldRub(disputes);
  const disputeCount = openDisputeCount(disputes);
  const outboxAvailable = outbox.isApiAvailable;
  const pendingBank = outboxAvailable ? outbox.totalPending : 0;
  const failedBank = outboxAvailable ? outbox.totalFailed : 0;
  const unclassifiedBank = outboxAvailable ? outbox.totalUnclassified : 0;
  const outboxComplete = outboxAvailable && outbox.isComplete;
  const paymentsAvailable = paymentsSnapshot.isApiAvailable;
  const paymentsComplete = paymentsAvailable && paymentsSnapshot.isComplete;
  const manualReviewBank = paymentsAvailable ? paymentsSnapshot.totalManualReview : 0;
  const bi = getPlatformV7BiCockpitState();

  const liveBlockers = [
    ...(!dealsAvailable ? [{ id: 'deals-source', label: 'Источник сделок недоступен · состояние портфеля неизвестно', severity: 'warn' as const }] : []),
    ...(!disputesAvailable ? [{ id: 'disputes-source', label: 'Источник споров недоступен · состояние неизвестно', severity: 'warn' as const }] : []),
    ...(!outboxAvailable ? [{ id: 'outbox-source', label: 'Источник банковской доставки недоступен · состояние неизвестно', severity: 'warn' as const }] : []),
    ...(outboxAvailable && !outboxComplete ? [{ id: 'outbox-incomplete', label: 'История банковской доставки превышает проверяемое окно · состояние неполное', severity: 'warn' as const }] : []),
    ...(!paymentsAvailable ? [{ id: 'payments-source', label: 'Источник банковской сверки недоступен · состояние неизвестно', severity: 'warn' as const }] : []),
    ...(paymentsAvailable && !paymentsComplete ? [{ id: 'payments-incomplete', label: 'История банковской сверки превышает проверяемое окно · состояние неполное', severity: 'warn' as const }] : []),
    ...(disputeCount > 0 ? [{ id: 'disputes', label: `${disputeCount} открытых спора · ${formatMoney(heldRub)} удержано`, severity: 'stop' as const }] : []),
    ...(manualReviewBank > 0 ? [{ id: 'bank-manual-review', label: `${manualReviewBank} банковских операций требуют ручной сверки`, severity: 'stop' as const }] : []),
    ...(unclassifiedBank > 0 ? [{ id: 'bank-unclassified', label: `${unclassifiedBank} банковских событий имеют неподтвержденный статус, включая возможный DEAD_LETTER`, severity: 'stop' as const }] : []),
    ...(failedBank > 0 ? [{ id: 'bank-failed', label: `${failedBank} банковских операций завершились ошибкой`, severity: 'stop' as const }] : []),
    ...(pendingBank > 0 ? [{ id: 'bank', label: `${pendingBank} банковских операций ожидают подтверждения`, severity: 'warn' as const }] : []),
  ];

  const signals: ExecutiveSignal[] = [
    { label: 'Деньги в блоке', value: disputesAvailable ? formatMoney(heldRub) : '—', detail: !disputesAvailable ? 'источник споров недоступен' : disputeCount > 0 ? 'удержано до решения споров' : 'удержаний нет', state: !disputesAvailable ? 'wait' : heldRub > 0 ? 'stop' : 'ok' },
    { label: 'Открытые споры', value: disputesAvailable ? String(disputeCount) : '—', detail: disputesAvailable ? 'каждый спор связан с конкретной Сделкой' : 'состояние неизвестно', state: !disputesAvailable ? 'wait' : disputeCount > 0 ? 'stop' : 'ok' },
    { label: 'Банк', value: manualReviewBank > 0 ? String(manualReviewBank) : failedBank > 0 ? String(failedBank) : outboxAvailable && paymentsAvailable ? String(pendingBank) : '—', detail: manualReviewBank > 0 ? 'операции требуют ручной сверки' : failedBank > 0 ? 'операции завершились ошибкой доставки' : !outboxAvailable || !paymentsAvailable ? 'состояние банковского контура неизвестно' : pendingBank > 0 ? 'операции требуют внешнего подтверждения' : 'ожидающих операций нет', state: manualReviewBank > 0 || failedBank > 0 ? 'stop' : !outboxAvailable || !paymentsAvailable || pendingBank > 0 ? 'wait' : 'ok' },
    { label: 'Портфель', value: dealsAvailable ? formatMoney(totalVolume) : '—', detail: dealsAvailable ? `${dealList.length} сделок · ${activeDeals.length} активных` : 'источник сделок недоступен', state: dealsAvailable ? 'ok' : 'wait' },
  ];

  return (
    <OperationalDecisionCockpit
      testId='platform-v7-executive-v8'
      eyebrow='Личный кабинет руководителя · только просмотр'
      title='Мой дашборд'
      description='Главное по платформе на одном экране: портфель, деньги, сделки, споры и внешние подтверждения. Без операционного вмешательства и расширения полномочий.'
      statusLabel={liveBlockers.length > 0 ? 'есть отклонения' : 'контур стабилен'}
      statusTone={liveBlockers.some((item) => item.severity === 'stop') ? 'critical' : liveBlockers.length > 0 ? 'warning' : 'success'}
      liveStatus={(
        <LiveApiStatusBar
          apiOnline={dealsAvailable && disputesAvailable && outboxComplete && paymentsComplete}
          blockers={liveBlockers}
          pendingBankOps={pendingBank}
          openDisputes={disputeCount}
          role='EXECUTIVE · Стратегический обзор'
          summary={!dealsAvailable
            ? 'портфель: состояние неизвестно'
            : disputesAvailable
              ? `${activeDeals.length} активных сделок · ${formatMoney(totalVolume)} портфель · ${formatMoney(heldRub)} удержано`
              : `${activeDeals.length} активных сделок · ${formatMoney(totalVolume)} портфель · споры: состояние неизвестно`}
        />
      )}
      priority={{
        state: disputeCount > 0 || manualReviewBank > 0 || failedBank > 0 || unclassifiedBank > 0 ? 'critical' : !dealsAvailable || !disputesAvailable || !outboxComplete || !paymentsComplete || pendingBank > 0 ? 'active' : 'ready',
        eyebrow: 'Главный управленческий сигнал',
        title: disputeCount > 0
          ? `Разобрать причины удержания ${formatMoney(heldRub)}`
          : manualReviewBank > 0
            ? `Разобрать ${manualReviewBank} операций ручной банковской сверки`
          : unclassifiedBank > 0
            ? `Разобрать ${unclassifiedBank} неподтвержденных статусов банковской доставки`
          : failedBank > 0
            ? `Разобрать ${failedBank} ошибок банковской доставки`
          : !dealsAvailable
            ? 'Проверить доступность реестра сделок'
          : !disputesAvailable
            ? 'Проверить доступность реестра споров'
          : !outboxAvailable
            ? 'Проверить доступность банковской доставки'
          : !outboxComplete
            ? 'Проверить полную историю банковской доставки'
          : !paymentsAvailable
            ? 'Проверить доступность банковской сверки'
          : !paymentsComplete
            ? 'Проверить полную историю банковской сверки'
          : pendingBank > 0
            ? `Проверить ${pendingBank} банковских подтверждений`
            : 'Критических отклонений нет',
        description: disputeCount > 0
          ? 'Сначала разберите причины удержаний и владельцев процесса. Операционные действия остаются у уполномоченных ролей внутри Сделки.'
          : manualReviewBank > 0
            ? 'Банковская сверка зафиксировала MANUAL_REVIEW. Дашборд не объявляет all-clear до разрешения расхождения уполномоченными ролями.'
          : unclassifiedBank > 0
            ? 'Есть банковские события вне подтвержденных PENDING/FAILED/CONFIRMED состояний. Это может включать DEAD_LETTER; all-clear запрещён до разбора.'
          : failedBank > 0
            ? 'Есть подтверждённые ошибки доставки банковских событий. Дашборд показывает их как critical и не подменяет разбор оператором и банковским контуром.'
          : !dealsAvailable
            ? 'Источник сделок недоступен или вернул непроверяемые данные. Портфель и all-clear не считаются подтвержденными.'
          : !disputesAvailable
            ? 'Источник споров недоступен или вернул непроверяемые данные. Дашборд не объявляет all-clear, пока серверный реестр не восстановит подтверждаемое состояние.'
          : !outboxAvailable
            ? 'Источник банковской доставки недоступен. Отсутствие данных не трактуется как отсутствие проблем.'
          : !outboxComplete
            ? 'Банковская доставка достигла лимита 200 записей. История считается неполной, поэтому all-clear отключён.'
          : !paymentsAvailable
            ? 'Источник банковской сверки недоступен. Статус MANUAL_REVIEW нельзя подтвердить, поэтому all-clear отключён.'
          : !paymentsComplete
            ? 'Банковская сверка вернула полный лимит 100 строк. Старые MANUAL_REVIEW могут быть вне окна, поэтому all-clear отключён.'
          : pendingBank > 0
            ? 'Есть внешние банковские подтверждения в ожидании. Дашборд показывает влияние, но не подменяет банковский authority.'
            : 'Портфель без критических удержаний и банковских блокеров. Контролируйте сделки и динамику без ручного вмешательства.',
        blocker: disputeCount > 0 ? `${disputeCount} открытых спора` : manualReviewBank > 0 ? `${manualReviewBank} операций MANUAL_REVIEW` : unclassifiedBank > 0 ? `${unclassifiedBank} неподтвержденных статусов BANK_` : failedBank > 0 ? `${failedBank} ошибок банковской доставки` : !dealsAvailable ? 'состояние сделок неизвестно' : !disputesAvailable ? 'состояние споров неизвестно' : !outboxComplete ? 'история банковской доставки неполна' : !paymentsComplete ? 'история банковской сверки неполна' : pendingBank > 0 ? `${pendingBank} банковских операций` : 'нет',
        owner: disputeCount > 0 ? 'оператор + арбитр + банк' : manualReviewBank > 0 || unclassifiedBank > 0 || failedBank > 0 || pendingBank > 0 ? 'банк + оператор' : !dealsAvailable || !disputesAvailable || !outboxComplete || !paymentsComplete ? 'оператор платформы' : 'нет эскалации',
        impact: heldRub > 0 ? formatMoney(heldRub) : manualReviewBank > 0 ? `${manualReviewBank} операций на ручной сверке` : unclassifiedBank > 0 ? `${unclassifiedBank} неподтвержденных статусов` : failedBank > 0 ? `${failedBank} ошибок` : !dealsAvailable || !disputesAvailable || !outboxComplete || !paymentsComplete ? 'неизвестно до восстановления полного источника' : pendingBank > 0 ? `${pendingBank} операций` : 'нет денежного влияния',
        result: 'эскалация владельцу процесса, а не ручная правка данных',
      }}
      facts={[
        { label: 'Портфель', value: dealsAvailable ? formatMoney(totalVolume) : '—', hint: dealsAvailable ? `${dealList.length} сделок всего` : 'состояние сделок неизвестно' },
        { label: 'Активных сделок', value: dealsAvailable ? String(activeDeals.length) : '—', hint: dealsAvailable ? 'не закрыты и не отменены' : 'источник недоступен' },
        { label: 'Деньги в блоке', value: disputesAvailable ? formatMoney(heldRub) : '—', hint: !disputesAvailable ? 'состояние споров неизвестно' : disputeCount > 0 ? `${disputeCount} открытых спора` : 'удержаний нет' },
        { label: 'Ручная сверка банка', value: paymentsAvailable ? String(manualReviewBank) : '—', hint: !paymentsAvailable ? 'состояние неизвестно' : manualReviewBank > 0 ? 'MANUAL_REVIEW требует разбора' : failedBank > 0 ? `${failedBank} ошибок доставки отдельно` : 'расхождений нет' },
      ]}
      boundary='Руководитель имеет read-only обзор. Экран не расширяет RBAC, не создаёт банк-статус и не позволяет обходить ответственных участников Сделки.'
    >
      <CollapsibleSection title='Быстрый доступ' summary='сделки · споры · профиль' defaultOpen>
        <OperationalQueue>
          <OperationalQueueLink
            href='/platform-v7/deals'
            title='Сделки'
            detail={dealsAvailable ? `${activeDeals.length} активных · ${formatMoney(totalVolume)} в портфеле` : 'Источник сделок недоступен'}
          />
          <OperationalQueueLink
            href='/platform-v7/disputes'
            title='Споры и удержания'
            detail={!disputesAvailable ? 'Источник споров недоступен' : disputeCount > 0 ? `${disputeCount} открытых · ${formatMoney(heldRub)} удержано` : 'Открытых споров и удержаний нет'}
          />
          <OperationalQueueLink
            href='/platform-v7/profile'
            title='Мой профиль и доступ'
            detail='Организация, membership, роль и MFA из серверной сессии'
          />
        </OperationalQueue>
      </CollapsibleSection>

      {liveBlockers.length > 0 ? (
        <CollapsibleSection title='Требует внимания' summary={`${liveBlockers.length} управленческих сигнала`} defaultOpen>
          <OperationalQueue>
            {!dealsAvailable ? (
              <OperationalQueueLink
                href='/platform-v7/executive'
                title='Требует внимания: источник сделок'
                detail='Портфель неизвестен — all-clear отключён до восстановления источника'
              />
            ) : null}
            {!disputesAvailable ? (
              <OperationalQueueLink
                href='/platform-v7/executive'
                title='Требует внимания: источник споров'
                detail='Состояние споров неизвестно — all-clear отключён до восстановления источника'
              />
            ) : null}
            {disputeCount > 0 ? (
              <OperationalQueueLink
                href='/platform-v7/disputes'
                title='Требуют внимания: споры'
                detail={`${disputeCount} открытых · влияние ${formatMoney(heldRub)}`}
              />
            ) : null}
            {!outboxAvailable ? (
              <OperationalQueueLink
                href='/platform-v7/status'
                title='Требует внимания: источник банка'
                detail='Состояние банковских подтверждений неизвестно — all-clear отключён до восстановления источника'
              />
            ) : null}
            {outboxAvailable && !outboxComplete ? (
              <OperationalQueueLink
                href='/platform-v7/executive'
                title='Требует внимания: история банковской доставки'
                detail='Достигнут лимит 200 записей — полная история не подтверждена'
              />
            ) : null}
            {!paymentsAvailable ? (
              <OperationalQueueLink
                href='/platform-v7/executive'
                title='Требует внимания: источник банковской сверки'
                detail='MANUAL_REVIEW нельзя подтвердить — all-clear отключён до восстановления источника'
              />
            ) : null}
            {paymentsAvailable && !paymentsComplete ? (
              <OperationalQueueLink
                href='/platform-v7/executive'
                title='Требует внимания: история банковской сверки'
                detail='Достигнут лимит 100 платежей — старые MANUAL_REVIEW могут быть вне окна'
              />
            ) : null}
            {manualReviewBank > 0 ? (
              <OperationalQueueLink
                href='/platform-v7/executive'
                title='Требуют внимания: ручная банковская сверка'
                detail={`${manualReviewBank} операций имеют статус MANUAL_REVIEW`}
              />
            ) : null}
            {unclassifiedBank > 0 ? (
              <OperationalQueueLink
                href='/platform-v7/executive'
                title='Требуют внимания: неподтвержденные статусы банка'
                detail={`${unclassifiedBank} BANK_ событий вне PENDING/FAILED/CONFIRMED, включая возможный DEAD_LETTER`}
              />
            ) : null}
            {failedBank > 0 ? (
              <OperationalQueueLink
                href='/platform-v7/executive'
                title='Требуют внимания: ошибки банка'
                detail={`${failedBank} операций завершились ошибкой доставки`}
              />
            ) : null}
            {pendingBank > 0 ? (
              <OperationalQueueLink
                href='/platform-v7/status'
                title='Требуют внимания: банк'
                detail={`${pendingBank} операций ожидают внешнего подтверждения`}
              />
            ) : null}
          </OperationalQueue>
        </CollapsibleSection>
      ) : null}

      <ExecutiveSignalWall signals={signals} />

      <OperationalCockpitSection id='portfolio'>
        {!dealsAvailable ? (
          <EmptyState title='Источник сделок недоступен' description='Портфель не подменяется нулём. После восстановления серверного реестра дашборд повторно покажет подтверждённые Сделки.' />
        ) : dealList.length === 0 ? (
          <EmptyState title='Сделок пока нет' description='После регистрации Сделок здесь появятся сумма, статус, культура, объём и владелец.' />
        ) : (
          <div className={operationalCockpitClasses.tableWrap}>
            <table className={operationalCockpitClasses.readOnlyTable}>
              <thead>
                <tr>{['ID', 'Статус', 'Культура', 'Объём, т', 'Сумма', 'Владелец'].map((header) => <th key={header}>{header}</th>)}</tr>
              </thead>
              <tbody>
                {dealList.slice(0, 20).map((deal) => (
                  <tr key={deal.id}>
                    <td>{deal.id}</td>
                    <td>{deal.status}</td>
                    <td>{deal.culture ?? '—'}</td>
                    <td>{deal.volumeTons ?? '—'}</td>
                    <td>{deal.totalRub ? formatMoney(deal.totalRub) : '—'}</td>
                    <td>{deal.owner ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </OperationalCockpitSection>

      <CollapsibleSection title='Юнит-экономика' summary='GMV · take rate · margin · CAC · LTV' defaultOpen={false}>
        <p className={operationalCockpitClasses.muted}>{bi.note}</p>
        <UnitEconomicsPassport />
      </CollapsibleSection>

      <div className={operationalCockpitClasses.toolGrid}>
        <CollapsibleSection title='Аналитика GMV' summary='сценарный ClickHouse-контур' defaultOpen={false}>
          <ClickHouseAnalyticsPanel />
        </CollapsibleSection>
        <CollapsibleSection title='Ценовой прогноз' summary='модельный экран · не торговая рекомендация' defaultOpen={false}>
          <MlPricePredictorPanel />
        </CollapsibleSection>
      </div>

      <CollapsibleSection title='Динамика цен' summary='12 месяцев · основные культуры' defaultOpen={false}>
        <PriceChart cultures={['wheat_3', 'wheat_4', 'barley', 'corn', 'sunflower']} defaultPeriod={12} />
      </CollapsibleSection>
    </OperationalDecisionCockpit>
  );
}
