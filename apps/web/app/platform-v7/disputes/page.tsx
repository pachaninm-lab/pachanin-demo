import Link from 'next/link';
import { SmartSectionSummary } from '@/components/platform-v7/visual/SmartSectionSummary';
import { EvidenceStrengthMeter } from '@/components/platform-v7/visual/EvidenceStrengthMeter';
import { calculateEvidencePackReadiness, evidencePackBlocker } from '@/lib/platform-v7/grain-execution/automation/evidence-pack-engine';
import { disputes as executionDisputes, evidencePacks } from '@/lib/platform-v7/grain-execution/mock-data';
import { formatRub } from '@/lib/platform-v7/grain-execution/format';
import { P7HiddenDetails } from '@/components/platform-v7/P7HiddenDetails';
import { RoleExecutionHandoff, type HandoffItem } from '@/components/platform-v7/RoleExecutionHandoff';
import { EvidenceDecisionPanel } from '@/components/platform-v7/EvidenceDecisionPanel';
import { EvidenceReadinessMiniMatrix } from '@/components/platform-v7/EvidenceReadinessMiniMatrix';
import { DecisionRecommendationStrip } from '@/components/platform-v7/DecisionRecommendationStrip';
import { DecisionPackMiniPanel } from '@/components/platform-v7/DecisionPackMiniPanel';
import { ActionFeedbackPreviewStrip } from '@/components/platform-v7/ActionFeedbackPreviewStrip';

const disputesHandoff: HandoffItem[] = [
  {
    direction: 'awaits',
    role: 'споры ← элеватор',
    requirement: 'акт расхождения от элеватора — без него удержание не закрывается',
    documentImpact: true,
    moneyImpact: true,
  },
  {
    direction: 'awaits',
    role: 'споры ← лабораторный контур качества',
    requirement: 'протокол качества — основание для решения по спорной сумме',
    documentImpact: true,
  },
  {
    direction: 'sends',
    role: 'споры → оператор',
    requirement: 'рекомендация по удержанию или спорной сумме — передаётся оператору на ручную проверку оснований',
    moneyImpact: true,
  },
  {
    direction: 'sends',
    role: 'споры → контур документов',
    requirement: 'доказательный пакет: акт, вес, фото, протокол и журнал — в контур банка',
    documentImpact: true,
  },
  {
    direction: 'blockedBy',
    requirement: 'спор не закрыт — спорная сумма остаётся на ручной проверке до решения оператора',
    moneyImpact: true,
  },
  {
    direction: 'next',
    requirement: 'закрыть акт расхождения DSP-9102-WEIGHT и получить протокол DSP-9106-QUALITY',
    documentImpact: true,
    moneyImpact: true,
  },
];

const staticDisputes = [
  {
    id: 'DSP-9102-WEIGHT',
    deal: 'DL-9102',
    lot: 'LOT-2402',
    reason: 'Отклонение веса',
    amount: '624 тыс. ₽',
    status: 'удержание активно',
    responsible: 'оператор',
    sla: '4 часа до решения',
    next: 'закрыть акт расхождения и решение по удержанию',
    href: '/platform-v7/deals/DL-9102/clean',
    evidence: ['весовая ведомость', 'акт расхождения', 'фото приёмки', 'журнал рейса'],
  },
  {
    id: 'DSP-9106-QUALITY',
    deal: 'DL-9106',
    lot: 'LOT-2403',
    reason: 'Протокол качества ожидается',
    amount: '9,65 млн ₽',
    status: 'проверка выплаты остановлена',
    responsible: 'лаборатория',
    sla: 'до 18:00 сегодня',
    next: 'получить протокол качества и закрыть акт приёмки',
    href: '/platform-v7/elevator',
    evidence: ['проба', 'показатели качества', 'акт приёмки', 'журнал элеватора'],
  },
] as const;

const evidenceGateRows = executionDisputes.map((dispute) => {
  const pack = evidencePacks.find((item) => item.id === dispute.evidencePackId);
  const readiness = pack ? calculateEvidencePackReadiness(pack) : null;
  const blocker = pack ? evidencePackBlocker(pack) : null;
  return {
    id: dispute.id,
    deal: dispute.dealId,
    evidencePackId: dispute.evidencePackId,
    reason: dispute.reason,
    disputedAmount: formatRub(dispute.disputedAmount),
    status: dispute.status,
    readiness,
    blocker,
    href: `/platform-v7/disputes?dispute=${encodeURIComponent(dispute.id)}`,
  };
});

const readyDisputeCount = evidenceGateRows.filter((item) => item.readiness?.ready).length;
const blockedDisputeCount = evidenceGateRows.filter((item) => !item.readiness?.ready).length;

const disputeSummary = [
  { label: 'Что сейчас', value: '2 открытых спора', note: 'Каждый спор объясняет, почему сумма остановлена или удержана.' },
  { label: 'Сумма влияния', value: '15,89 млн ₽', note: 'Включает активное удержание и сделку, где проверка выплаты остановлена до качества.' },
  { label: 'Удержание', value: '624 тыс. ₽', note: 'Удержание нельзя снять без решения, суммы и основания.' },
  { label: 'SLA', value: '4 часа / до 18:00', note: 'Очередь должна сортироваться по срочности и влиянию на деньги.' },
  { label: 'Владельцы', value: 'оператор · лаборатория · элеватор', note: 'У каждого спора есть ответственный за следующий шаг.' },
  { label: 'Доказательства', value: 'акт · вес · фото · протокол · журнал', note: 'Спор не закрывается устной перепиской или ручным обходом.' },
] as const;

export default function PlatformV7DisputesPage() {
  return (
    <main style={{ display: 'grid', gap: 14, padding: '4px 0 24px' }}>
      <section style={hero}>
        <div style={badge}>Споры и удержания</div>
        <h1 style={h1}>Спор объясняет, почему сумма остановлена</h1>
        <p style={lead}>Здесь сверху видны только причина, сумма влияния, SLA, ответственный и следующий шаг. Доказательства, правила и передача между ролями раскрываются отдельно.</p>
        <div style={actions}>
          <Link href='/platform-v7/operator' style={primaryBtn}>Центр управления</Link>
          <Link href='/platform-v7/bank' style={ghostBtn}>Банковская проверка</Link>
        </div>
      </section>

      <section style={darkCard}>
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ ...micro, color: '#FECACA' }}>контроль спора</div>
          <h2 style={{ margin: 0, color: '#fff', fontSize: 'clamp(24px,6vw,36px)', lineHeight: 1.08, letterSpacing: '-0.04em', fontWeight: 950 }}>Что должно быть понятно за 5 секунд</h2>
          <p style={{ margin: 0, color: '#FEE2E2', fontSize: 14, lineHeight: 1.55 }}>Спор — это сумма влияния, причина, SLA, ответственный, доказательства и решение по деньгам.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10 }}>
          {disputeSummary.map((item) => <SummaryCard key={item.label} item={item} />)}
        </div>
      </section>

      <section style={metricsGrid}>
        <Metric label='Открытых споров' value='2' danger />
        <Metric label='Под удержанием' value='624 тыс. ₽' danger />
        <Metric label='Деньги под влиянием' value='15,89 млн ₽' danger />
        <Metric label='Готово к решению' value={String(readyDisputeCount)} />
        <Metric label='Закрыто доказательствами' value={String(blockedDisputeCount)} danger />
      </section>

      <SmartSectionSummary
        label='Споры'
        moneyFact='15,89 млн ₽ под влиянием'
        blockers={['624 тыс. ₽ · активное удержание', 'DSP-9102-WEIGHT · акт расхождения не закрыт']}
        warnings={['DSP-9106-QUALITY · ожидает протокол качества']}
        facts={['2 открытых спора', `${readyDisputeCount} готово к решению`]}
      />

      <section style={card}>
        <div style={micro}>Очередь споров</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {staticDisputes.map((item) => <DisputeCard key={item.id} item={item} />)}
        </div>
      </section>

      <EvidenceStrengthMeter
        score={readyDisputeCount * 20}
        maxScore={40}
        factors={[
          { id: 'gps',    label: 'GPS-трек рейса',       points: 5,  earned: 5,  status: 'present'  },
          { id: 'photo',  label: 'Фото приёмки',         points: 10, earned: readyDisputeCount >= 1 ? 10 : 0, status: readyDisputeCount >= 1 ? 'present' : 'absent' },
          { id: 'weight', label: 'Акт расхождения веса', points: 10, earned: 0,  status: 'absent'   },
          { id: 'lab',    label: 'Протокол качества',    points: 10, earned: 0,  status: 'pending'  },
          { id: 'act',    label: 'Акт приёмки',          points: 5,  earned: 5,  status: 'present'  },
        ]}
        compact
      />

      <P7HiddenDetails title='Проверка доказательного пакета' meta='готовность, недостающие доказательства, сумма спора и блокировка решения'>
        <section style={cardInner}>
          <div style={micro}>Проверка доказательного пакета</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {evidenceGateRows.map((item) => <EvidenceGateCard key={item.id} item={item} />)}
          </div>
        </section>
      </P7HiddenDetails>

      <P7HiddenDetails title='Решение и рекомендации' meta='панель решения, рекомендация, пакет решения и обратная связь'>
        <EvidenceDecisionPanel />
        <DecisionRecommendationStrip context='disputes' />
        <DecisionPackMiniPanel context='dl9102_dispute_hold' />
        <EvidenceReadinessMiniMatrix context='disputes' />
        <ActionFeedbackPreviewStrip context='disputes' />
      </P7HiddenDetails>

      <P7HiddenDetails title='Правила закрытия спора' meta='решение, сумма, основание и запись в журнал сделки'>
        <section style={cardInner}>
          <div style={micro}>Правила закрытия</div>
          <div style={grid2}>
            <Rule title='Решение' text='нужно указать: удержать, выплатить, пересчитать или вернуть' />
            <Rule title='Сумма' text='спорная часть должна быть выражена в рублях' />
            <Rule title='Основание' text='акт, протокол, весовая ведомость или документ ЭДО' />
            <Rule title='Журнал' text='закрытие спора записывается в журнал сделки' />
          </div>
        </section>
      </P7HiddenDetails>

      <P7HiddenDetails title='Передача между ролями' meta='что споры ожидают, что отправляют и что блокирует деньги'>
        <RoleExecutionHandoff items={disputesHandoff} title='исполнение: что споры отправляют и ожидают' />
      </P7HiddenDetails>
    </main>
  );
}

function SummaryCard({ item }: { item: typeof disputeSummary[number] }) {
  return <div style={{ background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 20, padding: 14, display: 'grid', gap: 7, boxShadow: '0 12px 26px rgba(15,23,42,0.12)' }}><div style={{ ...micro, color: '#FECACA' }}>{item.label}</div><strong style={{ color: '#fff', fontSize: 14, lineHeight: 1.4 }}>{item.value}</strong><p style={{ margin: 0, color: '#FEE2E2', fontSize: 12, lineHeight: 1.45 }}>{item.note}</p></div>;
}

function DisputeCard({ item }: { item: typeof staticDisputes[number] }) {
  return (
    <Link href={item.href} style={disputeCard}>
      <div style={rowHead}>
        <div>
          <div style={idText}>{item.id} · {item.deal} · {item.lot}</div>
          <h2 style={h2}>{item.reason}</h2>
          <p style={muted}>{item.status}</p>
        </div>
        <span style={dangerPill}>держит сумму</span>
      </div>
      <div style={grid2}>
        <Cell label='Сумма влияния' value={item.amount} danger />
        <Cell label='SLA' value={item.sla} danger />
        <Cell label='Ответственный' value={item.responsible} />
        <Cell label='Следующее действие' value={item.next} strong />
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {item.evidence.map((evidence) => <span key={evidence} style={evidencePill}>{evidence}</span>)}
      </div>
    </Link>
  );
}

function EvidenceGateCard({ item }: { item: typeof evidenceGateRows[number] }) {
  const ready = Boolean(item.readiness?.ready);
  const missing = item.readiness?.missing ?? [];
  const present = item.readiness?.present ?? [];

  return (
    <div style={disputeCard}>
      <div style={rowHead}>
        <div>
          <div style={idText}>{item.id} · {item.deal} · {item.evidencePackId}</div>
          <h2 style={h2}>{ready ? 'Решение можно готовить' : 'Решение закрыто до комплекта доказательств'}</h2>
          <p style={muted}>{item.blocker?.description ?? 'Минимальный доказательный пакет собран.'}</p>
        </div>
        <span style={ready ? safePill : dangerPill}>{ready ? 'пакет готов' : 'решение заблокировано'}</span>
      </div>
      <div style={grid2}>
        <Cell label='Готовность' value={`${item.readiness?.score ?? 0}%`} danger={!ready} />
        <Cell label='Сумма спора' value={item.disputedAmount} danger />
        <Cell label='Статус' value={item.status} />
        <Cell label='Действие' value={ready ? 'подготовить решение по спору' : 'дособрать доказательства'} strong />
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {present.map((evidence) => <span key={evidence} style={evidencePill}>есть: {evidence}</span>)}
        </div>
        {missing.length > 0 ? <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{missing.map((evidence) => <span key={evidence} style={missingEvidencePill}>нет: {evidence}</span>)}</div> : null}
      </div>
    </div>
  );
}

function Metric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return <div style={metric}><div style={micro}>{label}</div><div style={{ marginTop: 8, color: danger ? '#B91C1C' : '#0F1419', fontSize: 29, lineHeight: 1, fontWeight: 950, letterSpacing: '-0.035em' }}>{value}</div></div>;
}

function Cell({ label, value, strong = false, danger = false }: { label: string; value: string; strong?: boolean; danger?: boolean }) {
  return <div style={cell}><div style={micro}>{label}</div><div style={{ marginTop: 4, color: danger ? '#B91C1C' : strong ? '#0A7A5F' : '#0F1419', fontSize: 13, lineHeight: 1.3, fontWeight: 900 }}>{value}</div></div>;
}

function Rule({ title, text }: { title: string; text: string }) {
  return <div style={cell}><strong style={{ color: '#0F1419', fontSize: 14 }}>{title}</strong><p style={{ margin: '5px 0 0', color: '#64748B', fontSize: 12, lineHeight: 1.4 }}>{text}</p></div>;
}

const hero = { background: 'linear-gradient(135deg,#FFFFFF 0%,#F8FAFB 58%,#FFF1F2 100%)', border: '1px solid #E4E6EA', borderRadius: 28, padding: 24, display: 'grid', gap: 12, boxShadow: '0 18px 44px rgba(127,29,29,0.08)' } as const;
const darkCard = { background: 'linear-gradient(135deg,#7F1D1D 0%,#991B1B 58%,#450A0A 120%)', color: '#fff', borderRadius: 26, padding: 20, display: 'grid', gap: 13, boxShadow: '0 18px 44px rgba(127,29,29,0.2)' } as const;
const card = { background: 'linear-gradient(180deg,#FFFFFF 0%,#F8FAFB 100%)', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 12, boxShadow: '0 14px 34px rgba(15,23,42,0.055)' } as const;
const cardInner = { background: 'linear-gradient(180deg,#FFFFFF 0%,#F8FAFB 100%)', border: '1px solid #E4E6EA', borderRadius: 20, padding: 14, display: 'grid', gap: 12, boxShadow: '0 10px 22px rgba(15,23,42,0.045)' } as const;
const metric = { background: 'linear-gradient(180deg,#FFFFFF 0%,#F8FAFB 100%)', border: '1px solid #E4E6EA', borderRadius: 20, padding: 16, boxShadow: '0 12px 28px rgba(15,23,42,0.055)' } as const;
const badge = { display: 'inline-flex', width: 'fit-content', padding: '7px 11px', borderRadius: 999, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.18)', color: '#B91C1C', fontSize: 12, fontWeight: 900 } as const;
const h1 = { margin: 0, color: '#0F1419', fontSize: 'clamp(30px,8vw,48px)', lineHeight: 1.03, letterSpacing: '-0.045em', fontWeight: 950 } as const;
const h2 = { margin: '6px 0 0', color: '#0F1419', fontSize: 20, lineHeight: 1.08, fontWeight: 950, letterSpacing: '-0.02em' } as const;
const lead = { margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.6 } as const;
const muted = { margin: '6px 0 0', color: '#64748B', fontSize: 13 } as const;
const rowHead = { display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' } as const;
const idText = { color: '#B91C1C', fontSize: 13, fontWeight: 950 } as const;
const micro = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' } as const;
const metricsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 } as const;
const grid2 = { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(120px,1fr))', gap: 8 } as const;
const cell = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 14, padding: 10, minWidth: 0, boxShadow: '0 8px 18px rgba(15,23,42,0.035)' } as const;
const actions = { display: 'flex', gap: 8, flexWrap: 'wrap' } as const;
const primaryBtn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#B91C1C', color: '#fff', fontSize: 14, fontWeight: 900, boxShadow: '0 14px 30px rgba(185,28,28,0.18)' } as const;
const ghostBtn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#fff', border: '1px solid #CBD5E1', color: '#0F1419', fontSize: 14, fontWeight: 850, boxShadow: '0 10px 24px rgba(15,23,42,0.06)' } as const;
const disputeCard = { textDecoration: 'none', color: 'inherit', background: 'linear-gradient(180deg,#FFFFFF 0%,#FEF2F2 100%)', border: '1px solid rgba(220,38,38,0.16)', borderRadius: 22, padding: 16, display: 'grid', gap: 10, boxShadow: '0 12px 30px rgba(127,29,29,0.07)' } as const;
const dangerPill = { display: 'inline-flex', width: 'fit-content', alignItems: 'center', padding: '7px 10px', borderRadius: 999, background: '#fff', border: '1px solid rgba(220,38,38,0.18)', color: '#B91C1C', fontSize: 12, fontWeight: 900 } as const;
const safePill = { display: 'inline-flex', width: 'fit-content', alignItems: 'center', padding: '7px 10px', borderRadius: 999, background: '#fff', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 12, fontWeight: 900 } as const;
const evidencePill = { display: 'inline-flex', width: 'fit-content', padding: '6px 9px', borderRadius: 999, background: '#fff', border: '1px solid #E4E6EA', color: '#475569', fontSize: 12, fontWeight: 850 } as const;
const missingEvidencePill = { display: 'inline-flex', width: 'fit-content', padding: '6px 9px', borderRadius: 999, background: '#fff', border: '1px solid rgba(220,38,38,0.22)', color: '#B91C1C', fontSize: 12, fontWeight: 900 } as const;
