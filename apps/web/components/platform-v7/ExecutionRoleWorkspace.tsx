'use client';

import * as React from 'react';
import Link from 'next/link';
import type { ExecutionRole, ExecutionStageKey } from '@/lib/platform-v7/domain/execution-simulation';
import { selectExecutionSimulationByDealId } from '@/lib/platform-v7/domain/execution-simulation';

type ActionState = Record<ExecutionStageKey, boolean>;

const roleLabels: Record<ExecutionRole, string> = {
  operator: 'Оператор',
  seller: 'Продавец',
  buyer: 'Покупатель',
  logistics: 'Логистика',
  driver: 'Водитель',
  elevator: 'Элеватор',
  lab: 'Лаборатория',
  bank: 'Банк',
  surveyor: 'Сюрвейер',
  arbitrator: 'Арбитр',
};

const roleDealId: Record<ExecutionRole, string> = {
  operator: 'DL-9113',
  seller: 'DL-9113',
  buyer: 'DL-9113',
  logistics: 'DL-9113',
  driver: 'DL-9113',
  elevator: 'DL-9113',
  lab: 'DL-9113',
  bank: 'DL-9113',
  surveyor: 'DL-9113',
  arbitrator: 'DL-9113',
};

const actionMap: Partial<Record<ExecutionRole, ExecutionStageKey[]>> = {
  logistics: ['carrier_assigned', 'driver_assigned'],
  driver: ['pickup_arrived', 'loaded', 'in_transit', 'elevator_arrived'],
  elevator: ['elevator_arrived', 'weighed'],
  lab: ['lab_passed'],
  surveyor: ['loaded'],
  operator: ['documents_signed'],
  bank: ['money_ready'],
};

function card(): React.CSSProperties {
  return { border: '1px solid var(--pc-border)', borderRadius: 20, padding: 18, background: 'var(--pc-bg-card)' };
}

function button(active = true): React.CSSProperties {
  return { borderRadius: 12, border: '1px solid var(--pc-border)', padding: '10px 13px', background: active ? 'var(--pc-accent-bg)' : 'var(--pc-bg-elevated)', color: active ? 'var(--pc-accent-strong)' : 'var(--pc-text-primary)', fontWeight: 850, cursor: 'pointer' };
}

function muted(): React.CSSProperties {
  return { color: 'var(--pc-text-secondary)', fontSize: 13, lineHeight: 1.5 };
}

function badge(tone: 'green' | 'amber' | 'neutral' | 'red'): React.CSSProperties {
  const colors = {
    green: ['rgba(22,163,74,.09)', '#15803D'],
    amber: ['rgba(217,119,6,.10)', '#B45309'],
    neutral: ['rgba(100,116,139,.10)', '#475569'],
    red: ['rgba(220,38,38,.09)', '#B91C1C'],
  } as const;
  return { borderRadius: 999, background: colors[tone][0], color: colors[tone][1], padding: '5px 9px', fontSize: 12, fontWeight: 900 };
}

export function ExecutionRoleWorkspace({ role }: { role: ExecutionRole }) {
  const sim = selectExecutionSimulationByDealId(roleDealId[role]);
  const [done, setDone] = React.useState<ActionState>(() => ({
    deal_created: true,
    carrier_assigned: role !== 'logistics',
    driver_assigned: role !== 'logistics',
    pickup_arrived: false,
    loaded: false,
    in_transit: false,
    elevator_arrived: false,
    weighed: false,
    lab_passed: false,
    documents_signed: false,
    money_ready: false,
  }));
  const [pulse, setPulse] = React.useState(58);

  React.useEffect(() => {
    const interval = window.setInterval(() => setPulse((value) => (value >= 94 ? 58 : value + 1)), 1200);
    return () => window.clearInterval(interval);
  }, []);

  if (!sim) return <div>Симуляция не найдена</div>;

  const allowed = actionMap[role] ?? [];
  const releaseReady = done.weighed && done.lab_passed && done.documents_signed && done.elevator_arrived;
  const visibleStages = role === 'driver'
    ? sim.stages.filter((stage) => ['driver_assigned', 'pickup_arrived', 'loaded', 'in_transit', 'elevator_arrived'].includes(stage.key))
    : role === 'lab'
      ? sim.stages.filter((stage) => ['elevator_arrived', 'weighed', 'lab_passed'].includes(stage.key))
      : role === 'elevator'
        ? sim.stages.filter((stage) => ['elevator_arrived', 'weighed', 'lab_passed', 'documents_signed'].includes(stage.key))
        : sim.stages;

  function complete(stage: ExecutionStageKey) {
    setDone((value) => ({ ...value, [stage]: true }));
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <section style={{ ...card(), background: 'linear-gradient(135deg,var(--pc-bg-card),var(--pc-bg-elevated))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 950, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--pc-text-secondary)' }}>Контур исполнения · {roleLabels[role]}</div>
            <h1 style={{ margin: '8px 0 0', fontSize: 30, lineHeight: 1.08 }}>{sim.title}</h1>
            <p style={muted()}>{sim.subtitle}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <span style={badge(releaseReady ? 'green' : 'amber')}>{releaseReady ? 'деньги можно проверить' : 'деньги заблокированы'}</span>
            <span style={badge('neutral')}>simulation-grade</span>
          </div>
        </div>
      </section>

      <section style={card()}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
          <Metric label="Перевозчик" value={sim.carrier} />
          <Metric label="Водитель" value={sim.driver.name} />
          <Metric label="Машина" value={sim.driver.vehicle} />
          <Metric label="ETA" value={sim.eta} />
        </div>
      </section>

      <section style={card()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20 }}>Карта рейса</h2>
            <p style={muted()}>{sim.routeName} · {sim.driver.gpsStatus}</p>
          </div>
          <span style={badge('green')}>маршрут {pulse}%</span>
        </div>
        <div style={{ marginTop: 18, height: 150, borderRadius: 18, border: '1px solid var(--pc-border)', background: 'linear-gradient(135deg,rgba(15,23,42,.06),rgba(37,99,235,.06))', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: 24, right: 24, top: 74, height: 3, background: 'var(--pc-border)' }} />
          <div style={{ position: 'absolute', left: 24, top: 74, height: 3, width: `${pulse}%`, maxWidth: 'calc(100% - 48px)', background: 'var(--pc-accent-strong)' }} />
          {sim.routePoints.map((point) => (
            <div key={point.label} style={{ position: 'absolute', left: `calc(24px + ${point.progress}% * (100% - 48px) / 100)`, top: point.kind === 'current' ? 56 : 66, transform: 'translateX(-50%)', display: 'grid', justifyItems: 'center', gap: 7 }}>
              <div style={{ width: point.kind === 'current' ? 22 : 14, height: point.kind === 'current' ? 22 : 14, borderRadius: 999, background: point.kind === 'current' ? 'var(--pc-accent-strong)' : 'var(--pc-bg-card)', border: '2px solid var(--pc-accent-strong)' }} />
              <span style={{ fontSize: 11, fontWeight: 850, color: 'var(--pc-text-secondary)', whiteSpace: 'nowrap' }}>{point.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={card()}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Действия роли</h2>
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {visibleStages.map((stage) => {
            const isAllowed = allowed.includes(stage.key);
            const isDone = done[stage.key];
            return (
              <div key={stage.key} style={{ border: '1px solid var(--pc-border)', borderRadius: 16, padding: 14, display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center', background: isDone ? 'rgba(22,163,74,.05)' : 'var(--pc-bg-elevated)' }}>
                <div>
                  <strong>{stage.title}</strong>
                  <div style={muted()}>{stage.description}</div>
                </div>
                {isAllowed ? <button onClick={() => complete(stage.key)} style={button(!isDone)}>{isDone ? 'закрыто' : 'закрыть этап'}</button> : <span style={badge(isDone ? 'green' : 'neutral')}>{isDone ? 'готово' : roleLabels[stage.owner]}</span>}
              </div>
            );
          })}
        </div>
      </section>

      <section style={card()}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Деньги и документы</h2>
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {sim.documents.map((doc) => (
            <div key={doc.id} style={{ border: '1px solid var(--pc-border)', borderRadius: 14, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <strong>{doc.title}</strong>
                <span style={badge(doc.status === 'ready' ? 'green' : 'amber')}>{doc.status === 'ready' ? 'готово' : 'ожидает'}</span>
              </div>
              <div style={muted()}>{doc.moneyImpact}</div>
            </div>
          ))}
        </div>
        <p style={{ ...muted(), color: releaseReady ? '#15803D' : '#B45309', fontWeight: 850 }}>{releaseReady ? 'Контур закрыт: банк может перейти к проверке выпуска денег.' : sim.releaseReadyLabel}</p>
      </section>

      <section style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link style={button(false)} href={`/platform-v7/deals/${sim.dealId}/execution`}>Экран сделки</Link>
        <Link style={button(false)} href="/platform-v7/control-tower">Центр управления</Link>
        <Link style={button(false)} href="/platform-v7/bank/release-safety">Банк</Link>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div style={{ border: '1px solid var(--pc-border)', borderRadius: 14, padding: 12 }}><div style={{ fontSize: 11, color: 'var(--pc-text-secondary)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div><div style={{ marginTop: 6, fontWeight: 900 }}>{value}</div></div>;
}
