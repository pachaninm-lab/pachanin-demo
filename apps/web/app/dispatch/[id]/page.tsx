import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageAccessGuard } from '../../../components/page-access-guard';
import { LOGISTICS_ROLES } from '../../../lib/route-roles';
import { AppShell } from '../../../components/app-shell';
import { api, ApiError } from '../../../lib/api-client';
import { runtimeStore } from '../../../../../shared/runtime-store';
import { ModuleHub } from '../../../components/module-hub';
import { NextStepBar } from '../../../components/next-step-bar';
import { OperationBlueprint } from '../../../components/operation-blueprint';
import { readCommercialWorkspace, buildInsuranceView, buildSurveyView } from '../../../lib/commercial-workspace-store';

type Shipment = {
  id: string;
  carrier: string;
  driver: string;
  truck: string;
  status: string;
  eta: string;
  dealId?: string;
};

async function getShipment(id: string): Promise<Shipment | undefined> {
  try {
    const shipments = await api.get<any[]>('/logistics/shipments');
    return Array.isArray(shipments)
      ? shipments.find((shipment) => String(shipment.id) === id)
      : undefined;
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 404) return undefined;
    throw cause;
  }
}

export default async function DispatchRailPage({ params }: { params: { id: string } }) {
  const shipment = await getShipment(params.id);
  if (!shipment) notFound();

  const workspace = await readCommercialWorkspace();
  const insuranceView = buildInsuranceView(workspace);
  const surveyView = buildSurveyView(workspace);
  const routeEvents = runtimeStore.listHistory(30).filter((event) => {
    const payload = event.payload && typeof event.payload === 'object' ? (event.payload as any) : null;
    return payload?.shipmentId === params.id || payload?.linkedObjectId === params.id;
  });
  const linkedInsuranceCases = insuranceView.cases.filter((item) => item.linkedDealId === shipment.dealId || item.id === shipment.id);
  const linkedSurveyTasks = surveyView.tasks.filter((item) => item.linkedDealId === shipment.dealId || item.linkedObjectId === shipment.id);
  const routeRisk = linkedInsuranceCases.filter((item) => item.status !== 'POLICY_DRAFT').length + linkedSurveyTasks.filter((item) => item.status !== 'QUEUED').length;

  return (
    <PageAccessGuard allowedRoles={[...LOGISTICS_ROLES]} title="Dispatch rail ограничен" subtitle="Раздел доступен только логистическим и операционным ролям.">
      <AppShell title={`Dispatch rail · ${shipment.id}`} subtitle={`${shipment.driver} · ${shipment.truck}`}>
        <div className="page-surface">
          <section className="dashboard-grid-3">
            <div className="dashboard-card"><div className="dashboard-card-title">Перевозчик</div><div className="dashboard-card-value">{shipment.carrier}</div><div className="dashboard-card-caption">Владелец рейса</div></div>
            <div className="dashboard-card"><div className="dashboard-card-title">ETA</div><div className="dashboard-card-value">{shipment.eta}</div><div className="dashboard-card-caption">Последний прогноз</div></div>
            <div className="dashboard-card"><div className="dashboard-card-title">Риск routing</div><div className="dashboard-card-value">{routeRisk}</div><div className="dashboard-card-caption">Insurance / survey связанные с рейсом</div></div>
          </section>

          <ModuleHub
            title="Связанные rails по рейсу"
            subtitle="Dispatch rail должен связывать shipment не только с логистикой, но и со спорным, страховым и сюрвейным контуром."
            items={[
              { href: '/logistics', label: 'Логистика', detail: 'Вернуться к списку рейсов и owner action.', icon: '🚚', meta: shipment.status, tone: 'blue' },
              { href: '/driver-mobile', label: 'Mobile rail', detail: 'Подтверждение водителя, чек-листы и фотофиксация.', icon: '📱', meta: shipment.driver, tone: 'green' },
              { href: '/insurance', label: 'Страхование', detail: 'Сверить связанные кейсы и claim path по рейсу.', icon: '🛡', meta: `${linkedInsuranceCases.length} кейсов`, tone: routeRisk ? 'red' : 'gray' },
              { href: '/surveyor', label: 'Сюрвей', detail: 'Проверить инспекции и claim-attached задачи.', icon: '🧪', meta: `${linkedSurveyTasks.length} задач`, tone: linkedSurveyTasks.length ? 'amber' : 'gray' },
            ]}
          />

          <OperationBlueprint
            title="Как должен заканчиваться dispatch rail по рейсу"
            subtitle="У рейса должна быть не только карточка, но и понятное продолжение: mobile, ETA, survey/insurance и спорный хвост."
            stages={[
              { title: 'Привязка к рейсу', detail: 'Перевозчик закреплён за конкретным shipment id.', state: 'active', href: '/dispatch' },
              { title: 'Mobile follow-up', detail: 'Назначение водителя, маршрут и контроль фотофиксации.', state: 'pending', href: '/driver-mobile' },
              { title: 'Insurance / survey rail', detail: 'Риск-инциденты должны переходить в страховой или сюрвейный контур.', state: routeRisk ? 'risk' : 'active', href: '/insurance' },
              { title: 'Закрытие ETA и incident trail', detail: 'Финальная точка — завершённый рейс с owner action, а не просто “в пути”.', state: shipment.status === 'completed' ? 'done' : 'active', href: '/logistics' },
            ]}
            outcomes={[
              { href: '/insurance', label: 'Страхование', detail: 'Проверить claim path, policy и financial impact по рейсу.', meta: `${linkedInsuranceCases.length} кейсов` },
              { href: '/surveyor', label: 'Сюрвей', detail: 'Закрыть инспекции и спорные задачи до финального ETA.', meta: `${linkedSurveyTasks.length} задач` },
              { href: '/logistics', label: 'Логистика', detail: 'Вернуться к owner action и статусам рейса после incident review.', meta: shipment.status },
            ]}
            rules={[
              'Рейс не должен жить отдельно от risk rails: survey и insurance обязаны быть связаны по linkedObjectId/dealId.',
              'Любой инцидент должен иметь следующий маршрут: claim, survey task или owner action логистики.',
              'Dispatch rail считается закрытым только когда подтверждены ETA, статусы и связанный спорный/страховой хвост.'
            ]}
          />

          <section className="section-card" style={{ marginTop: 24 }}>
            <div className="section-title">Timeline событий по рейсу</div>
            <div className="muted small" style={{ marginBottom: 16 }}>Показываем только события, связанные с текущим shipment id.</div>
            <div className="section-stack">
              {routeEvents.length ? routeEvents.map((event) => (
                <div key={event.id} className="list-row">
                  <div>
                    <div style={{ fontWeight: 700 }}>{event.kind}</div>
                    <div className="muted small">{event.at} · {event.by}</div>
                  </div>
                  <div className="mini-chip">history</div>
                </div>
              )) : <div className="empty-state">История по рейсу ещё не накоплена.</div>}
            </div>
          </section>

          <NextStepBar
            title="Открыть следующий rail по рейсу"
            detail={`${shipment.driver} · ${shipment.truck} · ${shipment.status}`}
            primary={{ href: '/driver-mobile', label: 'Открыть mobile rail' }}
            secondary={[
              { href: '/insurance', label: 'Страхование' },
              { href: '/surveyor', label: 'Сюрвей' },
              { href: '/logistics', label: 'Логистика' },
            ]}
          />
        </div>
      </AppShell>
    </PageAccessGuard>
  );
}
