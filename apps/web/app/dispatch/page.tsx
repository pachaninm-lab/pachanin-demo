'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '../../lib/api-client';
import { carrierMarketplaceOffers } from '../../lib/commercial-expansion-data';
import { commercialFetch, CommercialApiError } from '../../lib/commercial-api';
import { PageAccessGuard } from '../../components/page-access-guard';
import { LOGISTICS_ROLES } from '../../lib/route-roles';
import { AppShell } from '../../components/app-shell';
import { ModuleHub } from '../../components/module-hub';
import { NextStepBar } from '../../components/next-step-bar';
import { OperationBlueprint } from '../../components/operation-blueprint';
import { ActionOutcomePanel } from '../../components/action-outcome-panel';
import { ServiceProviderSelectionPanel } from '../../components/service-provider-selection-panel';
import { ServiceProviderAssignmentConsole } from '../../components/service-provider-assignment-console';
import { buildProviderStagePlan } from '../../../../packages/domain-core/src';
import { buildProviderContextFromWorkspace, describeProviderContext } from '../../lib/provider-stage-context';
import { readCommercialWorkspace } from '../../lib/commercial-workspace-store';

type Shipment = {
  id: string;
  carrier: string;
  driver: string;
  truck: string;
  status: string;
  eta: string;
  source?: 'runtime' | 'commercial';
  offerId?: string;
};

const COMMERCIAL_RAIL_KEY = 'tpCommercialDispatchRail';

type RailPreset = {
  selectedOfferIds: string[];
  linkedShipmentId?: string | null;
};

function loadRailPreset(): RailPreset {
  if (typeof window === 'undefined') return { selectedOfferIds: [] };
  try {
    const raw = window.localStorage.getItem(COMMERCIAL_RAIL_KEY);
    if (!raw) return { selectedOfferIds: [] };
    const parsed = JSON.parse(raw);
    const selectedOfferIds = Array.isArray(parsed?.selectedOfferIds) ? parsed.selectedOfferIds.filter((item: unknown) => typeof item === 'string') : [];
    const linkedShipmentId = typeof parsed?.linkedShipmentId === 'string' ? parsed.linkedShipmentId : null;
    return { selectedOfferIds, linkedShipmentId };
  } catch {
    return { selectedOfferIds: [] };
  }
}

function saveRailPreset(payload: RailPreset) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(COMMERCIAL_RAIL_KEY, JSON.stringify(payload));
}

function ShipmentRail({ selectedShipmentId, onSelect, shipments }: { selectedShipmentId?: string; onSelect: (id: string) => void; shipments: Shipment[] }) {
  return (
    <div className="section-card space-y-4" style={{ marginTop: 24 }}>
      <div>
        <div className="section-title">Оперативный rail</div>
        <div className="muted small">Список рейсов, которые уже заведены в исполнение. Любой новый запрос перевозчику должен привязываться к рейсу, а не жить отдельно.</div>
      </div>
      <div className="section-stack">
        {shipments.map((shipment) => {
          const isActive = shipment.id === selectedShipmentId;
          return (
            <button
              key={shipment.id}
              type="button"
              onClick={() => onSelect(shipment.id)}
              className="list-row"
              style={{
                width: '100%',
                textAlign: 'left',
                borderRadius: 14,
                border: isActive ? '1px solid rgba(10,92,54,0.35)' : '1px solid rgba(15,23,42,0.08)',
                background: isActive ? 'rgba(10,92,54,0.08)' : 'rgba(255,255,255,0.96)',
                boxShadow: isActive ? '0 20px 44px -30px rgba(10,92,54,0.35)' : '0 18px 42px -34px rgba(15,23,42,0.12)',
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>{shipment.driver} · {shipment.truck}</div>
                <div className="muted small">{shipment.carrier} · ETA {shipment.eta} · {shipment.source === 'commercial' ? 'коммерческий rail' : 'runtime rail'}</div>
              </div>
              <div className="list-row-meta">
                <span className="status-pill gray">{shipment.status}</span>
                {shipment.offerId ? <span className="mini-chip">offer #{shipment.offerId}</span> : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DispatchPageInner() {
  const params = useSearchParams();
  const dealId = params.get('dealId') ?? undefined;
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | undefined>();
  const [selectedOfferIds, setSelectedOfferIds] = useState<string[]>([]);
  const [submittingOfferIds, setSubmittingOfferIds] = useState<string[]>([]);
  const [selectionMessage, setSelectionMessage] = useState<string | null>(null);
  const [selectionTone, setSelectionTone] = useState<'green' | 'red'>('green');
  const [workspace, setWorkspace] = useState<any>(null);
  const [workspaceStatus, setWorkspaceStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setStatus('loading');
      setError(null);
      try {
        const runtimeShipments = await api.get<any[]>('/logistics/shipments');
        const runtimeMapped: Shipment[] = Array.isArray(runtimeShipments)
          ? runtimeShipments.map((shipment: any) => ({
              id: String(shipment.id),
              carrier: shipment.carrier ?? 'Перевозчик',
              driver: shipment.driver ?? 'Водитель',
              truck: shipment.truck ?? 'ТС',
              status: shipment.status ?? 'В пути',
              eta: shipment.eta ?? '—',
              source: 'runtime',
            }))
          : [];

        let commercialMapped: Shipment[] = [];
        try {
          const offers = await commercialFetch<any[]>('/carrier-marketplace/offers');
          commercialMapped = Array.isArray(offers)
            ? offers.map((offer: any, index: number) => ({
                id: `offer-${offer.id ?? index}`,
                carrier: offer.carrierName ?? 'Коммерческий перевозчик',
                driver: offer.driverName ?? 'Назначается',
                truck: offer.truckNumber ?? offer.fleetTag ?? 'ТС',
                status: offer.status ?? 'Предложение',
                eta: offer.eta ?? offer.pickupWindow ?? 'Ожидает',
                source: 'commercial',
                offerId: String(offer.id ?? index),
              }))
            : [];
        } catch (commercialError) {
          if (!(commercialError instanceof CommercialApiError && commercialError.status === 404)) {
            console.warn('carrier-marketplace offers unavailable', commercialError);
          }
        }

        if (cancelled) return;
        const merged = [...runtimeMapped, ...commercialMapped];
        setShipments(merged);
        setSelectedShipmentId((prev) => prev ?? merged[0]?.id);
        const preset = loadRailPreset();
        if (preset.selectedOfferIds.length > 0) {
          setSelectedOfferIds(preset.selectedOfferIds.filter((item) => commercialMapped.some((shipment) => shipment.offerId === item)));
        }
        if (preset.linkedShipmentId && merged.some((shipment) => shipment.id === preset.linkedShipmentId)) {
          setSelectedShipmentId(preset.linkedShipmentId);
        }
        setStatus('ready');
      } catch (cause) {
        if (cancelled) return;
        const nextError = cause instanceof ApiError ? cause.message : 'Не удалось загрузить rail dispatch';
        setError(nextError);
        setStatus('error');
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!dealId) {
      setWorkspace(null);
      setWorkspaceStatus('idle');
      setWorkspaceError(null);
      return;
    }
    let cancelled = false;
    async function loadWorkspace() {
      setWorkspaceStatus('loading');
      setWorkspaceError(null);
      try {
        const result = await readCommercialWorkspace();
        if (!cancelled) {
          setWorkspace(result);
          setWorkspaceStatus('ready');
        }
      } catch (cause) {
        if (!cancelled) {
          setWorkspace(null);
          setWorkspaceStatus('error');
          setWorkspaceError(cause instanceof Error ? cause.message : 'Не удалось загрузить commercial workspace');
        }
      }
    }
    void loadWorkspace();
    return () => {
      cancelled = true;
    };
  }, [dealId]);

  const actionState = useMemo(() => {
    if (!selectionMessage) return null;
    return {
      tone: selectionTone,
      title: selectionTone === 'green' ? 'Привязка перевозчика обновлена' : 'Не удалось привязать перевозчика',
      detail: selectionMessage,
      badge: selectionTone === 'green' ? 'rail synced' : 'rail blocked',
    };
  }, [selectionMessage, selectionTone]);

  const selectedShipment = useMemo(() => shipments.find((shipment) => shipment.id === selectedShipmentId), [shipments, selectedShipmentId]);
  const availableOffers = useMemo(() => carrierMarketplaceOffers.map((offer) => ({ ...offer, id: String(offer.id) })), []);
  const linkedOffers = useMemo(() => availableOffers.filter((offer) => selectedOfferIds.includes(offer.id)), [availableOffers, selectedOfferIds]);
  const unlinkedOffers = useMemo(() => availableOffers.filter((offer) => !selectedOfferIds.includes(offer.id)), [availableOffers, selectedOfferIds]);
  const dispatchContext = useMemo(() => buildProviderContextFromWorkspace('DISPATCH', workspace, { docsReady: status === 'ready', linkedObjectId: selectedShipment?.id ?? null }), [workspace, status, selectedShipment?.id]);
  const dispatchPlan = useMemo(() => buildProviderStagePlan('DISPATCH', dispatchContext), [dispatchContext]);
  const logisticsPolicy = dispatchPlan.items.find((item) => item.category === 'LOGISTICS');

  useEffect(() => {
    saveRailPreset({ selectedOfferIds, linkedShipmentId: selectedShipmentId ?? null });
  }, [selectedOfferIds, selectedShipmentId]);

  async function handleSelectOffer(offerId: string) {
    if (!selectedShipmentId) return;
    setSubmittingOfferIds((prev) => [...prev, offerId]);
    setSelectionMessage(null);
    try {
      await commercialFetch(`/carrier-marketplace/offers/${offerId}/select`, {
        method: 'POST',
        body: JSON.stringify({ shipmentId: selectedShipmentId, dealId }),
      });
      setSelectedOfferIds((prev) => (prev.includes(offerId) ? prev : [...prev, offerId]));
      setSelectionTone('green');
      setSelectionMessage(`Offer ${offerId} привязан к рейсу ${selectedShipmentId}. Следующий шаг — закрепить назначение в dispatch rail.`);
    } catch (cause) {
      setSelectionTone('red');
      setSelectionMessage(cause instanceof CommercialApiError ? cause.message : 'Не удалось выбрать коммерческого перевозчика');
    } finally {
      setSubmittingOfferIds((prev) => prev.filter((item) => item !== offerId));
    }
  }

  async function handleUnselectOffer(offerId: string) {
    if (!selectedShipmentId) return;
    setSubmittingOfferIds((prev) => [...prev, offerId]);
    setSelectionMessage(null);
    try {
      await commercialFetch(`/carrier-marketplace/offers/${offerId}/unselect`, {
        method: 'POST',
        body: JSON.stringify({ shipmentId: selectedShipmentId, dealId }),
      });
      setSelectedOfferIds((prev) => prev.filter((item) => item !== offerId));
      setSelectionTone('green');
      setSelectionMessage(`Offer ${offerId} снят с рейса ${selectedShipmentId}. Rail обновлён.`);
    } catch (cause) {
      setSelectionTone('red');
      setSelectionMessage(cause instanceof CommercialApiError ? cause.message : 'Не удалось снять коммерческого перевозчика');
    } finally {
      setSubmittingOfferIds((prev) => prev.filter((item) => item !== offerId));
    }
  }

  return (
    <PageAccessGuard allowedRoles={[...LOGISTICS_ROLES]} title="Диспетчеризация ограничена" subtitle="Раздел доступен только логистическим и операционным ролям.">
      <AppShell title="Диспетчеризация" subtitle="Назначение перевозчиков, маршрут и контроль рейсов.">
        <div className="page-surface">
          <ModuleHub
            title="Связанные функции dispatch rail"
            subtitle="Каждое назначение перевозчика должно упираться в сделку, provider readiness и мобильный follow-up."
            items={[
              { href: '/service-providers', label: 'Исполнители', detail: 'Проверить доступность перевозчиков, сюрвея и склада в общем rail.', icon: '🧩', meta: 'provider rail', tone: 'blue' },
              { href: '/logistics', label: 'Логистика', detail: 'Контроль отгрузки, ETA и статусов по рейсам.', icon: '🚚', meta: `${shipments.length} рейсов`, tone: 'green' },
              { href: '/driver-mobile', label: 'Мобильный маршрут', detail: 'Подтверждение водителя, контроль инцидентов и фотофиксация.', icon: '📱', meta: 'mobile ready', tone: 'amber' },
              { href: '/dispatch-center', label: 'Dispatch center', detail: 'Очередь действий диспетчера и контроль owner action.', icon: '🛠', meta: dealId ? 'deal scoped' : 'global', tone: 'gray' },
            ]}
          />
          <ShipmentRail selectedShipmentId={selectedShipmentId} onSelect={setSelectedShipmentId} shipments={shipments} />
          {selectedShipment ? (
            <section className="section-card space-y-4" style={{ marginTop: 24 }}>
              <div className="section-title">Коммерческий rail перевозчиков</div>
              <div className="muted small">Выбирай офферы и сразу привязывай их к рейсу. После выбора оффер должен перейти в dispatch rail, а не жить отдельно от сделки.</div>
              <div className="section-stack">
                {linkedOffers.map((offer) => (
                  <div key={offer.id} className="list-row" style={{ borderRadius: 14, border: '1px solid rgba(10,92,54,0.16)', background: 'rgba(10,92,54,0.06)' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{offer.carrierName}</div>
                      <div className="muted small">{offer.truckNumber} · {offer.pickupWindow} · рейтинг {offer.rating}/5</div>
                    </div>
                    <div className="list-row-meta">
                      <span className="status-pill green">Привязан</span>
                      <button
                        type="button"
                        className="secondary-link"
                        disabled={submittingOfferIds.includes(offer.id)}
                        onClick={() => void handleUnselectOffer(offer.id)}
                      >
                        Отвязать
                      </button>
                    </div>
                  </div>
                ))}
                {unlinkedOffers.map((offer) => (
                  <div key={offer.id} className="list-row" style={{ borderRadius: 14, border: '1px solid rgba(15,23,42,0.08)', background: 'rgba(255,255,255,0.96)' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{offer.carrierName}</div>
                      <div className="muted small">{offer.truckNumber} · {offer.pickupWindow} · ставка {offer.offerRate.toLocaleString('ru-RU')} ₽/т</div>
                    </div>
                    <div className="list-row-meta">
                      <span className="mini-chip">ETA {offer.eta}</span>
                      <button
                        type="button"
                        className="secondary-link"
                        disabled={submittingOfferIds.includes(offer.id)}
                        onClick={() => void handleSelectOffer(offer.id)}
                      >
                        Привязать
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {actionState ? <ActionOutcomePanel tone={actionState.tone} title={actionState.title} detail={actionState.detail} badge={actionState.badge} /> : null}
            </section>
          ) : null}
          <OperationBlueprint
            title="Как должен завершаться dispatch rail"
            subtitle={'Назначение перевозчика не должно заканчиваться на кнопке «Выбрать». Дальше обязательны подтверждение роли, привязка к рейсу и вход в mobile/execution rail.'}
            stages={[
              { title: 'Выбор оффера', detail: 'Коммерческий rail выбирает перевозчика и ставку.', state: selectedOfferIds.length ? 'active' : 'pending', href: '/dispatch' },
              { title: 'Закрепление в dispatch', detail: 'Оффер должен быть привязан к конкретному рейсу и owner action диспетчера.', state: selectedShipment ? 'active' : 'pending', href: '/dispatch-center' },
              { title: 'Подтверждение водителя / mobile', detail: 'После назначения перевозчик обязан попасть в mobile rail и маршрут исполнения.', state: selectedOfferIds.length ? 'risk' : 'pending', href: '/driver-mobile' },
              { title: 'Логистика и ETA', detail: 'Финальная точка — рабочий рейс с контролем статусов и ETA, а не просто связь в чате.', state: shipments.length ? 'active' : 'pending', href: '/logistics' },
            ]}
            outcomes={[
              { href: '/service-providers', label: 'Исполнители', detail: 'Проверить допуск перевозчика, сюрвея и склада перед dispatch assign.', meta: 'provider gate' },
              { href: '/driver-mobile', label: 'Mobile rail', detail: 'Передать назначение водителю и открыть follow-up на маршруте.', meta: selectedOfferIds.length ? 'assignment ready' : 'awaiting assign' },
              { href: '/dispatch-center', label: 'Dispatch queue', detail: 'Закрыть owner action диспетчера и зафиксировать rail follow-up.', meta: selectedShipment ? selectedShipment.id : 'no shipment' },
            ]}
            rules={[
              'Нельзя считать логистический контур закрытым, если перевозчик выбран, но не привязан к конкретному рейсу.',
              'Коммерческий и операционный rails должны быть связаны: offer → shipment → driver/mobile → ETA.',
              'Любое назначение должно завершаться owner action диспетчера и входом в следующий rail, а не устной договорённостью.'
            ]}
          />
          {logisticsPolicy ? (
            <>
              <ServiceProviderSelectionPanel
                title="Rail исполнителей для dispatch"
                subtitle={`Выбранный рейс должен пройти через логистический rail: ${describeProviderContext(dispatchContext) || 'готовность логистики и сопровождения'}.`}
                selection={logisticsPolicy.selection}
                policy={logisticsPolicy}
                primaryHref="/service-providers"
                primaryLabel="Открыть rail исполнителей"
              />
              <ServiceProviderAssignmentConsole
                stage="DISPATCH"
                category="LOGISTICS"
                linkedObjectType="SHIPMENT"
                linkedObjectId={selectedShipment?.id ?? 'dispatch-preset'}
                linkedDealId={dealId ?? null}
                context={dispatchContext}
                policy={logisticsPolicy}
              />
            </>
          ) : null}
          <section className="section-card" style={{ marginTop: 24 }}>
            <div className="section-title">Коммерческий контур</div>
            <div className="muted small" style={{ marginBottom: 16 }}>
              Dispatch должен видеть связанные коммерческие rails: страхование, сюрвей и состояние workspace по сделке.
            </div>
            {workspaceStatus === 'loading' ? <div className="empty-state">Загружаю workspace…</div> : null}
            {workspaceStatus === 'error' ? <div className="empty-state">{workspaceError}</div> : null}
            {workspaceStatus === 'ready' && workspace ? (
              <div className="dashboard-grid-3">
                <div className="dashboard-card">
                  <div className="dashboard-card-title">Insurance rail</div>
                  <div className="dashboard-card-value">{workspace.insuranceCases.length}</div>
                  <div className="dashboard-card-caption">Кейсов страхования в linked workspace</div>
                </div>
                <div className="dashboard-card">
                  <div className="dashboard-card-title">Survey rail</div>
                  <div className="dashboard-card-value">{workspace.surveyTasks.length}</div>
                  <div className="dashboard-card-caption">Полевые задачи сюрвея по этой сделке</div>
                </div>
                <div className="dashboard-card">
                  <div className="dashboard-card-title">Provider sync</div>
                  <div className="dashboard-card-value">{linkedOffers.length}</div>
                  <div className="dashboard-card-caption">Коммерческих перевозчиков уже привязано к рейсам</div>
                </div>
              </div>
            ) : null}
          </section>
          <NextStepBar
            title={selectedShipment ? `Закрыть rail по рейсу ${selectedShipment.id}` : 'Выбери рейс для dispatch'}
            detail={selectedShipment ? `${selectedShipment.driver} · ${selectedShipment.truck}` : 'Сначала нужен активный рейс.'}
            primary={selectedShipment ? { href: `/dispatch/${selectedShipment.id}`, label: 'Открыть dispatch rail' } : undefined}
            secondary={[
              { href: '/logistics', label: 'Логистика' },
              { href: '/service-providers', label: 'Исполнители' },
            ]}
          />
        </div>
      </AppShell>
    </PageAccessGuard>
  );
}

export default function DispatchPage() {
  return <Suspense fallback={<div className="muted">Загрузка...</div>}><DispatchPageInner /></Suspense>;
}
