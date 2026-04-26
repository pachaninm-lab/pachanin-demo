'use client';

import * as React from 'react';
import { P7ActionButton, type P7ActionButtonState } from '@/components/platform-v7/P7ActionButton';
import { useToast } from '@/components/v7r/Toast';
import { runPlatformAction } from '@/lib/platform-v7/action-runner';
import type { PlatformActionLogEntry, PlatformActionStatus } from '@/lib/platform-v7/action-log';
import { useFieldRuntimeStore, type LabCaseRuntime } from '@/stores/useFieldRuntimeStore';

type ActionRow = {
  id: string;
  at: string;
  status: PlatformActionStatus;
  action: string;
  message: string;
};

function toActionRow(entry: PlatformActionLogEntry): ActionRow {
  return {
    id: entry.id,
    at: entry.at,
    status: entry.status,
    action: entry.action,
    message: entry.message,
  };
}

function statusTone(status: PlatformActionStatus) {
  if (status === 'success') return { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F', label: 'Успешно' };
  if (status === 'error') return { bg: 'rgba(180,35,24,0.08)', border: 'rgba(180,35,24,0.18)', color: '#B42318', label: 'Ошибка' };
  return { bg: 'rgba(180,83,9,0.10)', border: 'rgba(180,83,9,0.18)', color: '#B45309', label: 'Выполняется' };
}

function resolveProtocolResult(c: LabCaseRuntime) {
  return Number(c.moisture || 0) <= 14 ? 'PASS' : 'REVIEW';
}

export function FieldLabRuntime() {
  const toast = useToast();
  const labCases = useFieldRuntimeStore((s) => s.labCases);
  const startLabCase = useFieldRuntimeStore((s) => s.startLabCase);
  const updateLabCase = useFieldRuntimeStore((s) => s.updateLabCase);
  const completeLabCase = useFieldRuntimeStore((s) => s.completeLabCase);
  const [actionStates, setActionStates] = React.useState<Record<string, P7ActionButtonState>>({});
  const [actionLog, setActionLog] = React.useState<ActionRow[]>([]);

  const pushActionLog = (entries: PlatformActionLogEntry[]) => {
    setActionLog((current) => [...entries.map(toActionRow), ...current].slice(0, 8));
  };

  const startAnalysis = async (c: LabCaseRuntime) => {
    const actionKey = `${c.id}:start`;
    setActionStates((current) => ({ ...current, [actionKey]: 'loading' }));

    const result = await runPlatformAction({
      scope: 'lab',
      objectId: c.id,
      action: 'lab-analysis-start',
      actor: 'Лаборатория',
      loadingMessage: `Проба ${c.id}: анализ взят в работу.`,
      successMessage: () => `Проба ${c.id}: лабораторный анализ начат по сделке ${c.dealId}.`,
      errorMessage: (error) => `Проба ${c.id}: анализ не запущен${error instanceof Error ? `: ${error.message}` : ''}.`,
      run: async () => {
        startLabCase(c.id);
        return c.id;
      },
    });

    pushActionLog(result.log);

    if (result.phase === 'success') {
      toast(`Проба ${c.id} взята в работу.`, 'success');
      setActionStates((current) => ({ ...current, [actionKey]: 'success' }));
      return;
    }

    toast(`Проба ${c.id} не взята в работу.`, 'error');
    setActionStates((current) => ({ ...current, [actionKey]: 'error' }));
  };

  const confirmProtocol = async (c: LabCaseRuntime) => {
    const actionKey = `${c.id}:confirm`;
    setActionStates((current) => ({ ...current, [actionKey]: 'loading' }));

    const result = await runPlatformAction({
      scope: 'lab',
      objectId: c.id,
      action: 'lab-protocol-confirm',
      actor: 'Лаборатория',
      loadingMessage: `Проба ${c.id}: подписывается протокол качества.`,
      successMessage: () => `Проба ${c.id}: протокол подтверждён, результат ${resolveProtocolResult(c)}.`,
      errorMessage: (error) => `Проба ${c.id}: протокол не подтверждён${error instanceof Error ? `: ${error.message}` : ''}.`,
      run: async () => {
        completeLabCase(c.id);
        return c.id;
      },
    });

    pushActionLog(result.log);

    if (result.phase === 'success') {
      toast(`Проба ${c.id} подтверждена.`, 'success');
      setActionStates((current) => ({ ...current, [actionKey]: 'success' }));
      return;
    }

    toast(`Проба ${c.id} не подтверждена.`, 'error');
    setActionStates((current) => ({ ...current, [actionKey]: 'error' }));
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#0F1419' }}>Лаборатория</div>
        <div style={{ fontSize: 13, color: '#6B778C', marginTop: 8 }}>Формируется протокол качества. Любая дельта влияет на деньги сделки.</div>
      </section>

      {labCases.map((c) => {
        const startState = actionStates[`${c.id}:start`] ?? 'idle';
        const confirmState = actionStates[`${c.id}:confirm`] ?? 'idle';
        return (
          <section key={c.id} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 800 }}>{c.id} · {c.dealId}</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: c.status === 'completed' ? '#15803D' : c.status === 'in_progress' ? '#B45309' : '#6B7280' }}>{c.status.toUpperCase()}</div>
            </div>
            {c.status === 'new' ? (
              <P7ActionButton
                state={startState}
                onClick={() => startAnalysis(c)}
                loadingLabel='Запускаю…'
                successLabel='Анализ начат'
                errorLabel='Ошибка'
              >
                Начать анализ
              </P7ActionButton>
            ) : null}
            <input value={c.protein} onChange={(e) => updateLabCase(c.id, { protein: e.target.value })} placeholder='Белок %' style={{ padding: 10, borderRadius: 10, border: '1px solid #E4E6EA' }} />
            <input value={c.moisture} onChange={(e) => updateLabCase(c.id, { moisture: e.target.value })} placeholder='Влажность %' style={{ padding: 10, borderRadius: 10, border: '1px solid #E4E6EA' }} />
            <input value={c.gluten} onChange={(e) => updateLabCase(c.id, { gluten: e.target.value })} placeholder='Клейковина %' style={{ padding: 10, borderRadius: 10, border: '1px solid #E4E6EA' }} />
            {c.status !== 'completed' ? (
              <P7ActionButton
                state={confirmState}
                onClick={() => confirmProtocol(c)}
                loadingLabel='Подписываю…'
                successLabel='Протокол подписан'
                errorLabel='Ошибка'
              >
                Подтвердить протокол
              </P7ActionButton>
            ) : null}
            <div style={{ fontSize: 12, color: '#6B778C' }}>Результат: {c.result} · Протокол: {c.protocolSigned ? 'подписан' : 'не подписан'}</div>
          </section>
        );
      })}

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Журнал лабораторных действий</div>
        {actionLog.length ? actionLog.map((row) => {
          const tone = statusTone(row.status);
          return (
            <div key={row.id} style={{ border: `1px solid ${tone.border}`, background: tone.bg, borderRadius: 14, padding: 12, display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ display: 'inline-flex', borderRadius: 999, padding: '4px 8px', background: '#fff', color: tone.color, fontSize: 11, fontWeight: 800 }}>{tone.label}</span>
                  <span style={{ color: '#0F1419', fontSize: 13, fontWeight: 800 }}>{row.action}</span>
                </div>
                <span style={{ color: '#667085', fontSize: 11 }}>{new Date(row.at).toLocaleString('ru-RU')}</span>
              </div>
              <div style={{ color: row.status === 'error' ? '#B42318' : '#475569', fontSize: 13, lineHeight: 1.5 }}>{row.message}</div>
            </div>
          );
        }) : <div style={{ color: '#6B778C', fontSize: 13 }}>Действий пока нет.</div>}
      </section>
    </div>
  );
}
