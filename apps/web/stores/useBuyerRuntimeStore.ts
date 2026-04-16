'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { RFQ_LIST, type RfqItem } from '@/lib/v7r/data';

export interface LocalRfqRequest {
  id: string;
  grain: string;
  volume: number;
  region: string;
  targetPrice: number;
  quality: string;
  payment: string;
  createdAt: string;
  source: 'LOCAL_RFQ';
}

export interface DraftDeal {
  id: string;
  sourceId: string;
  sourceType: 'RFQ_MARKET' | 'LOCAL_RFQ';
  grain: string;
  volume: number;
  region: string;
  price: number;
  quality: string;
  payment: string;
  sellerName: string;
  buyerName: string;
  status: 'draft' | 'approval_needed';
  docsState: 'missing' | 'collecting';
  reserveState: 'not_started' | 'pending';
  nextStep: string;
  createdAt: string;
}

interface BuyerRuntimeState {
  localRfqs: LocalRfqRequest[];
  shortlistedSourceIds: string[];
  draftDeals: DraftDeal[];
  addLocalRfq: (input: Omit<LocalRfqRequest, 'id' | 'createdAt' | 'source'>) => LocalRfqRequest;
  toggleShortlist: (sourceId: string) => void;
  createDraftDealFromMarket: (rfq: RfqItem) => DraftDeal;
  createDraftDealFromLocalRfq: (rfq: LocalRfqRequest) => DraftDeal;
  removeDraftDeal: (id: string) => void;
}

function nextNumericId(items: Array<{ id: string }>, prefix: string, seed: number) {
  const maxValue = items.reduce((maxItem, item) => {
    const numeric = Number(item.id.replace(/[^0-9]/g, ''));
    return Number.isFinite(numeric) ? Math.max(maxItem, numeric) : maxItem;
  }, seed);
  return `${prefix}${maxValue + 1}`;
}

function createDraftDealBase(input: {
  sourceId: string;
  sourceType: 'RFQ_MARKET' | 'LOCAL_RFQ';
  grain: string;
  volume: number;
  region: string;
  price: number;
  quality: string;
  payment: string;
  sellerName: string;
}): Omit<DraftDeal, 'id' | 'createdAt'> {
  return {
    sourceId: input.sourceId,
    sourceType: input.sourceType,
    grain: input.grain,
    volume: input.volume,
    region: input.region,
    price: input.price,
    quality: input.quality,
    payment: input.payment,
    sellerName: input.sellerName,
    buyerName: 'Текущий покупатель',
    status: 'draft',
    docsState: 'missing',
    reserveState: 'not_started',
    nextStep: 'Открыть draft-сделку, проверить контрагента и запустить резерв.',
  };
}

export const useBuyerRuntimeStore = create<BuyerRuntimeState>()(
  persist(
    (set, get) => ({
      localRfqs: [],
      shortlistedSourceIds: [],
      draftDeals: [],
      addLocalRfq: (input) => {
        const created: LocalRfqRequest = {
          id: nextNumericId(get().localRfqs, 'RFQ-LOCAL-', 5000),
          grain: input.grain,
          volume: input.volume,
          region: input.region,
          targetPrice: input.targetPrice,
          quality: input.quality,
          payment: input.payment,
          createdAt: new Date().toISOString(),
          source: 'LOCAL_RFQ',
        };
        set((state) => ({ localRfqs: [created, ...state.localRfqs] }));
        return created;
      },
      toggleShortlist: (sourceId) => {
        set((state) => ({
          shortlistedSourceIds: state.shortlistedSourceIds.includes(sourceId)
            ? state.shortlistedSourceIds.filter((id) => id !== sourceId)
            : [sourceId, ...state.shortlistedSourceIds],
        }));
      },
      createDraftDealFromMarket: (rfq) => {
        const created: DraftDeal = {
          id: nextNumericId(get().draftDeals, 'DRAFT-', 3000),
          createdAt: new Date().toISOString(),
          ...createDraftDealBase({
            sourceId: rfq.id,
            sourceType: 'RFQ_MARKET',
            grain: rfq.grain,
            volume: rfq.volume,
            region: rfq.region,
            price: rfq.price,
            quality: rfq.quality,
            payment: rfq.payment,
            sellerName: 'Контрагент из shortlist',
          }),
        };
        set((state) => ({ draftDeals: [created, ...state.draftDeals] }));
        return created;
      },
      createDraftDealFromLocalRfq: (rfq) => {
        const created: DraftDeal = {
          id: nextNumericId(get().draftDeals, 'DRAFT-', 3000),
          createdAt: new Date().toISOString(),
          ...createDraftDealBase({
            sourceId: rfq.id,
            sourceType: 'LOCAL_RFQ',
            grain: rfq.grain,
            volume: rfq.volume,
            region: rfq.region,
            price: rfq.targetPrice,
            quality: rfq.quality,
            payment: rfq.payment,
            sellerName: 'Контрагент не выбран',
          }),
        };
        set((state) => ({ draftDeals: [created, ...state.draftDeals] }));
        return created;
      },
      removeDraftDeal: (id) => set((state) => ({ draftDeals: state.draftDeals.filter((item) => item.id !== id) })),
    }),
    {
      name: 'pc-buyer-runtime-v1',
      partialize: (state) => ({
        localRfqs: state.localRfqs,
        shortlistedSourceIds: state.shortlistedSourceIds,
        draftDeals: state.draftDeals,
      }),
    }
  )
);

export function getMarketRfqById(id: string) {
  return RFQ_LIST.find((item) => item.id === id) ?? null;
}
