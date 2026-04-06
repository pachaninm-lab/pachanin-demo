import Link from 'next/link';
import { AppShell } from '../../components/app-shell';
import { Breadcrumbs } from '../../components/breadcrumbs';
import { PageAccessGuard } from '../../components/page-access-guard';
import { INTERNAL_ONLY_ROLES, EXECUTIVE_ROLES } from '../../lib/route-roles';

type OrgRep = {
  orgId: string; orgName: string; score: number; tier: string;
  dealsCompleted: number; disputeRate: number; avgSlaHours: number;
  flags: string[];
};

const REPUTATIONS: OrgRep[] = [
  { orgId: 'org-buyer-1', orgName: 'ТД Зерноград', score: 91, tier: 'A+', dealsCompleted: 47, disputeRate: 2.1, avgSlaHours: 18, flags: [] },
  { orgId: 'org-farmer-1', orgName: 'АО Агро-Тамбов', score: 87, tier: 'A', dealsCompleted: 38, disputeRate: 5.3, avgSlaHours: 24, flags: [] },
  { orgId: 'org-farmer-2', orgName: 'ООО Зернопром', score: 72, tier: 'B', dealsCompleted: 14, disputeRate: 7.1, avgSlaHours: 32, flags: ['Задержки ответа', 'Просроченный KYB'] },
  { orgId: 'org-buyer-2', orgName: 'ООО АгроТрейд', score: 58, tier: 'C', dealsCompleted: 5, disputeRate: 20.0, avgSlaHours: 48, flags: ['Высокий процент споров', 'KYB не завершён'] },
];

const TIER_COLOR: Record<string, string> = { 'A+': 'green', 'A': 'green', 'B': 'amber', 'C': 'red', 'D': 'red' };

export default function ReputationControlPage() {
  const avgScore = Math.round(REPUTATIONS.reduce((s, r) => s + r.score, 0) / REPUTATIONS.length);
  const atRisk = REPUTATIONS.filter((r) => r.score < 65 || r.flags.length > 0);

  return (
    <PageAccessGuard allowedRoles={[...INTERNAL_ONLY_ROLES, ...EXECUTIVE_ROLES]}
      title="Репутация ограничена"
      subtitle="Управление репутацией доступно внутренним и исполнительным ролям.">
      <AppShell title="Репутация контрагентов" subtitle="Business reputation scoring, tier management и флаги риска">
        <div className="space-y-6">
          <Breadcrumbs items={[{ href: '/', label: 'Главная' }, { label: 'Репутация' }]} />

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'Средний score', value: `${avgScore}/100` },
              { label: 'Организаций', value: REPUTATIONS.length },
              { label: 'Требуют внимания', value: atRisk.length },
              { label: 'Tier A/A+', value: REPUTATIONS.filter((r) => ['A', 'A+'].includes(r.tier)).length },
            ].map((s) => (
              <div key={s.label} className="soft-box" style={{ flex: '1 1 100px', textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: '1.3rem' }}>{s.value}</div>
                <div className="muted small">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="section-stack">
            {REPUTATIONS.sort((a, b) => b.score - a.score).map((r) => (
              <div key={r.orgId} className="soft-box" style={{
                borderLeft: `3px solid var(--color-${TIER_COLOR[r.tier]}, #9ca3af)`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700 }}>{r.orgName}</span>
                      <span className={`mini-chip ${TIER_COLOR[r.tier]}`}>Tier {r.tier}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 6 }}>
                      <div className="muted small">Сделок: <b>{r.dealsCompleted}</b></div>
                      <div className="muted small">Споры: <b>{r.disputeRate}%</b></div>
                      <div className="muted small">Avg SLA: <b>{r.avgSlaHours}ч</b></div>
                    </div>
                    {r.flags.length > 0 && (
                      <div>
                        {r.flags.map((f, i) => (
                          <div key={i} className="muted tiny" style={{ color: 'var(--color-red, #ef4444)' }}>⚠ {f}</div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'center', minWidth: 56 }}>
                    <div style={{ fontWeight: 700, fontSize: '1.4rem' }}>{r.score}</div>
                    <div className="muted tiny">/ 100</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href="/trust-center" className="mini-chip">Trust Center</Link>
            <Link href="/companies" className="mini-chip">Компании</Link>
            <Link href="/anti-fraud" className="mini-chip">Антифрод</Link>
          </div>
        </div>
      </AppShell>
    </PageAccessGuard>
  );
}
