'use client';

import { useEffect, useMemo, useState } from 'react';
import { AuditEvent } from '../../lib/platform-v7/core-types';
import {
  getWorkflowDashboardModel,
  runWorkflowAction,
  WorkflowActionContext,
  WorkflowState,
} from '../../lib/platform-v7/workflow-source-of-truth';

const STORAGE_KEY = 'pc-platform-v7-workflow-state-v2';

interface PersistedWorkflowState {
  state: WorkflowState;
  auditEvents: AuditEvent[];
  toast: string;
}

export function WorkflowActionPanel({ context }: { context: WorkflowActionContext }) {
  const model = useMemo(() => getWorkflowDashboardModel(context), [context]);
  const [state, setState] = useState<WorkflowState>(model.state);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>(model.auditSeed);
  const [toast, setToast] = useState('Готово к действию. Любой шаг меняет состояние и пишет журнал.');

  useEffect(() => {
    const persisted = readPersistedWorkflowState();
    if (!persisted) return;

    setState({ ...model.state, ...persisted.state });
    setAuditEvents(mergeAuditEvents(persisted.auditEvents, model.auditSeed));
    setToast(persisted.toast || 'Состояние восстановлено из предыдущего действия.');
  }, [model.auditSeed, model.state]);

  return (
    <section style={shell} data-testid={`workflow-action-panel-${context}`}>
      <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
        <div style={eyebrow}>рабочие действия</div>
        <h2 style={h2}>{model.title}</h2>
        <p style={lead}>{model.lead}</p>
      </div>

      <div style={toastStyle} role='status'>{toast}</div>

      <div style={stateGrid}>
        <StateCell label='Партия' value={state.batchStatus} />
        <StateCell label='Лот' value={state.lotStatus} />
        <StateCell label='Оффер' value={state.offerStatus} />
        <StateCell label='Черновик сделки' value={state.dealDraftStatus} />
        <StateCell label='Деньги' value={state.moneyStatus} accent />
        <StateCell label='Документы' value={state.documentStatus} />
        <StateCell label='Логистика' value={state.logisticsStatus} />
        <StateCell label='Антиобход' value={state.bypassStatus} warning />
      </div>

      <div style={nextBox}>
        <span style={eyebrow}>следующее действие</span>
        <strong style={{ color: '#0F1419', fontSize: 15, lineHeight: 1.35, overflowWrap: 'anywhere' }}>{state.nextAction}</strong>
        <span style={{ color: '#64748B', fontSize: 12, fontWeight: 800 }}>{state.updatedAt}</span>
      </div>

      <div style={actionGrid}>
        {model.actions.map((action) => (
          <button
            key={action.kind}
            type='button'
            style={actionButton}
            onClick={() => {
              const result = runWorkflowAction(action, state);
              const nextAuditEvents = [result.auditEvent, ...auditEvents].slice(0, 10);

              setState(result.state);
              setAuditEvents(nextAuditEvents);
              setToast(result.toast);
              persistWorkflowState({ state: result.state, auditEvents: nextAuditEvents, toast: result.toast });
            }}
          >
            <span style={{ color: '#0F1419', fontSize: 14, fontWeight: 950, overflowWrap: 'anywhere' }}>{action.label}</span>
            <span style={{ color: '#64748B', fontSize: 12, lineHeight: 1.4, overflowWrap: 'anywhere' }}>{action.description}</span>
          </button>
        ))}
      </div>

      <div style={journal}>
        <div style={eyebrow}>журнал действий</div>
        {auditEvents.map((event) => (
          <div key={event.id} style={journalRow}>
            <div style={{ display: 'grid', gap: 3, minWidth: 0 }}>
              <strong style={{ color: '#0F1419', fontSize: 13, overflowWrap: 'anywhere' }}>{translateAction(event.action)}</strong>
              <span style={{ color: '#64748B', fontSize: 12, overflowWrap: 'anywhere' }}>{event.entityType} · {event.entityId}{event.dealId ? ` · ${event.dealId}` : ''}</span>
            </div>
            <span style={rolePill}>{roleLabel(event.actorRole)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function readPersistedWorkflowState(): PersistedWorkflowState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<PersistedWorkflowState>;
    if (!parsed.state || !Array.isArray(parsed.auditEvents)) return null;

    return {
      state: parsed.state as WorkflowState,
      auditEvents: parsed.auditEvents as AuditEvent[],
      toast: typeof parsed.toast === 'string' ? parsed.toast : 'Состояние восстановлено из предыдущего действия.',
    };
  } catch {
    return null;
  }
}

function persistWorkflowState(payload: PersistedWorkflowState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // В controlled pilot отсутствие localStorage не должно ломать действие на странице.
  }
}

function mergeAuditEvents(persisted: AuditEvent[], seed: AuditEvent[]): AuditEvent[] {
  const seen = new Set<string>();
  return [...persisted, ...seed].filter((event) => {
    if (seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  }).slice(0, 10);
}

function StateCell({ label, value, accent = false, warning = false }: { label: string; value: string; accent?: boolean; warning?: boolean }) {
  return (
    <div style={{ ...stateCell, borderColor: warning ? 'rgba(217,119,6,0.22)' : accent ? 'rgba(10,122,95,0.2)' : '#E4E6EA', background: warning ? 'rgba(217,119,6,0.055)' : accent ? 'rgba(10,122,95,0.055)' : '#fff' }}>
      <span style={eyebrow}>{label}</span>
      <strong style={{ color: warning ? '#B45309' : accent ? '#0A7A5F' : '#0F1419', fontSize: 12.5, lineHeight: 1.35, overflowWrap: 'anywhere' }}>{value}</strong>
    </div>
  );
}

function translateAction(action: string): string {
  const map: Record<string, string> = {
    workflow_opened: 'Открыта рабочая поверхность',
    publish_market_lot: 'Лот опубликован',
    send_buyer_offer: 'Оффер отправлен',
    accept_offer_to_draft: 'Оффер принят, создан черновик сделки',
    confirm_money_reserve: 'Резерв денег подтверждён',
    request_document_preview: 'Документ открыт в защищённом просмотре',
    block_contact_leak: 'Контакт замаскирован',
    open_manual_review: 'Включена ручная проверка',
  };
  return map[action] ?? action;
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    seller: 'продавец',
    buyer: 'покупатель',
    operator: 'оператор',
    bank: 'банк',
    logistics: 'логистика',
    carrier: 'перевозчик',
    driver: 'водитель',
    elevator: 'элеватор',
    lab: 'лаборатория',
    investor: 'наблюдатель',
  };
  return map[role] ?? role;
}

const shell = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 14, boxShadow: '0 14px 34px rgba(15,20,25,0.045)', minWidth: 0, overflow: 'hidden' } as const;
const eyebrow = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' } as const;
const h2 = { margin: 0, color: '#0F1419', fontSize: 'clamp(23px,5vw,32px)', lineHeight: 1.08, letterSpacing: '-0.035em', fontWeight: 950, overflowWrap: 'anywhere' } as const;
const lead = { margin: 0, color: '#475569', fontSize: 14, lineHeight: 1.55, overflowWrap: 'anywhere' } as const;
const toastStyle = { background: 'rgba(10,122,95,0.07)', border: '1px solid rgba(10,122,95,0.18)', borderRadius: 16, padding: 12, color: '#0A7A5F', fontSize: 13, lineHeight: 1.45, fontWeight: 900, overflowWrap: 'anywhere' } as const;
const stateGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8, minWidth: 0 } as const;
const stateCell = { minHeight: 82, display: 'grid', alignContent: 'start', gap: 6, border: '1px solid #E4E6EA', borderRadius: 14, padding: 10, minWidth: 0 } as const;
const nextBox = { background: '#F8FAFB', border: '1px solid #E4E6EA', borderRadius: 16, padding: 12, display: 'grid', gap: 5, minWidth: 0 } as const;
const actionGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 8, minWidth: 0 } as const;
const actionButton = { appearance: 'none', textAlign: 'left', border: '1px solid #CBD5E1', background: '#fff', borderRadius: 16, padding: 13, minHeight: 112, display: 'grid', gap: 7, cursor: 'pointer', minWidth: 0 } as const;
const journal = { display: 'grid', gap: 8, background: '#F8FAFB', border: '1px solid #E4E6EA', borderRadius: 18, padding: 12, minWidth: 0 } as const;
const journalRow = { display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', background: '#fff', border: '1px solid #E4E6EA', borderRadius: 13, padding: 10, flexWrap: 'wrap', minWidth: 0 } as const;
const rolePill = { display: 'inline-flex', width: 'fit-content', alignItems: 'center', borderRadius: 999, padding: '6px 9px', background: 'rgba(15,23,42,0.06)', color: '#0F172A', fontSize: 11, fontWeight: 900, flex: '0 0 auto' } as const;
