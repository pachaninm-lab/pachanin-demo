import Link from 'next/link';
import { AppShell } from '../../components/app-shell';
import { Breadcrumbs } from '../../components/breadcrumbs';
import { DetailHero } from '../../components/detail-hero';
import { NextStepBar } from '../../components/next-step-bar';
import { PageAccessGuard } from '../../components/page-access-guard';
import { apiServer } from '../../lib/api-server';

type FraudCheck = {
  id: string; entityType: string; entityId: string; orgId: string;
  flagged: boolean; score: number; reasons: string[];
  checkedAt: string; resolvedAt?: string; resolvedBy?: string;
};

const SEED: FraudCheck[] = [
  { id: 'AFC-001', entityType: 'Deal', entityId: 'DEAL-002', orgId: 'ORG-BUYER',
    flagged: true, score: 72,
    reasons: ['Нетипичный объём первой сделки (>3σ)', 'Контрагент зарегистрирован <30 дней'],
    checkedAt: '2026-04-03T08:00:00Z' },
  { id: 'AFC-002', entityType: 'Lot', entityId: 'LOT-001', orgId: 'ORG-FARMER',
    flagged: false, score: 12, reasons: [],
    checkedAt: '2026-04-01T10:00:00Z', resolvedAt: '2026-04-01T10:05:00Z', resolvedBy: 'admin@demo.ru' },
  { id: 'AFC-003', entityType: 'Deal', entityId: 'DEAL-003', orgId: 'ORG-FARMER',
    flagged: true, score: 58,
    reasons: ['Цена ниже рыночной на 18%', 'IP-адрес из нетипичной юрисдикции'],
    checkedAt: '2026-04-04T11:00:00Z' },
];

async function load(): Promise<FraudCheck[]> {
  try {
    const res = await apiServer('/anti-fraud/checks');
    return Array.isArray(res?.items) ? res.items : res?.length ? res : SEED;
  } catch { return SEED; }
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? 'red' : score >= 40 ? 'amber' : 'green';
  return <span className={`mini-chip ${color}`}>score {score}</span>;
}

export default async function AntiFraudPage() {
  const checks = await load();
  const flagged = checks.filter((c) => c.flagged && !c.resolvedAt);
  const resolved = checks.filter((c) => c.resolvedAt);

  return (
    <PageAccessGuard allowedRoles={['ADMIN', 'SUPPORT_MANAGER']}
      title="Доступ к антифроду ограничен"
      subtitle="Антифрод-мониторинг доступен только администраторам и менеджерам поддержки.">
      <AppShell title="Антифрод" subtitle="Мониторинг подозрительной активности и управление рисками платформы">
        <div className="space-y-6">
          <Breadcrumbs items={[{ href: '/', label: 'Главная' }, { label: 'Антифрод' }]} />

          <DetailHero
            kicker="Anti-fraud center"
            title="Контроль рисков — каждая сделка и лот проходят автоматическую проверку"
            description="Система анализирует поведенческие паттерны, ценовые аномалии и атрибуты контрагентов. Флаги требуют ручной верификации."
            chips={[`всего проверок ${checks.length}`, `активных флагов ${flagged.length}`, `закрыто ${resolved.length}`]}
            nextStep={flagged.length ? `Разобрать ${flagged.length} активных флагов` : 'Активных флагов нет'}
            owner="admin / support_manager"
            blockers="Флаг без резолюции блокирует выплату"
            actions={[
              { href: '/operator-cockpit', label: 'Кокпит оператора' },
              { href: '/disputes', label: 'Споры', variant: 'secondary' },
              { href: '/payments', label: 'Платежи', variant: 'secondary' },
            ]}
          />

          {flagged.length > 0 && (
            <div>
              <h3 className="section-title" style={{ marginBottom: 8, color: 'var(--color-red, #ef4444)' }}>
                Активные флаги ({flagged.length})
              </h3>
              <div className="section-stack">
                {flagged.map((c) => (
                  <div key={c.id} className="soft-box" style={{ borderLeft: '3px solid var(--color-red, #ef4444)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                          <span className="mini-chip red">FLAGGED</span>
                          <ScoreBadge score={c.score} />
                          <span className="muted tiny">{c.entityType} {c.entityId}</span>
                        </div>
                        <div style={{ fontWeight: 700 }}>{c.id} · Org {c.orgId}</div>
                        {c.reasons.length > 0 && (
                          <ul style={{ marginTop: 6, paddingLeft: 16 }}>
                            {c.reasons.map((r, i) => (
                              <li key={i} className="muted small">{r}</li>
                            ))}
                          </ul>
                        )}
                        <div className="muted tiny" style={{ marginTop: 6 }}>
                          Проверено: {new Date(c.checkedAt).toLocaleDateString('ru-RU')}
                        </div>
                      </div>
                      <Link href={`/deals/${c.entityId}`} className="mini-chip">К объекту →</Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {resolved.length > 0 && (
            <div>
              <h3 className="section-title" style={{ marginBottom: 8 }}>Закрытые проверки</h3>
              <div className="section-stack">
                {resolved.map((c) => (
                  <div key={c.id} className="soft-box">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                      <div>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                          <span className="mini-chip green">OK</span>
                          <ScoreBadge score={c.score} />
                          <span className="muted tiny">{c.entityType} {c.entityId}</span>
                        </div>
                        <div className="muted small">
                          {c.id} · Закрыт: {c.resolvedBy}
                          {c.resolvedAt ? ` · ${new Date(c.resolvedAt).toLocaleDateString('ru-RU')}` : ''}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {checks.length === 0 && (
            <div className="soft-box text-center muted">Проверок нет — платформа работает в штатном режиме.</div>
          )}

          <NextStepBar
            title="Каждый флаг должен быть верифицирован вручную"
            detail="Нерешённый флаг блокирует hold/release платежа до получения резолюции оператора."
            primary={{ href: '/operator-cockpit', label: 'Кокпит оператора' }}
            secondary={[{ href: '/disputes', label: 'Споры' }, { href: '/payments', label: 'Платежи' }]}
          />
        </div>
      </AppShell>
    </PageAccessGuard>
  );
}
