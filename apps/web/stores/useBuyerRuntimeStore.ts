'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { selectRuntimeRfqById, type RuntimeRfqItem as RfqItem } from '@/lib/domain/selectors';

export type DraftDealStatus =
  | 'draft'
  | 'docs_in_progress'
  | 'reserve_pending'
  | 'reserve_approved'
  | 'dispute_open'
  | 'release_ready'
  | 'released';

export type DraftDocsState = 'missing' | 'collecting' | 'complete';
export type DraftReserveState = 'not_started' | 'pending' | 'approved';
export type DraftPaymentState = 'blocked' | 'ready_for_release' | 'released';
export type DraftDisputeState = 'none' | 'open' | 'resolved';

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

export interface DraftDealEvent {
  ts: string;
  actor: string;
  action: string;
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
  status: DraftDealStatus;
  docsState: DraftDocsState;
  reserveState: DraftReserveState;
  paymentState: DraftPaymentState;
  disputeState: DraftDisputeState;
  blockers: string[];
  nextStep: string;
  nextOwner: string;
  riskFlags: string[];
  evidenceUploaded: number;
  createdAt: string;
  events: DraftDealEvent[];
}

interface BuyerRuntimeState {
  localRfqs: LocalRfqRequest[];
  shortlistedSourceIds: string[];
  draftDeals: DraftDeal[];
  addLocalRfq: (input: Omit<LocalRfqRequest, 'id' | 'createdAt' | 'source'>) => LocalRfqRequest;
  toggleShortlist: (sourceId: string) => void;
  createDraftDealFromMarket: (rfq: RfqItem) => DraftDeal;
  createDraftDealFromLocalRfq: (rfq: LocalRfqRequest) => DraftDeal;
  markDraftDocsCollecting: (id: string) => void;
  markDraftDocsComplete: (id: string) => void;
  submitDraftReserve: (id: string) => void;
  approveDraftReserve: (id: string) => void;
  openDraftDispute: (id: string) => void;
  resolveDraftDispute: (id: string) => void;
  requestDraftRelease: (id: string) => void;
  releaseDraftFunds: (id: string) => void;
  removeDraftDeal: (id: string) => void;
}

function nextNumericId(items: Array<{ id: string }>, prefix: string, seed: number) {
  const maxValue = items.reduce((maxItem, item) => {
    const numeric = Number(item.id.replace(/[^0-9]/g, ''));
    return Number.isFinite(numeric) ? Math.max(maxItem, numeric) : maxItem;
  }, seed);
  return `${prefix}${maxValue + 1}`;
}

function nowIso() {
  return new Date().toISOString();
}

function recalcDraft(draft: DraftDeal): DraftDeal {
  const blockers: string[] = [];
  const riskFlags = [...draft.riskFlags];

  if (draft.docsState !== 'complete') blockers.push('docs');
  if (draft.reserveState !== 'approved') blockers.push('reserve');
  if (draft.disputeState === 'open') blockers.push('dispute');
  if (draft.sourceType === 'LOCAL_RFQ' && !riskFlags.includes('counterparty_unselected')) {
    riskFlags.push('counterparty_unselected');
  }

  let status: DraftDealStatus = 'draft';
  let nextStep = 'Начать сбор документов по сделке.';
  let nextOwner = 'Покупатель';
  let paymentState = draft.paymentState;

  if (draft.paymentState === 'released') {
    status = 'released';
    nextStep = 'Деньги выпущены. Можно архивировать draft или переводить его в боевой контур.';
    nextOwner = 'Оператор';
  } else if (draft.disputeState === 'open') {
    status = 'dispute_open';
    nextStep = 'Закрыть спор и заново пройти денежный шаг.';
    nextOwner = 'Арбитр';
    paymentState = 'blocked';
  } else if (draft.reserveState === 'approved' && draft.docsState === 'complete' && draft.paymentState === 'ready_for_release') {
    status = 'release_ready';
    nextStep = 'Банк может выпускать деньги по сделке.';
    nextOwner = 'Банк';
  } else if (draft.reserveState === 'approved') {
    status = 'reserve_approved';
    nextStep = draft.docsState === 'complete' ? 'Запросить выпуск денег.' : 'Закрыть документные блокеры до выпуска денег.';
    nextOwner = draft.docsState === 'complete' ? 'Покупатель' : 'Продавец';
    paymentState = draft.docsState === 'complete' ? draft.paymentState : 'blocked';
  } else if (draft.reserveState === 'pending') {
    status = 'reserve_pending';
    nextStep = 'Банк должен проверить и подтвердить резерв.';
    nextOwner = 'Банк';
    paymentState = 'blocked';
  } else if (draft.docsState === 'collecting' || draft.docsState === 'complete') {
    status = 'docs_in_progress';
    nextStep = draft.docsState === 'complete' ? 'Запустить банковый резерв.' : 'Собрать обязательный пакет документов.';
    nextOwner = draft.docsState === 'complete' ? 'Покупатель' : 'Продавец';
    paymentState = 'blocked';
  }

  return {
    ...draft,
    status,
    paymentState,
    blockers,
    nextStep,
    nextOwner,
    riskFlags,
  };
}

function addEvent(draft: DraftDeal, actor: string, action: string) {
  return {
    ...draft,
    events: [{ ts: nowIso(), actor, action }, ...draft.events],
  };
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
    paymentState: 'blocked',
    disputeState: 'none',
    blockers: ['docs', 'reserve'],
    nextStep: 'Начать сбор документов по сделке.',
    nextOwner: 'Покупатель',
    riskFlags: input.sourceType === 'LOCAL_RFQ' ? ['counterparty_unselected'] : [],
    evidenceUploaded: 0,
    events: [{ ts: nowIso(), actor: 'Система', action: 'Draft-сделка создана' }],
  };
}

function evolveDraft(
  items: DraftDeal[],
  id: string,
  mutate: (draft: DraftDeal) => DraftDeal
) {
  return items.map((item) => (item.id === id ? recalcDraft(mutate(item)) : item));
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
          createdAt: nowIso(),
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
        const created = recalcDraft({
          id: nextNumericId(get().draftDeals, 'DRAFT-', 3000),
          createdAt: nowIso(),
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
        });
        set((state) => ({ draftDeals: [created, ...state.draftDeals] }));
        return created;
      },
      createDraftDealFromLocalRfq: (rfq) => {
        const created = recalcDraft({
          id: nextNumericId(get().draftDeals, 'DRAFT-', 3000),
          createdAt: nowIso(),
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
        });
        set((state) => ({ draftDeals: [created, ...state.draftDeals] }));
        return created;
      },
      markDraftDocsCollecting: (id) => set((state) => ({
        draftDeals: evolveDraft(state.draftDeals, id, (draft) => addEvent({ ...draft, docsState: 'collecting' }, 'Покупатель', 'Запущен сбор документов')),
      })),
      markDraftDocsComplete: (id) => set((state) => ({
        draftDeals: evolveDraft(state.draftDeals, id, (draft) => addEvent({ ...draft, docsState: 'complete', evidenceUploaded: Math.max(draft.evidenceUploaded, 3) }, 'Продавец', 'Пакет документов собран')),
      })),
      submitDraftReserve: (id) => set((state) => ({
        draftDeals: evolveDraft(state.draftDeals, id, (draft) => addEvent({ ...draft, reserveState: 'pending' }, 'Покупатель', 'Запрос на резерв отправлен в банк')),
      })),
      approveDraftReserve: (id) => set((state) => ({
        draftDeals: evolveDraft(state.draftDeals, id, (draft) => addEvent({ ...draft, reserveState: 'approved' }, 'Банк', 'Резерв подтверждён')),
      })),
      openDraftDispute: (id) => set((state) => ({
        draftDeals: evolveDraft(state.draftDeals, id, (draft) => addEvent({ ...draft, disputeState: 'open', paymentState: 'blocked' }, 'Покупатель', 'Открыт спор по draft-сделке')),
      })),
      resolveDraftDispute: (id) => set((state) => ({
        draftDeals: evolveDraft(state.draftDeals, id, (draft) => addEvent({ ...draft, disputeState: 'resolved' }, 'Арбитр', 'Спор закрыт')),
      })),
      requestDraftRelease: (id) => set((state) => ({
        draftDeals: evolveDraft(state.draftDeals, id, (draft) => addEvent({ ...draft, paymentState: 'ready_for_release' }, 'Покупатель', 'Запрошен выпуск денег')),
      })),
      releaseDraftFunds: (id) => set((state) => ({
        draftDeals: evolveDraft(state.draftDeals, id, (draft) => addEvent({ ...draft, paymentState: 'released' }, 'Банк', 'Деньги выпущены')),
      })),
      removeDraftDeal: (id) => set((state) => ({ draftDeals: state.draftDeals.filter((item) => item.id !== id) })),
    }),
    {
      name: 'pc-buyer-runtime-v2',
      partialize: (state) => ({
        localRfqs: state.localRfqs,
        shortlistedSourceIds: state.shortlistedSourceIds,
        draftDeals: state.draftDeals,
      }),
    }
  )
);

export function getMarketRfqById(id: string) {
  return selectRuntimeRfqById(id) ?? null;
}
