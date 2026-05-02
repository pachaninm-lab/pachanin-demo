'use client';

import { selectRuntimeDeals, selectRuntimeDisputes } from '@/lib/domain/selectors';
import { formatCompactMoney } from '@/lib/v7r/helpers';

type EvidenceStatus = 'ready' | 'partial' | 'missing';

type EvidenceItem = {
  key: string;
  label: string;
  status: EvidenceStatus;
  source: string;
  detail: string;
};

const STATUS_LABEL: Record<EvidenceStatus, string> = {
  ready: 'Есть',
  partial: 'Частично',
  missing: 'Требует подключения',
};

function tone(status: EvidenceStatus) {
  if (status === 'ready') return { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' };
  if (status === 'partial') return { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' };
  return { bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.18)', color: '#64748B' };
}

export function EvidencePack() {
  const disputes = selectRuntimeDisputes();
  const deals = selectRuntimeDeals();
  const dispute = disputes.find((item) => item.status === 'open') ?? disputes[0];
  const deal = dispute ? deals.find((item) => item.id === dispute.dealId) : undefined;

  if (!dispute || !deal) {
    return (
      <section data-testid="platform-v7-evidence-pack" style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: '#0F1419' }}>Доказательства</div>
        <div style={{ marginTop: 6, fontSize: 13, color: '#64748B' }}>Открытых споров нет.</div>
      </section>
    );
  }

  const routeEvents = deal.route ?? [];
  const dealEvents = deal.events ?? [];
  const uploadedEvidence = dispute.evidence?.uploaded ?? 0;
  const totalEvidence = dispute.evidence?.total ?? 0;
  const hasGps = routeEvents.some((event) => Boolean(event.gps));
  const hasWeight = routeEvents.some((event) => event.event.toLowerCase().includes('взвеш'));
  const hasLab = dealEvents.some((event) => event.actor.toLowerCase().includes('лаб') || event.action.toLowerCase().includes('лаборатор'));
  const hasRoute = routeEvents.length > 0;
  const hasAudit = dealEvents.length > 0;

  const items: EvidenceItem[] = [
    {
      key: 'photos',
      label: 'Фото',
      status: uploadedEvidence > 0 ? 'partial' : 'missing',
      source: 'Полевой контур',
      detail: uploadedEvidence > 0 ? `${uploadedEvidence}/${totalEvidence} доказательств загружено` : 'Фото не переданы в текущем наборе данных',
    },
    {
      key: 'gps',
      label: 'GPS',
      status: hasGps ? 'ready' : 'missing',
      source: 'Рейс',
      detail: hasGps ? routeEvents.filter((event) => event.gps).map((event) => event.gps).join(' · ') : 'GPS требует подключения телематики',
    },
    {
      key: 'weight',
      label: 'Вес',
      status: hasWeight ? 'ready' : 'missing',
      source: 'Элеватор',
      detail: hasWeight ? routeEvents.find((event) => event.event.toLowerCase().includes('взвеш'))?.event ?? 'Вес зафиксирован' : 'Вес не найден в событиях рейса',
    },
    {
      key: 'seal',
      label: 'Пломба',
      status: 'missing',
      source: 'Водитель / элеватор',
      detail: 'Поле пломбы требует подключения или загрузки',
    },
    {
      key: 'lab',
      label: 'Лаборатория',
      status: hasLab ? 'ready' : 'partial',
      source: 'Лаборатория',
      detail: hasLab ? dealEvents.find((event) => event.actor.toLowerCase().includes('лаб') || event.action.toLowerCase().includes('лаборатор'))?.action ?? dispute.description : dispute.description,
    },
    {
      key: 'documents',
      label: 'Документы',
      status: deal.blockers.includes('docs') ? 'partial' : 'ready',
      source: 'Документный контур',
      detail: deal.blockers.includes('docs') ? 'Есть документная причина остановки' : 'Явной документной причины остановки нет',
    },
    {
      key: 'audit',
      label: 'Журнал действий',
      status: hasAudit ? 'ready' : 'missing',
      source: 'События сделки',
      detail: hasAudit ? `${dealEvents.length} событий в журнале сделки` : 'Журнал действий требует подключения',
    },
  ];

  return (
    <section data-testid="platform-v7-evidence-pack" style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, color: '#64748B', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>EvidencePack · доказательства спора</div>
          <div style={{ marginTop: 4, fontSize: 22, lineHeight: 1.12, fontWeight: 950, color: '#0F1419' }}>{dispute.id} · {dispute.title}</div>
          <div style={{ marginTop: 6, fontSize: 13, color: '#64748B', lineHeight: 1.55 }}>{deal.id} · сумма под риском {formatCompactMoney(dispute.holdAmount)} · решение нельзя скрывать от истории спора.</div>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '7px 10px', borderRadius: 999, border: '1px solid rgba(217,119,6,0.18)', background: 'rgba(217,119,6,0.08)', color: '#B45309', fontSize: 12, fontWeight: 900 }}>
          {uploadedEvidence}/{totalEvidence} загружено
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
        {items.map((item) => {
          const t = tone(item.status);
          return (
            <div key={item.key} style={{ border: '1px solid #EEF1F4', borderRadius: 14, padding: 12, background: '#F8FAFB', display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: '#0F1419' }}>{item.label}</div>
                  <div style={{ marginTop: 3, fontSize: 11, color: '#64748B' }}>{item.source}</div>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 7px', borderRadius: 999, background: t.bg, border: `1px solid ${t.border}`, color: t.color, fontSize: 11, fontWeight: 900 }}>{STATUS_LABEL[item.status]}</span>
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.45, color: '#334155' }}>{item.detail}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
