import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '../../../components/app-shell';
import { Breadcrumbs } from '../../../components/breadcrumbs';
import { PageAccessGuard } from '../../../components/page-access-guard';
import { TRANSACTIONAL_ROLES } from '../../../lib/route-roles';
import { apiServer } from '../../../lib/api-server';

type Evidence = { id: string; type: string; description: string; addedBy: string; addedAt: string };
type TimelineEvent = { at: string; actor: string; action: string; note?: string };

type Dispute = {
  id: string; dealId: string; status: string; type: string;
  claimAmountRub: number; description: string; severity: string;
  createdAt: string; owner?: string; slaMinutes?: number;
  resolution?: string; reasonCode?: string;
  evidence?: Evidence[];
  timeline?: TimelineEvent[];
};

const SEED: Record<string, Dispute> = {
  'DISPUTE-001': {
    id: 'DISPUTE-001', dealId: 'DEAL-001', status: 'UNDER_REVIEW', type: 'quality',
    claimAmountRub: 127500, description: 'Влажность зерна 15.2% вместо заявленных 13% по договору',
    severity: 'MEDIUM', createdAt: '2026-04-01T14:00:00Z',
    owner: 'operator@demo.ru', slaMinutes: 180,
    evidence: [
      { id: 'EV-001', type: 'LAB_PROTOCOL', description: 'Протокол лаборатории АПФ №12-2026', addedBy: 'lab@demo.ru', addedAt: '2026-04-01T16:00:00Z' },
      { id: 'EV-002', type: 'PHOTO', description: 'Фото партии при разгрузке', addedBy: 'buyer@demo.ru', addedAt: '2026-04-02T09:00:00Z' },
    ],
    timeline: [
      { at: '2026-04-01T14:00:00Z', actor: 'buyer@demo.ru', action: 'OPENED', note: 'Инициирован спор по качеству' },
      { at: '2026-04-01T14:30:00Z', actor: 'system', action: 'OWNER_ASSIGNED', note: 'Назначен operator@demo.ru, SLA 180 мин' },
      { at: '2026-04-01T16:00:00Z', actor: 'lab@demo.ru', action: 'EVIDENCE_ATTACHED', note: 'Добавлен протокол лаборатории' },
      { at: '2026-04-02T09:00:00Z', actor: 'operator@demo.ru', action: 'UNDER_REVIEW', note: 'Спор взят в работу' },
    ],
  },
  'DISPUTE-002': {
    id: 'DISPUTE-002', dealId: 'DEAL-002', status: 'OPEN', type: 'weight',
    claimAmountRub: 86250, description: 'Расхождение веса на 7.5 тонн по весовой квитанции элеватора',
    severity: 'HIGH', createdAt: '2026-04-03T09:00:00Z',
    slaMinutes: 30,
    evidence: [
      { id: 'EV-003', type: 'WEIGHBRIDGE_RECEIPT', description: 'Весовая квитанция элеватора №WB-0347', addedBy: 'elevator@demo.ru', addedAt: '2026-04-03T09:30:00Z' },
    ],
    timeline: [
      { at: '2026-04-03T09:00:00Z', actor: 'farmer@demo.ru', action: 'OPENED', note: 'Инициирован спор по весу' },
      { at: '2026-04-03T09:30:00Z', actor: 'elevator@demo.ru', action: 'EVIDENCE_ATTACHED', note: 'Добавлена весовая квитанция' },
    ],
  },
};

const SEVERITY_COLOR: Record<string, string> = { HIGH: 'red', CRITICAL: 'red', MEDIUM: 'amber', LOW: 'gray' };
const STATUS_RU: Record<string, string> = {
  OPEN: 'Открыт', UNDER_REVIEW: 'На рассмотрении', EXPERTISE: 'Экспертиза',
  DECISION: 'Решение принято', RESOLVED: 'Решён', CLOSED: 'Закрыт',
};
const EVIDENCE_TYPE_RU: Record<string, string> = {
  LAB_PROTOCOL: 'Протокол лаборатории', PHOTO: 'Фотоматериал',
  WEIGHBRIDGE_RECEIPT: 'Весовая квитанция', DOCUMENT: 'Документ', OTHER: 'Прочее',
};

async function load(id: string): Promise<Dispute | null> {
  try {
    const res = await apiServer(`/disputes/${id}`);
    return res?.id ? res : SEED[id] ?? null;
  } catch {
    return SEED[id] ?? null;
  }
}

export default async function DisputeDetailPage({ params }: { params: { id: string } }) {
  const dispute = await load(params.id);
  if (!dispute) notFound();

  const slaOk = dispute.slaMinutes && dispute.slaMinutes > 0;

  return (
    <PageAccessGuard allowedRoles={[...TRANSACTIONAL_ROLES]}
      title="Доступ к спору ограничен"
      subtitle="Детали спора доступны участникам сделки и операционным ролям.">
      <AppShell title={`Спор ${dispute.id}`} subtitle={`Сделка ${dispute.dealId} · ${STATUS_RU[dispute.status] || dispute.status}`}>
        <div className="space-y-6">
          <Breadcrumbs items={[
            { href: '/', label: 'Главная' },
            { href: '/disputes', label: 'Споры' },
            { label: dispute.id },
          ]} />

          {/* Header card */}
          <div className="soft-box">
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              <span className={`mini-chip ${SEVERITY_COLOR[dispute.severity] || 'gray'}`}>{dispute.severity}</span>
              <span className="mini-chip">{STATUS_RU[dispute.status] || dispute.status}</span>
              <span className="mini-chip">{dispute.type === 'quality' ? 'Качество' : dispute.type === 'weight' ? 'Вес' : dispute.type}</span>
            </div>
            <h2 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 6 }}>{dispute.description}</h2>
            <div className="muted small">
              Претензия: <b>{Number(dispute.claimAmountRub).toLocaleString('ru-RU')} ₽</b>
              {' · '}Сделка: <Link href={`/deals/${dispute.dealId}`} className="mini-chip">{dispute.dealId}</Link>
            </div>
            <div className="muted tiny" style={{ marginTop: 6 }}>
              Открыт: {new Date(dispute.createdAt).toLocaleDateString('ru-RU')}
              {dispute.owner
                ? ` · Owner: ${dispute.owner}`
                : <span style={{ color: 'var(--color-red, #ef4444)' }}> · Owner не назначен ⚠</span>}
              {slaOk ? ` · SLA: ${dispute.slaMinutes} мин` : ''}
            </div>
            {dispute.resolution && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--color-green-soft, #f0fdf4)', borderRadius: 6 }}>
                <b>Решение:</b> {dispute.resolution}
                {dispute.reasonCode ? ` (${dispute.reasonCode})` : ''}
              </div>
            )}
          </div>

          {/* Evidence base */}
          <div>
            <h3 className="section-title" style={{ marginBottom: 8 }}>Доказательная база</h3>
            {dispute.evidence && dispute.evidence.length > 0 ? (
              <div className="section-stack">
                {dispute.evidence.map((ev) => (
                  <div key={ev.id} className="soft-box" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{EVIDENCE_TYPE_RU[ev.type] || ev.type}</div>
                      <div className="muted small" style={{ marginTop: 2 }}>{ev.description}</div>
                      <div className="muted tiny" style={{ marginTop: 4 }}>
                        {ev.addedBy} · {new Date(ev.addedAt).toLocaleDateString('ru-RU')}
                      </div>
                    </div>
                    <span className="mini-chip gray">{ev.id}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="soft-box muted">Доказательств ещё нет. Стороны могут прикрепить файлы через API.</div>
            )}
          </div>

          {/* Timeline */}
          <div>
            <h3 className="section-title" style={{ marginBottom: 8 }}>История событий</h3>
            {dispute.timeline && dispute.timeline.length > 0 ? (
              <div className="section-stack">
                {dispute.timeline.map((ev, i) => (
                  <div key={i} className="soft-box" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 80, fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--color-muted, #6b7280)', paddingTop: 2 }}>
                      {new Date(ev.at).toLocaleDateString('ru-RU')}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{ev.action}</div>
                      <div className="muted tiny">{ev.actor}</div>
                      {ev.note && <div className="muted small" style={{ marginTop: 2 }}>{ev.note}</div>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="soft-box muted">История событий пуста.</div>
            )}
          </div>

          {/* Navigation */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 8 }}>
            <Link href={`/deals/${dispute.dealId}`} className="mini-chip">Сделка {dispute.dealId}</Link>
            <Link href="/disputes" className="mini-chip">← Все споры</Link>
            <Link href="/payments" className="mini-chip">Платежи</Link>
            <Link href="/lab" className="mini-chip">Лаборатория</Link>
            <Link href="/operator-cockpit" className="mini-chip">Кокпит оператора</Link>
          </div>
        </div>
      </AppShell>
    </PageAccessGuard>
  );
}
