import { getLabSamples, pendingProtocols } from '@/lib/labs-server';
import { getShipments, activeShipmentCount } from '@/lib/logistics-server';
import { LiveApiStatusBar } from '@/components/platform-v7/LiveApiStatusBar';
import { FieldElevatorRuntime } from '@/components/v7r/FieldElevatorRuntime';
import { RoleExecutionHandoff, type HandoffItem } from '@/components/platform-v7/RoleExecutionHandoff';
import { EvidenceReadinessMiniMatrix } from '@/components/platform-v7/EvidenceReadinessMiniMatrix';
import { DecisionRecommendationStrip } from '@/components/platform-v7/DecisionRecommendationStrip';
import { QuietIntelligenceHint } from '@/components/platform-v7/visual/QuietIntelligenceHint';
import { TrustDot } from '@/components/platform-v7/visual/TrustDot';
import { CauseLine } from '@/components/platform-v7/visual/CauseLine';
import { SmartSectionSummary } from '@/components/platform-v7/visual/SmartSectionSummary';
import { WeighStationPanel } from '@/components/platform-v7/WeighStationPanel';
import { CockpitHero, ProcessStepper } from '@/components/platform-v7/premium';
import { CollapsibleSection } from '@/components/platform-v7/CollapsibleSection';
import { DL_9106_ELEVATOR_RECEIVING } from '@/lib/platform-v7/deal-execution-source-of-truth';

const elevatorHandoff: HandoffItem[] = [
  { direction: 'sends', role: 'элеватор → контур документов', requirement: 'акт приёмки и акт расхождения в контур документов', documentImpact: true, moneyImpact: true },
  { direction: 'sends', role: 'элеватор → лабораторный контур качества', requirement: 'проба и показатели качества — в пилотный протокол качества', documentImpact: true },
  { direction: 'awaits', role: 'от логистики', requirement: 'рейс с ЭТрН и данными водителя перед началом приёмки', documentImpact: true },
  { direction: 'blockedBy', requirement: 'отклонение веса -1,2 т — нужен акт расхождения до банковской проверки', documentImpact: true, moneyImpact: true },
  { direction: 'next', requirement: 'зафиксировать вес, подписать акт приёмки и передать пробу в лабораторный контур качества', entity: 'TRIP-2403-001', documentImpact: true },
];

const receiving = DL_9106_ELEVATOR_RECEIVING.snapshot;
const quality = DL_9106_ELEVATOR_RECEIVING.quality;

const firstScreen = [
  { label: 'Что произошло', value: 'TRIP-2403-001 прибыл на приёмку', note: 'Физический факт уже в работе: рейс, партия, вес и лабораторная проба.' },
  { label: 'Что заблокировано', value: 'акт расхождения и протокол качества', note: 'Отклонение веса и сорная примесь выше допуска не дают передать основание банку.' },
  { label: 'Деньги под риском', value: '9,65 млн ₽ удержание', note: 'Выплата не должна уходить дальше до закрытия веса, качества и документов.' },
  { label: 'Кто отвечает', value: 'элеватор · лаборатория · оператор', note: 'Приёмка фиксирует вес, лаборатория закрывает протокол, оператор контролирует передачу основания.' },
  { label: 'Следующее действие', value: 'зафиксировать вес и передать пробу', note: 'Действия ведут в реальные секции текущего кабинета: #weight и #quality.' },
] as const;

const receivingSummary = [
  { label: 'Что сейчас', value: 'TRIP-2403-001 прибыл на приёмку', note: 'Приёмка фиксирует физический факт: вес, качество, акт и отклонения.' },
  { label: 'Где груз', value: 'элеватор ВРЖ-08 · партия LOT-2403', note: 'Видна только партия и рейс, без коммерческой цены сделки.' },
  { label: 'Вес', value: '600 т заявлено · 598,8 т принято', note: 'Отклонение -1,2 т создаёт основание для акта расхождения.' },
  { label: 'Качество', value: 'сорная примесь выше допуска', note: 'Нужен протокол качества; это может изменить расчёт и открыть спор.' },
] as const;

const gates = [
  { title: 'Вес', value: 'отклонение -1,2 т', impact: 'создаёт удержание до акта расхождения', state: 'stop' },
  { title: 'Качество', value: 'есть превышение по примеси', impact: 'требует протокол качества', state: 'stop' },
  { title: 'Акт приёмки', value: 'готовится', impact: 'без акта основание не передаётся банку', state: 'wait' },
  { title: 'Качество', value: 'протокол ожидается', impact: 'качество влияет на расчёт и спор', state: 'wait' },
] as const;

export default async function Page() {
  const [samples, shipments] = await Promise.all([getLabSamples(), getShipments()]);
  const pendingSamples = pendingProtocols(samples);
  const shipmentCount = activeShipmentCount(shipments);
  const apiOnline = samples.some((s) => !s.id.startsWith('SAMPLE-00'));

  const liveBlockers = pendingSamples.slice(0, 3).map((s) => ({ id: s.id, label: `Проба ${s.id}: протокол качества ожидается`, severity: 'warn' as const, responsibleRole: 'ELEVATOR', nextAction: 'Передать пробу в лабораторию' }));

  return (
    <main data-testid='platform-v7-elevator-page' style={{ display: 'grid', gap: 14, padding: '4px 0 24px' }}>
      <LiveApiStatusBar apiOnline={apiOnline} blockers={liveBlockers} activeShipments={shipmentCount} role="ELEVATOR · Приёмка" summary={apiOnline ? `${shipmentCount} рейсов на приёмке · ${pendingSamples.length} проб ожидают протокола` : 'Данные статичные — API недоступен'} />
      <style dangerouslySetInnerHTML={{ __html: `@media(max-width:767px){[data-testid='platform-v7-elevator-page']{gap:10px!important;padding-top:0!important}.p7-elevator-hero{padding:16px!important;border-radius:24px!important;gap:8px!important}.p7-elevator-hero h1{font-size:clamp(28px,8vw,38px)!important;line-height:1.04!important}.p7-elevator-hero p{display:none!important}.p7-elevator-first-screen{padding:14px!important;border-radius:22px!important;gap:10px!important}.p7-elevator-first-screen h2{font-size:20px!important;line-height:1.1!important}.p7-elevator-first-grid{grid-template-columns:1fr!important;gap:8px!important}.p7-elevator-first-actions{display:grid!important;grid-template-columns:1fr!important}.p7-elevator-first-actions a{width:100%!important;min-height:52px!important}.p7-elevator-active{padding:14px!important;border-radius:22px!important;gap:10px!important}.p7-elevator-active h2{font-size:20px!important;line-height:1.1!important}.p7-elevator-active-grid{grid-template-columns:1fr 1fr!important;gap:8px!important}.p7-elevator-active-actions{display:grid!important;grid-template-columns:1fr!important}.p7-elevator-active-actions a{width:100%!important;min-height:54px!important}.p7-elevator-quality{padding:14px!important;border-radius:22px!important;gap:10px!important}.p7-elevator-quality-grid{grid-template-columns:1fr 1fr!important;gap:8px!important}.p7-elevator-quality .p7-elevator-notice{font-size:12px!important;line-height:1.4!important}}` }} />
      <QuietIntelligenceHint problem='Отклонение веса -1,2 т и превышение по сорной примеси — акт расхождения не подписан.' action='Зафиксировать вес, подписать акт приёмки и акт расхождения, передать пробу в лабораторию.' outcome='После закрытия актов основание уйдёт в контур документов и банку на проверку выплаты.' />
      <CockpitHero className='p7-elevator-hero' eyebrow='Кабинет приёмки' title='Вес, качество и основание для проверки выплаты' lead='Приёмка формирует основание для банковской проверки: вес, акт приёмки, качество, отклонения и документы. Деньги, ставки, резерв, кредит и покупательская аналитика не раскрываются.'>
        <ProcessStepper ariaLabel='Этапы приёмки' steps={[{ label: 'Сделка', state: 'done' }, { label: 'Партия', state: 'done' }, { label: 'Приёмка', state: 'current' }, { label: 'Лаборатория', state: 'upcoming' }, { label: 'Документы', state: 'upcoming' }, { label: 'Готово', state: 'upcoming' }]} />
      </CockpitHero>

      <section className='p7-elevator-first-screen' data-testid='platform-v7-elevator-first-screen' style={card}>
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={micro}>первый экран · контроль сделки</div>
          <h2 style={h2}>Что важно для приёмки прямо сейчас</h2>
          <p style={muted}>Экран сначала показывает факт, блокер, деньги под риском, владельца и следующее действие. Данные остаются controlled-pilot / pre-integration — без заявлений о промышленной готовности.</p>
        </div>
        <div className='p7-elevator-first-grid' style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 10 }}>{firstScreen.map((item) => <FirstScreenCell key={item.label} item={item} />)}</div>
        <div className='p7-elevator-first-actions' style={actions}><a href='#weight' style={primaryBtn}>Открыть фиксацию веса</a><a href='#quality' style={ghostBtn}>Открыть качество</a></div>
      </section>

      <CollapsibleSection title='Обзор приёмки' summary='рейс · вес · качество · следующий шаг' defaultOpen>
        <section style={darkCard}>
          <div style={{ display: 'grid', gap: 6 }}><div style={{ ...micro, color: '#FED7AA' }}>контроль приёмки</div><h2 style={{ margin: 0, color: '#fff', fontSize: 'clamp(24px,6vw,36px)', lineHeight: 1.08, letterSpacing: '-0.04em', fontWeight: 950 }}>Что приёмка должна понять за 5 секунд</h2></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10 }}>{receivingSummary.map((item) => <SummaryCard key={item.label} item={item} />)}</div>
        </section>
      </CollapsibleSection>

      <CollapsibleSection title='Вес и активная приёмка' summary='598,8 т · отклонение -1,2 т' defaultOpen={false}>
        <section id='weight' className='p7-elevator-active' style={card}>
          <div style={micro}>Активная приёмка</div>
          <div style={rowHead}><div><div style={idText}>{receiving.tripId} · {receiving.dealId}</div><h2 style={h2}>{receiving.crop} · {receiving.declaredWeight}</h2><p style={muted}>{receiving.lotId} · прибыл на элеватор ВРЖ-08</p></div><span style={statusPill}>в работе</span></div>
          <WeighStationPanel tripId={receiving.tripId} declaredTons={600} acceptedTons={598.8} toleranceTons={0.5} note='Отклонение фиксируется актом расхождения; без него основание не передаётся банку на проверку выплаты.' />
          <div className='p7-elevator-active-grid' style={grid2}><Cell label='Заявлено' value={receiving.declaredWeight} /><Cell label='На приёмке' value={receiving.arrivedWeight} strong /><Cell label='Отклонение' value={receiving.deviation} danger /><Cell label='Лаборатория' value={receiving.lab} /><Cell label='Документы' value={receiving.docs} /><Cell label='Следующее действие' value={receiving.next} strong /></div>
          <div className='p7-elevator-active-actions' style={actions}><a href='#weight' style={primaryBtn}>Зафиксировать вес</a><a href='#quality' style={ghostBtn}>Передать пробу в лабораторию</a></div>
        </section>
      </CollapsibleSection>

      <CollapsibleSection title='Качество и условия допуска' summary='примесь · акт · протокол' defaultOpen={false}>
        <div style={{ display: 'grid', gap: 12 }}>
          <section style={card}><div style={micro}>Условия приёмки, влияющие на банковскую проверку</div><div style={grid2}>{gates.map((gate) => <Gate key={`${gate.title}-${gate.value}`} gate={gate} />)}</div></section>
          <section id='quality' className='p7-elevator-quality' style={card}><div style={micro}>Качество партии · пилотный протокол качества</div><div className='p7-elevator-quality-grid' style={grid2}>{quality.map((item) => <QualityCell key={item.label} item={item} />)}</div><div className='p7-elevator-notice' style={notice}>При отклонении веса или качества платформа создаёт акт расхождения, удержание и задачу оператору. Передача основания банку на проверку выплаты не продолжается до закрытия акта и протокола.</div></section>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title='Доказательства, рекомендации и журнал приёмки' summary='факты · передача · решение' defaultOpen={false}>
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'grid', gap: 10 }}><CauseLine cause={{ text: 'Акт расхождения по весу не подписан', tone: 'blocked' }} relation='blocks' effect={{ text: 'Основание не передаётся банку', tone: 'blocked' }} moneyAmount='9,65 млн ₽' moneyTone='hold' /><CauseLine cause={{ text: 'Превышение по сорной примеси (2,4% > 2%)', tone: 'warning' }} relation='requires' effect={{ text: 'Протокол качества до расчёта', tone: 'warning' }} /><TrustDot state='test' size='sm' label='Контур исполнения · Физические данные требуют реальных приёмок' /><SmartSectionSummary label='Статус приёмки' items={[{ text: 'TRIP-2403-001 · Вес 598,8 т · Отклонение -1,2 т · Акт готовится', tone: 'warn' }, { text: 'Сорная примесь 2,4% — выше допуска 2% · Протокол ожидается', tone: 'warn' }]} /></div>
          <DecisionRecommendationStrip context='elevator' />
          <EvidenceReadinessMiniMatrix context='elevator' />
          <RoleExecutionHandoff items={elevatorHandoff} title='исполнение: что приёмка отправляет и ожидает' />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title='Runtime приёмки' summary='очередь · акт · действие' defaultOpen={false}><FieldElevatorRuntime /></CollapsibleSection>
    </main>
  );
}

const grid2 = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 } as const;
const card = { background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', borderRadius: 24, padding: 18, display: 'grid', gap: 14, boxShadow: '0 18px 40px rgba(15,23,42,.08)' } as const;
const darkCard = { ...card, background: 'linear-gradient(135deg,#7C2D12,#0F766E)' } as const;
const micro = { color: 'var(--pc-text-muted,#64748B)', fontSize: 11, fontWeight: 950, textTransform: 'uppercase', letterSpacing: '.08em' } as const;
const h2 = { margin: '4px 0 0', color: 'var(--pc-text-primary)', fontSize: 'clamp(22px,5vw,34px)', lineHeight: 1.08, letterSpacing: '-.035em', fontWeight: 950 } as const;
const muted = { margin: '4px 0 0', color: 'var(--pc-text-muted)', fontSize: 14, lineHeight: 1.45 } as const;
const idText = { color: '#B45309', fontSize: 13, fontWeight: 950 } as const;
const rowHead = { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start', flexWrap: 'wrap' } as const;
const statusPill = { borderRadius: 999, background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#047857', padding: '8px 12px', fontSize: 12, fontWeight: 950 } as const;
const primaryBtn = { minHeight: 48, display: 'grid', placeItems: 'center', borderRadius: 16, background: '#047857', color: '#fff', fontWeight: 950, textDecoration: 'none', padding: '0 16px' } as const;
const ghostBtn = { ...primaryBtn, background: 'var(--pc-bg-card)', color: 'var(--pc-text-primary)', border: '1px solid var(--pc-border)' } as const;
const actions = { display: 'flex', gap: 10, flexWrap: 'wrap' } as const;
const notice = { border: '1px solid #FECACA', background: 'rgba(220,38,38,0.06)', color: '#B91C1C', borderRadius: 18, padding: 14, fontSize: 13, lineHeight: 1.45, fontWeight: 900 } as const;

function FirstScreenCell({ item }: { item: (typeof firstScreen)[number] }) { return <div style={{ border: '1px solid var(--pc-border)', borderRadius: 18, padding: 14, display: 'grid', gap: 6 }}><span style={micro}>{item.label}</span><strong style={{ color: item.label === 'Деньги под риском' || item.label === 'Что заблокировано' ? '#B91C1C' : 'var(--pc-text-primary)', fontSize: 17, lineHeight: 1.2 }}>{item.value}</strong><span style={{ color: 'var(--pc-text-muted)', fontSize: 12, lineHeight: 1.4 }}>{item.note}</span></div>; }
function Cell({ label, value, strong, danger }: { label: string; value: string; strong?: boolean; danger?: boolean }) { return <div style={{ border: '1px solid var(--pc-border)', borderRadius: 18, padding: 14, display: 'grid', gap: 6 }}><span style={micro}>{label}</span><strong style={{ color: danger ? '#B91C1C' : strong ? '#047857' : 'var(--pc-text-primary)', fontSize: 18, lineHeight: 1.2 }}>{value}</strong></div>; }
function Gate({ gate }: { gate: (typeof gates)[number] }) { return <div style={{ border: `1px solid ${gate.state === 'stop' ? '#FECACA' : '#FED7AA'}`, background: gate.state === 'stop' ? 'rgba(220,38,38,0.06)' : '#FFF7ED', borderRadius: 18, padding: 14, display: 'grid', gap: 6 }}><span style={{ ...micro, color: gate.state === 'stop' ? '#B91C1C' : '#C2410C' }}>{gate.title}</span><strong style={{ color: 'var(--pc-text-primary)', fontSize: 16 }}>{gate.value}</strong><span style={{ color: 'var(--pc-text-muted)', fontSize: 12, lineHeight: 1.4 }}>{gate.impact}</span></div>; }
function QualityCell({ item }: { item: (typeof quality)[number] }) { return <div style={{ border: `1px solid ${item.state === 'stop' ? '#FECACA' : '#FED7AA'}`, background: item.state === 'stop' ? 'rgba(220,38,38,0.06)' : '#FFFBEB', borderRadius: 18, padding: 14, display: 'grid', gap: 6 }}><span style={{ ...micro, color: item.state === 'stop' ? '#B91C1C' : '#B45309' }}>{item.label}</span><strong style={{ color: 'var(--pc-text-primary)', fontSize: 18 }}>{item.value}</strong><span style={{ color: item.state === 'stop' ? '#B91C1C' : '#B45309', fontSize: 12 }}>{item.limit}</span></div>; }
function SummaryCard({ item }: { item: (typeof receivingSummary)[number] }) { return <div style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.22)', borderRadius: 18, padding: 14, display: 'grid', gap: 7 }}><span style={{ ...micro, color: '#FED7AA' }}>{item.label}</span><strong style={{ color: '#fff', fontSize: 16, lineHeight: 1.25 }}>{item.value}</strong><span style={{ color: '#FFEDD5', fontSize: 12, lineHeight: 1.4 }}>{item.note}</span></div>; }
