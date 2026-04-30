'use client';

import { useMemo, useState } from 'react';
import {
  createExecutionDomainStore,
  createExecutionSimulationState,
  type Deal,
  type PlatformActionCommand,
  type PlatformActionResult,
  type PlatformActionType,
  type PlatformRole,
  type User,
} from '../../../../packages/domain-core/src/execution-simulation';

const B = 'var(--pc-border)';
const T = 'var(--pc-text-primary)';
const M = 'var(--pc-text-secondary)';
const SURFACE = 'var(--pc-bg-elevated)';
const BRAND = 'var(--pc-accent-strong)';
const BRAND_BG = 'var(--pc-accent-bg)';
const BRAND_BORDER = 'var(--pc-accent-border)';
const DANGER = '#B91C1C';
const DANGER_BG = 'rgba(220,38,38,0.08)';
const DANGER_BORDER = 'rgba(220,38,38,0.18)';

type JournalEntry = {
  id: string;
  actionType: PlatformActionType;
  ok: boolean;
  message: string;
  statusAfter?: string;
  audit?: string;
  timeline?: string;
};

export function RoleActionDispatchBridge({
  role,
  dealId,
  actionType,
  canRun,
  disabledReason,
}: {
  role: PlatformRole;
  dealId: string;
  actionType: PlatformActionType;
  canRun: boolean;
  disabledReason: string | null;
}) {
  const store = useMemo(() => createExecutionDomainStore(createExecutionSimulationState()), []);
  const [result, setResult] = useState<PlatformActionResult | null>(null);
  const [lastStatus, setLastStatus] = useState<string | null>(null);
  const [journal, setJournal] = useState<JournalEntry[]>([]);

  function pushJournal(entry: JournalEntry) {
    setJournal((prev) => [entry, ...prev].slice(0, 5));
  }

  function runSandboxDispatch() {
    const state = store.getState();
    const deal = state.deals.find((item) => item.id === dealId);
    const actor = state.users.find((item) => item.role === actorRoleForAction(role, actionType));

    if (!deal || !actor) {
      const message = !deal ? `Сделка не найдена: ${dealId}` : `Нет sandbox-актора для роли ${role}`;
      const failedResult: PlatformActionResult = {
        ok: false,
        state,
        toast: { type: 'error', message },
        error: message,
      };
      setResult(failedResult);
      pushJournal({ id: `${actionType}-${Date.now()}`, actionType, ok: false, message });
      return;
    }

    const command = buildCommand(actionType, actor, deal);
    const next = store.dispatch(command);
    const statusAfter = next.state.deals.find((item) => item.id === dealId)?.status ?? deal.status;
    setResult(next);
    setLastStatus(statusAfter);
    pushJournal({
      id: `${actionType}-${Date.now()}`,
      actionType,
      ok: next.ok,
      message: next.toast.message,
      statusAfter,
      audit: next.auditEvent ? `${next.auditEvent.actionType} · ${next.auditEvent.entityId}` : undefined,
      timeline: next.timelineEvent?.title,
    });
  }

  const tone = result?.ok ? 'success' : result ? 'danger' : canRun ? 'ready' : 'disabled';
  const message = result?.toast.message ?? disabledReason ?? 'Sandbox dispatch доступен для проверки action feedback.';

  return (
    <div data-testid='role-dispatch-bridge' style={{ background: tone === 'danger' ? DANGER_BG : SURFACE, border: `1px solid ${tone === 'danger' ? DANGER_BORDER : B}`, borderRadius: 14, padding: 12, display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'grid', gap: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: tone === 'danger' ? DANGER : BRAND, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sandbox dispatch</div>
          <div style={{ fontSize: 12, color: M, lineHeight: 1.5 }}>Проверяет действие через domain-core, audit/timeline и guard-ошибки. Боевые интеграции не вызываются.</div>
        </div>
        <button
          type='button'
          onClick={runSandboxDispatch}
          disabled={!canRun}
          style={{
            border: `1px solid ${canRun ? BRAND_BORDER : B}`,
            borderRadius: 12,
            padding: '10px 14px',
            background: canRun ? BRAND_BG : SURFACE,
            color: canRun ? BRAND : M,
            fontSize: 13,
            fontWeight: 900,
            cursor: canRun ? 'pointer' : 'not-allowed',
          }}
        >
          Выполнить sandbox
        </button>
      </div>
      <div style={{ fontSize: 12, color: tone === 'danger' ? DANGER : tone === 'success' ? BRAND : M, lineHeight: 1.5, fontWeight: 800 }}>{message}</div>
      {lastStatus ? <div style={{ fontSize: 12, color: T, fontWeight: 900 }}>Текущий статус после dispatch: {lastStatus}</div> : null}
      {result?.auditEvent ? <div style={{ fontSize: 12, color: M }}>Audit: {result.auditEvent.actionType} · {result.auditEvent.entityId}</div> : null}
      {result?.timelineEvent ? <div style={{ fontSize: 12, color: M }}>Timeline: {result.timelineEvent.title}</div> : null}
      <RoleActionJournal rows={journal} />
    </div>
  );
}

function RoleActionJournal({ rows }: { rows: JournalEntry[] }) {
  return (
    <div data-testid='role-action-journal' style={{ borderTop: `1px solid ${B}`, paddingTop: 10, display: 'grid', gap: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 900, color: T, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Role action journal</div>
      {rows.length ? rows.map((row) => (
        <div key={row.id} style={{ display: 'grid', gap: 3, background: row.ok ? BRAND_BG : DANGER_BG, border: `1px solid ${row.ok ? BRAND_BORDER : DANGER_BORDER}`, borderRadius: 10, padding: 10 }}>
          <div style={{ fontSize: 12, color: row.ok ? BRAND : DANGER, fontWeight: 900 }}>{row.actionType} · {row.ok ? 'success' : 'error'}</div>
          <div style={{ fontSize: 12, color: M }}>{row.message}</div>
          {row.statusAfter ? <div style={{ fontSize: 11, color: M }}>status: {row.statusAfter}</div> : null}
          {row.audit ? <div style={{ fontSize: 11, color: M }}>audit: {row.audit}</div> : null}
          {row.timeline ? <div style={{ fontSize: 11, color: M }}>timeline: {row.timeline}</div> : null}
        </div>
      )) : <div style={{ fontSize: 12, color: M }}>Журнал появится после sandbox-действия.</div>}
    </div>
  );
}

function actorRoleForAction(role: PlatformRole, actionType: PlatformActionType): PlatformRole {
  if (actionType === 'confirmReserve') return 'bank';
  if (actionType === 'requestReserve') return 'buyer';
  if (actionType === 'assignDriver') return 'operator';
  if (actionType === 'confirmArrival') return 'driver';
  if (actionType === 'createLabProtocol') return 'lab';
  if (actionType === 'publishLot') return 'seller';
  return role;
}

function buildCommand(actionType: PlatformActionType, actor: User, deal: Deal): PlatformActionCommand {
  const now = new Date().toISOString();
  const common = { type: actionType, actor, now, runtimeLabel: 'sandbox' as const };

  if (actionType === 'publishLot') return { ...common, payload: { lotId: deal.lotId } };
  if (actionType === 'assignDriver') return { ...common, payload: { dealId: deal.id, driverId: 'U-DRIVER-1', carrierId: 'CP-C-001', vehicleNumber: 'А777ВС68' } };
  if (actionType === 'confirmArrival') return { ...common, payload: { dealId: deal.id } };
  if (actionType === 'createLabProtocol') return { ...common, payload: { dealId: deal.id, protocolId: `LAB-${deal.id}-ROLE`, humidityPct: 12.4, glutenPct: 24.8, proteinPct: 12.1, natureGramPerLiter: 752 } };
  if (actionType === 'requestReserve') return { ...common, payload: { dealId: deal.id }, idempotencyKey: `role-${deal.id}-${actionType}-${Date.now()}` };
  if (actionType === 'confirmReserve') return { ...common, payload: { dealId: deal.id }, idempotencyKey: `role-${deal.id}-${actionType}-${Date.now()}` };
  if (actionType === 'openDispute') return { ...common, payload: { dealId: deal.id, reason: 'other', amountImpactRub: 0, evidenceIds: [] } };

  return { ...common, payload: { dealId: deal.id } };
}
