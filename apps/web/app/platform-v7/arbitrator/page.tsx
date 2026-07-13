import Link from 'next/link';
import { RoleExecutionSummary } from '@/components/platform-v7/RoleExecutionSummary';
import { JournalPreview } from '@/components/platform-v7/JournalPreview';
import { ArbitratorDisputeRoom } from '@/components/platform-v7/ArbitratorDisputeRoom';
import { QuietIntelligenceHint } from '@/components/platform-v7/visual/QuietIntelligenceHint';
import { TrustDot } from '@/components/platform-v7/visual/TrustDot';
import { LiveApiStatusBar } from '@/components/platform-v7/LiveApiStatusBar';
import { getDisputes, openDisputeCount, disputeTotalHeldRub } from '@/lib/disputes-server';
import { CauseLine } from '@/components/platform-v7/visual/CauseLine';
import { SmartSectionSummary } from '@/components/platform-v7/visual/SmartSectionSummary';
import { CollapsibleSection } from '@/components/platform-v7/CollapsibleSection';
import {
  OperationalCockpitSection,
  OperationalDecisionCockpit,
  operationalCockpitClasses,
} from '@/components/transaction-ux/OperationalDecisionCockpit';

function formatMoney(rub: number): string {
  if (rub >= 1_000_000) return `${(rub / 1_000_000).toFixed(2)} млн ₽`;
  if (rub >= 1_000) return `${(rub / 1_000).toFixed(0)} тыс. ₽`;
  return `${rub} ₽`;
}

export default async function ArbitratorPage() {
  const disputes = await getDisputes();
  const disputeCount = openDisputeCount(disputes);
  const heldRub = disputeTotalHeldRub(disputes);
  const active = disputes.find((dispute) => dispute.status === 'OPEN' || dispute.status === 'UNDER_REVIEW');

  const liveBlockers = disputes
    .filter((dispute) => dispute.status === 'OPEN' || dispute.status === 'UNDER_REVIEW')
    .map((dispute) => ({
      id: dispute.id,
      label: `Спор ${dispute.id}: ${dispute.description.slice(0, 60)}`,
      severity: (dispute.severity === 'HIGH' || dispute.severity === 'CRITICAL' ? 'stop' : 'warn') as 'stop' | 'warn',
      responsibleRole: 'ARBITRATOR',
      nextAction: dispute.status === 'OPEN' ? 'Взять в работу' : 'Зафиксировать решение',
    }));

  return (
    <OperationalDecisionCockpit
      testId='platform-v7-arbitrator-v8'
      eyebrow='Арбитраж · доказательства → решение → основание'
      title='Решение начинается с проверяемых фактов'
      description='Арбитр видит сумму спора, доказательства сторон, причинную связь, удержание и следующий шаг. Решение фиксируется в Сделке и не выпускает деньги самостоятельно.'
      statusLabel={disputeCount > 0 ? 'есть открытые споры' : 'очередь чистая'}
      statusTone={disputeCount > 0 ? 'critical' : 'success'}
      liveStatus={(
        <LiveApiStatusBar
          apiOnline={disputeCount > 0}
          blockers={liveBlockers}
          openDisputes={disputeCount}
          role='ARBITRATOR · Споры и доказательства'
          summary={`${disputeCount} открытых споров · ${formatMoney(heldRub)} удержано`}
        />
      )}
      priority={{
        state: active ? 'critical' : 'ready',
        title: active ? `Рассмотреть спор ${active.id}` : 'Открытых споров нет',
        description: active
          ? 'Проверьте акт, протокол, вес, фото, временные метки и журнал. Зафиксируйте сумму, основание и рекомендуемый следующий шаг.'
          : 'Новые споры появятся в очереди только после серверной регистрации и привязки к Сделке.',
        blocker: active ? 'доказательный пакет требует решения' : 'нет',
        owner: 'арбитр',
        impact: formatMoney(heldRub),
        result: 'мотивированное решение + неизменяемый журнал',
        primaryAction: active ? <Link className={operationalCockpitClasses.primaryLink} href='/platform-v7/disputes'>Открыть спор</Link> : undefined,
        secondaryAction: <Link className={operationalCockpitClasses.secondaryLink} href='/platform-v7/deals/DL-9102/audit'>Журнал Сделки</Link>,
      }}
      facts={[
        { label: 'Открытых споров', value: String(disputeCount), hint: 'только серверно зарегистрированные дела' },
        { label: 'Удержано', value: formatMoney(heldRub), hint: 'спорная часть остаётся под контролем банка' },
        { label: 'Обязательные доказательства', value: 'акт + протокол + фото + журнал', hint: 'каждый факт имеет источник и время' },
        { label: 'После решения', value: 'ручная сверка основания', hint: 'оператор и банк получают только подтверждённый результат' },
      ]}
      boundary='Арбитр создаёт мотивированное основание. Он не меняет лабораторный факт, не подписывает документы за стороны и не подтверждает движение денег.'
    >
      {active ? (
        <QuietIntelligenceHint
          problem={`Открытый спор ${active.id} удерживает часть расчёта.`}
          action='Проверить доказательства и зафиксировать сумму и основание решения.'
          outcome='Решение передаётся оператору и банку как основание для следующей проверки.'
        />
      ) : null}

      <OperationalCockpitSection id='decision'>
        <RoleExecutionSummary role='arbitrator' />
        <CauseLine
          cause={{ text: 'Акт расхождения не закрыт', tone: 'blocked' }}
          relation='blocks'
          effect={{ text: 'Удержание не снимается', tone: 'blocked' }}
          moneyAmount={formatMoney(heldRub)}
          moneyTone='hold'
        />
        <SmartSectionSummary
          label='Рамка решения'
          items={[
            { text: 'Сумма и предмет спора подтверждены', tone: 'warn' },
            { text: 'Доказательства сторон доступны в одном пакете', tone: 'warn' },
            { text: 'Причина, решение и следующий шаг фиксируются в журнале', tone: 'warn' },
          ]}
        />
      </OperationalCockpitSection>

      <ArbitratorDisputeRoom />

      <CollapsibleSection title='Журнал арбитража' summary='события · автор · основание · время' defaultOpen={false}>
        <JournalPreview role='arbitrator' />
      </CollapsibleSection>

      <TrustDot state='test' size='sm' label='Арбитражный контур требует договоров, правил и реального назначения арбитра' />
    </OperationalDecisionCockpit>
  );
}
