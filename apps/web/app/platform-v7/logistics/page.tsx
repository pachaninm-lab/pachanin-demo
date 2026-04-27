'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  SANDBOX_LOGISTICS_ORDERS,
  SANDBOX_ROUTE_LEGS,
  SANDBOX_INCIDENTS,
  buildLogisticsProjection,
  type LogisticsOrderStatus,
} from '@/lib/platform-v7/logistics-chain';

// ─── palette ────────────────────────────────────────────────────────────────
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

// ─── helpers ─────────────────────────────────────────────────────────────────

function orderStatusTone(s: LogisticsOrderStatus) {
  if (s === 'completed') return { bg: BRAND_BG, border: BRAND_BORDER, color: BRAND, label: 'Завершён' };
  if (s === 'in_transit') return { bg: INFO_BG, border: INFO_BORDER, color: INFO, label: 'В пути' };
  if (s === 'arrived') return { bg: BRAND_BG, border: BRAND_BORDER, color: BRAND, label: 'Прибыл' };
  if (s === 'unloading') return { bg: INFO_BG, border: INFO_BORDER, color: INFO, label: 'Выгрузка' };
  if (s === 'loading_started' || s === 'loading_done') return { bg: WARN_BG, border: WARN_BORDER, color: WARN, label: 'Погрузка' };
  if (s === 'loading_scheduled') return { bg: WARN_BG, border: WARN_BORDER, color: WARN, label: 'Ожидает погрузки' };
  if (s === 'carrier_assigned' || s === 'carrier_matching') return { bg: INFO_BG, border: INFO_BORDER, color: INFO, label: 'Назначение перевозчика' };
  if (s === 'incident') return { bg: ERR_BG, border: ERR_BORDER, color: ERR, label: 'Инцидент' };
  if (s === 'cancelled') return { bg: SS, border: B, color: M, label: 'Отменён' };
  return { bg: SS, border: B, color: M, label: 'Черновик' };
}

function btn(kind: 'primary' | 'default' = 'default'): React.CSSProperties {
  if (kind === 'primary') return { textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: BRAND_BG, border: `1px solid ${BRAND_BORDER}`, color: BRAND, fontSize: 13, fontWeight: 700 };
  return { textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: SS, border: `1px solid ${B}`, color: T, fontSize: 13, fontWeight: 700 };
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function LogisticsPage() {
  const orders = SANDBOX_LOGISTICS_ORDERS;
  const legs = SANDBOX_ROUTE_LEGS;
  const incidents = SANDBOX_INCIDENTS;

  const projections = orders.map((order) => {
    const orderLegs = legs.filter((l) => l.logisticsOrderId === order.id);
    const orderIncidents = incidents.filter((i) => i.logisticsOrderId === order.id);
    return buildLogisticsProjection(order, orderLegs, null, orderIncidents);
  });

  const inTransit = orders.filter((o) => o.status === 'in_transit').length;
  const arrived = orders.filter((o) => o.status === 'arrived').length;
  const openIncidents = incidents.filter((i) => i.status === 'open' || i.status === 'under_review').length;
  const totalDeals = new Set(orders.map((o) => o.dealId)).size;

  return (
    <div style={{ display: 'grid', gap: 18, padding: '8px 0' }}>
      {/* Header */}
      <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, color: M, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Логистика · <span style={{ color: WARN }}>sandbox</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: T, marginTop: 8, lineHeight: 1.1 }}>Диспетчерская</div>
            <div style={{ marginTop: 8, fontSize: 14, color: M, maxWidth: 700 }}>
              Все логистические заказы привязаны к сделкам. Каждый заказ — дочерний контур сделки.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href='/platform-v7/control-tower' style={btn()}>Башня управления</Link>
          </div>
        </div>
      </section>

      {/* KPIs */}
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

      {/* Incidents banner */}
      {openIncidents > 0 && (
        <section style={{ background: ERR_BG, border: `1px solid ${ERR_BORDER}`, borderRadius: 14, padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: ERR, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Открытые инциденты ({openIncidents})
          </div>
          {incidents
            .filter((i) => i.status === 'open' || i.status === 'under_review')
            .map((inc) => (
              <div key={inc.id} style={{ marginTop: 8, fontSize: 13, color: T }}>
                <strong>{inc.type}</strong> · {inc.description}
                {inc.moneyImpact ? (
                  <span style={{ marginLeft: 8, color: ERR, fontWeight: 700 }}>
                    риск {inc.moneyImpact.toLocaleString('ru-RU')} ₽
                  </span>
                ) : null}
              </div>
            ))}
        </section>
      )}

      {/* Orders list */}
      <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: T, marginBottom: 14 }}>Логистические заказы</div>
        <div style={{ display: 'grid', gap: 12 }}>
          {orders.map((order, idx) => {
            const proj = projections[idx];
            const tone = orderStatusTone(order.status);
            const orderLegs = legs.filter((l) => l.logisticsOrderId === order.id);
            return (
              <div key={order.id} style={{ background: SS, border: `1px solid ${B}`, borderRadius: 14, padding: 16 }}>
                {/* Order header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 13, color: BRAND }}>{order.id}</span>
                    <span style={{ marginLeft: 8, fontSize: 13, color: M }}>→ Сделка</span>
                    <Link
                      href={`/platform-v7/deals/${order.dealId}`}
                      style={{ marginLeft: 6, fontFamily: 'monospace', fontSize: 13, fontWeight: 800, color: BRAND, textDecoration: 'none' }}
                    >
                      {order.dealId}
                    </Link>
                  </div>
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: 99,
                      fontSize: 11,
                      fontWeight: 700,
                      background: tone.bg,
                      border: `1px solid ${tone.border}`,
                      color: tone.color,
                    }}
                  >
                    {tone.label}
                  </span>
                </div>

                {/* Cargo info */}
                <div style={{ fontSize: 14, fontWeight: 800, color: T, marginTop: 10 }}>
                  {order.grain} · {order.volumeTons} т
                </div>
                <div style={{ fontSize: 12, color: M, marginTop: 4 }}>
                  {order.originRegion} → {order.destinationRegion}
                  {order.carrierName && <span style={{ marginLeft: 8 }}>· {order.carrierName}</span>}
                </div>

                {/* Projection stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8, marginTop: 12 }}>
                  <SmallCell label='Рейсов' value={`${proj.completedLegs}/${proj.totalLegs}`} />
                  <SmallCell label='Инцидентов' value={String(proj.openIncidents)} danger={proj.openIncidents > 0} />
                  <SmallCell
                    label='Транспортный gate'
                    value={proj.transportGateCleared ? 'Очищен' : 'Блокирован'}
                    danger={!proj.transportGateCleared}
                    good={proj.transportGateCleared}
                  />
                </div>

                {/* Deviations */}
                {proj.deviations.length > 0 && (
                  <div
                    style={{
                      marginTop: 10,
                      background: WARN_BG,
                      border: `1px solid ${WARN_BORDER}`,
                      borderRadius: 8,
                      padding: 10,
                      fontSize: 12,
                      color: WARN,
                    }}
                  >
                    {proj.deviations.map((d, i) => (
                      <div key={i}>⚠ {d}</div>
                    ))}
                  </div>
                )}

                {/* Route legs */}
                {orderLegs.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 11, color: M, fontWeight: 800, textTransform: 'uppercase', marginBottom: 6 }}>Рейсы</div>
                    {orderLegs.map((leg) => (
                      <div key={leg.id} style={{ fontSize: 12, color: T, padding: '6px 0', borderTop: `1px solid ${B}` }}>
                        <span style={{ fontWeight: 700 }}>{leg.sequence}.</span> {leg.originName} → {leg.destinationName}
                        {leg.driverRef && <span style={{ marginLeft: 8, color: M }}>· {leg.driverRef.name}</span>}
                        {typeof leg.vehicleRef === 'object' && leg.vehicleRef && (
                          <span style={{ marginLeft: 8, fontFamily: 'monospace', fontSize: 11, color: M }}>
                            {leg.vehicleRef.plate}
                          </span>
                        )}
                        {leg.deviationNote && (
                          <span style={{ marginLeft: 8, color: WARN, fontWeight: 700 }}>⚠ {leg.deviationNote}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function SmallCell({
  label,
  value,
  danger = false,
  good = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
  good?: boolean;
}) {
  const color = danger ? ERR : good ? BRAND : T;
  return (
    <div style={{ background: S, border: `1px solid ${B}`, borderRadius: 10, padding: '8px 10px' }}>
      <div style={{ fontSize: 10, color: M, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color, marginTop: 4 }}>{value}</div>
    </div>
  );
}
