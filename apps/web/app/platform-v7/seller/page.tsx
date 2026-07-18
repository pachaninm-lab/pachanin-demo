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
import { PushNotificationBanner } from '@/components/platform-v7/PushNotificationBanner';
import { PriceChart } from '@/components/platform-v7/PriceChart';
import { SellerInlineLotEditor } from '@/components/platform-v7/SellerInlineLotEditor';
import { getDealsCanonical } from '@/lib/deals-server';
import { summarizeDeals, dealsSummaryLine } from '@/lib/platform-v7/deals-summary';
import { getDisputes, openDisputeCount } from '@/lib/disputes-server';
import { LiveApiStatusBar } from '@/components/platform-v7/LiveApiStatusBar';
import { WorkflowActionPanel } from '@/components/platform-v7/WorkflowActionPanel';
import { RoleExecutionHandoff, type HandoffItem } from '@/components/platform-v7/RoleExecutionHandoff';
import { P7ActionStateChip } from '@/components/platform-v7/P7ActionStateChip';
import { JournalPreview } from '@/components/platform-v7/JournalPreview';
import { ConditionReasonStrip } from '@/components/platform-v7/ConditionReasonStrip';
import { DocumentReadinessMiniMatrix } from '@/components/platform-v7/DocumentReadinessMiniMatrix';
import { MoneyImpactSummaryStrip } from '@/components/platform-v7/MoneyImpactSummaryStrip';
import { MoneyGateRing } from '@/components/v7r/MoneyGateRing';
import { CollapsibleSection } from '@/components/platform-v7/CollapsibleSection';
import { CanonicalDealsList } from '@/components/platform-v7/CanonicalDealsList';
import { FactoringPanel } from '@/components/platform-v7/FactoringPanel';
import { CommissionCalculator } from '@/components/platform-v7/CommissionCalculator';
import { IncotermsExportWidget } from '@/components/platform-v7/IncotermsExportWidget';
import { FtsCustomsPanel } from '@/components/platform-v7/FtsCustomsPanel';
import { DocumentTemplatesPanel } from '@/components/platform-v7/DocumentTemplatesPanel';
import { EdoDocflowPanel } from '@/components/platform-v7/EdoDocflowPanel';
import { PaymentHeatmap } from '@/components/platform-v7/PaymentHeatmap';
import { buildDemoPaymentHeatmapData } from '@/components/platform-v7/PaymentHeatmap.data';
import { RoleExecutionCockpitContent } from '@/components/platform-v7/RoleExecutionCockpit';
import { PRIMARY_ROLE_EXECUTION_COCKPITS } from '@/lib/platform-v7/role-execution-cockpit';
import { ActionFeedbackPreviewStrip } from '@/components/platform-v7/ActionFeedbackPreviewStrip';
import { SmartSectionSummary } from '@/components/platform-v7/visual/SmartSectionSummary';
import { CauseLine } from '@/components/platform-v7/visual/CauseLine';
import { UnlockPath } from '@/components/platform-v7/visual/UnlockPath';

const sellerHandoff: HandoffItem[] = [
  { direction: 'sends', role: 'продавец → покупатель', requirement: 'публикует лот и ожидает подтверждённое предложение покупателя', entity: 'LOT-2403', href: '/platform-v7/lots/LOT-2403', documentImpact: true },
  { direction: 'awaits', role: 'от покупателя и банка', requirement: 'резерв ожидает банковского подтверждения', moneyImpact: true },
  { direction: 'awaits', role: 'от ФГИС «Зерно»', requirement: 'СДИЗ ожидает закрытия', moneyImpact: true, documentImpact: true },
  { direction: 'blockedBy', requirement: 'ЭТрН, акт приёмки и протокол качества ещё не закрыты', documentImpact: true, moneyImpact: true },
  { direction: 'next', requirement: 'закрыть СДИЗ и ЭТрН для передачи основания банку на проверку', entity: 'DL-9106', href: '/platform-v7/deals', moneyImpact: true },
];

const sellerLots = [
  { id: 'LOT-2403', title: 'Пшеница 4 класса · 600 т · EXW', status: 'предложение принято', money: 'резерв 9,65 млн ₽ · к проверке банком 0 ₽', next: 'закрыть СДИЗ, ЭТрН и приёмку', href: '/platform-v7/lots/LOT-2403' },
  { id: 'LOT-2405', title: 'Пшеница 4 класса · 240 т · EXW', status: 'идут предложения', money: 'лучшая ставка 16 120 ₽/т', next: 'проверить рейтинг покупателя и условия резерва', href: '/platform-v7/lots/LOT-2405' },
] as const;

const sellerPaths = [
  { title: 'Создать партию', href: '/platform-v7/seller/batches/new', note: 'культура, объём, качество, документы, ФГИС' },
  { title: 'Опубликовать лот', href: '/platform-v7/seller/lots', note: 'управляемая публикация через рабочую поверхность лотов' },
  { title: 'Проверить запросы', href: '/platform-v7/seller/matches', note: 'спрос, netback и риск покупателя' },
  { title: 'Открыть сделку', href: '/platform-v7/deals', note: 'документы, рейс, пакет для банка и статус проверки' },
] as const;

export default async function PlatformV7SellerPage() {
  const [deals, disputes] = await Promise.all([getDealsCanonical(), getDisputes()]);
  const apiOnline = deals.length > 0;
  const disputeCount = openDisputeCount(disputes);

  return (
    <MoneyObligationCockpit
      testId='platform-v7-seller-cockpit'
      eyebrow='Продавец · обязательства сделки'
      title='Закрыть документы, чтобы банк получил основание'
      description='Продавец видит одну сделку, денежное влияние, обязательные документы и следующий безопасный шаг. Резерв не называется выплатой.'
      statusLabel={apiOnline ? 'Сервер подтверждён' : 'Статичный контур'}
      statusTone={apiOnline ? 'success' : 'warning'}
      liveStatus={(
        <LiveApiStatusBar
          apiOnline={apiOnline}
          openDisputes={disputeCount}
          role='ПРОДАВЕЦ · КАБИНЕТ СДЕЛКИ'
          summary={apiOnline ? `${dealsSummaryLine(summarizeDeals(deals))} · ${disputeCount} открытых споров` : 'Внешние подключения не активны'}
        />
      )}
      priority={{
        title: 'Закрыть СДИЗ и ЭТрН по DL-9106',
        description: 'Пока документный пакет неполон, основание не передаётся банку. Движение денег подтверждает только банк после собственной проверки.',
        state: 'waiting',
        amount: '9,65 млн ₽ резерв · не выплата',
        blocker: 'СДИЗ, ЭТрН, акт приёмки и протокол качества',
        owner: 'продавец и ответственные за документы',
        result: 'пакет готов к банковской проверке',
        primaryAction: <Link className={moneyCockpitClasses.primaryLink} href='/platform-v7/deals'>Открыть сделку</Link>,
        secondaryAction: <a className={moneyCockpitClasses.secondaryLink} href='#documents'>Документы</a>,
      }}
      facts={[
        { label: 'Сделка', value: 'LOT-2403 → DL-9106', hint: 'покупатель заявил резерв' },
        { label: 'К проверке банком', value: '0 ₽', hint: 'основание ещё не сформировано' },
        { label: 'Открытые споры', value: String(disputeCount), hint: 'учитываются до передачи основания' },
        { label: 'Следующий результат', value: 'закрытый пакет', hint: 'СДИЗ · ЭТрН · акт · качество' },
      ]}
    >
      <MoneyBoundary>
        Платформа показывает резерв, блокеры и доказательства. Она не подтверждает выплату и не подменяет банковское решение.
      </MoneyBoundary>

      <MoneyCockpitSection id='live-deals'>
        <CollapsibleSection title='Мои сделки' summary='реальные сделки с сервера · открыть исполнение' defaultOpen>
          <CanonicalDealsList />
        </CollapsibleSection>
      </MoneyCockpitSection>

      <MoneyCockpitSection id='overview'>
        <CollapsibleSection title='Состояние сделки продавца' summary='партия · лот · блокер · следующий шаг' defaultOpen={false}>
          <RoleExecutionCockpitContent cockpit={PRIMARY_ROLE_EXECUTION_COCKPITS.seller} />
        </CollapsibleSection>
      </MoneyCockpitSection>

      <MoneyCockpitSection id='documents'>
        <CollapsibleSection title='Документы для банковской проверки' summary='СДИЗ · ЭТрН · акт · протокол' defaultOpen>
          <div className={moneyCockpitClasses.sectionStack}>
            <DocumentReadinessMiniMatrix role='seller' />
            <WorkflowActionPanel context='seller' />
          </div>
        </CollapsibleSection>
      </MoneyCockpitSection>

      <MoneyCockpitSection id='money'>
        <CollapsibleSection title='Деньги и банковская проверка' summary='резерв 9,65 млн ₽ · к проверке 0 ₽' defaultOpen={false}>
          <div className={moneyCockpitClasses.sectionStack}>
            <MoneyGateRing
              title='Деньги по сделке DL-9106'
              totalRub={9_648_000}
              segments={[
                { label: 'Банк подтвердил выплату', amountRub: 0, state: 'released' },
                { label: 'Резерв заявлен покупателем', amountRub: 9_648_000, state: 'reserved' },
              ]}
              caption='Резерв ожидает банковской проверки; выплата остановлена документными условиями.'
            />
            <MoneyImpactSummaryStrip
              amountContext='резерв 9,65 млн ₽ · к проверке банком 0 ₽'
              pilotState='waiting'
              pilotStateLabel='ожидание документов'
              responsible='продавец · ФГИС «Зерно»'
              nextStep='закрыть СДИЗ и ЭТрН, затем отправить пакет документов в банк'
              stopReason='банковская проверка остановлена: СДИЗ и ЭТрН не закрыты'
              requiredEvidence='закрытый СДИЗ, ЭТрН, акт приёмки и протокол качества'
              afterResolved='пакет документов передаётся банку; банк проверяет выплату по своим правилам'
              bankPlatformBoundary='платформа показывает основание и статус; банк подтверждает проверку и движение денег'
            />
          </div>
        </CollapsibleSection>
      </MoneyCockpitSection>

      <MoneyCockpitSection id='blockers'>
        <CollapsibleSection title='Что мешает передаче основания' summary='причина → действие → проверка' defaultOpen={false}>
          <div className={moneyCockpitClasses.sectionStack}>
            <P7ActionStateChip status='waiting' label='контур исполнения' nextActor='ФГИС «Зерно» и банк' blocker='СДИЗ и ЭТрН не закрыты' moneyEffect='банковская проверка остановлена' />
            <ConditionReasonStrip condition='ожидание документов' responsible='ФГИС «Зерно» и банк' documentState='СДИЗ и ЭТрН не закрыты' stopReason='банковская проверка остановлена' />
            <CauseLine cause={{ text: 'СДИЗ не закрыт', tone: 'blocked' }} relation='blocks' effect={{ text: 'отправку пакета документов в банк', tone: 'money' }} moneyAmount='9,65 млн ₽' moneyTone='blocked' />
            <CauseLine cause={{ text: 'ЭТрН не подписан', tone: 'blocked' }} relation='blocks' effect={{ text: 'банковскую проверку выплаты', tone: 'money' }} moneyTone='blocked' />
            <UnlockPath title='Чтобы передать сделку на проверку банком:' steps={[
              { id: '1', label: 'Закрыть СДИЗ в ФГИС «Зерно»', status: 'current' },
              { id: '2', label: 'Подписать ЭТрН', status: 'upcoming' },
              { id: '3', label: 'Отправить пакет документов в банк', status: 'upcoming' },
            ]} />
          </div>
        </CollapsibleSection>
      </MoneyCockpitSection>

      <MoneyCockpitSection id='actions'>
        <CollapsibleSection title='Передача и журнал' summary='ответственный · ожидание · доказательство' defaultOpen={false}>
          <div className={moneyCockpitClasses.sectionStack}>
            <ActionFeedbackPreviewStrip context='seller' />
            <RoleExecutionHandoff items={sellerHandoff} title='исполнение: что продавец отправляет и ожидает' />
            <SmartSectionSummary label='Журнал' facts={['3 последних события · СДИЗ и ЭТрН не закрыты']} />
            <JournalPreview role='seller' maxEntries={3} />
          </div>
        </CollapsibleSection>
      </MoneyCockpitSection>

      <MoneyCockpitSection id='parties'>
        <CollapsibleSection title='Партии, лоты и рабочие маршруты' summary='детали продаж' defaultOpen={false}>
          <div className={moneyCockpitClasses.sectionStack}>
            <MoneyQueue>
              {sellerPaths.map((path) => <MoneyQueueLink key={path.href} href={path.href} title={path.title} detail={path.note} status={<StatusChip tone='information'>Открыть</StatusChip>} />)}
            </MoneyQueue>
            <MoneyQueue>
              {sellerLots.map((lot) => <MoneyQueueLink key={lot.id} href={lot.href} title={`${lot.id} · ${lot.title}`} detail={`${lot.money} · ${lot.next}`} status={<StatusChip tone={lot.status === 'предложение принято' ? 'success' : 'warning'}>{lot.status}</StatusChip>} />)}
            </MoneyQueue>
            <Surface><SellerInlineLotEditor /></Surface>
          </div>
        </CollapsibleSection>
      </MoneyCockpitSection>

      <MoneyCockpitSection>
        <CollapsibleSection title='Дополнительные инструменты продавца' summary='аналитика · комиссия · финансирование · экспорт · ЭДО' defaultOpen={false}>
          <div className={moneyCockpitClasses.toolGrid}>
            <Surface><PaymentHeatmap data={buildDemoPaymentHeatmapData()} year={2024} month={2} /></Surface>
            <Surface><PriceChart cultures={['wheat_3', 'wheat_4', 'barley']} defaultPeriod={12} title='Динамика закупочных цен' /></Surface>
            <Surface><CommissionCalculator /></Surface>
            <Surface><FactoringPanel /></Surface>
            <Surface><IncotermsExportWidget /></Surface>
            <Surface><FtsCustomsPanel /></Surface>
            <Surface><DocumentTemplatesPanel /><EdoDocflowPanel /></Surface>
          </div>
        </CollapsibleSection>
      </MoneyCockpitSection>

      <PushNotificationBanner />
    </MoneyObligationCockpit>
  );
}
