'use client';

import Link from 'next/link';
import { P7ExecutionMachineReadOnlyStrip } from '@/components/platform-v7/P7ExecutionMachineReadOnlyStrip';
import {
  SANDBOX_INCIDENTS,
  SANDBOX_LOGISTICS_ORDERS,
  SANDBOX_ROUTE_LEGS,
  buildLogisticsProjection,
  type LogisticsOrderStatus,
} from '@/lib/platform-v7/logistics-chain';
import { PLATFORM_V7_EXECUTION_SOURCE } from '@/lib/platform-v7/deal-execution-source-of-truth';

const S = 'var(--pc-bg-card)';
const SS = 'var(--pc-bg-elevated)';
const B = 'var(--pc-border)';
const T = 'var(--pc-text-primary)';
const M = 'var(--pc-text-secondary)';
const BRAND = '#0A7A5F';
const BRAND_BG = 'rgba(10,122,95,0.08)';
const BRAND_BORDER = 'rgba(10,122,95,0.18)';
const WARN_BG = 'rgba(217,119,6,0.08)';
const WARN_BORDER = 'rgba(217,119,6,0.18)';
const WARN = '#B45309';
const ERR_BG = 'rgba(220,38,38,0.08)';
const ERR_BORDER = 'rgba(220,38,38,0.18)';
const ERR = '#B91C1C';
const INFO_BG = 'rgba(37,99,235,0.06)';
const INFO_BORDER = 'rgba(37,99,235,0.18)';
const INFO = '#2563EB';

function orderStatusTone(status: LogisticsOrderStatus) {
  if (status === 'completed') return { bg: BRAND_BG, border: BRAND_BORDER, color: BRAND, label: 'Завершён' };
  if (status === 'in_transit') return { bg: INFO_BG, border: INFO_BORDER, color: INFO, label: 'В пути' };
  if (status === 'arrived') return { bg: BRAND_BG, border: BRAND_BORDER, color: BRAND, label: 'Прибыл' };
  if (status === 'unloading') return { bg: INFO_BG, border: INFO_BORDER, color: INFO, label: 'Выгрузка' };
  if (status === 'loading_started' || status === 'loading_done') return { bg: WARN_BG, border: WARN_BORDER, color: WARN, label: 'Погрузка' };
  if (status === 'loading_scheduled') return { bg: WARN_BG, border: WARN_BORDER, color: WARN, label: 'Ожидает погрузки' };
  if (status === 'carrier_assigned' || status === 'carrier_matching') return { bg: INFO_BG, border: INFO_BORDER, color: INFO, label: 'Назначение перевозчика' };
  if (status === 'incident') return { bg: ERR_BG, border: ERR_BORDER, color: ERR, label: 'Инцидент' };
  if (status === 'cancelled') return { bg: SS, border: B, color: M, label: 'Отменён' };
  return { bg: SS, border: B, color: M, label: 'Черновик' };
}

function btn(): React.CSSProperties {
  return { textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: SS, border: `1px solid ${B}`, color: T, fontSize: 13, fontWeight: 700 };
}

export default function LogisticsPage() {
  const orders = SANDBOX_LOGISTICS_ORDERS;
  const legs = SANDBOX_ROUTE_LEGS;
  const incidents = SANDBOX_INCIDENTS;

  const projections = orders.map((order) => {
    const orderLegs = legs.filter((leg) => leg.logisticsOrderId === order.id);
    const orderIncidents = incidents.filter((incident) => incident.logisticsOrderId === order.id);
    return buildLogisticsProjection(order, orderLegs, null, orderIncidents);
  });

  const inTransit = orders.filter((order) => order.status === 'in_transit').length;
  const arrived = orders.filter((order) => order.status === 'arrived').length;
  const openIncidents = incidents.filter((incident) => incident.status === 'open' || incident.status === 'under_review').length;
  const totalDeals = new Set(orders.map((order) => order.dealId)).size;

  return (
    <div style={{ display: 'grid', gap: 18, padding: '8px 0' }}>
      <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, color: M, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Логистика · <span style={{ color: WARN }}>sandbox</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: T, marginTop: 8, lineHeight: 1.1 }}>Диспетчерская</div>
            <div style={{ marginTop: 8, fontSize: 14, color: M, maxWidth: 760 }}>
              Логистический заказ привязан к сделке. Экран показывает sandbox projection: заказ → рейсы → инциденты → транспортный gate. Live GPS, перевозчик и ЭДО здесь не заявляются.
            </div>
          </div>
          <Link href='/platform-v7/control-tower' style={btn()}>Башня управления</Link>
        </div>
      </section>

      <P7ExecutionMachineReadOnlyStrip compact />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14 }}>
        {[
          { label: 'В пути', value: String(inTransit), color: INFO },
          { label: 'Прибыли', value: String(arrived), color: BRAND },
          { label: 'Инцидентов', value: String(openIncidents), color: openIncidents > 0 ? ERR : BRAND },
          { label: 'Сделок охвачено', value: String(totalDeals), color: T },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: S, border: `1px solid ${B}`, borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 11, color: M, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 900, color, marginTop: 8, lineHeight: 1.1 }}>{value}</div>
          </div>
        ))}
      </div>

      {openIncidents > 0 ? (
        <section style={{ background: ERR_BG, border: `1px solid ${ERR_BORDER}`, borderRadius: 14, padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: ERR, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Открытые инциденты ({openIncidents})
          </div>
          {incidents
            .filter((incident) => incident.status === 'open' || incident.status === 'under_review')
            .map((incident) => (
              <div key={incident.id} style={{ marginTop: 8, fontSize: 13, color: T }}>
                <strong>{incident.type}</strong> · {incident.description}
                {incident.moneyImpact ? <span style={{ marginLeft: 8, color: ERR, fontWeight: 700 }}>риск {incident.moneyImpact.toLocaleString('ru-RU')} ₽</span> : null}
              </div>
            ))}
        </section>
      ) : null}

      <DL9102LogisticsCard />

      <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: T, marginBottom: 14 }}>Логистические заказы</div>
        <div style={{ display: 'grid', gap: 12 }}>
          {orders.map((order, index) => {
            const projection = projections[index];
            const tone = orderStatusTone(order.status);
            const orderLegs = legs.filter((leg) => leg.logisticsOrderId === order.id);
            return (
              <div key={order.id} style={{ background: SS, border: `1px solid ${B}`, borderRadius: 14, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 13, color: BRAND }}>{order.id}</span>
                    <span style={{ marginLeft: 8, fontSize: 13, color: M }}>→ Сделка</span>
                    <Link href={`/platform-v7/deals/${order.dealId}`} style={{ marginLeft: 6, fontFamily: 'monospace', fontSize: 13, fontWeight: 800, color: BRAND, textDecoration: 'none' }}>
                      {order.dealId}
                    </Link>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color }}>
                    {tone.label}
                  </span>
                </div>

                <div style={{ fontSize: 14, fontWeight: 800, color: T, marginTop: 10 }}>{order.grain} · {order.volumeTons} т</div>
                <div style={{ fontSize: 12, color: M, marginTop: 4 }}>
                  {order.originRegion} → {order.destinationRegion}
                  {order.carrierName ? <span style={{ marginLeft: 8 }}>· {order.carrierName}</span> : null}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8, marginTop: 12 }}>
                  <SmallCell label='Рейсов' value={`${projection.completedLegs}/${projection.totalLegs}`} />
                  <SmallCell label='Инцидентов' value={String(projection.openIncidents)} danger={projection.openIncidents > 0} />
                  <SmallCell label='Транспортный gate' value={projection.transportGateCleared ? 'Очищен' : 'Блокирован'} danger={!projection.transportGateCleared} good={projection.transportGateCleared} />
                </div>

                {projection.deviations.length > 0 ? (
                  <div style={{ marginTop: 10, background: WARN_BG, border: `1px solid ${WARN_BORDER}`, borderRadius: 8, padding: 10, fontSize: 12, color: WARN }}>
                    {projection.deviations.map((deviation) => <div key={deviation}>⚠ {deviation}</div>)}
                  </div>
                ) : null}

                {orderLegs.length > 0 ? (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 11, color: M, fontWeight: 800, textTransform: 'uppercase', marginBottom: 6 }}>Рейсы</div>
                    {orderLegs.map((leg) => (
                      <div key={leg.id} style={{ fontSize: 12, color: T, padding: '6px 0', borderTop: `1px solid ${B}` }}>
                        <span style={{ fontWeight: 700 }}>{leg.sequence}.</span> {leg.originName} → {leg.destinationName}
                        {leg.driverRef ? <span style={{ marginLeft: 8, color: M }}>· {leg.driverRef.name}</span> : null}
                        {leg.vehicleRef ? <span style={{ marginLeft: 8, fontFamily: 'monospace', fontSize: 11, color: M }}>{leg.vehicleRef.plate}</span> : null}
                        {leg.deviationNote ? <span style={{ marginLeft: 8, color: WARN, fontWeight: 700 }}>⚠ {leg.deviationNote}</span> : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function DL9102LogisticsCard() {
  const { deal, logistics } = PLATFORM_V7_EXECUTION_SOURCE;
  const gateColor = logistics.gateStatus === 'готово' ? BRAND : logistics.gateStatus === 'стоп' ? ERR : WARN;
  const gateBg = logistics.gateStatus === 'готово' ? BRAND_BG : logistics.gateStatus === 'стоп' ? ERR_BG : WARN_BG;
  const gateBorder = logistics.gateStatus === 'готово' ? BRAND_BORDER : logistics.gateStatus === 'стоп' ? ERR_BORDER : WARN_BORDER;

  return (
    <section style={{ background: S, border: `1px solid ${BRAND_BORDER}`, borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
      <div>
        <div style={{ fontSize: 11, color: BRAND, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Демо-сделка · проверочный контур · {deal.maturity}</div>
        <div style={{ marginTop: 4, fontSize: 18, fontWeight: 900, color: T }}>{deal.id} · {logistics.orderId}</div>
        <div style={{ marginTop: 4, fontSize: 13, color: M }}>{deal.lotId} · {deal.crop} · {deal.basis}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
        {[
          { label: 'Перевозчик', value: logistics.carrier },
          { label: 'Водитель', value: logistics.driverAlias },
          { label: 'Транспорт', value: logistics.vehicleMasked },
          { label: 'Погрузка', value: logistics.pickupPoint },
          { label: 'Доставка', value: logistics.deliveryPoint },
          { label: 'Расчётный срок', value: logistics.eta },
          { label: 'Текущий этап', value: logistics.currentLeg },
          { label: 'Инциденты', value: logistics.incidentStatus },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: SS, border: `1px solid ${B}`, borderRadius: 12, padding: 10 }}>
            <div style={{ fontSize: 10, color: M, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
            <div style={{ marginTop: 4, fontSize: 13, fontWeight: 800, color: T }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ background: gateBg, border: `1px solid ${gateBorder}`, borderRadius: 12, padding: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 900, color: gateColor }}>Транспортный gate:</span>
        <span style={{ fontSize: 12, color: gateColor, fontWeight: 800 }}>{logistics.gateStatus}</span>
        <span style={{ fontSize: 11, color: M }}>· Live GPS, ЭДО и боевой перевозчик здесь не заявляются (имитация проверочного контура)</span>
      </div>
    </section>
  );
}

function SmallCell({ label, value, danger = false, good = false }: { label: string; value: string; danger?: boolean; good?: boolean }) {
  const color = danger ? ERR : good ? BRAND : T;
  return (
    <div style={{ background: S, border: `1px solid ${B}`, borderRadius: 10, padding: '8px 10px' }}>
      <div style={{ fontSize: 10, color: M, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color, marginTop: 4 }}>{value}</div>
    </div>
  );
}
