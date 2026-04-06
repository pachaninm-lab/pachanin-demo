import Link from 'next/link';
import { PageAccessGuard } from '../../components/page-access-guard';
import { LOGISTICS_ROLES } from '../../lib/route-roles';
import { AppShell } from '../../components/app-shell';
import { ModuleHub } from '../../components/module-hub';
import { NextStepBar } from '../../components/next-step-bar';
import { buildLogisticsView } from '../../lib/commercial-workspace-store';
import { buildProviderStagePlan } from '../../../../packages/domain-core/src';

export default async function LogisticsPage() {
  const logisticsView = buildLogisticsView();
  const routePlan = buildProviderStagePlan('DISPATCH', {
    qualitySensitive: false,
    routeDistanceKm: 460,
    docsReady: true,
    needsSurveyor: logisticsView.incidents.some((item) => item.type === 'quality'),
    needsWarehouse: true,
  });
  const logisticsItem = routePlan.items.find((item) => item.category === 'LOGISTICS');

  return (
    <PageAccessGuard allowedRoles={[...LOGISTICS_ROLES]} title="Логистика ограничена" subtitle="Раздел нужен только логистическим и операционным ролям.">
      <AppShell title="Логистика" subtitle="Рейсы, ETA и incident rail.">
        <div className="page-surface">
          <section className="dashboard-grid-3">
            <div className="dashboard-card"><div className="dashboard-card-title">Рейсов</div><div className="dashboard-card-value">{logisticsView.routes.length}</div><div className="dashboard-card-caption">Активный rail</div></div>
            <div className="dashboard-card"><div className="dashboard-card-title">Инцидентов</div><div className="dashboard-card-value">{logisticsView.incidents.length}</div><div className="dashboard-card-caption">Нужны owner actions</div></div>
            <div className="dashboard-card"><div className="dashboard-card-title">Dispatch policy</div><div className="dashboard-card-value">{logisticsItem?.strategy ?? '—'}</div><div className="dashboard-card-caption">Rail выбора исполнителей</div></div>
          </section>

          <ModuleHub
            title="Связанные rails логистики"
            subtitle="Логистика должна быть связана с dispatch, mobile, weighbridge и provider readiness."
            items={[
              { href: '/dispatch', label: 'Dispatch rail', detail: 'Назначить перевозчика и закрепить owner action.', icon: '🧭', meta: 'routing', tone: 'blue' },
              { href: '/driver-mobile', label: 'Driver mobile', detail: 'Перевести рейс в mobile follow-up и чек-лист.', icon: '📱', meta: 'mobile', tone: 'green' },
              { href: '/weighbridge', label: 'Весовая', detail: 'Контроль взвешивания и linked evidence.', icon: '⚖️', meta: 'evidence', tone: 'amber' },
              { href: '/service-providers', label: 'Исполнители', detail: 'Проверить rail доступности перевозчиков и сюрвея.', icon: '🧩', meta: logisticsItem?.strategy ?? 'provider rail', tone: 'gray' },
            ]}
          />

          <section className="section-card" style={{ marginTop: 24 }}>
            <div className="section-title">Активные рейсы</div>
            <div className="section-stack" style={{ marginTop: 16 }}>
              {logisticsView.routes.map((route) => (
                <Link key={route.id} href={`/logistics/${route.id}`} className="list-row">
                  <div>
                    <div style={{ fontWeight: 700 }}>{route.driverName} · {route.truckNumber}</div>
                    <div className="muted small">{route.originLabel} → {route.destinationLabel} · ETA {route.etaLabel}</div>
                  </div>
                  <span className="status-pill gray">{route.status}</span>
                </Link>
              ))}
            </div>
          </section>

          <NextStepBar
            title={logisticsView.routes[0] ? 'Открыть верхний рейс' : 'Рейсов пока нет'}
            detail={logisticsView.routes[0] ? `${logisticsView.routes[0].driverName} · ${logisticsView.routes[0].truckNumber}` : 'Нужно создать рейс в dispatch rail.'}
            primary={logisticsView.routes[0] ? { href: `/logistics/${logisticsView.routes[0].id}`, label: 'Открыть рейс' } : { href: '/dispatch', label: 'Открыть dispatch' }}
            secondary={[{ href: '/service-providers', label: 'Исполнители' }, { href: '/driver-mobile', label: 'Driver mobile' }]}
          />
        </div>
      </AppShell>
    </PageAccessGuard>
  );
}
