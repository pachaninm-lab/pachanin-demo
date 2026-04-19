import { Fragment } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CALLBACKS, DISPUTES, getDealById, getDealIntegrationState, type DealStatus, type IntegrationGateState } from '@/lib/v7r/data';
import { formatCompactMoney, formatMoney, statusLabel } from '@/lib/v7r/helpers';
import { translateRole, translateStatus } from '@/lib/i18n/reason-codes';
import { RiskBadge } from '@/components/v7r/RiskBadge';
import { DocumentsDropzone } from '@/components/v7r/DocumentsDropzone';

interface RelatedChip {
  label: string;
  value: string;
  href: string;
  tone: 'lot' | 'route' | 'reception' | 'lab' | 'bank' | 'dispute';
}

const CHIP_TONES: Record<RelatedChip['tone'], { bg: string; border: string; color: string }> = {
  lot: { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' },
  route: { bg: 'rgba(37,99,235,0.08)', border: 'rgba(37,99,235,0.18)', color: '#2563EB' },
  reception: { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' },
  lab: { bg: 'rgba(147,51,234,0.08)', border: 'rgba(147,51,234,0.18)', color: '#7E22CE' },
  bank: { bg: 'rgba(22,163,74,0.08)', border: 'rgba(22,163,74,0.18)', color: '#15803D' },
  dispute: { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)', color: '#B91C1C' },
};

interface PipelineStage {
  key: string;
  label: string;
  statuses: DealStatus[];
}

type PipelineVisualState = 'done' | 'current' | 'blocked' | 'problem';

const PIPELINE_STAGES: PipelineStage[] = [
  { key: 'contract', label: 'Контракт', statuses: ['draft', 'contract_signed'] },
  { key: 'payment', label: 'Резерв', statuses: ['payment_reserved'] },
  { key: 'logistics', label: 'Логистика', statuses: ['loading_scheduled', 'loading_started', 'loading_done', 'in_transit', 'arrived'] },
  { key: 'acceptance', label: 'Приёмка', statuses: ['unloading_started', 'unloading_done'] },
  { key: 'quality', label: 'Качество', statuses: ['quality_check', 'quality_approved', 'quality_disputed'] },
  { key: 'release', label: 'Выплата', statuses: ['docs_complete', 'release_requested', 'release_approved', 'closed'] },
];

function resolveStageState(stage: PipelineStage, currentIndex: number, stageIndex: number, status: DealStatus): PipelineVisualState {
  if (status === 'quality_disputed') {
    if (stage.key === 'quality') return 'problem';
    if (stageIndex < currentIndex) return 'done';
    return 'blocked';
  }
  if (stage.statuses.includes(status)) return 'current';
  if (stageIndex < currentIndex) return 'done';
  return 'blocked';
}

function stagePalette(state: PipelineVisualState) {
  if (state === 'done') return { bg: '#0A7A5F', border: '#0A7A5F', text: '#0A7A5F', surface: 'rgba(10,122,95,0.06)', dot: '#fff' };
  if (state === 'current') return { bg: '#2563EB', border: '#2563EB', text: '#2563EB', surface: 'rgba(37,99,235,0.06)', dot: '#fff' };
  if (state === 'problem') return { bg: '#DC2626', border: '#DC2626', text: '#B91C1C', surface: 'rgba(220,38,38,0.06)', dot: '#fff' };
  return { bg: '#F5F7F8', border: '#D5DAE1', text: '#8B95A7', surface: '#F8FAFB', dot: '#8B95A7' };
}

function stageCaption(state: PipelineVisualState) {
  if (state === 'done') return 'Пройден';
  if (state === 'current') return 'В работе';
  if (state === 'problem') return 'Проблема';
  return 'Заблокирован';
}

function stageMarker(state: PipelineVisualState) {
  if (state === 'done') return '✓';
  if (state === 'problem') return '!';
  if (state === 'blocked') return '⛔';
  return '●';
}

function gateBadge(state: IntegrationGateState) {
  if (state === 'PASS') return { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F', label: 'ФГИС / ЕСИА: ок' };
  if (state === 'REVIEW') return { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309', label: 'ФГИС / ЕСИА: проверка' };
  return { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)', color: '#B91C1C', label: 'ФГИС / ЕСИА: стоп' };
}

function describeBlocker(code: string) {
  switch (code) {
    case 'dispute':
      return 'Открыт спор по качеству или весу';
    case 'docs':
    case 'DOCS_MISSING':
      return 'Не хватает документов для выпуска денег';
    case 'bank_confirm':
      return 'Банк ещё не подтвердил выпуск';
    case 'lab_result':
      return 'Нет финального лабораторного результата';
    case 'reserve':
      return 'Резерв средств ещё не подтверждён';
    case 'FGIS_GATE_FAIL':
      return 'ФГИС не подтвердил партию';
    case 'ESIA_LINK_MISSING':
      return 'Нет связи с ЕСИА';
    case 'BANK_REVIEW_PENDING':
      return 'Банк отправил сделку на ручную проверку';
    case 'DISPUTE_OPEN':
      return 'Спор не закрыт';
    case 'SYNC_CONFIRM_REQUIRED':
      return 'Нужна финальная сверка данных';
    case 'QUALITY_DISPUTE':
      return 'Есть спор по качеству';
    case 'ESIA_REAUTH_REQUIRED':
      return 'Нужно повторно подтвердить ЕСИА';
    default:
      return code;
  }
}

function primaryActionForDeal(status: DealStatus, dealId: string, disputeId?: string | null) {
  if (status === 'quality_disputed' && disputeId) return { label: 'Решить спор', href: `/platform-v7/disputes/${disputeId}` };
  if (status === 'release_requested' || status === 'docs_complete') return { label: 'Открыть банк', href: '/platform-v7/bank' };
  return { label: 'Открыть действие', href: `/platform-v7/deals/${dealId}#next-action` };
}

export default function PlatformV7DealDetailPage({ params }: { params: { id: string } }) {
  const deal = getDealById(params.id);
  if (!deal) return notFound();

  const dispute = deal.dispute ? DISPUTES.find((d) => d.id === deal.dispute?.id) : null;
  const callbacks = CALLBACKS.filter((c) => c.dealId === deal.id);
  const bankCallback = callbacks[0] ?? null;
  const integration = getDealIntegrationState(deal.id, deal.lotId);
  const gate = gateBadge(integration.gateState);
  const releasableAmount = integration.gateState === 'FAIL' ? 0 : (deal.releaseAmount ?? Math.max(deal.reservedAmount - deal.holdAmount, 0));
  const currentStageIndex = Math.max(PIPELINE_STAGES.findIndex((stage) => stage.statuses.includes(deal.status)), 0);
  const blockerTexts = [...new Set([...deal.blockers, ...integration.reasonCodes].map(describeBlocker))];
  const primaryAction = primaryActionForDeal(deal.status, deal.id, dispute?.id);
  const nextStepTitle = integration.nextStep ?? (deal.status === 'quality_disputed'
    ? 'Закрыть спор и снять удержание'
    : deal.status === 'release_requested'
      ? 'Подтвердить выпуск в банке'
      : deal.status === 'docs_complete'
        ? 'Запросить выпуск денег'
        : 'Довести сделку до следующего этапа');
  const problemSummary = [
    dispute ? dispute.title : null,
    integration.gateState === 'FAIL' ? 'Интеграционный контур блокирует выпуск денег' : null,
    integration.reasonCodes.includes('ESIA_LINK_MISSING') ? 'Нет связи с ЕСИА' : null,
    integration.reasonCodes.includes('FGIS_GATE_FAIL') ? 'ФГИС не подтвердил партию' : null,
    integration.reasonCodes.includes('DOCS_MISSING') ? 'Не хватает документов' : null,
  ].filter(Boolean) as string[];

  const related: RelatedChip[] = [];
  if (deal.lotId) related.push({ label: 'Лот', value: deal.lotId, href: `/platform-v7/lot/${deal.lotId}`, tone: 'lot' });
  if (deal.routeId) related.push({ label: 'Маршрут', value: deal.routeId, href: '/platform-v7/logistics', tone: 'route' });
  related.push({ label: 'Приёмка', value: 'Элеватор', href: '/platform-v7/elevator', tone: 'reception' });
  related.push({ label: 'Лаборатория', value: 'Пробы', href: '/platform-v7/lab', tone: 'lab' });
  related.push({ label: 'Банк', value: bankCallback ? bankCallback.id : 'Контур', href: '/platform-v7/bank', tone: 'bank' });
  if (dispute) related.push({ label: 'Спор', value: dispute.id, href: `/platform-v7/disputes/${dispute.id}`, tone: 'dispute' });

  return (
    <>
      <style>{`
        .deal-page{display:grid;gap:16px;padding-bottom:104px;max-width:100%;overflow-x:hidden}
        .surface{background:#fff;border:1px solid #E4E6EA;border-radius:18px;padding:18px;max-width:100%;overflow:hidden}
        .eyebrow{font-size:12px;color:#6B778C;font-weight:800;text-transform:uppercase;letter-spacing:.06em}
        .hero{display:grid;gap:16px}
        .hero-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}
        .hero-title{font-size:34px;line-height:1;font-weight:900;color:#0F1419;margin-top:8px;word-break:break-word}
        .hero-meta{font-size:14px;color:#6B778C;margin-top:8px;word-break:break-word}
        .badge-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
        .pill{display:inline-flex;align-items:center;border-radius:999px;padding:6px 10px;font-size:12px;font-weight:800;border:1px solid #E4E6EA;background:#F8FAFB;color:#0F1419;max-width:100%;word-break:break-word}
        .hero-actions{display:flex;gap:8px;flex-wrap:wrap}
        .btn{display:inline-flex;justify-content:center;align-items:center;text-decoration:none;border-radius:14px;padding:12px 14px;font-weight:800;font-size:14px;min-height:48px;max-width:100%;text-align:center}
        .btn-secondary{border:1px solid #E4E6EA;background:#fff;color:#0F1419}
        .btn-primary{border:1px solid rgba(10,122,95,0.14);background:#0A7A5F;color:#fff}
        .decision-grid{display:grid;gap:14px;grid-template-columns:repeat(12,minmax(0,1fr))}
        .decision-main{grid-column:span 7;display:grid;gap:14px}
        .decision-side{grid-column:span 5;display:grid;gap:14px}
        .action-card{background:linear-gradient(180deg,rgba(10,122,95,0.06),rgba(10,122,95,0.02));border:1px solid rgba(10,122,95,0.18);border-radius:18px;padding:18px;display:grid;gap:14px}
        .action-title{font-size:24px;line-height:1.15;font-weight:900;color:#0F1419;word-break:break-word}
        .action-meta{display:grid;gap:8px;color:#475569;font-size:14px}
        .summary-grid{display:grid;gap:12px;grid-template-columns:repeat(4,minmax(0,1fr))}
        .summary-card{border:1px solid #E4E6EA;border-radius:16px;padding:14px;background:#fff}
        .summary-title{font-size:11px;color:#6B778C;font-weight:800;text-transform:uppercase;letter-spacing:.06em}
        .summary-value{font-size:28px;line-height:1.05;font-weight:900;color:#0F1419;margin-top:8px;word-break:break-word}
        .summary-note{font-size:12px;color:#6B778C;margin-top:6px;line-height:1.4;word-break:break-word}
        .problem-card{background:#FEF2F2;border:1px solid #FECACA;border-radius:18px;padding:16px;display:grid;gap:10px}
        .problem-title{font-size:16px;font-weight:900;color:#991B1B}
        .problem-list{display:grid;gap:8px;margin:0;padding:0;list-style:none}
        .problem-item{display:flex;gap:8px;align-items:flex-start;color:#7F1D1D;font-size:13px;line-height:1.45}
        .problem-dot{display:inline-flex;justify-content:center;align-items:center;width:18px;height:18px;border-radius:999px;background:#DC2626;color:#fff;font-size:11px;font-weight:900;flex:0 0 18px;margin-top:1px}
        .owner-card{display:grid;gap:12px}
        .owner-value{font-size:24px;font-weight:900;color:#0F1419;line-height:1.1}
        .owner-note{font-size:13px;color:#6B778C;line-height:1.45}
        .mini-grid{display:grid;gap:12px;grid-template-columns:repeat(2,minmax(0,1fr))}
        .mini-cell{border:1px solid #E4E6EA;border-radius:14px;padding:12px;background:#fff}
        .mini-label{font-size:11px;color:#6B778C;text-transform:uppercase;letter-spacing:.06em;font-weight:800}
        .mini-value{margin-top:6px;font-size:14px;font-weight:800;color:#0F1419;word-break:break-word}
        .mini-note{margin-top:6px;font-size:12px;color:#6B778C;line-height:1.45}
        .stage-stack{display:grid;gap:12px}
        .stage-row{display:grid;grid-template-columns:44px 1fr;gap:12px;align-items:start;padding:12px;border:1px solid #E4E6EA;border-radius:16px;background:#fff}
        .stage-icon{display:grid;place-items:center;width:44px;height:44px;border-radius:999px;font-size:18px;font-weight:900;line-height:1}
        .stage-row-header{display:flex;justify-content:space-between;gap:8px;align-items:flex-start;flex-wrap:wrap}
        .stage-label{font-size:15px;font-weight:800;line-height:1.2}
        .stage-caption{font-size:11px;text-transform:uppercase;letter-spacing:.05em;font-weight:800;margin-top:4px}
        .stage-line{font-size:13px;color:#6B778C;line-height:1.45;margin-top:6px}
        .desktop-stage-grid{display:grid;grid-template-columns:repeat(6,minmax(120px,1fr));gap:12px;list-style:none;padding:0;margin:16px 0 0;overflow-x:auto}
        .desktop-stage-grid li{min-width:120px}
        .chip-flow{margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
        .chip-link{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;text-decoration:none;font-size:12px;font-weight:700;max-width:100%;word-break:break-word}
        .desktop-only{display:block}
        .mobile-only{display:none}
        .timeline-layout{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(320px,.9fr);gap:16px}
        .timeline-list{display:grid;gap:12px;margin-top:14px}
        .timeline-item{display:grid;grid-template-columns:12px 1fr;gap:12px;align-items:start}
        .timeline-dot{width:12px;height:12px;border-radius:999px;margin-top:5px}
        .timeline-card{border:1px solid #E4E6EA;border-radius:14px;padding:12px;max-width:100%;overflow:hidden}
        .sticky-action{position:fixed;left:0;right:0;bottom:0;z-index:30;padding:10px 12px calc(10px + env(safe-area-inset-bottom));background:rgba(255,255,255,.94);backdrop-filter:blur(14px);border-top:1px solid #E4E6EA}
        .sticky-inner{max-width:1280px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center}
        .sticky-label{font-size:12px;color:#6B778C;font-weight:700;line-height:1.3}
        .sticky-title{font-size:14px;font-weight:900;color:#0F1419;line-height:1.25;margin-top:2px}
        @media (max-width: 1100px){.decision-main,.decision-side{grid-column:span 12}.timeline-layout{grid-template-columns:1fr}}
        @media (max-width: 768px){.surface{padding:16px;border-radius:16px}.hero-title{font-size:28px}.hero-actions{width:100%}.hero-actions .btn{flex:1 1 calc(50% - 4px)}.summary-grid{grid-template-columns:1fr 1fr}.mini-grid{grid-template-columns:1fr 1fr}.desktop-only{display:none}.mobile-only{display:block}.timeline-layout{gap:12px}.sticky-inner{grid-template-columns:1fr}.sticky-inner .btn{width:100%}}
        @media (max-width: 560px){.deal-page{gap:12px;padding-bottom:112px}.hero-top{display:grid}.hero-actions .btn{flex:1 1 100%}.action-card{padding:16px;gap:12px}.action-title{font-size:20px}.mini-grid{grid-template-columns:1fr}.owner-value{font-size:22px}.summary-value{font-size:26px}.chip-flow{overflow:auto hidden;flex-wrap:nowrap;padding-bottom:2px;margin-right:-4px}.chip-link{white-space:nowrap}}
      `}</style>

      <div className="deal-page">
        <section className="surface hero">
          <div className="hero-top">
            <div>
              <div className="eyebrow">Сделка</div>
              <div className="hero-title">{deal.id}</div>
              <div className="hero-meta">{deal.grain} · {deal.quantity} {deal.unit} · {deal.seller.name} → {deal.buyer.name}</div>
              <div className="badge-row">
                <span className="pill">{statusLabel(deal.status)}</span>
                <span className="pill" style={{ background: gate.bg, borderColor: gate.border, color: gate.color }}>{gate.label}</span>
                <RiskBadge score={deal.riskScore} />
              </div>
            </div>
            <div className="hero-actions">
              <Link href="/platform-v7/deals" className="btn btn-secondary">Все сделки</Link>
              <Link href={primaryAction.href} className="btn btn-primary">{primaryAction.label}</Link>
            </div>
          </div>
        </section>

        <section className="surface">
          <div className="eyebrow">Деньги и статус</div>
          <div className="summary-grid" style={{ marginTop: 12 }}>
            <SummaryCard title="Удержано" value={formatCompactMoney(deal.holdAmount)} note={deal.holdAmount ? 'Деньги заморожены до закрытия причины.' : 'Замороженной суммы нет.'} />
            <SummaryCard title="К выпуску" value={formatCompactMoney(releasableAmount)} note={integration.gateState === 'FAIL' ? 'Пока выпуск заблокирован.' : integration.gateState === 'REVIEW' ? 'Нужна ручная проверка.' : 'Можно выпускать после закрытия блокеров.'} />
            <SummaryCard title="Резерв" value={formatCompactMoney(deal.reservedAmount)} note="Деньги подтверждены в банковом контуре." />
            <SummaryCard title="Следующий владелец" value={integration.nextOwner ? translateRole(integration.nextOwner) : '—'} note={integration.nextStep ?? 'Следующее действие не определено.'} />
          </div>
        </section>

        <section className="decision-grid">
          <div className="decision-main">
            <section id="next-action" className="action-card">
              <div>
                <div className="eyebrow" style={{ color: '#0A7A5F' }}>Следующее действие</div>
                <div className="action-title">{nextStepTitle}</div>
              </div>
              <div className="action-meta">
                <div><strong>Что мешает сейчас:</strong> {blockerTexts.join(' · ') || 'Критичных блокеров нет'}</div>
                <div><strong>После выполнения:</strong> будет доступно к выпуску {formatMoney(releasableAmount)}</div>
              </div>
            </section>

            <section className="surface mobile-only">
              <div className="eyebrow">Этапы сделки</div>
              <div className="stage-stack" style={{ marginTop: 12 }}>
                {PIPELINE_STAGES.map((stage, stageIndex) => {
                  const state = resolveStageState(stage, currentStageIndex, stageIndex, deal.status);
                  const palette = stagePalette(state);
                  return (
                    <div key={stage.key} className="stage-row" style={{ background: palette.surface }}>
                      <div className="stage-icon" style={{ background: palette.bg, border: `1px solid ${palette.border}`, color: palette.dot }}>{stageMarker(state)}</div>
                      <div>
                        <div className="stage-row-header">
                          <div>
                            <div className="stage-label" style={{ color: palette.text }}>{stage.label}</div>
                            <div className="stage-caption" style={{ color: palette.text }}>{stageCaption(state)}</div>
                          </div>
                        </div>
                        <div className="stage-line">
                          {state === 'problem' ? 'Требуется ручное действие, спор или подтверждение.' : state === 'current' ? 'Это текущий активный этап сделки.' : state === 'done' ? 'Этап подтверждён и пройден.' : 'Этап не может начаться, пока не закрыты блокеры выше.'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="surface desktop-only" aria-label="Этапы сделки">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
                <div className="eyebrow">Этапы сделки</div>
                <div style={{ fontSize: 12, color: '#6B778C' }}>Текущий: {statusLabel(deal.status)}</div>
              </div>
              <ol className="desktop-stage-grid">
                {PIPELINE_STAGES.map((stage, stageIndex) => {
                  const state = resolveStageState(stage, currentStageIndex, stageIndex, deal.status);
                  const palette = stagePalette(state);
                  const isLast = stageIndex === PIPELINE_STAGES.length - 1;
                  const connectorColor = state === 'done' ? '#0A7A5F' : state === 'problem' ? '#DC2626' : state === 'current' ? '#2563EB' : '#E4E6EA';
                  return (
                    <li key={stage.key}>
                      <div style={{ display: 'grid', justifyItems: 'center', textAlign: 'center', gap: 8 }}>
                        <div style={{ display: 'grid', placeItems: 'center', width: 42, height: 42, borderRadius: 999, background: palette.bg, border: `1px solid ${palette.border}`, color: palette.dot, fontSize: state === 'blocked' ? 14 : 18, fontWeight: 900, lineHeight: 1 }}>{stageMarker(state)}</div>
                        <div style={{ minHeight: 38, display: 'grid', alignContent: 'start', gap: 4 }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: palette.text, lineHeight: 1.25, wordBreak: 'break-word' }}>{stage.label}</div>
                          <div style={{ fontSize: 10, color: state === 'problem' ? '#B91C1C' : '#9AA4B2', textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.2 }}>{stageCaption(state)}</div>
                        </div>
                      </div>
                      <span aria-hidden style={{ display: 'block', height: 4, background: isLast ? 'transparent' : connectorColor, borderRadius: 999, marginTop: 12 }} />
                    </li>
                  );
                })}
              </ol>
            </section>
          </div>

          <div className="decision-side">
            <section className="problem-card">
              <div className="problem-title">Почему выпуск заблокирован</div>
              <ul className="problem-list">
                {(problemSummary.length ? problemSummary : ['Критичных причин нет.']).map((item) => (
                  <li key={item} className="problem-item"><span className="problem-dot">!</span><span>{item}</span></li>
                ))}
              </ul>
            </section>

            <section className="surface owner-card">
              <div>
                <div className="eyebrow">Следующий владелец</div>
                <div className="owner-value">{integration.nextOwner ? translateRole(integration.nextOwner) : '—'}</div>
                <div className="owner-note">{integration.nextStep ?? 'Действие не определено.'}</div>
              </div>
              <div className="mini-grid">
                <MiniCell label="Источник" value={integration.sourceType === 'FGIS' ? 'ФГИС' : 'Ручной контур'} note={integration.sourceReference ?? 'Без номера партии'} />
                <MiniCell label="ФГИС" value={translateStatus(integration.fgisState)} note="Статус регуляторного контура" />
                <MiniCell label="ЕСИА" value={translateStatus(integration.esiaState)} note="Статус связки учётной записи" />
                <MiniCell label="Риск" value={String(deal.riskScore)} note="Суммарный риск сделки" />
              </div>
              <div className="badge-row" style={{ marginTop: 0 }}>
                {blockerTexts.length ? blockerTexts.map((text) => <span key={text} className="pill" style={{ color: '#475569' }}>{text}</span>) : <span style={{ fontSize: 12, color: '#6B778C' }}>Критичных причин нет.</span>}
              </div>
            </section>
          </div>
        </section>

        <section className="surface" aria-label="Связанные сущности">
          <div className="eyebrow">Связанные сущности</div>
          <div className="chip-flow">
            {related.map((chip, index) => {
              const tone = CHIP_TONES[chip.tone];
              return (
                <Fragment key={`${chip.label}-${chip.value}`}>
                  {index > 0 ? <span aria-hidden style={{ color: '#9AA4B2', fontSize: 12 }}>→</span> : null}
                  <Link href={chip.href} className="chip-link" style={{ background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color }}>
                    <span style={{ opacity: 0.72, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 10 }}>{chip.label}</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800 }}>{chip.value}</span>
                  </Link>
                </Fragment>
              );
            })}
          </div>
          {deal.routeState ? <div style={{ marginTop: 10, fontSize: 12, color: '#6B778C', wordBreak: 'break-word' }}>Маршрут: {deal.routeState}{deal.routeEta ? ` · ETA ${deal.routeEta}` : ''}</div> : null}
        </section>

        <DocumentsDropzone dealId={deal.id} />

        <div className="timeline-layout">
          <section className="surface">
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Ход сделки</div>
            <div className="timeline-list">
              {(deal.events ?? []).map((event, index) => (
                <div key={`${event.ts}-${index}`} className="timeline-item">
                  <div className="timeline-dot" style={{ background: event.type === 'danger' ? '#DC2626' : event.type === 'success' ? '#0A7A5F' : '#2563EB' }} />
                  <div className="timeline-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ fontWeight: 800, color: '#0F1419', wordBreak: 'break-word' }}>{event.action}</div>
                      <div suppressHydrationWarning style={{ fontSize: 12, color: '#6B778C' }}>{new Date(event.ts).toLocaleString('ru-RU')}</div>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 13, color: '#6B778C', wordBreak: 'break-word' }}>{event.actor}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section style={{ display: 'grid', gap: 16 }}>
            <div className="surface">
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Банк и события</div>
              <div style={{ fontSize: 12, color: '#6B778C', marginTop: 6, wordBreak: 'break-word' }}>{integration.gateState === 'FAIL' ? 'Выпуск денег заблокирован до снятия причин в ФГИС / ЕСИА.' : integration.gateState === 'REVIEW' ? 'Банк требует ручной проверки перед выпуском.' : 'Интеграционный контур не блокирует банк.'}</div>
              <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                {callbacks.length ? callbacks.map((cb) => (
                  <div key={cb.id} style={{ border: '1px solid #E4E6EA', borderRadius: 14, padding: 12, maxWidth: '100%', overflow: 'hidden' }}>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: 13, wordBreak: 'break-word' }}>{cb.id} · {cb.type === 'Reserve' ? 'Резерв' : cb.type === 'Mismatch' ? 'Расхождение' : cb.type === 'Release' ? 'Выпуск' : cb.type}</div>
                    <div style={{ marginTop: 6, fontSize: 13, color: '#0F1419', wordBreak: 'break-word' }}>{cb.note}</div>
                    <div style={{ marginTop: 4, fontSize: 12, color: '#6B778C' }}>{cb.amountRub ? formatMoney(cb.amountRub) : '—'}</div>
                  </div>
                )) : <div style={{ fontSize: 13, color: '#6B778C' }}>Банковый контур по сделке пока не зафиксировал событий.</div>}
              </div>
            </div>

            {dispute ? (
              <div className="problem-card">
                <div className="problem-title">Открыт спор</div>
                <div style={{ fontSize: 14, color: '#991B1B', fontWeight: 800, wordBreak: 'break-word' }}>{dispute.id} · {dispute.title}</div>
                <div style={{ fontSize: 13, color: '#7F1D1D', lineHeight: 1.45, wordBreak: 'break-word' }}>{dispute.description}</div>
                <div>
                  <Link href={`/platform-v7/disputes/${dispute.id}`} style={{ color: '#991B1B', fontWeight: 700, fontSize: 13, textDecoration: 'underline' }}>Подробнее →</Link>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>

      <div className="sticky-action">
        <div className="sticky-inner">
          <div>
            <div className="sticky-label">Следующее действие</div>
            <div className="sticky-title">{nextStepTitle}</div>
          </div>
          <Link href={primaryAction.href} className="btn btn-primary">{primaryAction.label}</Link>
        </div>
      </div>
    </>
  );
}

function SummaryCard({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <div className="summary-card">
      <div className="summary-title">{title}</div>
      <div className="summary-value">{value}</div>
      <div className="summary-note">{note}</div>
    </div>
  );
}

function MiniCell({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="mini-cell">
      <div className="mini-label">{label}</div>
      <div className="mini-value">{value}</div>
      <div className="mini-note">{note}</div>
    </div>
  );
}
