'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuditEvent, Counterparty, Deal, Dispute, Evidence, Lot, MoneyEvent, User } from '../types';
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
  lastAction?: { actionId: PlatformActionId; dealId: string; ok: boolean; message: string };
  resetDomainFixtures: () => void;
  runDealAction: (dealId: string, actionId: PlatformActionId, actorUserId: string, idempotencyKey?: string) => { ok: boolean; message: string };
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

        const result = runPlatformAction({ actionId, deal, actor, idempotencyKey });
        if (!result.ok || !result.after) {
          const message = result.disabledReason ?? result.toast.message;
          set({ lastAction: { actionId, dealId, ok: false, message } });
          return { ok: false, message };
        }

        set({
          deals: state.deals.map(item => (item.id === dealId ? result.after! : item)),
          auditEvents: result.auditEvent ? [result.auditEvent, ...state.auditEvents] : state.auditEvents,
          lastAction: { actionId, dealId, ok: true, message: result.toast.message },
        });

        return { ok: true, message: result.toast.message };
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
        lastAction: state.lastAction,
      }),
    }
  )
);
