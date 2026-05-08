'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AuditEvent } from '../../lib/platform-v7/core-types';
import { getWorkflowDashboardModel, runWorkflowAction, type WorkflowActionContext, type WorkflowState } from '../../lib/platform-v7/workflow-source-of-truth';
import { decodeWorkflowSnapshot, encodeWorkflowSnapshot, hydrateWorkflowState, LEGACY_WORKFLOW_STORAGE_KEY, mergeWorkflowAuditEvents, WORKFLOW_STORAGE_KEY } from '../../lib/platform-v7/workflow-persistence';

export function WorkflowActionPanel({ context }: { context: WorkflowActionContext }) {
  const model = useMemo(() => getWorkflowDashboardModel(context), [context]);
  const [state, setState] = useState<WorkflowState>(model.state);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>(model.auditSeed);
  const [toast, setToast] = useState('Готово к действию. Любой шаг меняет состояние и пишет журнал.');

  useEffect(() => {
    function load() {
      const saved = readSaved();
      if (!saved) return;
      setState(hydrateWorkflowState(model.state, saved));
      setAuditEvents(mergeWorkflowAuditEvents(saved.auditEvents, model.auditSeed));
      setToast(saved.toast || 'Состояние восстановлено из предыдущего действия.');
    }
    load();
    const onStorage = (event: StorageEvent) => {
      if (event.key === WORKFLOW_STORAGE_KEY || event.key === LEGACY_WORKFLOW_STORAGE_KEY) load();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [model.auditSeed, model.state]);

  function applyAction(action: (typeof model.actions)[number]) {
    const result = runWorkflowAction(action, state);
    const nextEvents = mergeWorkflowAuditEvents([result.auditEvent, ...auditEvents], model.auditSeed);
    setState(result.state);
    setAuditEvents(nextEvents);
    setToast(result.toast);
    save({ state: result.state, auditEvents: nextEvents, toast: result.toast });
  }

  return (
    <section style={shell} data-testid={`workflow-action-panel-${context}`}>
      <div>
        <div style={eyebrow}>рабочие действия</div>
        <h2 style={h2}>{model.title}</h2>
        <p style={lead}>{model.lead}</p>
      </div>

      <div style={toastStyle} role='status'>{toast}</div>

      <div style={grid}>
        <Cell label='Партия' value={state.batchStatus} />
        <Cell label='Лот' value={state.lotStatus} />
        <Cell label='Предложение' value={state.offerStatus} />
        <Cell label='Черновик сделки' value={state.dealDraftStatus} />
        <Cell label='Деньги' value={state.moneyStatus} accent />
        <Cell label='Документы' value={state.documentStatus} />
        <Cell label='Логистика' value={state.logisticsStatus} />
        <Cell label='Доступ' value={state.bypassStatus} warning />
      </div>

      <div style={nextBox}>
        <span style={eyebrow}>следующее действие</span>
        <strong>{state.nextAction}</strong>
        <span style={small}>{state.updatedAt}</span>
      </div>

      <div style={actionGrid}>
        {model.actions.map((action) => (
          <button key={action.kind} type='button' style={actionButton} onClick={() => applyAction(action)}>
            <strong>{action.label}</strong>
            <span>{action.description}</span>
          </button>
        ))}
      </div>

      <div style={journal}>
        <div style={eyebrow}>журнал действий</div>
        {auditEvents.map((event) => (
          <div key={event.id} style={journalRow}>
            <div>
              <strong>{translateAction(event.action)}</strong>
              <div style={small}>{entityLabel(event.entityType)} · {event.entityId}{event.dealId ? ` · ${event.dealId}` : ''}</div>
            </div>
            <span style={rolePill}>{roleLabel(event.actorRole)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function readSaved() {
  try {
    return decodeWorkflowSnapshot(window.localStorage.getItem(WORKFLOW_STORAGE_KEY)) ?? decodeWorkflowSnapshot(window.localStorage.getItem(LEGACY_WORKFLOW_STORAGE_KEY));
  } catch {
    return null;
  }
}

function save(payload: { state: WorkflowState; auditEvents: AuditEvent[]; toast: string }) {
  try {
    window.localStorage.setItem(WORKFLOW_STORAGE_KEY, encodeWorkflowSnapshot(payload));
    window.localStorage.removeItem(LEGACY_WORKFLOW_STORAGE_KEY);
  } catch {}
}

function Cell({ label, value, accent, warning }: { label: string; value: string; accent?: boolean; warning?: boolean }) {
  return <div style={{ ...cell, borderColor: warning ? 'rgba(217,119,6,0.22)' : accent ? 'rgba(10,122,95,0.2)' : '#E4E6EA' }}><span style={eyebrow}>{label}</span><strong style={{ color: warning ? '#B45309' : accent ? '#0A7A5F' : '#0F1419' }}>{value}</strong></div>;
}

function translateAction(action: string): string {
  return ({ workflow_opened: 'Открыта рабочая поверхность', publish_market_lot: 'Лот опубликован', send_buyer_offer: 'Предложение отправлено', accept_offer_to_draft: 'Предложение принято, создан черновик сделки', confirm_money_reserve: 'Резерв денег подтверждён', request_document_preview: 'Документ открыт в защищённом просмотре', block_contact_leak: 'Доступ ограничен', open_manual_review: 'Включена ручная проверка' } as Record<string, string>)[action] ?? action;
}

function entityLabel(entityType: string): string {
  return ({ workflow: 'рабочая поверхность', market_lot: 'лот', offer: 'предложение', document: 'документ', money_plan: 'денежный план', deal_draft: 'черновик сделки', bypass_signal: 'сигнал доступа', deal: 'сделка', counterparty: 'контрагент' } as Record<string, string>)[entityType] ?? entityType;
}

function roleLabel(role: string): string {
  return ({ seller: 'продавец', buyer: 'покупатель', operator: 'оператор', bank: 'банк', logistics: 'логистика', carrier: 'перевозчик', driver: 'водитель', elevator: 'элеватор', lab: 'лаборатория', investor: 'наблюдатель' } as Record<string, string>)[role] ?? role;
}

const shell = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 14, minWidth: 0, overflow: 'hidden' } as const;
const eyebrow = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' } as const;
const h2 = { margin: 0, color: '#0F1419', fontSize: 'clamp(23px,5vw,32px)', lineHeight: 1.08, fontWeight: 950, overflowWrap: 'anywhere' } as const;
const lead = { margin: '6px 0 0', color: '#475569', fontSize: 14, lineHeight: 1.55, overflowWrap: 'anywhere' } as const;
const toastStyle = { background: 'rgba(10,122,95,0.07)', border: '1px solid rgba(10,122,95,0.18)', borderRadius: 16, padding: 12, color: '#0A7A5F', fontSize: 13, lineHeight: 1.45, fontWeight: 900 } as const;
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8 } as const;
const cell = { minHeight: 82, display: 'grid', gap: 6, border: '1px solid #E4E6EA', borderRadius: 14, padding: 10, minWidth: 0 } as const;
const nextBox = { background: '#F8FAFB', border: '1px solid #E4E6EA', borderRadius: 16, padding: 12, display: 'grid', gap: 5 } as const;
const actionGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 8 } as const;
const actionButton = { textAlign: 'left', border: '1px solid #CBD5E1', background: '#fff', borderRadius: 16, padding: 13, minHeight: 112, display: 'grid', gap: 7, cursor: 'pointer' } as const;
const journal = { display: 'grid', gap: 8, background: '#F8FAFB', border: '1px solid #E4E6EA', borderRadius: 18, padding: 12 } as const;
const journalRow = { display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', background: '#fff', border: '1px solid #E4E6EA', borderRadius: 13, padding: 10, flexWrap: 'wrap' } as const;
const small = { color: '#64748B', fontSize: 12 } as const;
const rolePill = { borderRadius: 999, padding: '6px 9px', background: 'rgba(15,23,42,0.06)', color: '#0F172A', fontSize: 11, fontWeight: 900 } as const;
