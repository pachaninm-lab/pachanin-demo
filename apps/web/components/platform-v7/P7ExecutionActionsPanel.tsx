'use client';

import { useState } from 'react';
import {
  applyExecutionAction,
  availableActions,
  blockedActionsInState,
  rollbackExecution,
  mapSourceTruthToContext,
  EXECUTION_STATE_LABELS,
  EXECUTION_ACTION_LABELS,
  type ExecutionActionId,
  type ExecutionContext,
} from '@/lib/platform-v7/execution-state-machine';
import { PLATFORM_V7_EXECUTION_SOURCE } from '@/lib/platform-v7/deal-execution-source-of-truth';

const BRAND = '#0A7A5F';
const BRAND_BG = 'rgba(10,122,95,0.08)';
const BRAND_BORDER = 'rgba(10,122,95,0.18)';
const WARN = '#B45309';
const WARN_BG = 'rgba(217,119,6,0.08)';
const WARN_BORDER = 'rgba(217,119,6,0.18)';
const ERR = '#B91C1C';
const ERR_BG = 'rgba(220,38,38,0.08)';
const ERR_BORDER = 'rgba(220,38,38,0.18)';
const INFO = '#2563EB';
const INFO_BG = 'rgba(37,99,235,0.06)';
const INFO_BORDER = 'rgba(37,99,235,0.18)';
const T = 'var(--pc-text-primary)';
const M = 'var(--pc-text-secondary)';
const S = 'var(--pc-bg-card)';
const SS = 'var(--pc-bg-elevated)';
const B = 'var(--pc-border)';

export function P7ExecutionActionsPanel() {
  const [ctx, setCtx] = useState<ExecutionContext>(() =>
    mapSourceTruthToContext(PLATFORM_V7_EXECUTION_SOURCE.deal),
  );

  const available = availableActions(ctx);
  const blocked = blockedActionsInState(ctx);

  function handleAction(actionId: ExecutionActionId) {
    const result = applyExecutionAction(ctx, actionId, 'Оператор');
    if (result.success) setCtx(result.context);
  }

  function handleRollback() {
    const rolled = rollbackExecution(ctx);
    if (rolled) setCtx(rolled);
  }

  return (
    <section style={{ background: S, border: `1px solid ${BRAND_BORDER}`, borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, color: BRAND, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Исполнение сделки · контролируемый пилот · не live
          </div>
          <div style={{ marginTop: 4, fontSize: 18, fontWeight: 900, color: T }}>
            {EXECUTION_STATE_LABELS[ctx.state]}
          </div>
        </div>
        <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 900, background: WARN_BG, border: `1px solid ${WARN_BORDER}`, color: WARN }}>
          sandbox · manual
        </span>
      </div>

      {available.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: M, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Доступные действия</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {available.map((actionId) => (
              <button
                key={actionId}
                onClick={() => handleAction(actionId)}
                style={{
                  cursor: 'pointer',
                  border: `1px solid ${BRAND_BORDER}`,
                  borderRadius: 10,
                  padding: '8px 14px',
                  background: BRAND_BG,
                  color: BRAND,
                  fontSize: 13,
                  fontWeight: 800,
                  fontFamily: 'inherit',
                }}
              >
                {EXECUTION_ACTION_LABELS[actionId]}
              </button>
            ))}
          </div>
        </div>
      )}

      {blocked.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: M, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Заблокированные действия</div>
          <div style={{ display: 'grid', gap: 6 }}>
            {blocked.map(({ actionId, guardReason }) => (
              <div key={actionId} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: ERR_BG, border: `1px solid ${ERR_BORDER}`, borderRadius: 8, padding: '6px 10px' }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: ERR, flexShrink: 0 }}>{EXECUTION_ACTION_LABELS[actionId]}</span>
                <span style={{ fontSize: 12, color: WARN }}>· {guardReason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {available.length === 0 && blocked.length === 0 && (
        <div style={{ fontSize: 12, color: M }}>
          {ctx.state === 'dealClosed' ? 'Сделка закрыта — нет доступных действий.' : 'Нет действий для текущего состояния.'}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8 }}>
        <CtxFlag label='Черновик сделки' active={ctx.hasDraftDeal} />
        <CtxFlag label='Резерв запрошен' active={ctx.hasMoneyReserveIntent} />
        <CtxFlag label='Резерв подтверждён' active={ctx.hasMoneyReserveConfirmed} />
        <CtxFlag label='Логистика' active={ctx.hasLogisticsOrder} />
        <CtxFlag label='Проверка качества' active={ctx.hasQualityCheckStarted} />
        <CtxFlag label='Документы' active={ctx.hasDocumentsAttached} />
        <CtxFlag label='СДИЗ готов' active={ctx.hasSdizReady} />
        <CtxFlag label='Спор открыт' active={ctx.hasOpenDispute} danger />
      </div>

      {ctx.actionLog.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: M, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Журнал действий</div>
          <div style={{ display: 'grid', gap: 4 }}>
            {ctx.actionLog.slice(0, 5).map((record, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', background: SS, border: `1px solid ${B}`, borderRadius: 8, padding: '6px 10px' }}>
                <span style={{ fontSize: 10, fontFamily: 'monospace', color: M, flexShrink: 0 }}>{record.at.slice(11, 19)}</span>
                <span style={{ fontSize: 12, color: T, fontWeight: 800, flexShrink: 0 }}>{EXECUTION_ACTION_LABELS[record.actionId]}</span>
                <span style={{ fontSize: 11, color: M }}>
                  {EXECUTION_STATE_LABELS[record.fromState]} → {EXECUTION_STATE_LABELS[record.toState]}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: INFO, fontWeight: 800, flexShrink: 0 }}>{record.mode}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {ctx.previousStateRef && (
          <button
            onClick={handleRollback}
            style={{
              cursor: 'pointer',
              border: `1px solid ${WARN_BORDER}`,
              borderRadius: 10,
              padding: '6px 12px',
              background: WARN_BG,
              color: WARN,
              fontSize: 12,
              fontWeight: 800,
              fontFamily: 'inherit',
            }}
          >
            ↩ Отменить последнее действие
          </button>
        )}
        <span style={{ fontSize: 11, color: M }}>Контролируемый пилот · без живых интеграций · состояние сбрасывается при перезагрузке</span>
      </div>
    </section>
  );
}

function CtxFlag({ label, active, danger = false }: { label: string; active: boolean; danger?: boolean }) {
  const color = active ? (danger ? ERR : BRAND) : M;
  const bg = active ? (danger ? ERR_BG : BRAND_BG) : SS;
  const border = active ? (danger ? ERR_BORDER : BRAND_BORDER) : B;
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 8, padding: '6px 8px' }}>
      <div style={{ fontSize: 10, color: M, fontWeight: 800, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 11, fontWeight: 900, color, marginTop: 2 }}>{active ? 'да' : 'нет'}</div>
    </div>
  );
}
