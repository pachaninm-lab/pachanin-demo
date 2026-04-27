'use client';

import * as React from 'react';
import Link from 'next/link';
import { P7ActionButton, type P7ActionButtonState } from '@/components/platform-v7/P7ActionButton';
import { useToast } from '@/components/v7r/Toast';
import { runPlatformAction } from '@/lib/platform-v7/action-runner';
import type { PlatformActionLogEntry, PlatformActionStatus } from '@/lib/platform-v7/action-log';
import { useFieldRuntimeStore, type ReceptionRuntime } from '@/stores/useFieldRuntimeStore';

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

export function FieldElevatorRuntime() {
  const toast = useToast();
  const receptions = useFieldRuntimeStore((s) => s.receptions);
  const admitReception = useFieldRuntimeStore((s) => s.admitReception);
  const updateReception = useFieldRuntimeStore((s) => s.updateReception);
  const confirmReception = useFieldRuntimeStore((s) => s.confirmReception);
  const [actionStates, setActionStates] = React.useState<Record<string, P7ActionButtonState>>({});
  const [actionLog, setActionLog] = React.useState<ActionRow[]>([]);

  const pushActionLog = (entries: PlatformActionLogEntry[]) => {
    setActionLog((current) => [...entries.map(toActionRow), ...current].slice(0, 8));
  };

  const admitTruck = async (item: ReceptionRuntime) => {
    const actionKey = `${item.plate}:admit`;
    setActionStates((current) => ({ ...current, [actionKey]: 'loading' }));

    const result = await runPlatformAction({
      scope: 'elevator',
      objectId: item.plate,
      action: 'elevator-admit-truck',
      actor: 'Элеватор',
      loadingMessage: `Машина ${item.plate}: начат допуск на приёмку по сделке ${item.dealId}.`,
      successMessage: () => `Машина ${item.plate}: допущена на приёмку.`,
      errorMessage: (error) => `Машина ${item.plate}: допуск не выполнен${error instanceof Error ? `: ${error.message}` : ''}.`,
      run: async () => {
        admitReception(item.plate);
        return item.plate;
      },
    });

    pushActionLog(result.log);

    if (result.phase === 'success') {
      toast(`Машина ${item.plate} допущена на приёмку.`, 'success');
      setActionStates((current) => ({ ...current, [actionKey]: 'success' }));
      return;
    }

    toast(`Машина ${item.plate} не допущена.`, 'error');
    setActionStates((current) => ({ ...current, [actionKey]: 'error' }));
  };

  const confirmTruckReception = async (item: ReceptionRuntime) => {
    const actionKey = `${item.plate}:confirm`;
    setActionStates((current) => ({ ...current, [actionKey]: 'loading' }));

    const result = await runPlatformAction({
      scope: 'elevator',
      objectId: item.plate,
      action: 'elevator-confirm-reception',
      actor: 'Элеватор',
      loadingMessage: `Машина ${item.plate}: фиксируется вес, СДИЗ и ФГИС-шаг.`,
      successMessage: () => `Машина ${item.plate}: приёмка завершена, ФГИС-шаг отмечен.`,
      errorMessage: (error) => `Машина ${item.plate}: приёмка не подтверждена${error instanceof Error ? `: ${error.message}` : ''}.`,
      run: async () => {
        confirmReception(item.plate);
        return item.plate;
      },
    });

    pushActionLog(result.log);

    if (result.phase === 'success') {
      toast(`Приёмка ${item.plate} завершена и отмечена в ФГИС.`, 'success');
      setActionStates((current) => ({ ...current, [actionKey]: 'success' }));
      return;
    }

    toast(`Приёмка ${item.plate} не подтверждена.`, 'error');
    setActionStates((current) => ({ ...current, [actionKey]: 'error' }));
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#0F1419' }}>Приёмка и весовая</div>
        <div style={{ fontSize: 13, color: '#6B778C', marginTop: 8, lineHeight: 1.7 }}>Экран больше не витрина. Здесь реально двигается состояние по машинам: допуск, вес, СДИЗ и фиксация ФГИС-шага.</div>
      </section>

      {receptions.map((item) => {
        const admitState = actionStates[`${item.plate}:admit`] ?? 'idle';
        const confirmState = actionStates[`${item.plate}:confirm`] ?? 'idle';
        return (
          <section key={item.plate} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', color: '#0A7A5F', fontSize: 13, fontWeight: 800 }}>{item.plate}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0F1419', marginTop: 4 }}>Сделка {item.dealId}</div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 800, color: item.status === 'completed' ? '#15803D' : item.status === 'admitted' ? '#B45309' : '#6B7280' }}>{item.status.toUpperCase()}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <input value={item.weight} onChange={(e) => updateReception(item.plate, { weight: e.target.value })} placeholder='Вес' style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid #E4E6EA', fontSize: 14 }} />
              <input value={item.sdiz} onChange={(e) => updateReception(item.plate, { sdiz: e.target.value })} placeholder='Номер СДИЗ' style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid #E4E6EA', fontSize: 14 }} />
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {item.status === 'waiting' ? (
                <P7ActionButton
                  state={admitState}
                  onClick={() => admitTruck(item)}
                  loadingLabel='Допускаю…'
                  successLabel='Допущено'
                  errorLabel='Ошибка'
                >
                  Допустить
                </P7ActionButton>
              ) : null}
              {item.status !== 'completed' ? (
                <P7ActionButton
                  variant='secondary'
                  state={confirmState}
                  onClick={() => confirmTruckReception(item)}
                  loadingLabel='Подтверждаю…'
                  successLabel='Приёмка закрыта'
                  errorLabel='Ошибка'
                >
                  Подтвердить приёмку
                </P7ActionButton>
              ) : null}
              <Link href={`/platform-v7/deals/${item.dealId}`} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '12px 16px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontWeight: 700 }}>Открыть сделку</Link>
            </div>

            <div style={{ fontSize: 12, color: '#6B778C' }}>FGIS: {item.fgis ? 'подтверждено' : 'не отправлено'} · Вес: {item.weight || '—'} т · СДИЗ: {item.sdiz || '—'}</div>
          </section>
        );
      })}

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Журнал действий приёмки</div>
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
