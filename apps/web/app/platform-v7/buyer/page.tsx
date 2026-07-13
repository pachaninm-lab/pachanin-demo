import Link from 'next/link';
import { NextActionCard, StatusChip, Surface } from '@pc/design-system-v8';
import { DealRoleWorkbenchTemplate } from '@/components/transaction-ux/DealRoleWorkbenchTemplate';
import { KeyFact, KeyFactGrid } from '@/components/transaction-ux/FieldTaskTemplate';
import workspace from '@/components/transaction-ux/CommercialRoleWorkspace.module.css';
import { CollapsibleSection } from '@/components/platform-v7/CollapsibleSection';
import { RoleExecutionHandoff, type HandoffItem } from '@/components/platform-v7/RoleExecutionHandoff';
import { RoleExecutionCockpitContent } from '@/components/platform-v7/RoleExecutionCockpit';
import { PRIMARY_ROLE_EXECUTION_COCKPITS } from '@/lib/platform-v7/role-execution-cockpit';
import { DocumentReadinessMiniMatrix } from '@/components/platform-v7/DocumentReadinessMiniMatrix';
import { WorkflowActionPanel } from '@/components/platform-v7/WorkflowActionPanel';
import { CauseLine } from '@/components/platform-v7/visual/CauseLine';
import { UnlockPath } from '@/components/platform-v7/visual/UnlockPath';
import { MoneyImpactSummaryStrip } from '@/components/platform-v7/MoneyImpactSummaryStrip';
import { ActionFeedbackPreviewStrip } from '@/components/platform-v7/ActionFeedbackPreviewStrip';
import { JournalPreview } from '@/components/platform-v7/JournalPreview';
import { QuietIntelligenceHint } from '@/components/platform-v7/visual/QuietIntelligenceHint';

const buyerHandoff: HandoffItem[] = [
  { direction: 'sends', role: 'покупатель → банк', requirement: 'запрос подтверждения резерва по сделке', moneyImpact: true },
  { direction: 'sends', role: 'покупатель → логистика', requirement: 'подтверждённые условия партии и окно поставки', documentImpact: true },
  { direction: 'awaits', role: 'от банка', requirement: 'подтверждение резерва до старта логистики', moneyImpact: true },
  { direction: 'blockedBy', requirement: 'резерв не подтверждён банком; спорная часть 624 тыс. ₽ удержана', documentImpact: true, moneyImpact: true },
  { direction: 'next', requirement: 'запросить подтверждение резерва и закрыть расхождение веса актом', entity: 'DL-9106', documentImpact: true, moneyImpact: true },
];

const buyerPaths = [
  { href: '/platform-v7/procurement', title: 'Закупки', note: 'Заявки, лимиты и предложения поставщиков' },
  { href: '/platform-v7/lots', title: 'Рынок партий', note: 'Сравнение партий, качества и условий' },
  { href: '/platform-v7/deals', title: 'Сделки', note: 'Резерв, логистика, документы и споры' },
];

const buyerLots = [
  { id: 'LOT-2403', title: 'Пшеница 4 класс · 600 т', price: '16 080 ₽/т', status: 'сделка DL-9106', next: 'подтвердить резерв', href: '/platform-v7/deals/DL-9106/clean' },
  { id: 'LOT-2410', title: 'Ячмень 3 класс · 420 т', price: '15 320 ₽/т', status: 'приём ставок', next: 'сравнить предложения', href: '/platform-v7/lots/LOT-2410' },
];

export default function BuyerPage() {
  const primary = (
    <div className={workspace.stack}>
      <NextActionCard
        label='Одно следующее действие'
        action='Запросить банковское подтверждение резерва'
        reason='До подтверждения банка логистика по DL-9106 не стартует. Спорная часть 624 тыс. ₽ остаётся под удержанием до закрытия расхождения веса.'
        blocked
        impact='9,65 млн ₽ резерв · 624 тыс. ₽ удержание'
        owner='Покупатель и банк'
        actions={(
          <div className={workspace.actions}>
            <Link className={workspace.primaryLink} href='/platform-v7/deals/DL-9106/clean'>Открыть сделку DL-9106</Link>
            <a className={workspace.secondaryLink} href='#buyer-money'>Проверить резерв</a>
          </div>
        )}
      />

      <KeyFactGrid>
        <KeyFact label='Сделка' value='DL-9106' hint='Пшеница 4 класс · 600 т' />
        <KeyFact label='Резерв' value='9,65 млн ₽' hint='ожидает подтверждения банка' />
        <KeyFact label='Удержание' value='624 тыс. ₽' hint='расхождение веса' />
        <KeyFact label='Следующий этап' value='логистика' hint='после подтверждения резерва' />
      </KeyFactGrid>

      <QuietIntelligenceHint
        problem='Банк ещё не подтвердил резерв, поэтому логистика не может стартовать.'
        action='Отправить запрос банку и проверить, что основание сделки и документы доступны для проверки.'
        outcome='После банковского подтверждения резерв открывает логистический этап; удержание остаётся до закрытия акта расхождения.'
      />

      <CollapsibleSection title='Обзор закупки' summary='заявка · партия · статус' defaultOpen>
        <RoleExecutionCockpitContent cockpit={PRIMARY_ROLE_EXECUTION_COCKPITS.buyer} />
      </CollapsibleSection>

      <section id='buyer-money' className={workspace.sectionAnchor}>
        <CollapsibleSection title='Деньги, резерв и удержание' summary='резерв 9,65 млн ₽ · удержание 624 тыс. ₽' defaultOpen>
          <div className={workspace.sectionStack}>
            <MoneyImpactSummaryStrip
              amountContext='резерв 9,65 млн ₽ · удержание 624 тыс. ₽'
              pilotState='waiting'
              pilotStateLabel='ожидание подтверждения'
              responsible='покупатель · банк'
              nextStep='запросить банковское подтверждение резерва'
              stopReason='сделка не переходит к логистике до банковского подтверждения'
              requiredEvidence='банковское подтверждение резерва; для спорной части — акт приёмки и протокол качества'
              afterResolved='подтверждённый резерв открывает логистику; спорная часть остаётся под удержанием'
              bankPlatformBoundary='платформа показывает причину и следующий шаг; банк подтверждает резерв и движение денег'
            />
          </div>
        </CollapsibleSection>
      </section>

      <CollapsibleSection title='Документы и СДИЗ покупателя' summary='СДИЗ · ручная проверка · действия' defaultOpen={false}>
        <div className={workspace.sectionStack}>
          <DocumentReadinessMiniMatrix role='buyer' />
          <WorkflowActionPanel context='buyer' />
        </div>
      </CollapsibleSection>
    </div>
  );

  const context = (
    <div className={workspace.stack}>
      <StatusChip tone='warning'>Ожидается решение банка</StatusChip>
      <ol className={workspace.contextList}>
        <li><span>1. Резерв</span><strong>отправить запрос на подтверждение</strong></li>
        <li><span>2. Логистика</span><strong>стартует только после ответа банка</strong></li>
        <li><span>3. Расхождение</span><strong>закрыть актом приёмки</strong></li>
        <li><span>Граница</span><strong>платформа не выпускает деньги</strong></li>
      </ol>
    </div>
  );

  const details = (
    <div className={workspace.detailsStack}>
      <CollapsibleSection title='Блокеры и путь разблокировки' summary='резерв → логистика → удержание' defaultOpen={false}>
        <div className={workspace.sectionStack}>
          <CauseLine cause={{ text: 'Банк не подтвердил резерв', tone: 'blocked' }} relation='blocks' effect={{ text: 'Логистика не стартует', tone: 'blocked' }} moneyAmount='9,65 млн ₽' moneyTone='hold' />
          <CauseLine cause={{ text: 'Вес расходится с актом', tone: 'warning' }} relation='affects' effect={{ text: 'Удержание на спорную часть', tone: 'warning' }} moneyAmount='624 тыс. ₽' moneyTone='hold' />
          <UnlockPath title='Чтобы открыть исполнение сделки покупателя:' steps={[
            { id: '1', label: 'Запросить банковское подтверждение резерва', status: 'current', detail: 'DL-9106 · 9,65 млн ₽' },
            { id: '2', label: 'Дождаться статуса банка', status: 'upcoming', detail: 'без этого логистика не стартует' },
            { id: '3', label: 'Закрыть расхождение веса через акт', status: 'upcoming', detail: 'снимет удержание 624 тыс. ₽' },
          ]} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title='Рабочие действия и передача' summary='ответственный · ожидание · журнал' defaultOpen={false}>
        <div className={workspace.sectionStack}>
          <ActionFeedbackPreviewStrip context='buyer' />
          <RoleExecutionHandoff items={buyerHandoff} title='исполнение: что покупатель отправляет и ожидает' />
          <JournalPreview role='buyer' maxEntries={3} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title='Закупки, партии и маршруты покупателя' summary='заявки · предложения · партии' defaultOpen={false}>
        <div className={workspace.sectionStack}>
          <div className={workspace.routeGrid}>
            {buyerPaths.map((item) => <Link key={item.href} href={item.href} className={workspace.routeCard}><strong>{item.title}</strong><small>{item.note}</small></Link>)}
          </div>
          <div className={workspace.queueList}>
            {buyerLots.map((lot) => (
              <Link key={lot.id} href={lot.href} className={workspace.queueCard}>
                <span className={workspace.queueCopy}><strong>{lot.id} · {lot.title}</strong><span>{lot.status} · {lot.price}</span><small>{lot.next}</small></span>
                <StatusChip tone={lot.id === 'LOT-2403' ? 'warning' : 'information'}>{lot.status}</StatusChip>
              </Link>
            ))}
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );

  return (
    <DealRoleWorkbenchTemplate
      testId='platform-v7-buyer-v8'
      eyebrow='Покупатель · исполнение сделки'
      title='Закупка, резерв и запуск логистики'
      description='Первый уровень показывает одну сделку, состояние резерва, удержание и следующий шаг. Каталог, скоринг и финансовые инструменты раскрываются только при необходимости.'
      statusLabel='Ожидается банк'
      statusTone='warning'
      primary={primary}
      context={context}
      details={details}
    />
  );
}
