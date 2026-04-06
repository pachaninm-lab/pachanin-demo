import Link from 'next/link';
import { PageFrame } from '../../../components/page-frame';
import { Breadcrumbs } from '../../../components/breadcrumbs';
import { DetailHero } from '../../../components/detail-hero';
import { ModuleHub } from '../../../components/module-hub';
import { NextStepBar } from '../../../components/next-step-bar';
import { SourceNote } from '../../../components/source-note';
import { PageAccessGuard } from '../../../components/page-access-guard';
import { LOGISTICS_ROLES, OPERATOR_ROLES, INTERNAL_ONLY_ROLES } from '../../../lib/route-roles';

const dispatchMap: Record<string, any> = {
  'DSP-001': {
    vehicle: 'А123ВС',
    driver: 'Иван П.',
    status: 'EN_ROUTE',
    eta: '35 мин',
    linkedDealId: 'DEAL-001',
    origin: 'Тамбовский узел',
    destination: 'Липецкий узел',
    nextAction: 'Подготовить receiving slot и weight handoff',
    blockers: ['нужно подтвердить окно приёмки', 'дальше обязателен handoff в receiving rail']
  },
  'DSP-002': {
    vehicle: 'М456ОР',
    driver: 'Сергей К.',
    status: 'AT_UNLOADING',
    eta: 'на площадке',
    linkedDealId: 'DEAL-002',
    origin: 'Воронеж',
    destination: 'Белгород',
    nextAction: 'Закрыть unload и перевести в documents/weight',
    blockers: ['нужно закрыть unload evidence']
  }
};

export default function DispatchCenterDetailPage({ params }: { params: { id: string } }) {
  const route = dispatchMap[params.id];

  return (
    <PageAccessGuard allowedRoles={[...LOGISTICS_ROLES, ...OPERATOR_ROLES, ...INTERNAL_ONLY_ROLES]} title="Dispatch detail ограничен" subtitle="Карточка маршрута нужна логистике и оператору как рабочий handoff-узел.">
      <PageFrame title={`Dispatch ${params.id}`} subtitle="Деталь маршрута: owner, ETA, linked deal и следующий handoff в receiving/weight/support." breadcrumbs={<Breadcrumbs items={[{ href: '/', label: 'Главная' }, { href: '/dispatch-center', label: 'Dispatch center' }, { label: params.id }]} />}>
        {!route ? (
          <div className="section-card">
            <div className="section-title">Маршрут не найден</div>
            <div className="muted" style={{ marginTop: 8 }}>Вернись в dispatch center и открой актуальный маршрут.</div>
            <div className="cta-stack" style={{ marginTop: 16 }}>
              <Link href="/dispatch-center" className="primary-link">Dispatch center</Link>
              <Link href="/dispatch" className="secondary-link">Dispatch rail</Link>
            </div>
          </div>
        ) : (
          <>
            <SourceNote source="embedded dispatch detail" warning="Карточка маршрута нужна не ради статуса. Она должна вести дальше в receiving, weight, support и linked deal rail." compact />
            <DetailHero
              kicker="Dispatch detail"
              title={`${route.origin} → ${route.destination}`}
              description={`${route.vehicle} · водитель ${route.driver} · ETA ${route.eta}`}
              chips={[route.status, route.linkedDealId, route.eta]}
              nextStep={route.nextAction}
              owner="логистика / оператор"
              blockers={route.blockers.join(' · ')}
              actions={[
                { href: '/dispatch-center', label: 'Назад в центр' },
                { href: '/receiving', label: 'Receiving', variant: 'secondary' },
                { href: `/deals/${route.linkedDealId}`, label: 'Сделка', variant: 'secondary' }
              ]}
            />

            <div className="mobile-two-grid">
              <div className="section-card-tight">
                <div className="section-title">Параметры маршрута</div>
                <div className="section-stack" style={{ marginTop: 12 }}>
                  <div className="list-row"><span>Vehicle</span><b>{route.vehicle}</b></div>
                  <div className="list-row"><span>Driver</span><b>{route.driver}</b></div>
                  <div className="list-row"><span>Status</span><b>{route.status}</b></div>
                  <div className="list-row"><span>ETA</span><b>{route.eta}</b></div>
                  <div className="list-row"><span>Deal</span><b>{route.linkedDealId}</b></div>
                </div>
              </div>
              <div className="section-card-tight">
                <div className="section-title">Следующие rails</div>
                <div className="section-stack" style={{ marginTop: 12 }}>
                  <div className="soft-box">Receiving rail — slot / queue / unload handoff</div>
                  <div className="soft-box">Weighbridge — weight evidence и proof</div>
                  <div className="soft-box">Documents — акт, ticket и evidence</div>
                </div>
              </div>
            </div>

            <ModuleHub
              title="Связанные rails"
              subtitle="Из dispatch detail оператор должен уходить в receiving, weight, support и linked deal rail."
              items={[
                { href: '/receiving', label: 'Receiving', detail: 'Закрыть slot handoff и queue-ready приёмку.', icon: '◫', meta: 'receiving', tone: 'blue' },
                { href: '/weighbridge', label: 'Weighbridge', detail: 'Проверить weight evidence по маршруту.', icon: '⚖', meta: 'weight', tone: 'green' },
                { href: '/support', label: 'Support', detail: 'Если маршрут упёрся в инцидент, открыть support rail.', icon: '!', meta: 'support', tone: 'amber' },
                { href: `/deals/${route.linkedDealId}`, label: 'Deal rail', detail: 'Проверить linked deal и следующий blocker исполнения.', icon: '≣', meta: route.linkedDealId, tone: 'gray' }
              ]}
            />

            <NextStepBar
              title="Провести handoff в следующий rail"
              detail={route.nextAction}
              primary={{ href: '/receiving', label: 'Открыть receiving' }}
              secondary={[{ href: '/weighbridge', label: 'Weighbridge' }, { href: '/support', label: 'Support' }]}
            />
          </>
        )}
      </PageFrame>
    </PageAccessGuard>
  );
}
