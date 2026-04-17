import { Fragment } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CALLBACKS, DISPUTES, getDealById, type DealStatus } from '@/lib/v7r/data';
import { formatCompactMoney, formatMoney, statusLabel } from '@/lib/v7r/helpers';
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
  if (state === 'done') return { bg: '#0A7A5F', border: '#0A7A5F', text: '#0A7A5F', dot: '#fff', line: '#0A7A5F' };
  if (state === 'current') return { bg: '#2563EB', border: '#2563EB', text: '#2563EB', dot: '#fff', line: '#2563EB' };
  if (state === 'problem') return { bg: '#DC2626', border: '#DC2626', text: '#B91C1C', dot: '#fff', line: '#DC2626' };
  return { bg: '#F5F7F8', border: '#D5DAE1', text: '#8B95A7', dot: '#8B95A7', line: '#E4E6EA' };
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

export default function PlatformV7DealDetailPage({ params }: { params: { id: string } }) {
  const deal = getDealById(params.id);
  if (!deal) return notFound();
  const dispute = deal.dispute ? DISPUTES.find((d) => d.id === deal.dispute?.id) : null;
  const callbacks = CALLBACKS.filter((c) => c.dealId === deal.id);
  const bankCallback = callbacks[0] ?? null;

  const related: RelatedChip[] = [];
  if (deal.lotId) related.push({ label: 'Лот', value: deal.lotId, href: `/platform-v7/lot/${deal.lotId}`, tone: 'lot' });
  if (deal.routeId) related.push({ label: 'Маршрут', value: deal.routeId, href: '/platform-v7/logistics', tone: 'route' });
  related.push({ label: 'Приёмка', value: 'Элеватор', href: '/platform-v7/elevator', tone: 'reception' });
  related.push({ label: 'Лаборатория', value: 'Пробы', href: '/platform-v7/lab', tone: 'lab' });
  related.push({ label: 'Банк', value: bankCallback ? bankCallback.id : 'Контур', href: '/platform-v7/bank', tone: 'bank' });
  if (dispute) related.push({ label: 'Спор', value: dispute.id, href: `/platform-v7/disputes/${dispute.id}`, tone: 'dispute' });

  const currentStageIndex = Math.max(
    PIPELINE_STAGES.findIndex((stage) => stage.statuses.includes(deal.status)),
    0,
  );

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 12, color: '#6B778C', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Сделка</div>
            <div style={{ fontSize: 30, lineHeight: 1.1, fontWeight: 900, color: '#0F1419', marginTop: 8 }}>{deal.id}</div>
            <div style={{ fontSize: 14, color: '#6B778C', marginTop: 8 }}>{deal.grain} · {deal.quantity} {deal.unit} · {deal.seller.name} → {deal.buyer.name}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              <span style={{ display: 'inline-flex', borderRadius: 999, padding: '6px 10px', background: '#F8FAFB', border: '1px solid #E4E6EA', fontSize: 12, fontWeight: 800 }}>{statusLabel(deal.status)}</span>
              <RiskBadge score={deal.riskScore} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href="/platform-v7/deals" style={{ textDecoration: 'none', borderRadius: 12, padding: '10px 12px', border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontWeight: 700 }}>Все сделки</Link>
            <Link href="/platform-v7/bank" style={{ textDecoration: 'none', borderRadius: 12, padding: '10px 12px', border: '1px solid rgba(10,122,95,0.14)', background: 'rgba(10,122,95,0.08)', color: '#0A7A5F', fontWeight: 700 }}>Открыть банк</Link>
          </div>
        </div>
      </section>

      <section aria-label="Этапы сделки" style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
          <div style={{ fontSize: 12, color: '#6B778C', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Этапы сделки</div>
          <div style={{ fontSize: 12, color: '#6B778C' }}>Текущий: {statusLabel(deal.status)}</div>
        </div>
        <ol style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(120px, 1fr))', gap: 12, listStyle: 'none', padding: 0, margin: '16px 0 0', overflowX: 'auto' }}>
          {PIPELINE_STAGES.map((stage, stageIndex) => {
            const state = resolveStageState(stage, currentStageIndex, stageIndex, deal.status);
            const palette = stagePalette(state);
            const isLast = stageIndex === PIPELINE_STAGES.length - 1;
            const connectorState = state === 'done' ? 'done' : state === 'problem' ? 'problem' : state === 'current' ? 'current' : 'blocked';
            const connectorColor = connectorState === 'done' ? '#0A7A5F' : connectorState === 'problem' ? '#DC2626' : connectorState === 'current' ? '#2563EB' : '#E4E6EA';
            return (
              <li key={stage.key} style={{ minWidth: 120 }}>
                <div style={{ display: 'grid', justifyItems: 'center', textAlign: 'center', gap: 8 }}>
                  <div style={{ display: 'grid', placeItems: 'center', width: 42, height: 42, borderRadius: 999, background: palette.bg, border: `1px solid ${palette.border}`, color: palette.dot, fontSize: state === 'blocked' ? 14 : 18, fontWeight: 900, lineHeight: 1 }}>
                    {stageMarker(state)}
                  </div>
                  <div style={{ minHeight: 38, display: 'grid', alignContent: 'start', gap: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: palette.text, lineHeight: 1.25, wordBreak: 'break-word' }}>{stage.label}</div>
                    <div style={{ fontSize: 10, color: state === 'problem' ? '#B91C1C' : '#9AA4B2', textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.2 }}>
                      {stageCaption(state)}
                    </div>
                  </div>
                </div>
                {!isLast ? <span aria-hidden style={{ display: 'block', height: 4, background: connectorColor, borderRadius: 999, marginTop: 12 }} /> : <span aria-hidden style={{ display: 'block', height: 4, background: 'transparent', borderRadius: 999, marginTop: 12 }} />}
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-label="Связанные сущности" style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 12, color: '#6B778C', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Связанные сущности</div>
        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {related.map((chip, index) => {
            const tone = CHIP_TONES[chip.tone];
            return (
              <Fragment key={`${chip.label}-${chip.value}`}>
                {index > 0 ? <span aria-hidden style={{ color: '#9AA4B2', fontSize: 12 }}>→</span> : null}
                <Link
                  href={chip.href}
                  style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 999, background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color, fontSize: 12, fontWeight: 700 }}
                >
                  <span style={{ opacity: 0.72, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 10 }}>{chip.label}</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800 }}>{chip.value}</span>
                </Link>
              </Fragment>
            );
          })}
        </div>
        {deal.routeState ? (
          <div style={{ marginTop: 10, fontSize: 12, color: '#6B778C' }}>
            Маршрут: {deal.routeState}{deal.routeEta ? ` · ETA ${deal.routeEta}` : ''}
          </div>
        ) : null}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <Metric title="Резерв" value={formatCompactMoney(deal.reservedAmount)} subtitle="Подтверждено в контуре" />
        <Metric title="Удержание" value={formatCompactMoney(deal.holdAmount)} subtitle={deal.holdAmount ? 'Есть замороженная сумма' : 'Удержаний нет'} />
        <Metric title="К выпуску" value={formatCompactMoney(deal.releaseAmount ?? Math.max(deal.reservedAmount - deal.holdAmount, 0))} subtitle="После закрытия блокеров" />
        <Metric title="Блокеры" value={String(deal.blockers.length)} subtitle={deal.blockers.length ? deal.blockers.join(' · ') : 'Критичных стоп-факторов нет'} />
      </div>

      <DocumentsDropzone dealId={deal.id} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(320px,0.8fr)', gap: 16 }}>
        <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Timeline сделки</div>
          <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
            {(deal.events ?? []).map((event, index) => (
              <div key={`${event.ts}-${index}`} style={{ display: 'grid', gridTemplateColumns: '12px 1fr', gap: 12, alignItems: 'start' }}>
                <div style={{ width: 12, height: 12, borderRadius: 999, background: event.type === 'danger' ? '#DC2626' : event.type === 'success' ? '#0A7A5F' : '#2563EB', marginTop: 5 }} />
                <div style={{ border: '1px solid #E4E6EA', borderRadius: 14, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 800, color: '#0F1419' }}>{event.action}</div>
                    <div style={{ fontSize: 12, color: '#6B778C' }}>{new Date(event.ts).toLocaleString('ru-RU')}</div>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 13, color: '#6B778C' }}>{event.actor}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ display: 'grid', gap: 16 }}>
          <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Следующий шаг</div>
            <div style={{ marginTop: 12, fontSize: 16, fontWeight: 800, color: '#0F1419' }}>
              {deal.status === 'quality_disputed' ? 'Закрыть спор и снять hold' : deal.status === 'release_requested' ? 'Подтвердить выпуск в банке' : deal.status === 'docs_complete' ? 'Запросить выпуск денег' : 'Довести сделку до следующего этапа'}
            </div>
            <div style={{ marginTop: 8, fontSize: 13, color: '#6B778C' }}>{deal.blockers.length ? `Блокеры: ${deal.blockers.join(' · ')}` : 'Критичных блокеров нет.'}</div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Банк и callbacks</div>
            <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
              {callbacks.length ? callbacks.map((cb) => (
                <div key={cb.id} style={{ border: '1px solid #E4E6EA', borderRadius: 14, padding: 12 }}>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: 13 }}>{cb.id} · {cb.type}</div>
                  <div style={{ marginTop: 6, fontSize: 13, color: '#0F1419' }}>{cb.note}</div>
                  <div style={{ marginTop: 4, fontSize: 12, color: '#6B778C' }}>{cb.amountRub ? formatMoney(cb.amountRub) : '—'}</div>
                </div>
              )) : <div style={{ fontSize: 13, color: '#6B778C' }}>Банковый хвост по сделке пока не зафиксирован.</div>}
            </div>
          </div>

          {dispute ? (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 18, padding: 18 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#991B1B' }}>Открыт спор</div>
              <div style={{ marginTop: 8, fontSize: 14, color: '#991B1B' }}>{dispute.id} · {dispute.title}</div>
              <div style={{ marginTop: 6, fontSize: 13, color: '#7F1D1D' }}>{dispute.description}</div>
              <div style={{ marginTop: 10 }}><Link href={`/platform-v7/disputes/${dispute.id}`} style={{ textDecoration: 'none', fontWeight: 700, color: '#991B1B' }}>Открыть спор →</Link></div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function Metric({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
      <div style={{ fontSize: 11, color: '#6B778C', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 28, lineHeight: 1.1, fontWeight: 900, color: '#0F1419' }}>{value}</div>
      <div style={{ marginTop: 8, fontSize: 12, color: '#6B778C' }}>{subtitle}</div>
    </div>
  );
}
