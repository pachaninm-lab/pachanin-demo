'use client';
import { create } from 'zustand';

export type FieldEventType =
  | 'arrival'
  | 'unloading_start'
  | 'unloading_done'
  | 'unloading'
  | 'photo'
  | 'quality_check'
  | 'departure'
  | 'weighing'
  | 'lab_result';

export interface FieldEvent {
  id: string;           // UUID — idempotency key
  dealId: string;
  type: FieldEventType;
  timestamp: string;    // ISO 8601
  payload: Record<string, unknown>;
  synced: boolean;
}

interface OfflineQueueState {
  events: FieldEvent[];
  isOnline: boolean;

  enqueue: (event: Omit<FieldEvent, 'synced'>) => void;
  markSynced: (id: string) => void;
  setOnline: (v: boolean) => void;
  pendingCount: () => number;
}

export const useOfflineQueueStore = create<OfflineQueueState>((set, get) => ({
  events: [],
  isOnline: true,

  enqueue: (event) => set((s) => ({
    events: [...s.events, { ...event, synced: false }],
  })),

  markSynced: (id) => set((s) => ({
    events: s.events.map(e => e.id === id ? { ...e, synced: true } : e),
  })),

  setOnline: (isOnline) => set({ isOnline }),

  pendingCount: () => get().events.filter(e => !e.synced).length,
}));
