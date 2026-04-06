import Link from 'next/link';
import { AppShell } from '../../../components/app-shell';
import { Breadcrumbs } from '../../../components/breadcrumbs';
import { PageAccessGuard } from '../../../components/page-access-guard';
import { INTERNAL_ONLY_ROLES } from '../../../lib/route-roles';
import { apiServer } from '../../../lib/api-server';

type Case = {
  id: string; type: string; entityId: string; entityType: string;
  owner?: string; slaMinutes: number; moneyImpactRub?: number;
  status: string; priority: string; createdAt: string; nextAction: string;
};

const SEED: Case[] = [
  { id: 'CASE-001', type: 'dispute', entityId: 'DISPUTE-001', entityType: 'Dispute', owner: 'operator@demo.ru', slaMinutes: 180, moneyImpactRub: 127500, status: 'IN_WORK', priority: 'HIGH', createdAt: '2026-04-01T14:00:00Z', nextAction: 'Проверить протокол лаборатории и вынести решение' },
  { id: 'CASE-002', type: 'fraud_flag', entityId: 'AFC-001', entityType: 'AntiFraud', owner: undefined, slaMinutes: 60, moneyImpactRub: 8625000, status: 'OPEN', priority: 'CRITICAL', createdAt: '2026-04-03T08:00:00Z', nextAction: 'Назначить ответственного и верифицировать флаг' },
  { id: 'CASE-003', type: 'dispute', entityId: 'DISPUTE-002', entityType: 'Dispute', owner: undefined, slaMinutes: 30, moneyImpactRub: 86250, status: 'OPEN', priority: 'HIGH', createdAt: '2026-04-03T09:00:00Z', nextAction: 'Принять спор в работу — SLA истекает скоро' },
  { id: 'CASE-004', type: 'payment_block', entityId: 'PAY-002', entityType: 'Payment', owner: 'accounting@demo.ru', slaMinutes: 120, moneyImpactRub: 2550000, status: 'IN_WORK', priority: 'MEDIUM', createdAt: '2026-04-04T10:00:00Z', nextAction: 'Проверить hold и одобрить release платежа' },
  { id: 'CASE-005', type: 'integration_error', entityId: 'EDO', entityType: 'Integration', owner: undefined, slaMinutes: 240, status: 'OPEN', priority: 'LOW', createdAt: '2026-04-05T06:00:00Z', nextAction: 'Проверить статус коннектора Диадок' },
];

const PRIORITY_COLOR: Record<string, string> = { CRITICAL: 'red', HIGH: 'red', MEDIUM: 'amber', LOW: 'gray' };
const STATUS_RU: Record<string, string> = { OPEN: 'Открыт', IN_WORK: 'В работе', RESOLVED: 'Решён', CLOSED: 'Закрыт' };
const TYPE_RU: Record<string, string> = { dispute: 'Спор', fraud_flag: 'Антифрод флаг', payment_block: 'Блок платежа', integration_error: 'Ошибка интеграции' };
const ENTITY_LINKS: Record<string, (id: string) => string> = {
  Dispute: (id) => `/disputes/${id}`,
  AntiFraud: (id) => `/anti-fraud`,
  Payment: (id) => `/payments/${id}`,
  Integration: () => `/connectors`,
};

async function load(): Promise<Case[]> {
  try {
    const res = await apiServer('/operator/cases');
    return Array.isArray(res?.items) ? res.items : res?.length ? res : SEED;
  } catch { return SEED; }
}

export default async function OperatorCasesPage() {
  const cases = await load();
  const open = cases.filter((c) => c.status === 'OPEN');
  const inWork = cases.filter((c) => c.status === 'IN_WORK');
  const noOwner = cases.filter((c) => !c.owner && c.status !== 'RESOLVED');
  const totalMoneyImpact = cases.reduce((s, c) => s + (c.moneyImpactRub || 0), 0);

  return (
    <PageAccessGuard allowedRoles={[...INTERNAL_ONLY_ROLES]}
      title="Доступ к кейсам оператора ограничен"
      subtitle="Кейсы операционного центра доступны только внутренним ролям.">
      <AppShell title="Кейсы оператора" subtitle="Список кейсов с owner, SLA, money impact and next action">
        <div className="space-y-6">
          <Breadcrumbs items={[
            { href: '/', label: 'Главная' },
            { href: '/operator-cockpit', label: 'Кокпит оператора' },
            { label: 'Кейсы' },
          ]} />

          {/* Stats */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'Открытых', value: open.length, color: 'red' },
              { label: 'В работе', value: inWork.length, color: 'amber' },
              { label: 'Без owner', value: noOwner.length, color: 'red' },
              { label: 'Money impact', value: `${(totalMoneyImpact / 1_000_000).toFixed(1)} М₽`, color: '' },
            ].map((s) => (
              <div key={s.label} className="soft-box" style={{ flex: '1 1 100px', textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: '1.4rem', color: s.color === 'red' && Number(s.value) > 0 ? 'var(--color-red, #ef4444)' : 'inherit' }}>
                  {s.value}
                </div>
                <div className="muted small">{s.label}</div>
              </div>
            ))}
          </div>

          {/* No-owner alert */}
          {noOwner.length > 0 && (
            <div className="soft-box" style={{ borderLeft: '3px solid var(--color-red, #ef4444)', background: 'var(--color-red-soft, #fef2f2)' }}>
              <div style={{ fontWeight: 700, color: 'var(--color-red, #ef4444)' }}>
                ⚠ {noOwner.length} кейс(ов) без назначенного ответственного
              </div>
              <div className="muted small" style={{ marginTop: 4 }}>Назначьте owner — иначе SLA нарушается.</div>
            </div>
          )}

          {/* Cases list */}
          <div className="section-stack">
            {cases.map((c) => {
              const entityLink = ENTITY_LINKS[c.entityType]?.(c.entityId) || '/operator-cockpit';
              return (
                <div key={c.id} className="soft-box" style={{
                  borderLeft: `3px solid var(--color-${PRIORITY_COLOR[c.priority]}, #9ca3af)`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                        <span className={`mini-chip ${PRIORITY_COLOR[c.priority]}`}>{c.priority}</span>
                        <span className="mini-chip">{TYPE_RU[c.type] || c.type}</span>
                        <span className="mini-chip gray">{STATUS_RU[c.status] || c.status}</span>
                      </div>
                      <div style={{ fontWeight: 700 }}>{c.id} · {c.entityType} {c.entityId}</div>
                      <div className="muted small" style={{ marginTop: 4 }}>{c.nextAction}</div>
                      <div className="muted tiny" style={{ marginTop: 6 }}>
                        SLA: {c.slaMinutes} мин
                        {c.moneyImpactRub ? ` · Impact: ${c.moneyImpactRub.toLocaleString('ru-RU')} ₽` : ''}
                        {c.owner
                          ? ` · Owner: ${c.owner}`
                          : <span style={{ color: 'var(--color-red, #ef4444)' }}> · Owner не назначен ⚠</span>}
                        {` · ${new Date(c.createdAt).toLocaleDateString('ru-RU')}`}
                      </div>
                    </div>
                    <Link href={entityLink} className="mini-chip">Открыть →</Link>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href="/operator-cockpit/queues" className="mini-chip">Очереди →</Link>
            <Link href="/operator-cockpit" className="mini-chip">← Кокпит</Link>
            <Link href="/disputes" className="mini-chip">Споры</Link>
            <Link href="/anti-fraud" className="mini-chip">Антифрод</Link>
            <Link href="/payments" className="mini-chip">Платежи</Link>
          </div>
        </div>
      </AppShell>
    </PageAccessGuard>
  );
}
