import Link from 'next/link';
import { AppShell } from '../../components/app-shell';
import { Breadcrumbs } from '../../components/breadcrumbs';
import { DetailHero } from '../../components/detail-hero';
import { NextStepBar } from '../../components/next-step-bar';
import { PageAccessGuard } from '../../components/page-access-guard';
import { TRANSACTIONAL_ROLES } from '../../lib/route-roles';
import { apiServer } from '../../lib/api-server';

type Dispute = {
  id: string; dealId: string; status: string; type: string;
  claimAmountRub: number; description: string; severity: string;
  createdAt: string; owner?: string; slaMinutes?: number;
};

const SEED: Dispute[] = [
  { id: 'DISPUTE-001', dealId: 'DEAL-001', status: 'UNDER_REVIEW', type: 'quality',
    claimAmountRub: 127500, description: 'Влажность зерна 15.2% вместо заявленных 13%',
    severity: 'MEDIUM', createdAt: '2026-04-01T14:00:00Z', owner: 'operator@demo.ru', slaMinutes: 180 },
  { id: 'DISPUTE-002', dealId: 'DEAL-002', status: 'OPEN', type: 'weight',
    claimAmountRub: 86250, description: 'Расхождение веса на 7.5 тонн по весовой квитанции',
    severity: 'HIGH', createdAt: '2026-04-03T09:00:00Z', slaMinutes: 30 },
];

async function load(): Promise<Dispute[]> {
  try {
    const res = await apiServer('/disputes');
    return Array.isArray(res?.items) ? res.items : res?.length ? res : SEED;
  } catch { return SEED; }
}

const SEVERITY_COLOR: Record<string, string> = { HIGH: 'red', CRITICAL: 'red', MEDIUM: 'amber', LOW: 'gray' };
const STATUS_RU: Record<string, string> = {
  OPEN: 'Открыт', UNDER_REVIEW: 'На рассмотрении', EXPERTISE: 'Экспертиза',
  DECISION: 'Решение принято', RESOLVED: 'Решён', CLOSED: 'Закрыт',
};

export default async function DisputesPage() {
  const disputes = await load();
  const active = disputes.filter((d) => ['OPEN', 'UNDER_REVIEW', 'EXPERTISE'].includes(d.status));
  const moneyAtRisk = disputes.reduce((s, d) => s + Number(d.claimAmountRub || 0), 0);

  return (
    <PageAccessGuard allowedRoles={[...TRANSACTIONAL_ROLES]}
      title="Доступ к спорам ограничен"
      subtitle="Управление спорами доступно участникам сделки и операционным ролям.">
      <AppShell title="Споры и разногласия"
        subtitle="Полный контур: инициация → доказательная база → решение → влияние на расчёт.">
        <div className="space-y-6">
          <Breadcrumbs items={[{ href: '/', label: 'Главная' }, { label: 'Споры' }]} />

          <DetailHero
            kicker="Dispute center"
            title="Споры под контролем — каждый имеет owner, SLA и money trail"
            description="Спор не закрывается без owner и reason code. Каждое решение влияет на hold/release платежа."
            chips={[`всего ${disputes.length}`, `активных ${active.length}`,
              `под риском ${moneyAtRisk.toLocaleString('ru-RU')} ₽`]}
            nextStep={active.length ? `Обработать ${active.length} активных спора` : 'Активных споров нет'}
            owner="support_manager / admin"
            blockers="Спор без owner и SLA — стоп-критерий UAT"
            actions={[
              { href: '/operator-cockpit', label: 'Кокпит оператора' },
              { href: '/payments', label: 'Платежи', variant: 'secondary' },
              { href: '/documents', label: 'Документы', variant: 'secondary' },
            ]}
          />

          {disputes.length === 0 && (
            <div className="soft-box text-center muted">Споров нет — все сделки проходят без разногласий.</div>
          )}

          <div className="section-stack">
            {disputes.map((d) => (
              <div key={d.id} className="soft-box"
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span className={`mini-chip ${SEVERITY_COLOR[d.severity] || 'gray'}`}>{d.severity}</span>
                    <span className="mini-chip">{STATUS_RU[d.status] || d.status}</span>
                    <span className="muted tiny">{d.type === 'quality' ? 'Качество' : d.type === 'weight' ? 'Вес' : d.type}</span>
                  </div>
                  <div style={{ fontWeight: 700 }}>{d.id} · Сделка {d.dealId}</div>
                  <div className="muted small" style={{ marginTop: 4 }}>{d.description}</div>
                  <div className="muted tiny" style={{ marginTop: 6 }}>
                    Претензия: <b>{Number(d.claimAmountRub).toLocaleString('ru-RU')} ₽</b>
                    {d.owner ? ` · Owner: ${d.owner}` : <span style={{ color: 'var(--color-red, #ef4444)' }}> · Owner не назначен ⚠</span>}
                    {d.slaMinutes ? ` · SLA: ${d.slaMinutes} мин` : ''}
                  </div>
                  <div className="muted tiny" style={{ marginTop: 4 }}>
                    Открыт: {new Date(d.createdAt).toLocaleDateString('ru-RU')}
                  </div>
                </div>
                <Link href={`/disputes/${d.id}`} className="mini-chip">Открыть →</Link>
              </div>
            ))}
          </div>

          <NextStepBar
            title="Каждый спор должен иметь owner, SLA и маршрут к money release"
            detail="Спор без owner — стоп-критерий. Решение по спору напрямую влияет на hold/release."
            primary={{ href: '/operator-cockpit', label: 'Кокпит оператора' }}
            secondary={[{ href: '/payments', label: 'Платежи' }, { href: '/lab', label: 'Лаборатория' }]}
          />
        </div>
      </AppShell>
    </PageAccessGuard>
  );
}
