import { LiveApiStatusBar } from '@/components/platform-v7/LiveApiStatusBar';
import { PriceChart } from '@/components/platform-v7/PriceChart';
import { ExecutiveSignalWall, type ExecutiveSignal } from '@/components/platform-v7/ExecutiveSignalWall';
import { EmptyState } from '@/components/platform-v7/EmptyState';
import { getDealsCanonical } from '@/lib/deals-server';
import { getDisputesSnapshot, disputeTotalHeldRub, openDisputeCount } from '@/lib/disputes-server';
import { getOutboxStatus } from '@/lib/outbox-server';
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
  const [deals, disputesSnapshot, outbox] = await Promise.all([
    getDealsCanonical(),
    getDisputesSnapshot(),
    getOutboxStatus(),
  ]);

  const disputes = disputesSnapshot.disputes;
  const disputesAvailable = disputesSnapshot.isApiAvailable;
  const dealList: any[] = Array.isArray(deals) ? deals : [];
  const activeDeals = dealList.filter((deal) => !['CLOSED', 'CANCELLED'].includes(deal.status));
  const totalVolume = dealList.reduce((sum, deal) => sum + (deal.totalRub ?? 0), 0);
  const heldRub = disputeTotalHeldRub(disputes);
  const disputeCount = openDisputeCount(disputes);
  const outboxAvailable = outbox.isApiAvailable;
  const pendingBank = outboxAvailable ? outbox.totalPending : 0;
  const failedBank = outboxAvailable ? outbox.totalFailed : 0;
  const bi = getPlatformV7BiCockpitState();

  const liveBlockers = [
    ...(!disputesAvailable ? [{ id: 'disputes-source', label: 'Источник споров недоступен · состояние неизвестно', severity: 'warn' as const }] : []),
    ...(!outboxAvailable ? [{ id: 'outbox-source', label: 'Источник банковских подтверждений недоступен · состояние неизвестно', severity: 'warn' as const }] : []),
    ...(disputeCount > 0 ? [{ id: 'disputes', label: `${disputeCount} открытых спора · ${formatMoney(heldRub)} удержано`, severity: 'stop' as const }] : []),
    ...(failedBank > 0 ? [{ id: 'bank-failed', label: `${failedBank} банковских операций завершились ошибкой`, severity: 'stop' as const }] : []),
    ...(pendingBank > 0 ? [{ id: 'bank', label: `${pendingBank} банковских операций ожидают подтверждения`, severity: 'warn' as const }] : []),
  ];

  const signals: ExecutiveSignal[] = [
    { label: 'Деньги в блоке', value: disputesAvailable ? formatMoney(heldRub) : '—', detail: !disputesAvailable ? 'источник споров недоступен' : disputeCount > 0 ? 'удержано до решения споров' : 'удержаний нет', state: !disputesAvailable ? 'wait' : heldRub > 0 ? 'stop' : 'ok' },
    { label: 'Открытые споры', value: disputesAvailable ? String(disputeCount) : '—', detail: disputesAvailable ? 'каждый спор связан с конкретной Сделкой' : 'состояние неизвестно', state: !disputesAvailable ? 'wait' : disputeCount > 0 ? 'stop' : 'ok' },
    { label: 'Банк', value: outboxAvailable ? String(pendingBank) : '—', detail: !outboxAvailable ? 'состояние банковских подтверждений неизвестно' : failedBank > 0 ? `${failedBank} операций завершились ошибкой` : pendingBank > 0 ? 'операции требуют внешнего подтверждения' : 'ожидающих операций нет', state: !outboxAvailable ? 'wait' : failedBank > 0 ? 'stop' : pendingBank > 0 ? 'wait' : 'ok' },
    { label: 'Портфель', value: formatMoney(totalVolume), detail: `${dealList.length} сделок · ${activeDeals.length} активных`, state: 'ok' },
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
          apiOnline={outbox.isApiAvailable}
          blockers={liveBlockers}
          pendingBankOps={pendingBank}
          openDisputes={disputeCount}
          role='EXECUTIVE · Стратегический обзор'
          summary={disputesAvailable
            ? `${activeDeals.length} активных сделок · ${formatMoney(totalVolume)} портфель · ${formatMoney(heldRub)} удержано`
            : `${activeDeals.length} активных сделок · ${formatMoney(totalVolume)} портфель · споры: состояние неизвестно`}
        />
      )}
      priority={{
        state: !disputesAvailable || !outboxAvailable ? 'active' : disputeCount > 0 || failedBank > 0 ? 'critical' : pendingBank > 0 ? 'active' : 'ready',
        eyebrow: 'Главный управленческий сигнал',
        title: !disputesAvailable
          ? 'Проверить доступность реестра споров'
          : !outboxAvailable
            ? 'Проверить доступность банковских подтверждений'
          : disputeCount > 0
          ? `Разобрать причины удержания ${formatMoney(heldRub)}`
          : failedBank > 0
            ? `Разобрать ${failedBank} ошибок банковской доставки`
          : pendingBank > 0
            ? `Проверить ${pendingBank} банковских подтверждений`
            : 'Критических отклонений нет',
        description: !disputesAvailable
          ? 'Источник споров недоступен или вернул непроверяемые данные. Дашборд не объявляет all-clear, пока серверный реестр не восстановит подтверждаемое состояние.'
          : !outboxAvailable
            ? 'Источник банковских подтверждений недоступен. Дашборд не трактует отсутствие данных как отсутствие ожидающих операций.'
          : disputeCount > 0
          ? 'Сначала разберите причины удержаний и владельцев процесса. Операционные действия остаются у уполномоченных ролей внутри Сделки.'
          : failedBank > 0
            ? 'Есть подтверждённые ошибки доставки банковских событий. Дашборд показывает их как critical и не подменяет разбор оператором и банковским контуром.'
          : pendingBank > 0
            ? 'Есть внешние банковские подтверждения в ожидании. Дашборд показывает влияние, но не подменяет банковский authority.'
            : 'Портфель без критических удержаний и банковских блокеров. Контролируйте сделки и динамику без ручного вмешательства.',
        blocker: !disputesAvailable ? 'состояние споров неизвестно' : !outboxAvailable ? 'состояние банковских подтверждений неизвестно' : disputeCount > 0 ? `${disputeCount} открытых спора` : failedBank > 0 ? `${failedBank} ошибок банковской доставки` : pendingBank > 0 ? `${pendingBank} банковских операций` : 'нет',
        owner: !disputesAvailable || !outboxAvailable ? 'оператор платформы' : disputeCount > 0 ? 'оператор + арбитр + банк' : failedBank > 0 || pendingBank > 0 ? 'банк + оператор' : 'нет эскалации',
        impact: !disputesAvailable || !outboxAvailable ? 'неизвестно до восстановления источника' : heldRub > 0 ? formatMoney(heldRub) : failedBank > 0 ? `${failedBank} ошибок` : pendingBank > 0 ? `${pendingBank} операций` : 'нет денежного влияния',
        result: 'эскалация владельцу процесса, а не ручная правка данных',
      }}
      facts={[
        { label: 'Портфель', value: formatMoney(totalVolume), hint: `${dealList.length} сделок всего` },
        { label: 'Активных сделок', value: String(activeDeals.length), hint: 'не закрыты и не отменены' },
        { label: 'Деньги в блоке', value: disputesAvailable ? formatMoney(heldRub) : '—', hint: !disputesAvailable ? 'состояние споров неизвестно' : disputeCount > 0 ? `${disputeCount} открытых спора` : 'удержаний нет' },
        { label: 'Ошибки банка', value: outboxAvailable ? String(failedBank) : '—', hint: !outboxAvailable ? 'состояние неизвестно' : failedBank > 0 ? 'требуют разбора' : 'ошибок доставки нет' },
      ]}
      boundary='Руководитель имеет read-only обзор. Экран не расширяет RBAC, не создаёт банк-статус и не позволяет обходить ответственных участников Сделки.'
    >
      <CollapsibleSection title='Быстрый доступ' summary='сделки · споры · профиль' defaultOpen>
        <OperationalQueue>
          <OperationalQueueLink
            href='/platform-v7/deals'
            title='Сделки'
            detail={`${activeDeals.length} активных · ${formatMoney(totalVolume)} в портфеле`}
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
        {dealList.length === 0 ? (
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
