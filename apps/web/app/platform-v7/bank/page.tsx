import Link from 'next/link';
import { getDeal360Scenario, type Deal360State } from '@/lib/platform-v7/deal360-source-of-truth';
import { RoleExecutionHandoff, type HandoffItem } from '@/components/platform-v7/RoleExecutionHandoff';
import { P7ActionStateChip } from '@/components/platform-v7/P7ActionStateChip';
import { JournalPreview } from '@/components/platform-v7/JournalPreview';
import { ConditionReasonStrip } from '@/components/platform-v7/ConditionReasonStrip';
import { DocumentReadinessMiniMatrix } from '@/components/platform-v7/DocumentReadinessMiniMatrix';
import { EvidenceReadinessMiniMatrix } from '@/components/platform-v7/EvidenceReadinessMiniMatrix';
import { MoneyImpactSummaryStrip } from '@/components/platform-v7/MoneyImpactSummaryStrip';
import { CounterpartyRiskStrip } from '@/components/platform-v7/CounterpartyRiskStrip';

const bankHandoff: HandoffItem[] = [
  {
    direction: 'awaits',
    role: 'банк ← все роли',
    requirement: 'документы, приёмка, качество и спор должны быть закрыты до банковского события',
    documentImpact: true,
    moneyImpact: true,
  },
  {
    direction: 'awaits',
    role: 'банк ← продавец',
    requirement: 'СДИЗ и ЭТрН ожидают закрытия — без этого выплата не передаётся на банковскую проверку',
    documentImpact: true,
    moneyImpact: true,
  },
  {
    direction: 'sends',
    role: 'банк → оператор',
    requirement: 'банк направляет уведомление о готовности к банковскому событию — пилотный контур требует ручной сверки оператором',
    moneyImpact: true,
  },
  {
    direction: 'blockedBy',
    requirement: 'СДИЗ, ЭТрН, акт приёмки и протокол качества ещё не закрыты — банковская проверка выплаты не продолжается',
    documentImpact: true,
    moneyImpact: true,
  },
  {
    direction: 'next',
    requirement: 'ждать закрытия всех условий для банковского события по DL-9106',
    entity: 'DL-9106',
    href: '/platform-v7/deals/DL-9106/clean',
    moneyImpact: true,
  },
];

const mainDeal = getDeal360Scenario('DL-9106');
const disputeDeal = getDeal360Scenario('DL-9102');

const bankQueue = [
  {
    id: mainDeal.dealId,
    lot: mainDeal.lotId,
    buyer: 'Покупатель 1',
    amount: '9,65 млн ₽',
    reserve: 'ожидает банковского подтверждения',
    releaseNow: '0 ₽',
    hold: '0 ₽',
    decision: 'не передавать на выплату',
    next: mainDeal.nextAction,
    href: `/platform-v7/deals/${mainDeal.dealId}/clean`,
    state: 'stop' as Deal360State,
  },
  {
    id: disputeDeal.dealId,
    lot: disputeDeal.lotId,
    buyer: 'Покупатель 2',
    amount: '6,24 млн ₽',
    reserve: 'отмечен в пилотном контуре',
    releaseNow: '5,616 млн ₽',
    hold: '624 тыс. ₽',
    decision: 'частичная выплата после решения и банковского подтверждения',
    next: disputeDeal.nextAction,
    href: `/platform-v7/deals/${disputeDeal.dealId}/clean`,
    state: 'manual' as Deal360State,
  },
] as const;

const releaseSummary = [
  { label: 'Что сейчас', value: 'DL-9106 · выплата остановлена', note: 'Сделка есть, но передача на выплату невозможна без закрытых условий.' },
  { label: 'Где деньги', value: 'резерв ожидает банковского подтверждения · к выплате 0 ₽', note: 'Банк видит резерв, удержание и основание остановки, а не декоративную кнопку выплаты.' },
  { label: 'Что блокирует', value: 'СДИЗ, ЭТрН, УПД, акт, качество', note: 'Каждая причина остановки должна иметь источник, ответственного, статус и влияние на деньги.' },
  { label: 'Где груз', value: 'TRIP-SIM-001 · приёмка и качество в работе', note: 'Транспортный и приёмочный факты нужны как основание для банковской проверки.' },
  { label: 'Решение банка', value: 'не передавать на выплату', note: 'В пилотном контуре нет заявления о live-выплате или боевом банковском событии.' },
  { label: 'Кто следующий', value: 'оператор + ответственный за документ', note: 'Следующее действие фиксируется в сделке и журнале.' },
] as const;

const gates = mainDeal.providerGates.filter((gate) => ['Сбер · Безопасные сделки', 'Сбер · Оплата в кредит', 'ФГИС «Зерно»', 'Контур.Диадок', 'СБИС / Saby ЭТрН', 'Лабораторный контур качества'].includes(gate.provider));

export default function PlatformV7BankPage() {
  return (
    <main style={{ display: 'grid', gap: 14, padding: '4px 0 24px' }}>
      <section style={hero}>
        <div style={badge}>Кабинет банка</div>
        <h1 style={h1}>Деньги передаются на выплату только после условий сделки</h1>
        <p style={lead}>Банк видит резерв, удержание, документы, приёмку, качество и причину остановки. Здесь нет кнопки прямой выплаты: сначала проверка условий, потом банковское событие или ручная сверка.</p>
        <div style={actions}>
          <Link href='/platform-v7/bank/release-safety' style={primaryBtn}>Проверка выплаты</Link>
          <Link href={`/platform-v7/deals/${mainDeal.dealId}/clean`} style={ghostBtn}>Deal 360</Link>
        </div>
      </section>

      <section style={darkCard}>
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ ...micro, color: '#CBD5E1' }}>проверка выплаты</div>
          <h2 style={{ margin: 0, color: '#fff', fontSize: 'clamp(24px,6vw,36px)', lineHeight: 1.08, letterSpacing: '-0.04em', fontWeight: 950 }}>Что банк должен понять за 5 секунд</h2>
          <p style={{ margin: 0, color: '#CBD5E1', fontSize: 14, lineHeight: 1.55 }}>Выплата продавцу не является ручной кнопкой платформы. Это результат закрытых документов, приёмки, качества, спора и банковского решения.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10 }}>
          {releaseSummary.map((item) => <SummaryCard key={item.label} item={item} />)}
        </div>
      </section>

      <MoneyImpactSummaryStrip
        amountContext='в резерве 15,89 млн ₽ · к выплате 0 ₽ · удержание 624 тыс. ₽'
        pilotState='blocked'
        pilotStateLabel='пилотный контур · удержание до закрытия условий'
        responsible='банк · оператор'
        nextStep='ручная сверка после закрытия всех условий'
        stopReason='банковская проверка выплаты остановлена: СДИЗ, ЭТрН, акт приёмки и качество не закрыты'
      />

      <P7ActionStateChip
        status='blocked'
        label='банковская проверка выплаты'
        nextActor='оператор и ответственный за документ'
        blocker='СДИЗ, ЭТрН, УПД, приёмка, качество'
        moneyEffect='удержание до закрытия условий'
      />

      <ConditionReasonStrip
        condition='банковская проверка выплаты'
        responsible='оператор и ответственный за документ'
        documentState='СДИЗ, ЭТрН, УПД, приёмка, качество'
        stopReason='удержание до закрытия условий'
      />

      <section style={metricsGrid}>
        <Metric label='В резерве' value='15,89 млн ₽' />
        <Metric label='Можно выплатить сейчас' value='0 ₽' danger />
        <Metric label='Под удержанием' value='624 тыс. ₽' danger />
        <Metric label='Требуют проверки' value='2 сделки' />
      </section>

      <section style={card}>
        <div style={micro}>Сбер · Безопасные сделки</div>
        <h2 style={h2}>Проверка выплаты продавцу</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8 }}>
          {mainDeal.money.map((item) => (
            <div key={item.title} style={{ background: stateBg(item.state), border: `1px solid ${stateBorder(item.state)}`, borderRadius: 16, padding: 13 }}>
              <div style={{ ...micro, color: stateText(item.state) }}>{item.title}</div>
              <div style={{ marginTop: 6, color: '#0F1419', fontSize: 20, fontWeight: 950 }}>{item.value}</div>
              <div style={{ marginTop: 5, color: '#64748B', fontSize: 12, lineHeight: 1.35 }}>{item.note}</div>
            </div>
          ))}
        </div>
        <div style={stopBox}>Выплата продавцу по {mainDeal.dealId} остановлена до закрытия СДИЗ, ЭТрН, УПД, акта приёмки и протокола качества.</div>
      </section>

      <section style={card}>
        <div style={micro}>Условия выплаты денег</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {gates.map((gate) => (
            <article key={`${gate.provider}-${gate.object}`} style={{ background: stateBg(gate.state), border: `1px solid ${stateBorder(gate.state)}`, borderRadius: 16, padding: 13, display: 'grid', gap: 6 }}>
              <div style={rowHead}>
                <div>
                  <h3 style={{ margin: 0, color: '#0F1419', fontSize: 16, fontWeight: 950 }}>{gate.provider}</h3>
                  <p style={muted}>{gate.object}</p>
                </div>
                <span style={{ ...pill, color: stateText(gate.state), borderColor: stateBorder(gate.state), background: '#fff' }}>{gate.status}</span>
              </div>
              <div style={{ color: '#0F1419', fontSize: 13, lineHeight: 1.45, fontWeight: 800 }}>{gate.impact}</div>
            </article>
          ))}
        </div>
      </section>

      <section style={card}>
        <div style={micro}>Денежная очередь</div>
        {bankQueue.map((deal) => (
          <Link key={deal.id} href={deal.href} style={{ textDecoration: 'none', color: 'inherit', background: '#F8FAFB', border: `1px solid ${stateBorder(deal.state)}`, borderRadius: 20, padding: 15, display: 'grid', gap: 12 }}>
            <div style={rowHead}>
              <div>
                <div style={idText}>{deal.id} · {deal.lot}</div>
                <h2 style={h2}>{deal.amount}</h2>
                <p style={muted}>{deal.buyer}</p>
              </div>
              <span style={{ ...pill, background: stateBg(deal.state), borderColor: stateBorder(deal.state), color: stateText(deal.state) }}>{deal.decision}</span>
            </div>
            <div style={grid2}>
              <Cell label='Резерв' value={deal.reserve} strong={deal.reserve === 'отмечен в пилотном контуре'} />
              <Cell label='К выплате сейчас' value={deal.releaseNow} danger={deal.releaseNow === '0 ₽'} />
              <Cell label='Удержано' value={deal.hold} danger={deal.hold !== '0 ₽'} />
              <Cell label='Следующее действие' value={deal.next} strong />
            </div>
          </Link>
        ))}
      </section>

      <DocumentReadinessMiniMatrix role='bank' />

      <EvidenceReadinessMiniMatrix context='bank' />

      <CounterpartyRiskStrip context='bank' />

      <RoleExecutionHandoff items={bankHandoff} title='исполнение: что банк ожидает и отправляет' />

      <JournalPreview role='bank' maxEntries={3} />
    </main>
  );
}

function SummaryCard({ item }: { item: typeof releaseSummary[number] }) {
  return <div style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 18, padding: 13, display: 'grid', gap: 7 }}><div style={{ ...micro, color: '#CBD5E1' }}>{item.label}</div><strong style={{ color: '#fff', fontSize: 14, lineHeight: 1.4 }}>{item.value}</strong><p style={{ margin: 0, color: '#CBD5E1', fontSize: 12, lineHeight: 1.45 }}>{item.note}</p></div>;
}

function Metric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 16 }}><div style={micro}>{label}</div><div style={{ marginTop: 8, color: danger ? '#B91C1C' : '#0F1419', fontSize: 28, lineHeight: 1, fontWeight: 950 }}>{value}</div></div>;
}

function Cell({ label, value, strong = false, danger = false }: { label: string; value: string; strong?: boolean; danger?: boolean }) {
  return <div style={cell}><div style={micro}>{label}</div><div style={{ marginTop: 4, color: danger ? '#B91C1C' : strong ? '#0A7A5F' : '#0F1419', fontSize: 13, lineHeight: 1.25, fontWeight: 900 }}>{value}</div></div>;
}

function stateBg(state: Deal360State) {
  if (state === 'ok') return 'rgba(10,122,95,0.06)';
  if (state === 'stop') return 'rgba(220,38,38,0.06)';
  if (state === 'wait') return 'rgba(217,119,6,0.06)';
  return '#F8FAFB';
}
function stateBorder(state: Deal360State) {
  if (state === 'ok') return 'rgba(10,122,95,0.18)';
  if (state === 'stop') return 'rgba(220,38,38,0.18)';
  if (state === 'wait') return 'rgba(217,119,6,0.18)';
  return '#E4E6EA';
}
function stateText(state: Deal360State) {
  if (state === 'ok') return '#0A7A5F';
  if (state === 'stop') return '#B91C1C';
  if (state === 'wait') return '#B45309';
  return '#475569';
}

const hero = { background: 'linear-gradient(135deg,#FFFFFF 0%,#F8FAFB 62%,#EEF6F3 100%)', border: '1px solid #E4E6EA', borderRadius: 26, padding: 22, display: 'grid', gap: 12 } as const;
const darkCard = { background: '#0F172A', color: '#fff', borderRadius: 24, padding: 18, display: 'grid', gap: 13, boxShadow: '0 18px 44px rgba(15,23,42,0.18)' } as const;
const card = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 12 } as const;
const badge = { display: 'inline-flex', width: 'fit-content', padding: '7px 11px', borderRadius: 999, background: 'rgba(15,23,42,0.08)', border: '1px solid rgba(15,23,42,0.18)', color: '#0F172A', fontSize: 12, fontWeight: 900 } as const;
const h1 = { margin: 0, color: '#0F1419', fontSize: 'clamp(30px,8vw,48px)', lineHeight: 1.03, letterSpacing: '-0.045em', fontWeight: 950 } as const;
const h2 = { margin: '6px 0 0', color: '#0F1419', fontSize: 22, lineHeight: 1.08, fontWeight: 950 } as const;
const lead = { margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.55 } as const;
const muted = { margin: '6px 0 0', color: '#64748B', fontSize: 13 } as const;
const actions = { display: 'flex', gap: 8, flexWrap: 'wrap' } as const;
const primaryBtn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#0F172A', color: '#fff', fontSize: 14, fontWeight: 900 } as const;
const ghostBtn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#fff', border: '1px solid #CBD5E1', color: '#0F1419', fontSize: 14, fontWeight: 850 } as const;
const metricsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 } as const;
const rowHead = { display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' } as const;
const idText = { color: '#0F172A', fontSize: 13, fontWeight: 950 } as const;
const micro = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' } as const;
const grid2 = { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(120px,1fr))', gap: 8 } as const;
const cell = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 13, padding: 10, minWidth: 0 } as const;
const pill = { display: 'inline-flex', width: 'fit-content', alignItems: 'center', padding: '7px 10px', borderRadius: 999, border: '1px solid #E4E6EA', fontSize: 12, fontWeight: 900 } as const;
const stopBox = { background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.18)', borderRadius: 14, padding: 12, color: '#B91C1C', fontSize: 13, lineHeight: 1.45, fontWeight: 900 } as const;
