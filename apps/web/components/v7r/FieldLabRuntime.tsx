'use client';

import * as React from 'react';
import { P7ActionButton, type P7ActionButtonState } from '@/components/platform-v7/P7ActionButton';
import { P7ActionLog } from '@/components/platform-v7/P7ActionLog';
import { useToast } from '@/components/v7r/Toast';
import { runPlatformAction } from '@/lib/platform-v7/action-runner';
import type { PlatformActionLogEntry } from '@/lib/platform-v7/action-log';
import { useFieldRuntimeStore, type LabCaseRuntime } from '@/stores/useFieldRuntimeStore';

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
  const [actionLog, setActionLog] = React.useState<PlatformActionLogEntry[]>([]);

  const pushActionLog = (entries: PlatformActionLogEntry[]) => {
    setActionLog((current) => [...entries, ...current].slice(0, 8));
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

      <P7ActionLog title='Журнал лабораторных действий' entries={actionLog} />
    </div>
  );
}
