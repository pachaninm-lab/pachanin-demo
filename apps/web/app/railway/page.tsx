import Link from 'next/link';
import { PageFrame } from '../../components/page-frame';
import { Breadcrumbs } from '../../components/breadcrumbs';
import { DetailHero } from '../../components/detail-hero';
import { ModuleHub } from '../../components/module-hub';
import { NextStepBar } from '../../components/next-step-bar';
import { SourceNote } from '../../components/source-note';
import { PageAccessGuard } from '../../components/page-access-guard';
import { LOGISTICS_ROLES, EXECUTIVE_ROLES, INTERNAL_ONLY_ROLES } from '../../lib/route-roles';
import { readCommercialWorkspace } from '../../lib/commercial-workspace-store';

export default async function RailwayPage() {
  const state = await readCommercialWorkspace();
  const routes = Array.isArray(state?.railwayRoutes) ? state.railwayRoutes : [
    { id: 'RL-001', originStation: 'Тамбов', destinationStation: 'Липецк', wagons: 12, etaDays: 2, status: 'IN_TRANSIT', operator: 'РЖД', linkedDealId: 'DEAL-001', nextAction: 'Проверить handoff в inventory', distanceKm: 310 },
    { id: 'RL-002', originStation: 'Воронеж', destinationStation: 'Белгород', wagons: 8, etaDays: 3, status: 'PLANNED', operator: 'РЖД', linkedDealId: 'DEAL-002', nextAction: 'Подтвердить window и docs', distanceKm: 280 },
  ];

  return (
    <PageAccessGuard allowedRoles={[...LOGISTICS_ROLES, ...EXECUTIVE_ROLES, ...INTERNAL_ONLY_ROLES]} title="Railway rail ограничен" subtitle="ЖД-контур нужен логистике, оператору и управляющим ролям как рабочий rail исполнения.">
      <PageFrame title="Railway" subtitle="Ж/д плечо: станции, вагоны, ETA и следующий переход в dispatch / inventory / documents." breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { label: 'Railway' }]} />}>
        <SourceNote source="railway registry / seeded projection" warning="Railway rail не должен быть просто списком маршрутов. Из него должен быть прямой вход в dispatch, inventory, documents и deal rail." compact />

        <DetailHero
          kicker="Railway registry"
          title="ЖД-маршруты исполнения"
          description="Каждый железнодорожный маршрут должен вести дальше: в dispatch, storage, documents и linked deal."
          chips={[`routes ${routes.length}`, `wagons ${(routes as any[]).reduce((acc: number, item: any) => acc + Number(item.wagons || 0), 0)}`, 'rail execution']}
          nextStep="Открыть проблемный маршрут и проверить handoff в следующий operational rail."
          owner="логистика / оператор"
          blockers={routes.some((item: any) => String(item.status) !== 'DONE') ? 'активные rail-маршруты требуют handoff в inventory / docs' : 'критичных блокеров не видно'}
          actions={[
            { href: '/dispatch', label: 'Dispatch' },
            { href: '/inventory', label: 'Inventory', variant: 'secondary' },
            { href: '/documents', label: 'Documents', variant: 'secondary' }
          ]}
        />

        <section className="section-card-tight">
          <div className="dashboard-section-title">Маршруты</div>
          <div className="section-stack" style={{ marginTop: 16 }}>
            {routes.map((route: any) => (
              <Link key={route.id} href={`/railway/${route.id}`} className="list-row linkable">
                <div>
                  <div style={{ fontWeight: 700 }}>{route.originStation} → {route.destinationStation}</div>
                  <div className="muted small">{route.id} · {route.wagons} вагонов · ETA {route.etaDays} дн.</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="mini-chip">{route.status}</div>
                  <div className="muted tiny" style={{ marginTop: 4 }}>{route.linkedDealId || '—'}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <ModuleHub
          title="Связанные rails"
          subtitle="Из railway списка оператор должен уходить в dispatch, inventory, documents и linked deal rail."
          items={[
            { href: '/dispatch', label: 'Dispatch', detail: 'Проверить handoff между ЖД-плечом и общим dispatch rail.', icon: '🧭', meta: 'dispatch', tone: 'blue' },
            { href: '/inventory', label: 'Inventory', detail: 'Понять, куда партия перейдёт после прибытия.', icon: '📦', meta: 'storage', tone: 'green' },
            { href: '/documents', label: 'Documents', detail: 'Сверить railway docs и evidence по маршрутам.', icon: '⌁', meta: 'evidence', tone: 'amber' },
            { href: '/deals', label: 'Deal rail', detail: 'Открыть linked deal и проверить execution continuation.', icon: '≣', meta: 'deals', tone: 'gray' },
          ]}
        />

        <NextStepBar
          title="Открыть активный railway route"
          detail="Следующий шаг — зайти в маршрут и провести handoff в inventory / documents / dispatch."
          primary={{ href: '/railway/RL-001', label: 'Открыть маршрут' }}
          secondary={[{ href: '/dispatch', label: 'Dispatch' }, { href: '/inventory', label: 'Inventory' }]}
        />
      </PageFrame>
    </PageAccessGuard>
  );
}
