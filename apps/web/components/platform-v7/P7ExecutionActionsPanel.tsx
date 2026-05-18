'use client';

import { useMemo, useState } from 'react';
import { P7ActionButton } from './P7ActionButton';
import { P7ActionLog } from './P7ActionLog';
import { P7GuardedActionButton } from './P7GuardedActionButton';
import type { PlatformActionLogEntry } from '@/lib/platform-v7/action-log';
import { platformV7ActionTargetById } from '@/lib/platform-v7/action-targets';
import { PLATFORM_V7_TOKENS } from '@/lib/platform-v7/design/tokens';
import {
  PLATFORM_V7_INITIAL_EXECUTION_ACTION_STATE,
  applyPlatformV7ExecutionAction,
  executionActionStateLabel,
  guardPlatformV7ExecutionAction,
  rollbackPlatformV7ExecutionAction,
  type PlatformV7ExecutionActionApplied,
  type PlatformV7ExecutionActionState,
  type PlatformV7ExecutionMode,
  type PlatformV7ExecutionRole,
} from '@/lib/platform-v7/execution-action-core';
import type { PlatformV7ActionMessageId } from '@/lib/platform-v7/action-messages';
import type { PlatformV7RuntimeActionEventCreated } from '@/lib/platform-v7/runtime-action-events';
import type { PlatformV7RuntimeExternalSystem, PlatformV7RuntimeResultState } from '@/lib/platform-v7/runtime-action-contract';

export interface PlatformV7ExecutionActionUiItem {
  readonly title: string;
  readonly description: string;
  readonly targetId: string;
  readonly actionId: PlatformV7ActionMessageId;
  readonly actorRole: PlatformV7ExecutionRole;
  readonly entityId: string;
  readonly mode?: PlatformV7ExecutionMode;
}

export interface P7ExecutionActionsPanelProps {
  readonly title: string;
  readonly subtitle: string;
  readonly items: readonly PlatformV7ExecutionActionUiItem[];
  readonly initialState?: PlatformV7ExecutionActionState;
  readonly initialLog?: readonly PlatformActionLogEntry[];
}

const MODE_LABELS: Record<PlatformV7ExecutionMode, string> = {
  sandbox: 'тестовый режим',
  manual: 'ручная проверка',
  'controlled-pilot': 'пилотный контур',
  live: 'боевой контур требует подтверждения',
};

const MODE_COPY: Record<PlatformV7ExecutionMode, string> = {
  sandbox: 'Действие фиксируется в тестовом сценарии. Внешние системы не вызываются.',
  manual: 'Действие требует ручной проверки. Внешнее подключение не заявлено.',
  'controlled-pilot': 'Действие фиксирует состояние, журнал и возможность отката без заявления о боевой интеграции.',
  live: 'Боевой контур допустим только после подтверждённых договоров и внешних подключений.',
};

const RUNTIME_STATE_LABELS: Record<PlatformV7RuntimeResultState, string> = {
  draft_created: 'черновик создан',
  internal_record_created: 'внутренняя запись создана',
  pending_external_confirmation: 'ожидает внешнего подтверждения',
  pending_bank_review: 'ожидает банковской проверки',
  manual_review_required: 'нужна ручная проверка',
  dispute_opened: 'спор открыт',
};

const EXTERNAL_SYSTEM_LABELS: Record<PlatformV7RuntimeExternalSystem, string> = {
  bank: 'банка',
  fgis: 'ФГИС',
  edo: 'ЭДО',
  lab: 'лаборатории',
  elevator: 'элеватора',
  none: 'внутреннего контура',
};

function isRuntimeEventCreated(event: PlatformV7ExecutionActionApplied['runtimeEvent']): event is PlatformV7RuntimeActionEventCreated {
  return event?.status === 'created';
}

function runtimeLogEntries(result: PlatformV7ExecutionActionApplied): PlatformActionLogEntry[] {
  if (isRuntimeEventCreated(result.runtimeEvent)) return [result.runtimeEvent.logEntry, result.logEntry];
  return [result.logEntry];
}

function runtimeToast(result: PlatformV7ExecutionActionApplied): { type: 'success' | 'warning'; message: string } {
  if (!isRuntimeEventCreated(result.runtimeEvent)) return { type: 'success', message: result.toastCopy };

  if (result.runtimeEvent.externalConfirmationStatus === 'requested') {
    return {
      type: 'warning',
      message: `${result.entityId}: запрос создан, ждём подтверждение ${EXTERNAL_SYSTEM_LABELS[result.runtimeEvent.externalSystem]}`,
    };
  }

  return {
    type: 'success',
    message: `${result.entityId}: действие зафиксировано во внутреннем контуре`,
  };
}

export function P7ExecutionActionsPanel({ title, subtitle, items, initialState, initialLog = [] }: P7ExecutionActionsPanelProps) {
  const [state, setState] = useState<PlatformV7ExecutionActionState>(initialState ?? PLATFORM_V7_INITIAL_EXECUTION_ACTION_STATE);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [log, setLog] = useState<PlatformActionLogEntry[]>([...initialLog]);
  const [toasts, setToasts] = useState<{ id: string; type: 'success' | 'error' | 'warning'; message: string }[]>([]);
  const [lastApplied, setLastApplied] = useState<PlatformV7ExecutionActionApplied | null>(null);

  const runtimeEventCandidate = lastApplied?.runtimeEvent ?? null;
  const lastRuntimeEvent: PlatformV7RuntimeActionEventCreated | null = isRuntimeEventCreated(runtimeEventCandidate) ? runtimeEventCandidate : null;

  const rows = useMemo(() => items.map((item) => {
    const target = platformV7ActionTargetById(item.targetId);
    const guard = guardPlatformV7ExecutionAction(state, item);
    return { item, target, guard };
  }), [items, state]);

  function pushToast(type: 'success' | 'error' | 'warning', message: string) {
    const id = `${type}:${message}:${Date.now()}`;
    setToasts((current) => [{ id, type, message }, ...current].slice(0, 4));
  }

  async function runAction(item: PlatformV7ExecutionActionUiItem) {
    if (activeActionId) return;

    setActiveActionId(item.actionId);
    await new Promise((resolve) => setTimeout(resolve, 120));
    const result = applyPlatformV7ExecutionAction(state, item);
    setActiveActionId(null);

    if (result.status === 'blocked') {
      pushToast('warning', result.disabledReason);
      return;
    }

    const toast = runtimeToast(result);
    setState(result.nextStateRef);
    setLog((current) => [...runtimeLogEntries(result), ...current]);
    setLastApplied(result);
    pushToast(toast.type, toast.message);
  }

  function rollbackLastAction() {
    if (!lastApplied) return;
    const nextState = rollbackPlatformV7ExecutionAction(lastApplied);
    setState(nextState);
    setLog((current) => [{
      id: `rollback-${lastApplied.rollbackRef}`,
      scope: lastApplied.logEntry.scope,
      status: 'success',
      objectId: lastApplied.entityId,
      action: `rollback:${lastApplied.actionId}`,
      message: `Откат выполнен: ${lastApplied.actionId}. Состояние восстановлено до предыдущего шага.`,
      actor: lastApplied.actorRole,
      at: new Date().toISOString(),
    }, ...current]);
    pushToast('success', 'Последнее действие отменено');
    setLastApplied(null);
  }

  return (
    <section style={{ background: PLATFORM_V7_TOKENS.color.surface, border: `1px solid ${PLATFORM_V7_TOKENS.color.border}`, borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, color: PLATFORM_V7_TOKENS.color.brand, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Действия по сделке</div>
          <div style={{ marginTop: 5, fontSize: 20, fontWeight: 900, color: PLATFORM_V7_TOKENS.color.text }}>{title}</div>
          <div style={{ marginTop: 6, fontSize: 13, color: PLATFORM_V7_TOKENS.color.textMuted, lineHeight: 1.55, maxWidth: 920 }}>{subtitle}</div>
        </div>
        <P7ActionButton disabled={!lastApplied} variant='secondary' disabledReason='Нет последнего успешного действия для отката.' onClick={rollbackLastAction}>
          Отменить последнее действие
        </P7ActionButton>
      </div>

      <div style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.18)', borderRadius: 12, padding: 12, color: PLATFORM_V7_TOKENS.color.text, fontSize: 12, lineHeight: 1.55 }}>
        Все действия ниже фиксируют состояние, журнал и возможность отката в пилотном контуре. Они не заявляют боевое подключение к ФГИС, банку, ЭДО, СберКорус или УКЭП.
      </div>

      {lastRuntimeEvent ? (
        <div data-testid='p7-runtime-event-status' style={{ background: lastRuntimeEvent.externalConfirmationStatus === 'requested' ? 'rgba(217,119,6,0.08)' : 'rgba(10,122,95,0.08)', border: `1px solid ${lastRuntimeEvent.externalConfirmationStatus === 'requested' ? 'rgba(217,119,6,0.18)' : 'rgba(10,122,95,0.18)'}`, borderRadius: 12, padding: 12, display: 'grid', gap: 6 }}>
          <div style={{ fontSize: 11, color: PLATFORM_V7_TOKENS.color.textSubtle, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Статус последнего действия</div>
          <div style={{ fontSize: 13, color: PLATFORM_V7_TOKENS.color.text, fontWeight: 900 }}>
            {RUNTIME_STATE_LABELS[lastRuntimeEvent.resultingState]}
          </div>
          <div style={{ fontSize: 12, color: PLATFORM_V7_TOKENS.color.textMuted, lineHeight: 1.5 }}>
            {lastRuntimeEvent.externalConfirmationStatus === 'requested'
              ? `Создан запрос. Платформа ждёт подтверждение ${EXTERNAL_SYSTEM_LABELS[lastRuntimeEvent.externalSystem]} и не считает действие внешне подтверждённым.`
              : 'Действие зафиксировано как внутренняя запись. Внешнее подтверждение для него не требуется.'}
          </div>
        </div>
      ) : null}

      {toasts.length ? (
        <div aria-live='polite' style={{ display: 'grid', gap: 8 }}>
          {toasts.map((toast) => (
            <div key={toast.id} data-toast-type={toast.type} style={{ border: `1px solid ${toast.type === 'success' ? 'rgba(10,122,95,0.2)' : toast.type === 'error' ? 'rgba(220,38,38,0.2)' : 'rgba(217,119,6,0.2)'}`, background: toast.type === 'success' ? 'rgba(10,122,95,0.08)' : toast.type === 'error' ? 'rgba(220,38,38,0.08)' : 'rgba(217,119,6,0.08)', color: PLATFORM_V7_TOKENS.color.text, borderRadius: 12, padding: 10, fontSize: 12, fontWeight: 800 }}>
              {toast.message}
            </div>
          ))}
        </div>
      ) : null}

      <div style={{ display: 'grid', gap: 10 }}>
        {rows.map(({ item, target, guard }) => {
          if (!target) {
            return (
              <div key={item.targetId} style={{ border: `1px solid ${PLATFORM_V7_TOKENS.color.border}`, borderRadius: 14, padding: 12 }}>
                Действие недоступно: {item.targetId}
              </div>
            );
          }

          const mode = item.mode ?? guard?.mode ?? 'controlled-pilot';
          return (
            <div key={`${item.actionId}-${item.entityId}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) minmax(160px, 0.45fr) auto', gap: 12, alignItems: 'center', border: `1px solid ${PLATFORM_V7_TOKENS.color.border}`, borderRadius: 14, padding: 12, background: PLATFORM_V7_TOKENS.color.surfaceStrong }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 900, color: PLATFORM_V7_TOKENS.color.text }}>{item.title}</div>
                <div style={{ marginTop: 4, fontSize: 12, color: PLATFORM_V7_TOKENS.color.textMuted, lineHeight: 1.45 }}>{item.description}</div>
                <div style={{ marginTop: 8, fontSize: 11, color: PLATFORM_V7_TOKENS.color.textSubtle }}>{MODE_COPY[mode]}</div>
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <span style={{ justifySelf: 'start', borderRadius: 999, padding: '4px 8px', background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: PLATFORM_V7_TOKENS.color.brand, fontSize: 11, fontWeight: 900 }}>{MODE_LABELS[mode]}</span>
                <span style={{ fontSize: 12, color: PLATFORM_V7_TOKENS.color.textMuted }}>{executionActionStateLabel(state, item.actionId)}</span>
              </div>
              <P7GuardedActionButton
                target={target}
                activeActionId={activeActionId}
                blocked={Boolean(guard)}
                blockedReason={guard?.disabledReason}
                blockedLabel={target.label}
                loadingLabel='Выполняется…'
                tone={item.actionId === 'openDispute' ? 'danger' : 'secondary'}
                onClick={() => void runAction(item)}
              />
            </div>
          );
        })}
      </div>

      <P7ActionLog title='Журнал действий' entries={log} emptyLabel='Действия ещё не выполнялись.' maxEntries={12} />
    </section>
  );
}
