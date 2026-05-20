import Link from 'next/link';
import type { ReactNode } from 'react';
import { getDeal360Scenario, type Deal360State } from '@/lib/platform-v7/deal360-source-of-truth';
import { RoleExecutionHandoff, type HandoffItem } from '@/components/platform-v7/RoleExecutionHandoff';
import { BatonStrip } from '@/components/platform-v7/BatonStrip';
import { P7ActionStateChip } from '@/components/platform-v7/P7ActionStateChip';
import { JournalPreview } from '@/components/platform-v7/JournalPreview';
import { ConditionReasonStrip } from '@/components/platform-v7/ConditionReasonStrip';
import { DocumentReadinessMiniMatrix } from '@/components/platform-v7/DocumentReadinessMiniMatrix';
import { DocumentsMatrix } from '@/components/platform-v7/DocumentsMatrix';
import { DocumentsMatrixActions } from '@/components/platform-v7/DocumentsMatrixActions';
import { EvidenceReadinessMiniMatrix } from '@/components/platform-v7/EvidenceReadinessMiniMatrix';
import { MoneyImpactSummaryStrip } from '@/components/platform-v7/MoneyImpactSummaryStrip';
import { DecisionRecommendationStrip } from '@/components/platform-v7/DecisionRecommendationStrip';
import { DecisionPackMiniPanel } from '@/components/platform-v7/DecisionPackMiniPanel';
import { ActionFeedbackPreviewStrip } from '@/components/platform-v7/ActionFeedbackPreviewStrip';

const bankHandoff: HandoffItem[] = [
  {
    direction: 'awaits',
    role: 'банк ← все роли',
    requirement: 'документы, приёмка, качество и спор должны быть закрыты до банковской проверки выплаты',
    documentImpact: true,
    moneyImpact: true,
  },
  {
    direction: 'awaits',
    role: 'банк ← продавец',
    requirement: 'СДИЗ и ЭТрН ожидают закрытия — без этого основание не передаётся на банковскую проверку',
    documentImpact: true,
    moneyImpact: true,
  },
  {
    direction: 'sends',
    role: 'банк → оператор',
    requirement: 'банк направляет статус проверки; оператор сверяет причину остановки и основание в сделке',
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
    requirement: 'ждать закрытия всех условий для банковской проверки выплаты по DL-9106',
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
    decision: 'не передавать основание банку',
    next: mainDeal.nextAction,
    href: `/platform-v7/deals/${mainDeal.dealId}/clean`,
    state: 'stop' as Deal360State,
  },
  {
    id: disputeDeal.dealId,
    lot: disputeDeal.lotId,
    buyer: 'Покупатель 2',
    amount: '6,24 млн ₽',
    reserve: 'резерв отмечен',
    releaseNow: '5,616 млн ₽',
    hold: '624 тыс. ₽',
    decision: 'частичная передача основания после решения и банковского подтверждения',
    next: disputeDeal.nextAction,
    href: `/platform-v7/deals/${disputeDeal.dealId}/clean`,
    state: 'manual' as Deal360State,
  },
] as const;

const releaseSummary = [
  { label: 'Что сейчас', value: 'DL-9106 · проверка выплаты остановлена', note: 'Сделка есть, но основание банку не передаётся без закрытых условий.' },
  { label: 'Где деньги', value: 'резерв ожидает банковского подтверждения · к передаче 0 ₽', note: 'Банк видит резерв, удержание и причину остановки, а не кнопку движения денег.' },
  { label: 'Что блокирует', value: 'СДИЗ, ЭТрН, УПД, акт, качество', note: 'У каждой причины есть источник, ответственный, статус и влияние на деньги.' },
  { label: 'Где груз', value: `${mainDeal.tripId} · приёмка и качество в работе`, note: 'Транспортный и приёмочный факты нужны как основание для проверки.' },
  { label: 'Решение банка', value: 'не передавать основание банку', note: 'Нет заявления о выплате без банковского подтверждения.' },
  { label: 'Кто следующий', value: 'оператор + ответственный за документ', note: 'Следующее действие фиксируется в сделке и журнале.' },
] as const;

const gates = mainDeal.providerGates.filter((gate) => ['Сбер · Безопасные сделки', 'Сбер · Оплата в кредит', 'ФГИС «Зерно»', 'Контур.Диадок', 'СБИС / Saby ЭТрН', 'Лабораторный контур качества'].includes(gate.provider));

export default function PlatformV7BankPage() {
  return (
    <main style={{ display: 'grid', gap: 14, padding: '4px 0 24px' }}>
      <BatonStrip
        from="оператор и ответственный за документ"
        mine="проверка основания выплаты"
        to="оператор — подтверждение"
        toHref="/platform-v7/control-tower"
      />
      <section style={hero}>
        <div style={badge}>Кабинет банка</div>
        <h1 style={h1}>Сначала основание, потом банковская проверка</h1>
        <p style={lead}>Экран показывает только то, что важно для решения: сумма, стоп, причина, ответственный и следующее действие. Длинные детали скрыты ниже и раскрываются по необходимости.</p>
        <div style={actions}>
          <Link href='/platform-v7/bank/release-safety' style={primaryBtn}>Проверка выплаты</Link>
          <Link href={`/platform-v7/deals/${mainDeal.dealId}/clean`} style={ghostBtn}>Карточка сделки</Link>
        </div>
      </section>

      <section style={focusCard}>
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={micro}>5 секунд для банка</div>
          <h2 style={{ margin: 0, color: '#0F1419', fontSize: 'clamp(23px,5.5vw,34px)', lineHeight: 1.08, letterSpacing: '-0.04em', fontWeight: 950 }}>Деньги не двигаются, пока нет основания</h2>
          <p style={{ margin: 0, color: '#475569', fontSize: 14, lineHeight: 1.55 }}>Передача основания банку — результат закрытых документов, приёмки, качества, спора и банковского решения.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10 }}>
          {releaseSummary.map((item) => <SummaryCard key={item.label} item={item} />)}
        </div>
      </section>

      <section style={metricsGrid}>
        <Metric label='В резерве' value='15,89 млн ₽' />
        <Metric label='К передаче банку сейчас' value='0 ₽' danger />
        <Metric label='Под удержанием' value='624 тыс. ₽' danger />
        <Metric label='Требуют проверки' value='2 сделки' />
      </section>

      <section style={cardInner}>
        <div style={micro}>Денежная очередь</div>
        {bankQueue.map((deal) => (
          <Link key={deal.id} href={deal.href} style={{ textDecoration: 'none', color: 'inherit', background: 'linear-gradient(180deg,#FFFFFF 0%,#F8FAFB 100%)', border: `1px solid ${stateBorder(deal.state)}`, borderRadius: 22, padding: 16, display: 'grid', gap: 12, boxShadow: '0 12px 30px rgba(15,23,42,0.055)' }}>
            <div style={rowHead}>
              <div>
                <div style={idText}>{deal.id} · {deal.lot}</div>
                <h2 style={h2}>{deal.amount}</h2>
                <p style={muted}>{deal.buyer}</p>
              </div>
              <span style={{ ...pill, background: stateBg(deal.state), borderColor: stateBorder(deal.state), color: stateText(deal.state) }}>{deal.decision}</span>
            </div>
            <div style={grid2}>
              <Cell label='Резерв' value={deal.reserve} strong={deal.reserve === 'резерв отмечен'} />
              <Cell label='К передаче банку' value={deal.releaseNow} danger={deal.releaseNow === '0 ₽'} />
              <Cell label='Удержано' value={deal.hold} danger={deal.hold !== '0 ₽'} />
              <Cell label='Следующее действие' value={deal.next} strong />
            </div>
          </Link>
        ))}
      </section>

      <MoneyImpactSummaryStrip
        amountContext='в резерве 15,89 млн ₽ · к передаче банку 0 ₽ · удержание 624 тыс. ₽'
        pilotState='blocked'
        pilotStateLabel='удержание до закрытия условий'
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

      <DisclosureSection title='Документы и основания' meta='СДИЗ, ЭТрН, УПД, акт, качество · раскрыть детали'>
        <DocumentsMatrix />
        <DocumentsMatrixActions />
        <DocumentReadinessMiniMatrix role='bank' />
      </DisclosureSection>

      <DisclosureSection title='Внешние контуры' meta='банк, ФГИС, ЭДО, ЭТрН, качество · показать статусы'>
        <section style={cardInner}>
          <div style={micro}>Условия банковской проверки выплаты</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {gates.map((gate) => (
              <article key={`${gate.provider}-${gate.object}`} style={{ background: stateBg(gate.state), border: `1px solid ${stateBorder(gate.state)}`, borderRadius: 18, padding: 14, display: 'grid', gap: 6, boxShadow: '0 10px 24px rgba(15,23,42,0.045)' }}>
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
      </DisclosureSection>

      <DisclosureSection title='Рекомендации и доказательства' meta='пакет решения · факты · обратная связь'>
        <DecisionRecommendationStrip context='bank' />
        <DecisionPackMiniPanel context='bank_release_review' />
        <EvidenceReadinessMiniMatrix context='bank' />
        <ActionFeedbackPreviewStrip context='bank' />
      </DisclosureSection>

      <DisclosureSection title='Передача между ролями и журнал' meta='кто ждёт · кто отправляет · что зафиксировано'>
        <RoleExecutionHandoff items={bankHandoff} title='исполнение: что банк ожидает и отправляет' />
        <JournalPreview role='bank' maxEntries={3} />
      </DisclosureSection>
    </main>
  );
}

function DisclosureSection({ title, meta, children }: { title: string; meta: string; children: ReactNode }) {
  return (
    <details style={detailsCard}>
      <summary style={summaryRow}>
        <span style={{ display: 'grid', gap: 4 }}>
          <strong style={{ color: '#0F1419', fontSize: 18, lineHeight: 1.15 }}>{title}</strong>
          <span style={{ color: '#64748B', fontSize: 12, lineHeight: 1.35 }}>{meta}</span>
        </span>
        <span style={summaryPill}>раскрыть</span>
      </summary>
      <div style={detailsBody}>{children}</div>
    </details>
  );
}

function SummaryCard({ item }: { item: typeof releaseSummary[number] }) {
  return <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 13, display: 'grid', gap: 7, boxShadow: '0 8px 20px rgba(15,23,42,0.045)' }}><div style={micro}>{item.label}</div><strong style={{ color: '#0F1419', fontSize: 14, lineHeight: 1.4 }}>{item.value}</strong><p style={{ margin: 0, color: '#64748B', fontSize: 12, lineHeight: 1.45 }}>{item.note}</p></div>;
}

function Metric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return <div style={{ background: 'linear-gradient(180deg,#FFFFFF 0%,#F8FAFB 100%)', border: '1px solid #E4E6EA', borderRadius: 20, padding: 16, boxShadow: '0 12px 28px rgba(15,23,42,0.055)' }}><div style={micro}>{label}</div><div style={{ marginTop: 8, color: danger ? '#B91C1C' : '#0F1419', fontSize: 28, lineHeight: 1, fontWeight: 950 }}>{value}</div></div>;
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

const hero = { background: 'linear-gradient(135deg,#FFFFFF 0%,#F8FAFB 58%,#EEF6F3 100%)', border: '1px solid #E4E6EA', borderRadius: 28, padding: 24, display: 'grid', gap: 12, boxShadow: '0 18px 44px rgba(15,23,42,0.08)' } as const;
const focusCard = { background: 'linear-gradient(135deg,#FFFFFF 0%,#F8FAFB 60%,#EEF6F3 100%)', color: '#0F1419', border: '1px solid #E4E6EA', borderRadius: 26, padding: 20, display: 'grid', gap: 14, boxShadow: '0 18px 42px rgba(15,23,42,0.075)' } as const;
const cardInner = { background: 'linear-gradient(180deg,#FFFFFF 0%,#F8FAFB 100%)', border: '1px solid #E4E6EA', borderRadius: 20, padding: 14, display: 'grid', gap: 12, boxShadow: '0 10px 22px rgba(15,23,42,0.045)' } as const;
const badge = { display: 'inline-flex', width: 'fit-content', padding: '7px 11px', borderRadius: 999, background: 'rgba(15,23,42,0.08)', border: '1px solid rgba(15,23,42,0.18)', color: '#0F172A', fontSize: 12, fontWeight: 900 } as const;
const h1 = { margin: 0, color: '#0F1419', fontSize: 'clamp(28px,7vw,46px)', lineHeight: 1.04, letterSpacing: '-0.045em', fontWeight: 950 } as const;
const h2 = { margin: '6px 0 0', color: '#0F1419', fontSize: 22, lineHeight: 1.08, fontWeight: 950 } as const;
const lead = { margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.55 } as const;
const muted = { margin: '6px 0 0', color: '#64748B', fontSize: 13 } as const;
const actions = { display: 'flex', gap: 8, flexWrap: 'wrap' } as const;
const primaryBtn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#0F172A', color: '#fff', fontSize: 14, fontWeight: 900, boxShadow: '0 14px 30px rgba(15,23,42,0.18)' } as const;
const ghostBtn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#fff', border: '1px solid #CBD5E1', color: '#0F1419', fontSize: 14, fontWeight: 850, boxShadow: '0 10px 24px rgba(15,23,42,0.06)' } as const;
const metricsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 } as const;
const rowHead = { display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' } as const;
const idText = { color: '#0F172A', fontSize: 13, fontWeight: 950 } as const;
const micro = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' } as const;
const grid2 = { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(120px,1fr))', gap: 8 } as const;
const cell = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 14, padding: 10, minWidth: 0, boxShadow: '0 8px 18px rgba(15,23,42,0.035)' } as const;
const pill = { display: 'inline-flex', width: 'fit-content', alignItems: 'center', padding: '7px 10px', borderRadius: 999, border: '1px solid #E4E6EA', fontSize: 12, fontWeight: 900 } as const;
const detailsCard = { background: 'linear-gradient(180deg,#FFFFFF 0%,#F8FAFB 100%)', border: '1px solid #E4E6EA', borderRadius: 24, padding: 0, boxShadow: '0 14px 34px rgba(15,23,42,0.055)', overflow: 'hidden' } as const;
const summaryRow = { cursor: 'pointer', listStyle: 'none', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: 16 } as const;
const summaryPill = { flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', borderRadius: 999, border: '1px solid #CBD5E1', background: '#fff', color: '#0F1419', padding: '7px 10px', fontSize: 12, fontWeight: 900 } as const;
const detailsBody = { borderTop: '1px solid #E4E6EA', padding: 14, display: 'grid', gap: 12 } as const;
