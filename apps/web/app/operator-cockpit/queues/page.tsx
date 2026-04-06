import Link from 'next/link';
import { AppShell } from '../../../components/app-shell';
import { Breadcrumbs } from '../../../components/breadcrumbs';
import { PageAccessGuard } from '../../../components/page-access-guard';
import { INTERNAL_ONLY_ROLES } from '../../../lib/route-roles';

type QueueItem = { id: string; lane: string; label: string; count: number; critical: number; link: string };

const QUEUES: QueueItem[] = [
  { id: 'docs', lane: 'Документы', label: 'Ожидают подписания или верификации', count: 4, critical: 1, link: '/documents' },
  { id: 'payments', lane: 'Платежи', label: 'Hold/release ожидает подтверждения', count: 2, critical: 1, link: '/payments' },
  { id: 'disputes', lane: 'Споры', label: 'Открытые споры без решения', count: 2, critical: 1, link: '/disputes' },
  { id: 'integrations', lane: 'Интеграции', label: 'Коннекторы с ошибками или в SANDBOX режиме', count: 3, critical: 2, link: '/connectors' },
  { id: 'receiving', lane: 'Приёмка', label: 'Грузы ожидают приёмки на элеваторе', count: 1, critical: 0, link: '/receiving' },
  { id: 'lab', lane: 'Лаборатория', label: 'Пробы без финального протокола', count: 2, critical: 0, link: '/lab' },
  { id: 'antifraud', lane: 'Антифрод', label: 'Активные флаги без резолюции', count: 2, critical: 1, link: '/anti-fraud' },
  { id: 'onboarding', lane: 'Онбординг', label: 'Организации ожидают KYC/KYB верификации', count: 3, critical: 0, link: '/companies' },
];

export default function OperatorQueuesPage() {
  const totalCritical = QUEUES.reduce((s, q) => s + q.critical, 0);
  const totalItems = QUEUES.reduce((s, q) => s + q.count, 0);

  return (
    <PageAccessGuard allowedRoles={[...INTERNAL_ONLY_ROLES]}
      title="Доступ к очередям оператора ограничен"
      subtitle="Операционные очереди доступны только внутренним ролям.">
      <AppShell title="Очереди оператора" subtitle="Очереди по lane: docs, payments, disputes, integrations, receiving">
        <div className="space-y-6">
          <Breadcrumbs items={[
            { href: '/', label: 'Главная' },
            { href: '/operator-cockpit', label: 'Кокпит оператора' },
            { label: 'Очереди' },
          ]} />

          {/* Summary */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div className="soft-box" style={{ flex: '1 1 120px', textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '1.5rem' }}>{totalItems}</div>
              <div className="muted small">Элементов в очередях</div>
            </div>
            <div className="soft-box" style={{ flex: '1 1 120px', textAlign: 'center', borderLeft: totalCritical > 0 ? '3px solid var(--color-red, #ef4444)' : undefined }}>
              <div style={{ fontWeight: 700, fontSize: '1.5rem', color: totalCritical > 0 ? 'var(--color-red, #ef4444)' : 'inherit' }}>{totalCritical}</div>
              <div className="muted small">Критических</div>
            </div>
            <div className="soft-box" style={{ flex: '1 1 120px', textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '1.5rem' }}>{QUEUES.length}</div>
              <div className="muted small">Активных lanes</div>
            </div>
          </div>

          {/* Queues by lane */}
          <div className="section-stack">
            {QUEUES.map((q) => (
              <div key={q.id} className="soft-box" style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16,
                borderLeft: q.critical > 0 ? '3px solid var(--color-red, #ef4444)' : '3px solid var(--color-border, #e5e7eb)',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700 }}>{q.lane}</span>
                    {q.critical > 0 && <span className="mini-chip red">{q.critical} критичных</span>}
                  </div>
                  <div className="muted small">{q.label}</div>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ textAlign: 'center', minWidth: 40 }}>
                    <div style={{ fontWeight: 700, fontSize: '1.2rem' }}>{q.count}</div>
                    <div className="muted tiny">всего</div>
                  </div>
                  <Link href={q.link} className="mini-chip">Открыть →</Link>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href="/operator-cockpit/cases" className="mini-chip">Кейсы →</Link>
            <Link href="/operator-cockpit" className="mini-chip">← Кокпит</Link>
          </div>
        </div>
      </AppShell>
    </PageAccessGuard>
  );
}
