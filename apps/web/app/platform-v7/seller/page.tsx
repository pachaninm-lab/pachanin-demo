import Link from 'next/link';
import { NextActionCard, StatusChip, Surface } from '@pc/design-system-v8';
import { DealRoleWorkbenchTemplate } from '@/components/transaction-ux/DealRoleWorkbenchTemplate';
import { KeyFact, KeyFactGrid } from '@/components/transaction-ux/FieldTaskTemplate';
import workspace from '@/components/transaction-ux/CommercialRoleWorkspace.module.css';
import { CollapsibleSection } from '@/components/platform-v7/CollapsibleSection';
import { RoleExecutionCockpitContent } from '@/components/platform-v7/RoleExecutionCockpit';
import { PRIMARY_ROLE_EXECUTION_COCKPITS } from '@/lib/platform-v7/role-execution-cockpit';
import { DocumentReadinessMiniMatrix } from '@/components/platform-v7/DocumentReadinessMiniMatrix';
import { WorkflowActionPanel } from '@/components/platform-v7/WorkflowActionPanel';
import { MoneyImpactSummaryStrip } from '@/components/platform-v7/MoneyImpactSummaryStrip';
import { CauseLine } from '@/components/platform-v7/visual/CauseLine';
import { UnlockPath } from '@/components/platform-v7/visual/UnlockPath';
import { ActionFeedbackPreviewStrip } from '@/components/platform-v7/ActionFeedbackPreviewStrip';
import { RoleExecutionHandoff, type HandoffItem } from '@/components/platform-v7/RoleExecutionHandoff';
import { JournalPreview } from '@/components/platform-v7/JournalPreview';
import { SellerInlineLotEditor } from '@/components/platform-v7/SellerInlineLotEditor';
import { PriceChart } from '@/components/platform-v7/PriceChart';
import { CommissionCalculator } from '@/components/platform-v7/CommissionCalculator';
import { FactoringPanel } from '@/components/platform-v7/FactoringPanel';
import { IncotermsExportWidget } from '@/components/platform-v7/IncotermsExportWidget';
import { FtsCustomsPanel } from '@/components/platform-v7/FtsCustomsPanel';
import { DocumentTemplatesPanel } from '@/components/platform-v7/DocumentTemplatesPanel';
import { EdoDocflowPanel } from '@/components/platform-v7/EdoDocflowPanel';
import { PushNotificationBanner } from '@/components/platform-v7/PushNotificationBanner';
import { QuietIntelligenceHint } from '@/components/platform-v7/visual/QuietIntelligenceHint';

const sellerHandoff: HandoffItem[] = [
  { direction: 'sends', role: 'продавец → ФГИС «Зерно»', requirement: 'закрытый СДИЗ по партии', documentImpact: true, moneyImpact: true },
  { direction: 'sends', role: 'продавец → логистика', requirement: 'партия, окно погрузки и ЭТрН', documentImpact: true },
  { direction: 'awaits', role: 'от элеватора и лаборатории', requirement: 'акт приёмки и протокол качества', documentImpact: true, moneyImpact: true },
  { direction: 'blockedBy', requirement: 'СДИЗ и ЭТрН не закрыты', documentImpact: true, moneyImpact: true },
  { direction: 'next', requirement: 'закрыть СДИЗ, подписать ЭТрН и отправить комплект в сделку', entity: 'DL-9106', documentImpact: true },
];

const sellerPaths = [
  { href: '/platform-v7/lots/create', title: 'Создать лот', note: 'Партия, качество, объём и условия поставки' },
  { href: '/platform-v7/lots', title: 'Мои лоты', note: 'Статусы публикации, ставки и переход в сделку' },
  { href: '/platform-v7/deals', title: 'Сделки', note: 'Документы, логистика, качество и деньги' },
];

const sellerLots = [
  { id: 'LOT-2403', title: 'Пшеница 4 класс · 600 т', status: 'сделка DL-9106', money: '9,65 млн ₽', next: 'закрыть СДИЗ и ЭТрН', href: '/platform-v7/deals/DL-9106/clean' },
  { id: 'LOT-2410', title: 'Ячмень 3 класс · 420 т', status: 'приём ставок', money: '6,43 млн ₽', next: 'проверить предложения', href: '/platform-v7/lots/LOT-2410' },
];

export default function SellerPage() {
  const primary = (
    <div className={workspace.stack}>
      <NextActionCard
        label='Одно следующее действие'
        action='Закрыть СДИЗ и подписать ЭТрН'
        reason='Без этих документов пакет сделки DL-9106 не может быть передан банку для проверки выплаты.'
        blocked
        impact='9,65 млн ₽ ожидают документного основания'
        owner='Продавец'
        actions={(
          <div className={workspace.actions}>
            <Link className={workspace.primaryLink} href='/platform-v7/deals/DL-9106/clean'>Открыть сделку DL-9106</Link>
            <a className={workspace.secondaryLink} href='#seller-documents'>Проверить документы</a>
          </div>
        )}
      />

      <KeyFactGrid>
        <KeyFact label='Сделка' value='DL-9106' hint='Пшеница 4 класс · 600 т' />
        <KeyFact label='Сумма' value='9,65 млн ₽' hint='выплата банком не подтверждена' />
        <KeyFact label='Блокер' value='СДИЗ + ЭТрН' hint='документный комплект неполон' />
        <KeyFact label='Результат' value='пакет банку' hint='после закрытия документов' />
      </KeyFactGrid>

      <QuietIntelligenceHint
        problem='СДИЗ и ЭТрН не закрыты — документное основание для банковской проверки не сформировано.'
        action='Закрыть СДИЗ в ФГИС «Зерно», подписать ЭТрН и повторно проверить комплект.'
        outcome='После этого платформа передаст подтверждаемый комплект в банковский контур; решение по деньгам принимает банк.'
      />

      <CollapsibleSection title='Состояние сделки продавца' summary='партия · лот · блокер · следующий шаг' defaultOpen>
        <RoleExecutionCockpitContent cockpit={PRIMARY_ROLE_EXECUTION_COCKPITS.seller} />
      </CollapsibleSection>

      <section id='seller-documents' className={workspace.sectionAnchor}>
        <CollapsibleSection title='Документы для проверки' summary='СДИЗ · ЭТрН · акт · протокол' defaultOpen>
          <div className={workspace.sectionStack}>
            <DocumentReadinessMiniMatrix role='seller' />
            <WorkflowActionPanel context='seller' />
          </div>
        </CollapsibleSection>
      </section>

      <CollapsibleSection title='Деньги и банковская проверка' summary='резерв 9,65 млн ₽ · к проверке 0 ₽' defaultOpen={false}>
        <div className={workspace.sectionStack}>
          <MoneyImpactSummaryStrip
            amountContext='резерв 9,65 млн ₽ · к проверке банком 0 ₽'
            pilotState='waiting'
            pilotStateLabel='ожидание документов'
            responsible='продавец · ФГИС «Зерно»'
            nextStep='закрыть СДИЗ и ЭТрН, затем отправить пакет документов в банк'
            stopReason='банковская проверка остановлена: СДИЗ и ЭТрН не закрыты'
            requiredEvidence='закрытый СДИЗ, ЭТрН, акт приёмки и протокол качества'
            afterResolved='пакет документов передаётся банку для самостоятельной проверки'
            bankPlatformBoundary='платформа формирует основание; банк подтверждает движение денег'
          />
        </div>
      </CollapsibleSection>
    </div>
  );

  const context = (
    <div className={workspace.stack}>
      <StatusChip tone='critical'>Выплата заблокирована документами</StatusChip>
      <ol className={workspace.contextList}>
        <li><span>1. СДИЗ</span><strong>закрыть в ФГИС «Зерно»</strong></li>
        <li><span>2. ЭТрН</span><strong>подписать транспортный документ</strong></li>
        <li><span>3. Комплект</span><strong>отправить в сделку для проверки</strong></li>
        <li><span>Граница</span><strong>банк принимает решение по деньгам</strong></li>
      </ol>
    </div>
  );

  const details = (
    <div className={workspace.detailsStack}>
      <CollapsibleSection title='Причины остановки и путь разблокировки' summary='причина → действие → проверка' defaultOpen={false}>
        <div className={workspace.sectionStack}>
          <CauseLine cause={{ text: 'СДИЗ не закрыт', tone: 'blocked' }} relation='blocks' effect={{ text: 'отправку пакета документов в банк', tone: 'money' }} moneyAmount='9,65 млн ₽' moneyTone='blocked' />
          <CauseLine cause={{ text: 'ЭТрН не подписан', tone: 'blocked' }} relation='blocks' effect={{ text: 'банковскую проверку выплаты', tone: 'money' }} moneyTone='blocked' />
          <UnlockPath title='Чтобы передать сделку на проверку банком:' steps={[
            { id: '1', label: 'Закрыть СДИЗ в ФГИС «Зерно»', status: 'current' },
            { id: '2', label: 'Подписать ЭТрН', status: 'upcoming' },
            { id: '3', label: 'Отправить пакет документов в банк', status: 'upcoming' },
          ]} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title='Рабочие действия и передача' summary='ответственный · ожидание · журнал' defaultOpen={false}>
        <div className={workspace.sectionStack}>
          <ActionFeedbackPreviewStrip context='seller' />
          <RoleExecutionHandoff items={sellerHandoff} title='исполнение: что продавец отправляет и ожидает' />
          <JournalPreview role='seller' maxEntries={3} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title='Партии, лоты и маршруты продавца' summary='создание · публикация · сделка' defaultOpen={false}>
        <div className={workspace.sectionStack}>
          <div className={workspace.routeGrid}>
            {sellerPaths.map((item) => <Link key={item.href} href={item.href} className={workspace.routeCard}><strong>{item.title}</strong><small>{item.note}</small></Link>)}
          </div>
          <div className={workspace.queueList}>
            {sellerLots.map((lot) => (
              <Link key={lot.id} href={lot.href} className={workspace.queueCard}>
                <span className={workspace.queueCopy}><strong>{lot.id} · {lot.title}</strong><span>{lot.status} · {lot.money}</span><small>{lot.next}</small></span>
                <StatusChip tone={lot.id === 'LOT-2403' ? 'warning' : 'information'}>{lot.status}</StatusChip>
              </Link>
            ))}
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title='Редактирование лотов' summary='поля · статус · сохранение' defaultOpen={false}><SellerInlineLotEditor /></CollapsibleSection>
      <CollapsibleSection title='Аналитика цен' summary='пшеница · ячмень · 12 месяцев' defaultOpen={false}><PriceChart cultures={['wheat_3', 'wheat_4', 'barley']} defaultPeriod={12} title='Динамика закупочных цен' /></CollapsibleSection>
      <CollapsibleSection title='Комиссия и финансирование' summary='комиссия · факторинг' defaultOpen={false}><div className={workspace.grid2}><Surface><CommissionCalculator /></Surface><Surface><FactoringPanel /></Surface></div></CollapsibleSection>
      <CollapsibleSection title='Экспорт и таможня' summary='Incoterms · ФТС' defaultOpen={false}><div className={workspace.grid2}><Surface><IncotermsExportWidget /></Surface><Surface><FtsCustomsPanel /></Surface></div></CollapsibleSection>
      <CollapsibleSection title='Документные сервисы' summary='шаблоны · ЭДО' defaultOpen={false}><div className={workspace.grid2}><Surface><DocumentTemplatesPanel /></Surface><Surface><EdoDocflowPanel /></Surface></div></CollapsibleSection>
      <PushNotificationBanner />
    </div>
  );

  return (
    <DealRoleWorkbenchTemplate
      testId='platform-v7-seller-v8'
      eyebrow='Продавец · исполнение сделки'
      title='Партия, документы и получение денег'
      description='Первый уровень показывает одну приоритетную сделку, точный блокер и следующий шаг. Детали лотов, аналитика, экспорт и финансирование раскрываются по запросу.'
      statusLabel='Нужны документы'
      statusTone='critical'
      primary={primary}
      context={context}
      details={details}
    />
  );
}
