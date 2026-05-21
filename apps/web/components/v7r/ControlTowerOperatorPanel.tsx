'use client';

import { useMemo, useState } from 'react';
import { P7ActionButton, type P7ActionButtonState } from '@/components/platform-v7/P7ActionButton';
import { P7Badge } from '@/components/platform-v7/P7Badge';
import { P7Card } from '@/components/platform-v7/P7Card';
import { runPlatformAction } from '@/lib/platform-v7/action-runner';
import { PLATFORM_V7_TOKENS, type PlatformV7Tone } from '@/lib/platform-v7/design/tokens';
import { formatCompactMoney, formatMoney } from '@/lib/v7r/helpers';
import { translateReason, translateRole } from '@/lib/i18n/reason-codes';
import { buildGatePassResult } from '@/lib/platform-v7/operator-actions';
import type { PlatformActionLogEntry, PlatformActionStatus } from '@/lib/platform-v7/action-log';

type GateState = 'PASS' | 'REVIEW' | 'FAIL';

export interface OperatorDealItem {
  id: string;
  title: string;
  gateState: GateState;
  nextStep: string | null;
  nextOwner: string | null;
  releasableAmount: number;
  releaseEligible: boolean;
  reasonCodes: string[];
}

interface AuditRow {
  id: string;
  ts: string;
  actor: string;
  action: string;
  detail: string;
  status: PlatformActionStatus;
}

function gateTone(state: GateState): PlatformV7Tone {
  if (state === 'PASS') return 'success';
  if (state === 'REVIEW') return 'warning';
  return 'danger';
}

function gateLabel(state: GateState) {
  if (state === 'PASS') return 'Проверено';
  if (state === 'REVIEW') return 'Проверка вручную';
  return 'Стоп проверки';
}

function auditTone(status: PlatformActionStatus): PlatformV7Tone {
  if (status === 'success') return 'success';
  if (status === 'error') return 'danger';
  return 'warning';
}

function auditLabel(status: PlatformActionStatus): string {
  if (status === 'success') return 'Успешно';
  if (status === 'error') return 'Ошибка';
  return 'Выполняется';
}

function actionLogToAuditRow(entry: PlatformActionLogEntry): AuditRow {
  return {
    id: entry.id,
    ts: entry.at,
    actor: entry.actor,
    action: cleanCopy(entry.action),
    detail: cleanCopy(entry.message),
    status: entry.status,
  };
}

function cleanCopy(value: string) {
  return value
    .replace(/\bGate\b/g, 'Проверка')
    .replace(/\bgate\b/g, 'проверка')
    .replace(/\bblocker\b/g, 'препятствие')
    .replace(/\bcallback\b/g, 'событие банка')
    .replace(/\brelease\b/g, 'выпуск денег')
    .replace(/\bsync\b/g, 'сверка')
    .replace(/\bfake-live\b/g, 'демо-событие')
    .replace(/\baudit\b/g, 'журнал');
}

export function ControlTowerOperatorPanel({ deals }: { deals: OperatorDealItem[] }) {
  const [items, setItems] = useState(deals);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lastActionState, setLastActionState] = useState<Record<string, P7ActionButtonState>>({});
  const [callbacks, setCallbacks] = useState<Record<string, { id: string; amountRub: number; ts: string }>>({});

  const blockedAmount = useMemo(
    () => items.filter((item) => item.gateState !== 'PASS').reduce((sum, item) => sum + item.releasableAmount, 0),
    [items],
  );

  function pushActionLog(entries: PlatformActionLogEntry[]) {
    setAudit((prev) => [...entries.map(actionLogToAuditRow), ...prev].slice(0, 8));
  }

  async function unblock(item: OperatorDealItem) {
    if (busyId) return;
    setBusyId(item.id);
    setLastActionState((prev) => ({ ...prev, [item.id]: 'loading' }));

    const runnerResult = await runPlatformAction({
      scope: 'deal',
      objectId: item.id,
      action: 'remove-blocker',
      actor: 'Оператор платформы',
      loadingMessage: `${item.id}: начато снятие препятствия.`,
      successMessage: () => `${item.id}: препятствие снято, проверка пройдена.`,
      errorMessage: (error) => `${item.id}: не удалось снять препятствие${error instanceof Error ? `: ${error.message}` : ''}.`,
      run: async () => buildGatePassResult({ dealId: item.id, amount: item.releasableAmount }),
    });

    pushActionLog(runnerResult.log);

    if (runnerResult.phase !== 'success' || !runnerResult.result) {
      setLastActionState((prev) => ({ ...prev, [item.id]: 'error' }));
      setBusyId(null);
      return;
    }

    const actionResult = runnerResult.result;

    setItems((prev) => prev.map((row) => row.id === item.id ? {
      ...row,
      gateState: actionResult.gateState,
      nextStep: actionResult.nextStep,
      nextOwner: actionResult.nextOwner,
      reasonCodes: [],
    } : row));
    pushActionLog(actionResult.log);
    setLastActionState((prev) => ({ ...prev, [item.id]: 'success' }));

    if (item.releaseEligible && item.releasableAmount > 0) {
      const bankResult = await runPlatformAction({
        scope: 'bank',
        objectId: item.id,
        action: 'bank-callback',
        actor: 'Оператор платформы',
        loadingMessage: `${item.id}: запрошено банковское демо-событие.`,
        successMessage: (data: { id: string; amountRub: number; ts: string }) => `${item.id}: банк подтвердил ${formatMoney(data.amountRub)}.`,
        errorMessage: () => `${item.id}: подтверждение банка не получено.`,
        run: async () => {
          const res = await fetch('/api/sim/bank-callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dealId: item.id, amount: item.releasableAmount }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return await res.json() as { id: string; amountRub: number; ts: string };
        },
      });

      pushActionLog(bankResult.log);

      if (bankResult.phase === 'success' && bankResult.result) {
        const data = bankResult.result;
        setCallbacks((prev) => ({ ...prev, [item.id]: { id: data.id, amountRub: data.amountRub, ts: data.ts } }));
      }
    }

    setBusyId(null);
  }

  return (
    <P7Card
      title='Операторские действия'
      subtitle='Прямо из центра управления: снять препятствие, увидеть журнал и получить демо-событие банка по выпуску денег.'
      testId='control-tower-operator-panel'
      footer={<OperatorAudit audit={audit} />}
    >
      <div style={{ display: 'grid', gap: PLATFORM_V7_TOKENS.spacing.md }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <P7Badge tone='danger'>Под проверкой: {formatCompactMoney(blockedAmount)}</P7Badge>
        </div>

        <div style={{ display: 'grid', gap: PLATFORM_V7_TOKENS.spacing.sm }}>
          {items.map((item) => {
            const callback = callbacks[item.id];
            const actionState = lastActionState[item.id] ?? 'idle';
            return (
              <div
                key={item.id}
                style={{
                  border: `1px solid ${PLATFORM_V7_TOKENS.color.border}`,
                  borderRadius: PLATFORM_V7_TOKENS.radius.lg,
                  padding: PLATFORM_V7_TOKENS.spacing.md,
                  display: 'grid',
                  gap: PLATFORM_V7_TOKENS.spacing.sm,
                  background: PLATFORM_V7_TOKENS.color.surface,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: PLATFORM_V7_TOKENS.spacing.sm, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div>
                    <div
                      style={{
                        fontFamily: PLATFORM_V7_TOKENS.typography.fontMono,
                        fontSize: PLATFORM_V7_TOKENS.typography.caption.size + 1,
                        fontWeight: 800,
                        color: PLATFORM_V7_TOKENS.color.brand,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {item.id}
                    </div>
                    <div
                      style={{
                        marginTop: PLATFORM_V7_TOKENS.spacing.xxs,
                        fontFamily: PLATFORM_V7_TOKENS.typography.fontSans,
                        fontSize: PLATFORM_V7_TOKENS.typography.body.size,
                        fontWeight: 800,
                        color: PLATFORM_V7_TOKENS.color.text,
                      }}
                    >
                      {item.title}
                    </div>
                  </div>
                  <P7Badge tone={gateTone(item.gateState)}>{gateLabel(item.gateState)}</P7Badge>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: PLATFORM_V7_TOKENS.spacing.sm }}>
                  <InfoCell label='Причины' value={item.reasonCodes.length ? item.reasonCodes.map(translateReason).join(' · ') : '—'} />
                  <InfoCell label='Следующий шаг' value={cleanCopy(item.nextStep ?? '—')} />
                  <InfoCell label='Следующий владелец' value={item.nextOwner ? translateRole(item.nextOwner) : '—'} />
                  <InfoCell label='К выпуску денег' value={formatCompactMoney(item.releasableAmount)} />
                </div>

                <div style={{ display: 'flex', gap: PLATFORM_V7_TOKENS.spacing.xs, flexWrap: 'wrap' }}>
                  {item.gateState !== 'PASS' ? (
                    <P7ActionButton
                      onClick={() => unblock(item)}
                      state={busyId === item.id ? 'loading' : actionState}
                      loadingLabel='Снимаю препятствие…'
                      successLabel='Препятствие снято'
                      errorLabel='Ошибка действия'
                    >
                      Снять препятствие
                    </P7ActionButton>
                  ) : (
                    <P7Badge tone='success'>Проверка пройдена</P7Badge>
                  )}
                  {callback ? <P7Badge tone='money'>{callback.id} · {formatMoney(callback.amountRub)}</P7Badge> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </P7Card>
  );
}

function OperatorAudit({ audit }: { audit: AuditRow[] }) {
  return (
    <div style={{ display: 'grid', gap: PLATFORM_V7_TOKENS.spacing.sm }}>
      <div
        style={{
          fontFamily: PLATFORM_V7_TOKENS.typography.fontSans,
          fontSize: PLATFORM_V7_TOKENS.typography.h3.size,
          fontWeight: PLATFORM_V7_TOKENS.typography.h3.weight,
          color: PLATFORM_V7_TOKENS.color.text,
        }}
      >
        Журнал действий оператора
      </div>
      {audit.length ? audit.map((row) => (
        <div
          key={row.id}
          style={{
            border: `1px solid ${PLATFORM_V7_TOKENS.color.border}`,
            borderRadius: PLATFORM_V7_TOKENS.radius.lg,
            padding: PLATFORM_V7_TOKENS.spacing.sm,
            background: row.status === 'error' ? PLATFORM_V7_TOKENS.color.dangerSoft : row.status === 'started' ? PLATFORM_V7_TOKENS.color.warningSoft : PLATFORM_V7_TOKENS.color.surfaceMuted,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: PLATFORM_V7_TOKENS.spacing.sm, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: PLATFORM_V7_TOKENS.spacing.xs, alignItems: 'center', flexWrap: 'wrap' }}>
              <P7Badge tone={auditTone(row.status)}>{auditLabel(row.status)}</P7Badge>
              <div style={{ fontSize: PLATFORM_V7_TOKENS.typography.caption.size + 1, fontWeight: 800, color: PLATFORM_V7_TOKENS.color.text }}>{row.action}</div>
            </div>
            <div style={{ fontSize: PLATFORM_V7_TOKENS.typography.caption.size - 1, color: PLATFORM_V7_TOKENS.color.textSubtle }}>{new Date(row.ts).toLocaleString('ru-RU')}</div>
          </div>
          <div style={{ marginTop: PLATFORM_V7_TOKENS.spacing.xxs, fontSize: PLATFORM_V7_TOKENS.typography.caption.size, color: PLATFORM_V7_TOKENS.color.textMuted }}>{row.actor}</div>
          <div style={{ marginTop: PLATFORM_V7_TOKENS.spacing.xs, fontSize: PLATFORM_V7_TOKENS.typography.caption.size + 1, color: row.status === 'error' ? PLATFORM_V7_TOKENS.color.danger : PLATFORM_V7_TOKENS.color.textMuted }}>{row.detail}</div>
        </div>
      )) : <div style={{ fontSize: PLATFORM_V7_TOKENS.typography.caption.size + 1, color: PLATFORM_V7_TOKENS.color.textMuted }}>Действий пока нет. Сними препятствие по одному из кейсов выше.</div>}
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: `1px solid ${PLATFORM_V7_TOKENS.color.border}`,
        borderRadius: PLATFORM_V7_TOKENS.radius.md,
        padding: PLATFORM_V7_TOKENS.spacing.sm,
        background: PLATFORM_V7_TOKENS.color.surface,
      }}
    >
      <div
        style={{
          fontSize: PLATFORM_V7_TOKENS.typography.caption.size - 1,
          color: PLATFORM_V7_TOKENS.color.textSubtle,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          fontWeight: 800,
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: PLATFORM_V7_TOKENS.spacing.xs,
          fontSize: PLATFORM_V7_TOKENS.typography.caption.size + 1,
          color: PLATFORM_V7_TOKENS.color.text,
          lineHeight: PLATFORM_V7_TOKENS.typography.body.lineHeight,
        }}
      >
        {value}
      </div>
    </div>
  );
}
