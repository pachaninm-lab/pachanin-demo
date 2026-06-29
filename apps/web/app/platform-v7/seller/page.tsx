import Link from 'next/link';
import { PushNotificationBanner } from '@/components/platform-v7/PushNotificationBanner';
import { PriceChart } from '@/components/platform-v7/PriceChart';
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
import { PaymentHeatmap, buildDemoPaymentHeatmapData } from '@/components/platform-v7/PaymentHeatmap';
import { RoleExecutionCockpitContent } from '@/components/platform-v7/RoleExecutionCockpit';
import { PRIMARY_ROLE_EXECUTION_COCKPITS } from '@/lib/platform-v7/role-execution-cockpit';
import { ActionFeedbackPreviewStrip } from '../../../components/platform-v7/ActionFeedbackPreviewStrip';
import { TrustDot } from '@/components/platform-v7/visual/TrustDot';
import { SmartSectionSummary } from '@/components/platform-v7/visual/SmartSectionSummary';
import { CauseLine } from '@/components/platform-v7/visual/CauseLine';
import { UnlockPath } from '@/components/platform-v7/visual/UnlockPath';

const sellerHandoff: HandoffItem[] = [
  {
    direction: 'sends',
    role: 'продавец → покупатель',
    requirement: 'публикует лот и ожидает подтверждённое предложение покупателя',
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
    requirement: 'СДИЗ ожидает закрытия',
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
    requirement: 'закрыть СДИЗ и ЭТрН для передачи основания банку на проверку',
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
  { title: 'Опубликовать лот', href: '/platform-v7/seller/lots', note: 'управляемая публикация через рабочую поверхность лотов' },
  { title: 'Проверить запросы', href: '/platform-v7/seller/matches', note: 'спрос, netback и риск покупателя' },
  { title: 'Открыть сделку', href: '/platform-v7/deals/DL-9106/clean', note: 'документы, рейс, пакет для банка и статус проверки' },
] as const;

type SellerFirstScreenFact = {
  label: string;
  value: string;
  note: string;
  strong?: boolean;
  warning?: boolean;
};

const sellerFirstScreenFacts: SellerFirstScreenFact[] = [
  {
    label: 'Сделка',
    value: 'LOT-2403 → DL-9106',
    note: 'Покупатель заявил резерв, но пакет ещё не готов к проверке банком.',
  },
  {
    label: 'Блокер',
    value: 'СДИЗ, ЭТрН и акт',
    note: 'Без закрытых документов банк не получает основание.',
    warning: true,
  },
  {
    label: 'Деньги',
    value: '9,65 млн ₽ резерва',
    note: 'К проверке банком сейчас 0 ₽. Это не подтверждённая выплата.',
    strong: true,
  },
  {
    label: 'Ответственный',
    value: 'Продавец',
    note: 'Собрать пакет и закрыть транспортную цепочку.',
  },
];

export default async function PlatformV7SellerPage() {
  const [deals, disputes] = await Promise.all([getDealsCanonical(), getDisputes()]);
  const apiOnline = deals.length > 0;
  const disputeCount = openDisputeCount(disputes);

  return (
    <main className='seller-cockpit' data-platform-v7-seller-cockpit-pass='true' style={{ display: 'grid', gap: 14, padding: '4px 0 24px' }}>
      <style dangerouslySetInnerHTML={{ __html: sellerMobileCss }} />
      <LiveApiStatusBar
        apiOnline={apiOnline}
        openDisputes={disputeCount}
        role="ПРОДАВЕЦ · КАБИНЕТ СДЕЛКИ"
        summary={
          apiOnline
            ? `${deals.length} сделок · ${disputeCount} открытых споров`
            : 'Предынтеграционный контур · внешние подключения не активны'
        }
      />

      <section className='seller-command-card' aria-label='Главный рабочий статус продавца'>
        <div className='seller-command-head'>
          <span className='seller-command-kicker'>Главный блокер</span>
          <span className='seller-command-status'>остановлено · ждёт ЭТрН</span>
        </div>
        <h1>СДИЗ и ЭТрН не закрыты</h1>
        <p>Закрыть документы, чтобы передать основание банку</p>
        <p>Резерв виден, но банк не получает основание для проверки выплаты.</p>
        <div className='seller-command-facts'>
          <div><span>Деньги</span><strong>9,65 млн ₽</strong><small>резерв · не выплата</small></div>
          <div><span>На проверку банку</span><strong>0 ₽</strong><small>готовность денег; это ещё не выплата</small></div>
          <div><span>Ответственный</span><strong>продавец</strong><small>закрыть документы</small></div>
        </div>
        <p style={{ fontSize: 12, color: '#6B778C' }}>банковская проверка выплаты остановлена до подтверждения документного пакета</p>
        <div className='seller-command-actions'>
          <Link href='/platform-v7/deals/DL-9106/clean'>Открыть сделку</Link>
          <Link href='#documents' data-secondary='true'>Документы</Link>
        </div>
      </section>

      {/* Календарный heatmap выплат */}
      <section style={{ background: 'var(--p7-color-surface, #0E1A18)', border: '1px solid var(--p7-color-border, #24342F)', borderRadius: 16, padding: '1.25rem' }}>
        <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 className="heading-4" style={{ margin: 0 }}>Выплаты по месяцу</h2>
          <span className="caption">данные демо</span>
        </div>
        <PaymentHeatmap data={buildDemoPaymentHeatmapData()} year={2024} month={2} />
      </section>

      <CockpitHero
        className='seller-detail-hero'
        eyebrow='Кабинет продавца · сделка → документы → деньги'
        title='Закройте документы'
        accent='для банка'
        lead='Первый экран показывает статус сделки, блокер, деньги под риском, ответственного и следующий безопасный шаг.'
        aside={
          <div style={blockerCard}>
            <div style={micro}>что мешает выплате</div>
            <strong style={{ color: 'var(--pc-prem-warn, #B45309)', fontSize: 18, lineHeight: 1.2 }}>СДИЗ и ЭТрН не закрыты</strong>
            <span style={{ color: 'var(--pc-text-muted, #64748B)', fontSize: 12, lineHeight: 1.45 }}>к проверке банком сейчас 0 ₽</span>
          </div>
        }
      >
        <div className='pc-prem-kpis seller-kpis' aria-label='Ключевые показатели продавца'>
          <PremiumStatCard glyph='bag' tone='info' value={String(deals.length)} label='Сделок в работе' />
          <PremiumStatCard glyph='coins' tone='success' value='9,65 млн ₽' label='Резерв · не выплата' />
          <PremiumStatCard glyph='doc' tone='warning' value='0 ₽' label='К проверке банком' />
          <PremiumStatCard glyph='alert' tone={disputeCount > 0 ? 'danger' : 'neutral'} value={String(disputeCount)} label='Открытых споров' />
        </div>

        <div className='seller-trust-row'>
          <TrustDot state='test' size='sm' label='Контур исполнения · внешние подключения требуют договоров' />
        </div>

        <div className='seller-hero-actions'>
          <PremiumCtaButton href='#documents' glyph='shield-check'>Подготовить документы</PremiumCtaButton>
          <PremiumCtaButton href='#parties' variant='ghost'>Партии и лоты</PremiumCtaButton>
        </div>
      </CockpitHero>

      <section id='first-screen' style={anchorSection} aria-label='Первый экран продавца: факты, блокер, деньги и следующий шаг'>
        <div style={card} className='seller-facts-card'>
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={micro}>контроль первого экрана</div>
            <h2 style={h2}>Что важно продавцу сейчас</h2>
            <p style={paragraph}>Статус не говорит о готовой выплате. Сначала нужен закрытый пакет документов.</p>
            <p style={paragraph}>контур исполнения: партия, лот, резерв покупателя, СДИЗ, ЭТрН, приёмка</p>
            <p style={paragraph}>сделка передаёт основание банку после закрытия всех документных условий.</p>
          </div>
          <div style={factGrid} className='seller-fact-grid'>
            {sellerFirstScreenFacts.map((fact) => (
              <Cell key={fact.label} label={fact.label} value={fact.value} strong={fact.strong} warning={fact.warning} note={fact.note} />
            ))}
          </div>
          <div style={firstScreenActions} className='seller-inline-actions'>
            <Link href='/platform-v7/deals/DL-9106/clean' style={primaryAction}>Открыть сделку DL-9106</Link>
            <Link href='#documents' style={secondaryAction}>Перейти к документам</Link>
          </div>
        </div>
      </section>

      <section id='overview' style={anchorSection}>
        <CollapsibleSection title='Состояние сделки продавца' summary='партия · лот · блокер · следующий шаг' defaultOpen>
          <RoleExecutionCockpitContent cockpit={PRIMARY_ROLE_EXECUTION_COCKPITS.seller} />
        </CollapsibleSection>
      </section>

      <section id='documents' style={anchorSection}>
        <CollapsibleSection title='Документы для проверки' summary='СДИЗ · ЭТрН · акт · протокол' defaultOpen={false}>
          <div style={{ display: 'grid', gap: 12 }}>
            <DocumentReadinessMiniMatrix role='seller' />
            <WorkflowActionPanel context='seller' />
          </div>
        </CollapsibleSection>
      </section>

      <section id='money' style={anchorSection}>
        <CollapsibleSection title='Деньги и банковская проверка' summary='резерв 9,65 млн ₽ · к проверке 0 ₽' defaultOpen={false}>
          <div style={{ display: 'grid', gap: 12 }}>
            <MoneyGateRing
              title='Деньги по сделке DL-9106'
              totalRub={9_648_000}
              segments={[
                { label: 'Банк подтвердил выплату', amountRub: 0, state: 'released' },
                { label: 'Резерв заявлен покупателем', amountRub: 9_648_000, state: 'reserved' },
              ]}
              caption='Резерв ожидает банковской проверки; выплата остановлена документными условиями (СДИЗ, ЭТрН, акт приёмки, протокол качества).'
            />
            <MoneyImpactSummaryStrip
              amountContext='резерв 9,65 млн ₽ · к проверке банком 0 ₽'
              pilotState='waiting'
              pilotStateLabel='контур исполнения · ожидание документов'
              responsible='продавец · ФГИС «Зерно»'
              nextStep='закрыть СДИЗ и ЭТрН, затем отправить пакет документов в банк'
              stopReason='банковская проверка остановлена: СДИЗ и ЭТрН не закрыты'
              requiredEvidence='закрытый СДИЗ, ЭТрН, акт приёмки и протокол качества без незакрытых расхождений'
              afterResolved='пакет документов передаётся банку; банк проверяет выплату по своим правилам'
              bankPlatformBoundary='платформа показывает основание и статус; банк подтверждает проверку и движение денег'
            />
          </div>
        </CollapsibleSection>
      </section>

      <section id='blockers' style={anchorSection}>
        <CollapsibleSection title='Что мешает выплате' summary='причина → действие → проверка' defaultOpen={false}>
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
              effect={{ text: 'отправку пакета документов в банк', tone: 'money' }}
              moneyAmount='9,65 млн ₽'
              moneyTone='blocked'
            />
            <CauseLine
              cause={{ text: 'ЭТрН не подписан', tone: 'blocked' }}
              relation='blocks'
              effect={{ text: 'банковскую проверку выплаты', tone: 'money' }}
              moneyTone='blocked'
            />
            <UnlockPath
              title='Чтобы передать сделку на проверку банком:'
              steps={[
                { id: '1', label: 'Закрыть СДИЗ в ФГИС «Зерно»', status: 'current' },
                { id: '2', label: 'Подписать ЭТрН', status: 'upcoming' },
                { id: '3', label: 'Отправить пакет документов в банк', status: 'upcoming' },
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
              <div style={pathGrid} className='seller-path-grid'>
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
                    <div style={rowGrid} className='seller-lot-grid'>
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
      <section style={{ background: 'var(--p7-color-surface, #0E1A18)', border: '1px solid var(--p7-color-border, #24342F)', borderRadius: 16, padding: '1.25rem', display: 'grid', gap: '0.75rem' }}>
        <PriceChart cultures={['wheat_3', 'wheat_4', 'barley']} defaultPeriod={12} title='Динамика закупочных цен' />
      </section>
      <section style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <PushNotificationBanner />
      </section>
    </main>
  );
}

function Cell({
  label,
  value,
  note,
  strong = false,
  warning = false,
}: {
  label: string;
  value: string;
  note?: string;
  strong?: boolean;
  warning?: boolean;
}) {
  return (
    <div style={cell} className='seller-cell'>
      <div style={micro}>{label}</div>
      <div style={{ marginTop: 4, color: warning ? '#B45309' : strong ? '#0A7A5F' : 'var(--pc-text-primary, #0F1419)', fontSize: 13, lineHeight: 1.35, fontWeight: 900 }}>{value}</div>
      {note ? <div style={noteText}>{note}</div> : null}
    </div>
  );
}

const card = { background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 24, padding: 18, display: 'grid', gap: 12, boxShadow: '0 14px 34px rgba(15,23,42,0.055)' } as const;
const h2 = { margin: '4px 0 0', color: 'var(--pc-text-primary, #0F1419)', fontSize: 22, lineHeight: 1.08, fontWeight: 950, letterSpacing: '-0.025em' } as const;
const paragraph = { margin: 0, color: 'var(--pc-text-muted, #64748B)', fontSize: 13, lineHeight: 1.5 } as const;
const blockerCard = { display: 'grid', gap: 6, minWidth: 220, maxWidth: 280, padding: 14, borderRadius: 18, background: '#FFFBEB', border: '1px solid #FDE68A', boxShadow: '0 12px 28px rgba(180,83,9,0.08)' } as const;
const pathGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 8 } as const;
const factGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(175px,1fr))', gap: 8 } as const;
const pathCard = { textDecoration: 'none', minHeight: 132, display: 'grid', alignContent: 'start', gap: 8, padding: 14, borderRadius: 20, background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border, #E4E6EA)', boxShadow: '0 10px 24px rgba(15,23,42,0.045)' } as const;
const lotRow = { textDecoration: 'none', color: 'inherit', background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 22, padding: 16, display: 'grid', gap: 12, boxShadow: '0 12px 30px rgba(15,23,42,0.055)' } as const;
const rowGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(155px,1fr))', gap: 8 } as const;
const firstScreenActions = { display: 'flex', flexWrap: 'wrap', gap: 8 } as const;
const primaryAction = { textDecoration: 'none', display: 'inline-flex', minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 999, padding: '0 16px', background: '#0A7A5F', color: '#fff', fontSize: 13, fontWeight: 950, boxShadow: '0 12px 24px rgba(10,122,95,0.18)' } as const;
const secondaryAction = { textDecoration: 'none', display: 'inline-flex', minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 999, padding: '0 16px', background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border, #E4E6EA)', color: 'var(--pc-text-primary, #0F1419)', fontSize: 13, fontWeight: 950 } as const;
const cell = { background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 14, padding: 10, minWidth: 0, boxShadow: '0 8px 18px rgba(15,23,42,0.035)' } as const;
const idText = { color: '#0A7A5F', fontSize: 13, fontWeight: 950 } as const;
const noteText = { marginTop: 6, color: 'var(--pc-text-muted, #64748B)', fontSize: 12, lineHeight: 1.4 } as const;
const micro = { color: 'var(--pc-text-muted, #64748B)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' } as const;
const anchorSection = { scrollMarginTop: 86 } as const;

const sellerMobileCss = `
.seller-cockpit{inline-size:100%;max-inline-size:100%;overflow-x:clip;user-select:none;-webkit-user-select:none;touch-action:pan-y}
.seller-cockpit a,.seller-cockpit button{user-select:none;-webkit-user-select:none}
.seller-command-card{display:grid;gap:14px;padding:18px;border-radius:26px;border:1px solid rgba(10,122,95,.16);background:linear-gradient(180deg,rgba(241,253,247,.96),rgba(255,255,255,.96));box-shadow:0 18px 44px rgba(15,23,42,.07);overflow:hidden}
.seller-command-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.seller-command-kicker{color:#0A7A5F;font-size:12px;font-weight:950;text-transform:uppercase;letter-spacing:.06em}.seller-command-status{display:inline-flex;align-items:center;justify-content:center;min-height:32px;padding:0 12px;border-radius:999px;background:rgba(220,38,38,.08);border:1px solid rgba(220,38,38,.18);color:#B91C1C;font-size:12px;font-weight:950;white-space:nowrap}
.seller-command-card h1{margin:0;color:var(--pc-text-primary,#0F1419);font-size:clamp(30px,7vw,46px);line-height:1.02;letter-spacing:-.055em;font-weight:950}.seller-command-card p{margin:0;color:var(--pc-text-secondary,#475569);font-size:15px;line-height:1.5;font-weight:650}.seller-command-facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.seller-command-facts div{display:grid;gap:4px;min-width:0;padding:12px;border-radius:18px;background:var(--pc-bg-card,#fff);border:1px solid rgba(15,23,42,.08);box-shadow:0 8px 18px rgba(15,23,42,.04)}.seller-command-facts span{color:var(--pc-text-muted,#64748B);font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.05em}.seller-command-facts strong{color:var(--pc-text-primary,#0F1419);font-size:17px;line-height:1.12;font-weight:950;overflow-wrap:anywhere}.seller-command-facts small{color:var(--pc-text-muted,#64748B);font-size:11px;line-height:1.3;font-weight:700}.seller-command-actions{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:8px}.seller-command-actions a{display:inline-flex;align-items:center;justify-content:center;min-height:48px;border-radius:16px;text-decoration:none;background:#0A7A5F;color:var(--pc-text-onaccent,#fff);font-size:14px;font-weight:950;box-shadow:0 12px 24px rgba(10,122,95,.18)}.seller-command-actions a[data-secondary='true']{background:var(--pc-bg-card,#fff);color:var(--pc-text-primary,#0F1419);border:1px solid rgba(15,23,42,.1);box-shadow:0 8px 18px rgba(15,23,42,.045)}
.seller-detail-hero{overflow:hidden}.seller-trust-row{display:flex;align-items:center;gap:8px}.seller-hero-actions{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px}.seller-cell{overflow:hidden}.seller-fact-grid,.seller-path-grid,.seller-lot-grid{min-width:0;max-width:100%}.seller-inline-actions a{flex:1 1 180px;text-align:center}
@media(max-width:767px){
  .pc-shell-root-v4:has(.seller-cockpit) .pc-v4-main{padding-top:calc(env(safe-area-inset-top) + 70px)!important;padding-bottom:calc(env(safe-area-inset-bottom) + 118px)!important;overflow-x:clip!important}.pc-shell-root-v4:has(.seller-cockpit) .pc-v4-actions{gap:4px!important;max-width:calc(100vw - 112px)!important}.pc-shell-root-v4:has(.seller-cockpit) .pc-v4-theme-toggle,.pc-shell-root-v4:has(.seller-cockpit) .p7-role-support{display:none!important}.pc-shell-root-v4:has(.seller-cockpit) .pc-v7-assistant-widget{right:14px!important;bottom:calc(env(safe-area-inset-bottom) + 112px)!important;inline-size:48px!important;block-size:48px!important;min-height:48px!important;max-width:48px!important;padding:0!important;border-radius:18px!important}.pc-shell-root-v4:has(.seller-cockpit) .pc-v7-assistant-widget span{display:none!important}.pc-shell-root-v4:has(.seller-cockpit) .pc-v7-role-dock{padding-top:6px!important;padding-bottom:calc(env(safe-area-inset-bottom) + 6px)!important}.pc-shell-root-v4:has(.seller-cockpit) .pc-v7-role-dock-item{min-height:48px!important;border-radius:14px!important;font-size:9.8px!important}.seller-cockpit{gap:12px!important;padding-top:0!important}.seller-cockpit>*{max-inline-size:100%!important}.seller-command-card{padding:16px!important;border-radius:24px!important;gap:12px!important}.seller-command-card h1{font-size:clamp(30px,9vw,38px)!important;line-height:1.02!important}.seller-command-card p{font-size:14px!important;line-height:1.45!important}.seller-command-status{min-height:30px;font-size:11.5px}.seller-command-facts{grid-template-columns:1fr!important}.seller-command-facts div{grid-template-columns:minmax(0,1fr) auto!important;align-items:center;padding:11px 12px}.seller-command-facts small{grid-column:1/-1}.seller-command-actions{grid-template-columns:1fr!important}.seller-detail-hero{padding:16px!important;border-radius:24px!important;gap:12px!important}.seller-detail-hero>div:first-child{display:grid!important;grid-template-columns:1fr!important;gap:12px!important}.seller-detail-hero>div:first-child>div,.seller-detail-hero>div:first-child>div+div{max-inline-size:100%!important;inline-size:100%!important}.seller-detail-hero .pc-prem-hero__eyebrow{font-size:11px!important;line-height:1.25!important;padding:6px 9px!important}.seller-detail-hero .pc-prem-hero__title{font-size:clamp(28px,8.8vw,36px)!important;line-height:1.02!important;letter-spacing:-.052em!important}.seller-detail-hero .pc-prem-hero__lead{font-size:13px!important;line-height:1.45!important}.seller-detail-hero .pc-prem-kpis,.seller-kpis{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}.seller-detail-hero .pc-prem-kpi{padding:12px!important;border-radius:18px!important}.seller-detail-hero .pc-prem-kpi__value{font-size:clamp(22px,7vw,28px)!important}.seller-hero-actions{grid-template-columns:1fr!important}.seller-facts-card{padding:14px!important;border-radius:22px!important}.seller-fact-grid,.seller-path-grid,.seller-lot-grid{grid-template-columns:1fr!important}.seller-cell{padding:11px!important}.seller-inline-actions{display:grid!important;grid-template-columns:1fr!important}.seller-inline-actions a{inline-size:100%;min-height:46px}.seller-cockpit h2{font-size:clamp(20px,6vw,25px)!important;line-height:1.1!important}.seller-cockpit section{scroll-margin-top:82px!important}.seller-cockpit [style*='minWidth: 220'],.seller-cockpit [style*='min-width: 220']{min-width:0!important;max-width:100%!important}
}
@media(max-width:374px){.seller-detail-hero .pc-prem-kpis,.seller-kpis{grid-template-columns:1fr!important}.seller-command-card h1{font-size:30px!important}.seller-detail-hero .pc-prem-hero__title{font-size:28px!important}}
`;
