import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '../../../../components/app-shell';
import { Breadcrumbs } from '../../../../components/breadcrumbs';
import { PageAccessGuard } from '../../../../components/page-access-guard';
import { TRANSACTIONAL_ROLES } from '../../../../lib/route-roles';
import { apiServer } from '../../../../lib/api-server';

type TimelineEntry = { status: string; label: string; timestamp: string; actor?: string };

const STATUS_RU: Record<string, string> = {
  DRAFT: 'Черновик', AWAITING_SIGN: 'Ожидает подписи', SIGNED: 'Подписана',
  PREPAYMENT_RESERVED: 'Предоплата резервирована', LOADING: 'Погрузка',
  IN_TRANSIT: 'В пути', ARRIVED: 'Прибыл', QUALITY_CHECK: 'Проверка качества',
  ACCEPTED: 'Принят', FINAL_PAYMENT: 'Финальный платёж', SETTLED: 'Расчёт завершён',
  CLOSED: 'Закрыт', DISPUTE_OPEN: 'Спор открыт', EXPERTISE: 'Экспертиза',
  ARBITRATION_DECISION: 'Решение арбитража', PARTIAL_SETTLEMENT: 'Частичный расчёт',
  CANCELLATION: 'Отмена',
};

const STATUS_COLOR: Record<string, string> = {
  IN_TRANSIT: 'amber', QUALITY_CHECK: 'amber', LOADING: 'amber', ARRIVED: 'amber', FINAL_PAYMENT: 'amber',
  DISPUTE_OPEN: 'red', EXPERTISE: 'red', CANCELLATION: 'red',
  SIGNED: 'green', ACCEPTED: 'green', PREPAYMENT_RESERVED: 'green', SETTLED: 'green',
  CLOSED: 'gray', DRAFT: 'gray',
};

const SEED_TIMELINES: Record<string, TimelineEntry[]> = {
  'DEAL-001': [
    { status: 'DRAFT', label: 'Сделка создана системой', timestamp: '2026-03-22T10:00:00Z', actor: 'system' },
    { status: 'AWAITING_SIGN', label: 'Договор направлен на подписание', timestamp: '2026-03-23T09:00:00Z', actor: 'system' },
    { status: 'SIGNED', label: 'Договор подписан обеими сторонами', timestamp: '2026-03-25T12:00:00Z', actor: 'farmer@demo.ru' },
    { status: 'PREPAYMENT_RESERVED', label: 'Предоплата 30% зарезервирована банком', timestamp: '2026-03-26T10:00:00Z', actor: 'bank-sber' },
    { status: 'LOADING', label: 'Начата погрузка на элеваторе', timestamp: '2026-03-28T07:00:00Z', actor: 'elevator@demo.ru' },
    { status: 'IN_TRANSIT', label: 'Груз отправлен', timestamp: '2026-03-29T14:00:00Z', actor: 'driver@demo.ru' },
  ],
  'DEAL-002': [
    { status: 'DRAFT', label: 'Сделка создана системой', timestamp: '2026-03-18T10:00:00Z', actor: 'system' },
    { status: 'SIGNED', label: 'Договор подписан', timestamp: '2026-03-20T09:00:00Z', actor: 'farmer@demo.ru' },
    { status: 'PREPAYMENT_RESERVED', label: 'Предоплата зарезервирована', timestamp: '2026-03-21T11:00:00Z', actor: 'bank-sber' },
    { status: 'LOADING', label: 'Погрузка начата', timestamp: '2026-03-25T06:00:00Z', actor: 'elevator@demo.ru' },
    { status: 'IN_TRANSIT', label: 'Груз в пути', timestamp: '2026-03-26T15:00:00Z', actor: 'driver@demo.ru' },
    { status: 'ARRIVED', label: 'Груз прибыл на элеватор покупателя', timestamp: '2026-04-02T08:00:00Z', actor: 'elevator@demo.ru' },
    { status: 'QUALITY_CHECK', label: 'Начата проверка качества в лаборатории', timestamp: '2026-04-02T10:00:00Z', actor: 'lab@demo.ru' },
  ],
  'DEAL-003': [
    { status: 'DRAFT', label: 'Сделка создана', timestamp: '2026-04-01T10:00:00Z', actor: 'system' },
    { status: 'AWAITING_SIGN', label: 'Ожидание подписи', timestamp: '2026-04-01T11:00:00Z', actor: 'system' },
    { status: 'SIGNED', label: 'Договор подписан', timestamp: '2026-04-02T09:00:00Z', actor: 'farmer@demo.ru' },
  ],
};

async function load(id: string): Promise<TimelineEntry[]> {
  try {
    const res = await apiServer(`/deals/${id}/timeline`);
    return Array.isArray(res) ? res : SEED_TIMELINES[id] || [];
  } catch {
    return SEED_TIMELINES[id] || [];
  }
}

export default async function DealTimelinePage({ params }: { params: { id: string } }) {
  const timeline = await load(params.id);
  if (timeline === null) notFound();

  return (
    <PageAccessGuard allowedRoles={[...TRANSACTIONAL_ROLES]}
      title="Доступ к timeline сделки ограничен"
      subtitle="История событий доступна участникам сделки и операционным ролям.">
      <AppShell title={`Timeline · ${params.id}`} subtitle="Последовательность событий и переходов состояния сделки">
        <div className="space-y-6">
          <Breadcrumbs items={[
            { href: '/', label: 'Главная' },
            { href: '/deals', label: 'Сделки' },
            { href: `/deals/${params.id}`, label: params.id },
            { label: 'Timeline' },
          ]} />

          {timeline.length === 0 ? (
            <div className="soft-box muted">История событий пуста.</div>
          ) : (
            <div style={{ position: 'relative' }}>
              {/* Vertical line */}
              <div style={{
                position: 'absolute', left: 16, top: 24, bottom: 0,
                width: 2, background: 'var(--color-border, #e5e7eb)',
              }} />

              <div className="section-stack" style={{ paddingLeft: 40 }}>
                {timeline.map((entry, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    {/* Dot */}
                    <div style={{
                      position: 'absolute', left: -32, top: 12, width: 12, height: 12,
                      borderRadius: '50%', border: '2px solid white',
                      background: `var(--color-${STATUS_COLOR[entry.status] || 'gray'}, #9ca3af)`,
                    }} />
                    <div className="soft-box">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                        <div>
                          <div style={{ display: 'flex', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                            <span className={`mini-chip ${STATUS_COLOR[entry.status] || 'gray'}`}>
                              {STATUS_RU[entry.status] || entry.status}
                            </span>
                          </div>
                          <div style={{ fontWeight: 600 }}>{entry.label}</div>
                          <div className="muted tiny" style={{ marginTop: 4 }}>
                            {entry.actor ? `${entry.actor} · ` : ''}{new Date(entry.timestamp).toLocaleString('ru-RU')}
                          </div>
                        </div>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--color-muted, #6b7280)', whiteSpace: 'nowrap' }}>
                          {new Date(entry.timestamp).toLocaleDateString('ru-RU')}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 8 }}>
            <Link href={`/deals/${params.id}`} className="mini-chip">← Сделка {params.id}</Link>
            <Link href={`/deals/${params.id}/passport`} className="mini-chip">Паспорт сделки</Link>
            <Link href="/deals" className="mini-chip">Все сделки</Link>
          </div>
        </div>
      </AppShell>
    </PageAccessGuard>
  );
}
