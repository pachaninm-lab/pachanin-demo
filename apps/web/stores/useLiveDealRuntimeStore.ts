'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { selectRuntimeDealById, type RuntimeDealStatus } from '@/lib/domain/selectors';

export type LiveDocsState = 'missing' | 'collecting' | 'complete';
export type LiveReserveState = 'reserved' | 'pending_release' | 'released';
export type LiveDisputeState = 'none' | 'open' | 'resolved';

export interface LiveDealEvent {
  ts: string;
  actor: string;
  action: string;
  type: 'success' | 'info' | 'danger';
}

export interface LiveDealOverride {
  dealId: string;
  docsState: LiveDocsState;
  reserveState: LiveReserveState;
  disputeState: LiveDisputeState;
  blockers: string[];
  nextStep: string;
  nextOwner: string;
  releaseAmount: number | null;
  holdAmount: number;
  status: RuntimeDealStatus;
  events: LiveDealEvent[];
}

interface LiveDealRuntimeState {
  overrides: Record<string, LiveDealOverride>;
  ensureDeal: (dealId: string) => LiveDealOverride | null;
  startDocs: (dealId: string) => void;
  completeDocs: (dealId: string) => void;
  requestRelease: (dealId: string) => void;
  releaseFunds: (dealId: string) => void;
  openDispute: (dealId: string) => void;
  resolveDispute: (dealId: string) => void;
}

function nowIso() {
  return new Date().toISOString();
}

function baseOverride(dealId: string): LiveDealOverride | null {
  const deal = selectRuntimeDealById(dealId);
  if (!deal) return null;

  const docsState: LiveDocsState = deal.blockers.includes('docs') ? 'missing' : deal.status === 'docs_complete' || deal.status === 'release_requested' || deal.status === 'release_approved' || deal.status === 'closed' ? 'complete' : 'collecting';
  const disputeState: LiveDisputeState = deal.blockers.includes('dispute') || deal.status === 'quality_disputed' ? 'open' : 'none';
  const reserveState: LiveReserveState = deal.status === 'release_approved' || deal.status === 'closed' ? 'released' : deal.status === 'release_requested' ? 'pending_release' : 'reserved';

  const override: LiveDealOverride = {
    dealId,
    docsState,
    reserveState,
    disputeState,
    blockers: [...deal.blockers],
    nextStep: 'Проверить блокеры сделки и довести контур до выпуска денег.',
    nextOwner: disputeState === 'open' ? 'Арбитр' : docsState !== 'complete' ? 'Продавец' : reserveState === 'pending_release' ? 'Банк' : 'Оператор',
    releaseAmount: deal.releaseAmount ?? null,
    holdAmount: deal.holdAmount,
    status: deal.status,
    events: (deal.events ?? []).map((event) => ({ ...event })),
  };

  return recalc(override);
}

function addEvent(override: LiveDealOverride, actor: string, action: string, type: 'success' | 'info' | 'danger'): LiveDealOverride {
  return {
    ...override,
    events: [{ ts: nowIso(), actor, action, type }, ...override.events],
  };
}

function recalc(item: LiveDealOverride): LiveDealOverride {
  const blockers = new Set<string>();
  if (item.docsState !== 'complete') blockers.add('docs');
  if (item.disputeState === 'open') blockers.add('dispute');
  if (item.reserveState === 'pending_release') blockers.add('bank_confirm');

  let status: RuntimeDealStatus = item.status;
  let nextStep = 'Проверить контур сделки.';
  let nextOwner = 'Оператор';

  if (item.disputeState === 'open') {
    status = 'quality_disputed';
    nextStep = 'Закрыть спор и повторно пройти денежный шаг.';
    nextOwner = 'Арбитр';
  } else if (item.reserveState === 'released') {
    status = 'release_approved';
    nextStep = 'Деньги выпущены. Можно закрывать сделку.';
    nextOwner = 'Оператор';
  } else if (item.reserveState === 'pending_release') {
    status = 'release_requested';
    nextStep = 'Банк должен подтвердить выпуск денег.';
    nextOwner = 'Банк';
  } else if (item.docsState === 'complete') {
    status = 'docs_complete';
    nextStep = 'Запросить выпуск денег в банке.';
    nextOwner = 'Покупатель';
  } else if (item.docsState === 'collecting') {
    status = 'quality_check';
    nextStep = 'Дособрать документы и убрать blocker.';
    nextOwner = 'Продавец';
  }

  return {
    ...item,
    blockers: Array.from(blockers),
    status,
    nextStep,
    nextOwner,
  };
}

export const useLiveDealRuntimeStore = create<LiveDealRuntimeState>()(
  persist(
    (set, get) => ({
      overrides: {},
      ensureDeal: (dealId) => {
        const existing = get().overrides[dealId];
        if (existing) return existing;
        const created = baseOverride(dealId);
        if (!created) return null;
        set((state) => ({ overrides: { ...state.overrides, [dealId]: created } }));
        return created;
      },
      startDocs: (dealId) => set((state) => {
        const current = state.overrides[dealId] ?? baseOverride(dealId);
        if (!current) return state;
        const next = recalc(addEvent({ ...current, docsState: 'collecting' }, 'Оператор', 'Запущен сбор документов по сделке', 'info'));
        return { overrides: { ...state.overrides, [dealId]: next } };
      }),
      completeDocs: (dealId) => set((state) => {
        const current = state.overrides[dealId] ?? baseOverride(dealId);
        if (!current) return state;
        const next = recalc(addEvent({ ...current, docsState: 'complete' }, 'Продавец', 'Документы по сделке собраны', 'success'));
        return { overrides: { ...state.overrides, [dealId]: next } };
      }),
      requestRelease: (dealId) => set((state) => {
        const current = state.overrides[dealId] ?? baseOverride(dealId);
        if (!current) return state;
        const next = recalc(addEvent({ ...current, reserveState: 'pending_release' }, 'Покупатель', 'Запрошен выпуск денег по сделке', 'info'));
        return { overrides: { ...state.overrides, [dealId]: next } };
      }),
      releaseFunds: (dealId) => set((state) => {
        const current = state.overrides[dealId] ?? baseOverride(dealId);
        if (!current) return state;
        const next = recalc(addEvent({ ...current, reserveState: 'released', holdAmount: 0 }, 'Банк', 'Деньги по сделке выпущены', 'success'));
        return { overrides: { ...state.overrides, [dealId]: next } };
      }),
      openDispute: (dealId) => set((state) => {
        const current = state.overrides[dealId] ?? baseOverride(dealId);
        if (!current) return state;
        const next = recalc(addEvent({ ...current, disputeState: 'open', holdAmount: current.holdAmount || Math.round((current.releaseAmount ?? 0) * 0.15) }, 'Покупатель', 'Открыт спор по сделке', 'danger'));
        return { overrides: { ...state.overrides, [dealId]: next } };
      }),
      resolveDispute: (dealId) => set((state) => {
        const current = state.overrides[dealId] ?? baseOverride(dealId);
        if (!current) return state;
        const next = recalc(addEvent({ ...current, disputeState: 'resolved', holdAmount: 0 }, 'Арбитр', 'Спор по сделке закрыт', 'success'));
        return { overrides: { ...state.overrides, [dealId]: next } };
      }),
    }),
    {
      name: 'pc-live-deal-runtime-v1',
      partialize: (state) => ({ overrides: state.overrides }),
    }
  )
);
