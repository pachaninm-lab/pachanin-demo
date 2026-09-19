'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LotItem, ReadinessState } from '@/lib/v7r/esia-fgis-data';

export interface ManualLotDraft {
  grain: string;
  volumeTons: number;
  region: string;
  docsReady: boolean;
}

interface CommercialRuntimeState {
  manualLots: LotItem[];
  addManualLot: (draft: ManualLotDraft) => LotItem;
  clearManualLots: () => void;
  favouriteLotIds: string[];
  toggleFavouriteLot: (lotId: string) => void;
  compareLotIds: string[];
  toggleCompareLot: (lotId: string) => { ok: boolean; reason?: 'limit' };
  clearCompareLots: () => void;
}

function createReadiness(draft: ManualLotDraft): LotItem['readiness'] {
  const state: ReadinessState = draft.docsReady ? 'PASS' : 'REVIEW';
  return {
    state,
    blockers: draft.docsReady
      ? []
      : [
          {
            id: `bl-docs-${Date.now()}`,
            title: 'Не хватает пакета документов',
            reasonCode: 'DOCS_MISSING',
            detail: 'Для полного движения лота не хватает акта приёмки и подтверждения допуска.',
            impact: 'Лот можно завести в контур, но выбор победителя и денежный шаг будут остановлены до дозагрузки пакета.',
          },
        ],
    nextStep: draft.docsReady ? 'Можно публиковать лот и открывать переговоры.' : 'Дозагрузить обязательный пакет документов продавца.',
    nextOwner: draft.docsReady ? 'Покупатель' : 'Продавец',
  };
}

function createManualLot(draft: ManualLotDraft, current: LotItem[]): LotItem {
  const maxNumericId = current.reduce((maxValue, item) => {
    const numeric = Number(item.id.replace(/[^0-9]/g, ''));
    return Number.isFinite(numeric) ? Math.max(maxValue, numeric) : maxValue;
  }, 2403);
  const nextId = `LOT-${maxNumericId + 1}`;
  return {
    id: nextId,
    title: `${draft.grain} / ${draft.region}`,
    grain: draft.grain,
    volumeTons: draft.volumeTons,
    sourceType: 'MANUAL',
    sourceReference: null,
    readiness: createReadiness(draft),
  };
}

export const useCommercialRuntimeStore = create<CommercialRuntimeState>()(
  persist(
    (set, get) => ({
      manualLots: [],
      addManualLot: (draft) => {
        const created = createManualLot(draft, get().manualLots);
        set((state) => ({ manualLots: [created, ...state.manualLots] }));
        return created;
      },
      clearManualLots: () => set({ manualLots: [] }),
      favouriteLotIds: [],
      toggleFavouriteLot: (lotId) => set((state) => {
        const exists = state.favouriteLotIds.includes(lotId);
        return { favouriteLotIds: exists ? state.favouriteLotIds.filter((id) => id !== lotId) : [...state.favouriteLotIds, lotId] };
      }),
      compareLotIds: [],
      toggleCompareLot: (lotId) => {
        const current = get().compareLotIds;
        if (current.includes(lotId)) {
          set({ compareLotIds: current.filter((id) => id !== lotId) });
          return { ok: true };
        }
        if (current.length >= 3) return { ok: false, reason: 'limit' as const };
        set({ compareLotIds: [...current, lotId] });
        return { ok: true };
      },
      clearCompareLots: () => set({ compareLotIds: [] }),
    }),
    {
      name: 'pc-commercial-runtime-v1',
      partialize: (state) => ({ manualLots: state.manualLots, favouriteLotIds: state.favouriteLotIds, compareLotIds: state.compareLotIds }),
    }
  )
);
