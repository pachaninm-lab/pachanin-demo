import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageAccessGuard } from '../../../components/page-access-guard';
import { LOGISTICS_ROLES } from '../../../lib/route-roles';
import { AppShell } from '../../../components/app-shell';
import { buildLogisticsView } from '../../../lib/commercial-workspace-store';
import { OperationBlueprint } from '../../../components/operation-blueprint';
import { ModuleHub } from '../../../components/module-hub';
import { NextStepBar } from '../../../components/next-step-bar';

export default async function LogisticsRailPage({ params }: { params: { id: string } }) {
  const logisticsView = buildLogisticsView();
  const route = logisticsView.routes.find((item) => item.id === params.id);
  if (!route) notFound();
  const linkedIncidents = logisticsView.incidents.filter((item) => item.routeId === route.id || item.linkedObjectId === route.id);

  return (
    <PageAccessGuard allowedRoles={[...LOGISTICS_ROLES]} title="Логистический rail ограничен" subtitle="Раздел доступен только логистическим и операционным ролям.">
      <AppShell title={`Логистический rail · ${route.id}`} subtitle={`${route.driverName} · ${route.truckNumber}`}>
        <div className="page-surface">
          <section className="dashboard-grid-3">
            <div className="dashboard-card"><div className="dashboard-card-title">Маршрут</div><div className="dashboard-card-value">{route.originLabel}</div><div className="dashboard-card-caption">→ {route.destinationLabel}</div></div>
            <div className="dashboard-card"><div className="dashboard-card-title">ETA</div><div className="dashboard-card-value">{route.etaLabel}</div><div className="dashboard-card-caption">Последний прогноз</div></div>
            <div className="dashboard-card"><div className="dashboard-card-title">Incidents</div><div className="dashboard-card-value">{linkedIncidents.length}</div><div className="dashboard-card-caption">Связанные риск-события</div></div>
          </section>

          <ModuleHub
            title="Связанные rails по рейсу"
            subtitle="Каждый рейс обязан иметь следующий маршрут: weighbridge, mobile, survey/insurance при отклонениях."
            items={[
              { href: '/dispatch', label: 'Dispatch', detail: 'Проверить owner action и carrier assignment.', icon: '🧭', meta: route.status, tone: 'blue' },
              { href: '/driver-mobile', label: 'Driver mobile', detail: 'Проверить чек-лист, доказательства и incident feed.', icon: '📱', meta: route.driverName, tone: 'green' },
              { href: '/weighbridge', label: 'Весовая', detail: 'Сверить контроль веса и привязанный evidence.', icon: '⚖️', meta: 'weight rail', tone: 'amber' },
              { href: '/surveyor', label: 'Сюрвей / страхование', detail: 'Если есть инцидент — перевод в risk rail обязателен.', icon: '🧪', meta: `${linkedIncidents.length} incidents`, tone: linkedIncidents.length ? 'red' : 'gray' },
            ]}
          />

          <OperationBlueprint
            title="Как должен заканчиваться логистический rail"
            subtitle="У рейса должен быть понятный operational closeout: ETA, evidence, incident outcome и следующий rail при проблеме."
            stages={[
              { title: 'Dispatch owner action', detail: 'Проверить назначение перевозчика и owner action диспетчера.', state: 'active', href: '/dispatch' },
              { title: 'Mobile follow-up', detail: 'Водитель и маршрут должны быть видны в mobile rail.', state: 'pending', href: '/driver-mobile' },
              { title: 'Weight / unload evidence', detail: 'Закрепить вес и доказательства выполнения рейса.', state: 'pending', href: '/weighbridge' },
              { title: 'Incident resolution', detail: 'Инциденты должны уйти в claim/survey rail, а не зависнуть в карточке рейса.', state: linkedIncidents.length ? 'risk' : 'active', href: '/surveyor' },
            ]}
            outcomes={[
              { href: '/driver-mobile', label: 'Mobile rail', detail: 'Проверить последний чек-лист и фотофиксацию.', meta: route.driverName },
              { href: '/weighbridge', label: 'Weight rail', detail: 'Зафиксировать вес, отклонения и unload outcome.', meta: route.weightStatus },
              { href: '/surveyor', label: 'Risk rail', detail: 'Открыть страховой/сюрвейный путь для инцидентов.', meta: `${linkedIncidents.length} incidents` },
            ]}
            rules={[
              'Рейс считается закрытым только когда у него понятен owner action и outcome по ETA/weight/incidents.',
              'Любой incident должен иметь следующий rail: survey, claim или operator review.',
              'Логистическая карточка не должна быть конечной точкой — после неё обязаны идти mobile и evidence rails.'
            ]}
          />

          <section className="section-card" style={{ marginTop: 24 }}>
            <div className="section-title">Incident feed по рейсу</div>
            <div className="section-stack" style={{ marginTop: 16 }}>
              {linkedIncidents.length ? linkedIncidents.map((incident) => (
                <div key={incident.id} className="list-row">
                  <div>
                    <div style={{ fontWeight: 700 }}>{incident.type}</div>
                    <div className="muted small">{incident.description}</div>
                  </div>
                  <span className={`status-pill ${incident.severity === 'critical' ? 'red' : 'amber'}`}>{incident.severity}</span>
                </div>
              )) : <div className="empty-state">Инцидентов по рейсу нет.</div>}
            </div>
          </section>

          <NextStepBar
            title="Открыть следующий rail"
            detail={`${route.driverName} · ${route.truckNumber} · ${route.status}`}
            primary={{ href: '/driver-mobile', label: 'Driver mobile' }}
            secondary={[{ href: '/weighbridge', label: 'Весовая' }, { href: '/surveyor', label: 'Risk rail' }]}
          />
        </div>
      </AppShell>
    </PageAccessGuard>
  );
}
