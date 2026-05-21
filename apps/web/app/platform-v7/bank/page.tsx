import Link from 'next/link';
import type { ReactNode } from 'react';
import { getDeal360Scenario, type Deal360State } from '@/lib/platform-v7/deal360-source-of-truth';
import { RoleExecutionHandoff, type HandoffItem } from '@/components/platform-v7/RoleExecutionHandoff';
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
import { BankCompliancePilotPanel } from '@/components/platform-v7/BankCompliancePilotPanel';
import { RoleExecutionCockpitPage } from '@/components/platform-v7/RoleExecutionCockpit';
import { PRIMARY_ROLE_EXECUTION_COCKPITS } from '@/lib/platform-v7/role-execution-cockpit';

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

const gates = mainDeal.providerGates.filter((gate) => ['Сбер · Безопасные сделки', 'Сбер · Оплата в кредит', 'ФГИС «Зерно»', 'Контур.Диадок', 'СБИС / Saby ЭТрН', 'Лабораторный контур качества'].includes(gate.provider));

export default function PlatformV7BankPage() {
  return (
    <RoleExecutionCockpitPage cockpit={PRIMARY_ROLE_EXECUTION_COCKPITS.bank}>

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

      <BankCompliancePilotPanel mode='bank' />

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
    </RoleExecutionCockpitPage>
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

const cardInner = { background: 'linear-gradient(180deg,#FFFFFF 0%,#F8FAFB 100%)', border: '1px solid #E4E6EA', borderRadius: 20, padding: 14, display: 'grid', gap: 12, boxShadow: '0 10px 22px rgba(15,23,42,0.045)' } as const;
const h2 = { margin: '6px 0 0', color: '#0F1419', fontSize: 22, lineHeight: 1.08, fontWeight: 950 } as const;
const muted = { margin: '6px 0 0', color: '#64748B', fontSize: 13 } as const;
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
