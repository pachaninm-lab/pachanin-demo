'use client';

import { useState } from 'react';
import { P7ActionLog } from './P7ActionLog';
import { buildPlatformV7FgisCheckRuntimeAction, type PlatformV7FgisCheckRuntimeResult } from '@/lib/platform-v7/fgis-runtime-action';
import type { PlatformActionLogEntry } from '@/lib/platform-v7/action-log';
import type { PlatformV7ExecutionRole } from '@/lib/platform-v7/execution-action-core';
import type { PlatformV7RuntimeActionEventCreated, PlatformV7RuntimeActionEventResult } from '@/lib/platform-v7/runtime-action-events';

export interface P7FgisRuntimeCheckPanelProps {
  readonly partyId: string;
  readonly actorRole?: PlatformV7ExecutionRole;
  readonly title?: string;
  readonly description?: string;
}

function isRuntimeEventCreated(event: PlatformV7RuntimeActionEventResult): event is PlatformV7RuntimeActionEventCreated {
  return event.status === 'created';
}

export function P7FgisRuntimeCheckPanel({
  partyId,
  actorRole = 'operator',
  title = 'Сверка партии ФГИС',
  description = 'Создаёт запрос сверки партии и остатка. Платформа ждёт внешнее событие ФГИС и не считает партию, остаток или СДИЗ подтверждёнными без ответа внешней системы.',
}: P7FgisRuntimeCheckPanelProps) {
  const [result, setResult] = useState<PlatformV7FgisCheckRuntimeResult | null>(null);
  const [log, setLog] = useState<PlatformActionLogEntry[]>([]);

  function requestCheck() {
    const next = buildPlatformV7FgisCheckRuntimeAction({
      actorRole,
      partyId,
      reason: 'Партия должна пройти сверку перед допуском к черновику сделки, резерву денег и СДИЗ.',
    });

    setResult(next);

    if (isRuntimeEventCreated(next.event)) {
      setLog((current) => [next.event.logEntry, ...current]);
    }
  }

  const created = result?.status === 'created' && isRuntimeEventCreated(result.event);
  const blocked = result?.status === 'blocked';

  return (
    <section data-testid='p7-fgis-runtime-check-panel' style={{ background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ maxWidth: 900 }}>
          <div style={{ fontSize: 11, color: '#0A7A5F', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>ФГИС · внешний контур</div>
          <h2 style={{ margin: '6px 0 0', fontSize: 20, lineHeight: 1.15, color: 'var(--pc-text-primary)', fontWeight: 900 }}>{title}</h2>
          <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.55, color: 'var(--pc-text-secondary)' }}>{description}</p>
        </div>
        <button
          type='button'
          onClick={requestCheck}
          style={{ minHeight: 44, borderRadius: 12, border: '1px solid rgba(10,122,95,0.22)', background: 'rgba(10,122,95,0.08)', color: '#0A7A5F', padding: '0 14px', fontSize: 13, fontWeight: 900, cursor: 'pointer' }}
        >
          Запросить сверку ФГИС
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
        <Fact label='Партия' value={partyId || 'не выбрана'} />
        <Fact label='Роль' value={actorRole} />
        <Fact label='Статус' value={result?.uiStatusLabel ?? 'запрос ещё не создан'} />
      </div>

      {result ? (
        <div data-testid='p7-fgis-runtime-status' style={{ background: created ? 'rgba(217,119,6,0.08)' : 'rgba(220,38,38,0.08)', border: `1px solid ${created ? 'rgba(217,119,6,0.18)' : 'rgba(220,38,38,0.18)'}`, borderRadius: 12, padding: 12, display: 'grid', gap: 6 }}>
          <div style={{ fontSize: 11, color: 'var(--pc-text-muted)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {created ? 'запрос создан' : 'действие остановлено'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--pc-text-primary)', fontWeight: 900 }}>{result.uiStatusLabel}</div>
          <div style={{ fontSize: 12, color: 'var(--pc-text-secondary)', lineHeight: 1.5 }}>{result.uiSafetyNote}</div>
          {created ? (
            <div style={{ fontSize: 12, color: 'var(--pc-text-secondary)', lineHeight: 1.5 }}>
              Внешний статус: ожидается подтверждение ФГИС. До внешнего события это не является подтверждением партии, остатка или СДИЗ.
            </div>
          ) : null}
        </div>
      ) : (
        <div style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.18)', borderRadius: 12, padding: 12, color: 'var(--pc-text-secondary)', fontSize: 12, lineHeight: 1.5 }}>
          ФГИС-сверка пока не запрошена. Следующий шаг создаёт только запрос и журнал, без заявления о боевой интеграции или внешнем подтверждении.
        </div>
      )}

      {blocked ? (
        <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.18)', borderRadius: 12, padding: 12, color: '#B91C1C', fontSize: 12, fontWeight: 900 }}>
          {result.uiSafetyNote}
        </div>
      ) : null}

      <P7ActionLog title='Журнал ФГИС-сверки' entries={log} emptyLabel='Запрос сверки ещё не создавался.' maxEntries={4} />
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-bg-elevated)', borderRadius: 12, padding: 12 }}>
      <div style={{ fontSize: 11, color: 'var(--pc-text-muted)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 13, color: 'var(--pc-text-primary)', fontWeight: 900 }}>{value}</div>
    </div>
  );
}
