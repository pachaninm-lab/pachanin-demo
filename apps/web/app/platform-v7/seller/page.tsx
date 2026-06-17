import Link from 'next/link';
import { getDealsCanonical } from '@/lib/deals-server';
import { getDisputes, openDisputeCount } from '@/lib/disputes-server';
import { LiveApiStatusBar } from '@/components/platform-v7/LiveApiStatusBar';
import { WorkflowActionPanel } from '../../../components/platform-v7/WorkflowActionPanel';
import { RoleExecutionHandoff, type HandoffItem } from '../../../components/platform-v7/RoleExecutionHandoff';
import { P7ActionStateChip } from '../../../components/platform-v7/P7ActionStateChip';
import { JournalPreview } from '../../../components/platform-v7/JournalPreview';
import { ConditionReasonStrip } from '../../../components/platform-v7/ConditionReasonStrip';
import { DocumentReadinessMiniMatrix } from '../../../components/platform-v7/DocumentReadinessMiniMatrix';
import { MoneyImpactSummaryStrip } from '../../../components/platform-v7/MoneyImpactSummaryStrip';
import { MoneyGateRing } from '@/components/v7r/MoneyGateRing';
import { CollapsibleSection } from '@/components/platform-v7/CollapsibleSection';
import { CockpitHero, PremiumStatCard, PremiumCtaButton } from '@/components/platform-v7/premium';
import { RoleExecutionCockpitContent } from '@/components/platform-v7/RoleExecutionCockpit';
import { PRIMARY_ROLE_EXECUTION_COCKPITS } from '@/lib/platform-v7/role-execution-cockpit';
import { ActionFeedbackPreviewStrip } from '../../../components/platform-v7/ActionFeedbackPreviewStrip';
import { QuietIntelligenceHint } from '@/components/platform-v7/visual/QuietIntelligenceHint';
import { TrustDot } from '@/components/platform-v7/visual/TrustDot';
import { SmartSectionSummary } from '@/components/platform-v7/visual/SmartSectionSummary';
import { CauseLine } from '@/components/platform-v7/visual/CauseLine';
import { UnlockPath } from '@/components/platform-v7/visual/UnlockPath';

const sellerHandoff: HandoffItem[] = [
  {
    direction: 'sends',
    role: 'продавец → покупатель',
    requirement: 'публикует лот и ждёт встречного предложения от покупателя',
    entity: 'LOT-2403',
    href: '/platform-v7/lots/LOT-2403',
    documentImpact: true,
  },
  {
    direction: 'awaits',
    role: 'от покупателя и банка',
    requirement: 'резерв ожидает банковского подтверждения',
    moneyImpact: true,
  },
  {
    direction: 'awaits',
    role: 'от ФГИС «Зерно»',
    requirement: 'СДИЗ ожидает закрытия — без этого основание не передаётся на банковскую проверку',
    moneyImpact: true,
    documentImpact: true,
  },
  {
    direction: 'blockedBy',
    requirement: 'ЭТрН, акт приёмки и протокол качества ещё не закрыты',
    documentImpact: true,
    moneyImpact: true,
  },
  {
    direction: 'next',
    requirement: 'закрыть СДИЗ, ЭТрН и акт приёмки для передачи основания на банковскую проверку',
    entity: 'DL-9106',
    href: '/platform-v7/deals/DL-9106/clean',
    moneyImpact: true,
  },
];

const sellerLots = [
  {
    id: 'LOT-2403',
    title: 'Пшеница 4 класса · 600 т · EXW',
    status: 'предложение принято',
    money: 'резерв 9,65 млн ₽ · на проверку банку 0 ₽',
    next: 'закрыть СДИЗ, ЭТрН и приёмку',
    href: '/platform-v7/lots/LOT-2403',
  },
  {
    id: 'LOT-2405',
    title: 'Пшеница 4 класса · 240 т · EXW',
    status: 'идут предложения',
    money: 'лучшая ставка 16 120 ₽/т',
    next: 'проверить рейтинг покупателя и условия резерва',
    href: '/platform-v7/lots/LOT-2405',
  },
] as const;

const sellerPaths = [
  { title: 'Создать партию', href: '/platform-v7/seller/batches/new', note: 'культура, объём, качество, документы, ФГИС' },
  { title: 'Опубликовать лот', href: '/platform-v7/seller/lots/new', note: 'управляемая публикация без раскрытия контактов' },
  { title: 'Проверить запросы', href: '/platform-v7/seller/rfq', note: 'сравнение спроса, netback и рисков покупателя' },
  { title: 'Открыть сделку', href: '/platform-v7/deals/DL-9106/clean', note: 'документы, рейс, основание и банковская проверка' },
] as const;

export default async function PlatformV7SellerPage() {
  const [deals, disputes] = await Promise.all([getDealsCanonical(), getDisputes()]);
  const apiOnline = deals.length > 0;
  const disputeCount = openDisputeCount(disputes);

  return (
    <main data-platform-v7-seller-cockpit-pass='true' style={{ display: 'grid', gap: 14, padding: '4px 0 24px' }}>
      <LiveApiStatusBar
        apiOnline={apiOnline}
        openDisputes={disputeCount}
        role="FARMER · Кабинет продавца"
        summary={
          apiOnline
            ? `${deals.length} сделок · ${disputeCount} открытых споров`
            : 'Данные статичные — API недоступен'
        }
      />

      <QuietIntelligenceHint
        problem='СДИЗ и ЭТрН не закрыты — деньги стоят на проверке банка.'
        action='Закройте СДИЗ и ЭТрН, затем передайте основание банку.'
        outcome='После закрытия документов банк получит основание для проверки выплаты.'
      />

      <CockpitHero
        eyebrow='Кабинет продавца · сделка → документы → деньги'
        title='Закрыть документы, чтобы передать основание банку'
        lead='Продавец видит не витрину лотов, а контур исполнения: партия, лот, резерв покупателя, СДИЗ, ЭТрН, приёмка и причина, почему деньги ещё не переданы на банковскую проверку.'
        aside={
          <div style={blockerCard}>
            <div style={micro}>главный блокер</div>
            <strong style={{ color: 'var(--pc-prem-warn, #B45309)', fontSize: 18, lineHeight: 1.2 }}>СДИЗ и ЭТрН не закрыты</strong>
            <span style={{ color: 'var(--pc-text-muted, #64748B)', fontSize: 12, lineHeight: 1.45 }}>на проверку банку сейчас 0 ₽</span>
          </div>
        }
      >
        <div className='pc-prem-kpis' aria-label='Ключевые показатели продавца'>
          <PremiumStatCard glyph='bag' tone='info' value={String(deals.length)} label='Сделок в работе' />
          <PremiumStatCard glyph='coins' tone='success' value='9,65 млн ₽' label='Резерв · не выплата' />
          <PremiumStatCard glyph='doc' tone='warning' value='0 ₽' label='На проверку банку сейчас' />
          <PremiumStatCard glyph='alert' tone={disputeCount > 0 ? 'danger' : 'neutral'} value={String(disputeCount)} label='Открытых споров' />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrustDot state='test' size='sm' label='Контур исполнения · Внешние подключения требуют договоров' />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 8 }}>
          <PremiumCtaButton href='#documents' glyph='shield-check'>Документы</PremiumCtaButton>
          <PremiumCtaButton href='#parties' variant='ghost'>Партии и лоты</PremiumCtaButton>
        </div>
      </CockpitHero>

      <section id='overview' style={anchorSection}>
        <CollapsibleSection title='Обзор исполнения продавца' summary='партия · лот · статус сделки' defaultOpen>
          <RoleExecutionCockpitContent cockpit={PRIMARY_ROLE_EXECUTION_COCKPITS.seller} />
        </CollapsibleSection>
      </section>

      <section id='documents' style={anchorSection}>
        <CollapsibleSection title='Документы и допуск' summary='СДИЗ · ЭТрН · акт · протокол' defaultOpen={false}>
          <div style={{ display: 'grid', gap: 12 }}>
            <DocumentReadinessMiniMatrix role='seller' />
            <WorkflowActionPanel context='seller' />
          </div>
        </CollapsibleSection>
      </section>

      <section id='money' style={anchorSection}>
        <CollapsibleSection title='Деньги и банковское основание' summary='резерв 9,65 млн ₽ · проверка 0 ₽' defaultOpen={false}>
          <div style={{ display: 'grid', gap: 12 }}>
            <MoneyGateRing
              title='Деньги по сделке DL-9106'
              totalRub={9_648_000}
              segments={[
                { label: 'Банк подтвердил выплату', amountRub: 0, state: 'released' },
                { label: 'Резерв заявлен покупателем', amountRub: 9_648_000, state: 'reserved' },
              ]}
              caption='Резерв ожидает банковского подтверждения; выплата остановлена документными условиями (СДИЗ, ЭТрН, акт приёмки, протокол качества).'
            />
            <MoneyImpactSummaryStrip
              amountContext='резерв 9,65 млн ₽ · на проверку банку 0 ₽'
              pilotState='waiting'
              pilotStateLabel='контур исполнения · ожидание документов'
              responsible='продавец · ФГИС «Зерно»'
              nextStep='закрыть СДИЗ и ЭТрН для передачи основания банку на проверку'
              stopReason='банковская проверка остановлена: СДИЗ и ЭТрН не закрыты'
              requiredEvidence='закрытый СДИЗ, ЭТрН, акт приёмки и протокол качества без незакрытых расхождений'
              afterResolved='сделка передаёт основание банку; банк проверяет выплату по своим правилам'
              bankPlatformBoundary='платформа показывает основание и статус, банк подтверждает проверку и движение денег'
            />
          </div>
        </CollapsibleSection>
      </section>

      <section id='blockers' style={anchorSection}>
        <CollapsibleSection title='Блокеры и путь разблокировки' summary='причина → действие → деньги' defaultOpen={false}>
          <div style={{ display: 'grid', gap: 12 }}>
            <P7ActionStateChip
              status='waiting'
              label='пилотный сценарий'
              nextActor='ФГИС «Зерно» и банк'
              blocker='СДИЗ и ЭТрН не закрыты'
              moneyEffect='банковская проверка остановлена'
            />
            <ConditionReasonStrip
              condition='пилотный сценарий'
              responsible='ФГИС «Зерно» и банк'
              documentState='СДИЗ и ЭТрН не закрыты'
              stopReason='банковская проверка остановлена'
            />
            <CauseLine
              cause={{ text: 'СДИЗ не закрыт', tone: 'blocked' }}
              relation='blocks'
              effect={{ text: 'передача основания банку', tone: 'money' }}
              moneyAmount='9,65 млн ₽'
              moneyTone='blocked'
            />
            <CauseLine
              cause={{ text: 'ЭТрН не подписан', tone: 'blocked' }}
              relation='blocks'
              effect={{ text: 'банковская проверка выплаты', tone: 'money' }}
              moneyTone='blocked'
            />
            <UnlockPath
              title='Чтобы деньги поступили на проверку банку:'
              steps={[
                { id: '1', label: 'Закрыть СДИЗ в ФГИС «Зерно»', status: 'current' },
                { id: '2', label: 'Подписать ЭТрН', status: 'upcoming' },
                { id: '3', label: 'Передать основание банку', status: 'upcoming' },
              ]}
            />
          </div>
        </CollapsibleSection>
      </section>

      <section id='actions' style={anchorSection}>
        <CollapsibleSection title='Рабочие действия и передача' summary='действие · ответственный · журнал' defaultOpen={false}>
          <div style={{ display: 'grid', gap: 12 }}>
            <ActionFeedbackPreviewStrip context='seller' />
            <RoleExecutionHandoff items={sellerHandoff} title='исполнение: что продавец отправляет и ожидает' />
          </div>
        </CollapsibleSection>
      </section>

      <section id='journal' style={anchorSection}>
        <CollapsibleSection title='Журнал событий' summary='3 последних события' defaultOpen={false}>
          <div style={{ display: 'grid', gap: 12 }}>
            <SmartSectionSummary label='Журнал' facts={['3 последних события · СДИЗ и ЭТрН не закрыты']} />
            <JournalPreview role='seller' maxEntries={3} />
          </div>
        </CollapsibleSection>
      </section>

      <section id='parties' style={anchorSection}>
        <CollapsibleSection title='Партии, лоты и маршруты продавца' summary='детали продаж' defaultOpen={false}>
          <div style={{ display: 'grid', gap: 12 }}>
            <section style={card}>
              <div style={micro}>рабочие маршруты продавца</div>
              <div style={pathGrid}>
                {sellerPaths.map((path) => (
                  <Link key={path.href} href={path.href} style={pathCard}>
                    <strong style={{ color: 'var(--pc-text-primary, #0F1419)', fontSize: 16 }}>{path.title}</strong>
                    <span style={{ color: 'var(--pc-text-muted, #64748B)', fontSize: 13, lineHeight: 1.45 }}>{path.note}</span>
                    <span style={{ color: '#0A7A5F', fontSize: 12, fontWeight: 900 }}>Открыть</span>
                  </Link>
                ))}
              </div>
            </section>

            <section style={card}>
              <div style={micro}>лоты продавца</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {sellerLots.map((lot) => (
                  <Link key={lot.id} href={lot.href} style={lotRow}>
                    <div>
                      <div style={idText}>{lot.id}</div>
                      <h2 style={h2}>{lot.title}</h2>
                    </div>
                    <div style={rowGrid}>
                      <Cell label='Статус' value={lot.status} />
                      <Cell label='Деньги' value={lot.money} strong />
                      <Cell label='Следующее действие' value={lot.next} warning />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </CollapsibleSection>
      </section>
    </main>
  );
}

function Cell({ label, value, strong = false, warning = false }: { label: string; value: string; strong?: boolean; warning?: boolean }) {
  return <div style={cell}><div style={micro}>{label}</div><div style={{ marginTop: 4, color: warning ? '#B45309' : strong ? '#0A7A5F' : 'var(--pc-text-primary, #0F1419)', fontSize: 13, lineHeight: 1.35, fontWeight: 900 }}>{value}</div></div>;
}

const card = { background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 24, padding: 18, display: 'grid', gap: 12, boxShadow: '0 14px 34px rgba(15,23,42,0.055)' } as const;
const h2 = { margin: '4px 0 0', color: 'var(--pc-text-primary, #0F1419)', fontSize: 22, lineHeight: 1.08, fontWeight: 950, letterSpacing: '-0.025em' } as const;
const blockerCard = { display: 'grid', gap: 6, minWidth: 220, maxWidth: 280, padding: 14, borderRadius: 18, background: '#FFFBEB', border: '1px solid #FDE68A', boxShadow: '0 12px 28px rgba(180,83,9,0.08)' } as const;
const pathGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 8 } as const;
const pathCard = { textDecoration: 'none', minHeight: 132, display: 'grid', alignContent: 'start', gap: 8, padding: 14, borderRadius: 20, background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border, #E4E6EA)', boxShadow: '0 10px 24px rgba(15,23,42,0.045)' } as const;
const lotRow = { textDecoration: 'none', color: 'inherit', background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 22, padding: 16, display: 'grid', gap: 12, boxShadow: '0 12px 30px rgba(15,23,42,0.055)' } as const;
const rowGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(155px,1fr))', gap: 8 } as const;
const cell = { background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 14, padding: 10, minWidth: 0, boxShadow: '0 8px 18px rgba(15,23,42,0.035)' } as const;
const idText = { color: '#0A7A5F', fontSize: 13, fontWeight: 950 } as const;
const micro = { color: 'var(--pc-text-muted, #64748B)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' } as const;
const anchorSection = { scrollMarginTop: 86 } as const;
