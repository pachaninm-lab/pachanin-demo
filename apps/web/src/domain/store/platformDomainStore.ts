'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuditEvent, Counterparty, Deal, DealTimelineEvent, Dispute, Evidence, Lot, MoneyEvent, User } from '../types';
import { auditEventsFixture, counterpartiesFixture, dealsFixture, disputesFixture, evidenceFixture, lotsFixture, moneyEventsFixture, usersFixture } from '../fixtures';
import { runPlatformAction, type PlatformActionId } from '../actions/actionEngine';

interface PlatformDomainState {
  deals: Deal[];
  lots: Lot[];
  disputes: Dispute[];
  counterparties: Counterparty[];
  moneyEvents: MoneyEvent[];
  evidence: Evidence[];
  users: User[];
  auditEvents: AuditEvent[];
  dealTimeline: DealTimelineEvent[];
  idempotencyKeys: string[];
  lastAction?: { actionId: PlatformActionId; dealId: string; ok: boolean; message: string; idempotentReplay?: boolean };
  resetDomainFixtures: () => void;
  runDealAction: (dealId: string, actionId: PlatformActionId, actorUserId: string, idempotencyKey?: string) => { ok: boolean; message: string; idempotentReplay?: boolean };
}

const initialDomain = {
  deals: dealsFixture,
  lots: lotsFixture,
  disputes: disputesFixture,
  counterparties: counterpartiesFixture,
  moneyEvents: moneyEventsFixture,
  evidence: evidenceFixture,
  users: usersFixture,
  auditEvents: auditEventsFixture,
  dealTimeline: auditEventsFixture.slice(0, 20).map((event, index): DealTimelineEvent => ({
    id: `TL-FIXTURE-${index + 1}`,
    dealId: event.objectId,
    actorUserId: event.actorUserId,
    action: event.action,
    statusBefore: 'draft',
    statusAfter: dealsFixture[index % dealsFixture.length].status,
    message: `Sandbox event: ${event.action}`,
    mode: 'sandbox',
    idempotencyKey: event.idempotencyKey,
    createdAt: event.createdAt,
  })),
  idempotencyKeys: auditEventsFixture.map(event => event.idempotencyKey).filter(Boolean) as string[],
};

export const usePlatformDomainStore = create<PlatformDomainState>()(
  persist(
    (set, get) => ({
      ...initialDomain,
      resetDomainFixtures: () => set({ ...initialDomain, lastAction: undefined }),
      runDealAction: (dealId, actionId, actorUserId, idempotencyKey) => {
        const state = get();
        const deal = state.deals.find(item => item.id === dealId);
        const actor = state.users.find(item => item.id === actorUserId);

        if (!deal || !actor) {
          const message = 'Сделка или пользователь не найдены в sandbox fixtures.';
          set({ lastAction: { actionId, dealId, ok: false, message } });
          return { ok: false, message };
        }

        const result = runPlatformAction({ actionId, deal, actor, idempotencyKey, usedIdempotencyKeys: state.idempotencyKeys });
        if (!result.ok || !result.after) {
          const message = result.disabledReason ?? result.toast.message;
          set({ lastAction: { actionId, dealId, ok: false, message } });
          return { ok: false, message };
        }

        const nextIdempotencyKeys = idempotencyKey && !state.idempotencyKeys.includes(idempotencyKey)
          ? [idempotencyKey, ...state.idempotencyKeys]
          : state.idempotencyKeys;

        set({
          deals: result.idempotentReplay ? state.deals : state.deals.map(item => (item.id === dealId ? result.after! : item)),
          auditEvents: result.auditEvent ? [result.auditEvent, ...state.auditEvents] : state.auditEvents,
          dealTimeline: result.timelineEvent ? [result.timelineEvent, ...state.dealTimeline] : state.dealTimeline,
          idempotencyKeys: nextIdempotencyKeys,
          lastAction: { actionId, dealId, ok: true, message: result.toast.message, idempotentReplay: result.idempotentReplay },
        });

        return { ok: true, message: result.toast.message, idempotentReplay: result.idempotentReplay };
      },
    }),
    {
      name: 'pc-domain-v1',
      partialize: state => ({
        deals: state.deals,
        lots: state.lots,
        disputes: state.disputes,
        counterparties: state.counterparties,
        moneyEvents: state.moneyEvents,
        evidence: state.evidence,
        users: state.users,
        auditEvents: state.auditEvents,
        dealTimeline: state.dealTimeline,
        idempotencyKeys: state.idempotencyKeys,
        lastAction: state.lastAction,
      }),
    }
  )
);
