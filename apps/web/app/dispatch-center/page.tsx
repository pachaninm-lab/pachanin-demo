import Link from 'next/link';
import { PageFrame } from '../../components/page-frame';
import { Breadcrumbs } from '../../components/breadcrumbs';
import { DetailHero } from '../../components/detail-hero';
import { ModuleHub } from '../../components/module-hub';
import { NextStepBar } from '../../components/next-step-bar';
import { SourceNote } from '../../components/source-note';
import { PageAccessGuard } from '../../components/page-access-guard';
import { LOGISTICS_ROLES, OPERATOR_ROLES, INTERNAL_ONLY_ROLES } from '../../lib/route-roles';
import { readCommercialWorkspace } from '../../lib/commercial-workspace-store';

export default async function DispatchCenterPage() {
  const state = await readCommercialWorkspace();
  const slots = Array.isArray(state?.queueSlots) ? state.queueSlots : [];
  const activeRoutes = [
    { id: 'DSP-001', vehicle: 'А123ВС', status: 'EN_ROUTE', eta: '35 мин', linkedDealId: 'DEAL-001', nextAction: 'Подготовить receiving slot' },
    { id: 'DSP-002', vehicle: 'М456ОР', status: 'AT_UNLOADING', eta: 'на площадке', linkedDealId: 'DEAL-002', nextAction: 'Закрыть unload handoff' },
  ];

  return (
    <PageAccessGuard allowedRoles={[...LOGISTICS_ROLES, ...OPERATOR_ROLES, ...INTERNAL_ONLY_ROLES]} title="Dispatch center ограничен" subtitle="Экран нужен логистике, оператору и internal-ролям как рабочий центр маршрутов и handoff.">
      <PageFrame title="Dispatch center" subtitle="Назначение рейсов, контроль исполнителей, queue and dispatch readiness." breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { label: 'Dispatch center' }]} />}>
        <SourceNote source="dispatch workspace / seeded routes" warning="Dispatch center не должен быть просто списком рейсов. Из него должен быть прямой вход в receiving, weight, support и linked deal rail." compact />

        <DetailHero
          kicker="Dispatch workspace"
          title="Центр маршрутов и handoff"
          description="Каждый маршрут должен вести дальше: в receiving, weight, documents и support без ручного поиска по меню."
          chips={[`routes ${activeRoutes.length}`, `queue slots ${slots.length}`, 'dispatch rail']}
          nextStep="Открыть проблемный маршрут и провести handoff в следующий operational rail."
          owner="логистика / оператор"
          blockers={activeRoutes.some((item) => item.status !== 'DONE') ? 'есть активные маршруты и handoff blockers' : 'критичных blockers не видно'}
          actions={[
            { href: '/dispatch', label: 'Dispatch rail' },
            { href: '/receiving', label: 'Receiving', variant: 'secondary' },
            { href: '/support', label: 'Support', variant: 'secondary' }
          ]}
        />

        <section className="section-card-tight">
          <div className="dashboard-section-title">Активные маршруты</div>
          <div className="section-stack" style={{ marginTop: 16 }}>
            {activeRoutes.map((route) => (
              <Link key={route.id} href={route.linkedDealId ? `/dispatch/${route.linkedDealId}` : '/dispatch'} className="list-row linkable">
                <div>
                  <div style={{ fontWeight: 700 }}>{route.vehicle}</div>
                  <div className="muted small">{route.id} · {route.status} · ETA {route.eta}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="mini-chip">{route.linkedDealId}</div>
                  <div className="muted tiny" style={{ marginTop: 4 }}>{route.nextAction}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <ModuleHub
          title="Связанные rails"
          subtitle="Из dispatch center оператор должен уходить в receiving, weight, support и deal rail."
          items={[
            { href: '/receiving', label: 'Receiving', detail: 'Закрыть slot handoff и queue-ready приёмку.', icon: '◫', meta: 'receiving', tone: 'blue' },
            { href: '/weighbridge', label: 'Weighbridge', detail: 'Проверить weight evidence по прибывшим маршрутам.', icon: '⚖', meta: 'weight', tone: 'green' },
            { href: '/support', label: 'Support', detail: 'Открыть support rail, если маршрут упёрся в инцидент.', icon: '!', meta: 'support', tone: 'amber' },
            { href: '/deals', label: 'Deal rail', detail: 'Проверить linked deal и следующий blocker исполнения.', icon: '≣', meta: 'deals', tone: 'gray' }
          ]}
        />

        <NextStepBar
          title="Открыть маршрут и провести handoff"
          detail="Следующий шаг — не смотреть на список, а зайти в маршрут и довести его до receiving/weight/support rail."
          primary={{ href: '/dispatch', label: 'Открыть dispatch' }}
          secondary={[{ href: '/receiving', label: 'Receiving' }, { href: '/support', label: 'Support' }]}
        />
      </PageFrame>
    </PageAccessGuard>
  );
}
