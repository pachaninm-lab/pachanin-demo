'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface TripRuntime {
  id: string;
  dealId: string;
  status: 'in_transit' | 'arrived' | 'deviation';
  eta: string;
  kmLeft: number;
  arrivedAt: string | null;
  deviationText: string;
  offlineSaved: boolean;
}

export interface ReceptionRuntime {
  plate: string;
  dealId: string;
  status: 'waiting' | 'admitted' | 'completed';
  weight: string;
  start: string;
  end: string;
  sdiz: string;
  fgis: boolean;
}

export interface LabCaseRuntime {
  id: string;
  dealId: string;
  status: 'new' | 'in_progress' | 'completed';
  moisture: string;
  protein: string;
  gluten: string;
  result: 'pending' | 'pass' | 'review';
  protocolSigned: boolean;
}

interface FieldRuntimeState {
  trip: TripRuntime;
  receptions: ReceptionRuntime[];
  labCases: LabCaseRuntime[];
  confirmArrival: () => void;
  reportDeviation: (text: string) => void;
  admitReception: (plate: string) => void;
  updateReception: (plate: string, patch: Partial<ReceptionRuntime>) => void;
  confirmReception: (plate: string) => void;
  startLabCase: (id: string) => void;
  updateLabCase: (id: string, patch: Partial<LabCaseRuntime>) => void;
  completeLabCase: (id: string) => void;
}

const initialTrip: TripRuntime = {
  id: 'ТМБ-14',
  dealId: 'DL-9103',
  status: 'in_transit',
  eta: '14:30',
  kmLeft: 87,
  arrivedAt: null,
  deviationText: '',
  offlineSaved: false,
};

const initialReceptions: ReceptionRuntime[] = [
  { plate: 'А777ВВ136', dealId: 'DL-9103', status: 'waiting', weight: '150', start: '', end: '', sdiz: '', fgis: false },
  { plate: 'В123КК52', dealId: 'DL-9105', status: 'waiting', weight: '120', start: '', end: '', sdiz: '', fgis: false },
];

const initialLabCases: LabCaseRuntime[] = [
  { id: 'LAB-9102', dealId: 'DL-9102', status: 'new', moisture: '', protein: '', gluten: '', result: 'pending', protocolSigned: false },
  { id: 'LAB-9103', dealId: 'DL-9103', status: 'in_progress', moisture: '13.4', protein: '12.1', gluten: '23', result: 'review', protocolSigned: false },
];

export const useFieldRuntimeStore = create<FieldRuntimeState>()(
  persist(
    (set) => ({
      trip: initialTrip,
      receptions: initialReceptions,
      labCases: initialLabCases,
      confirmArrival: () => set((state) => ({ trip: { ...state.trip, status: 'arrived', kmLeft: 0, arrivedAt: '14:28', offlineSaved: true } })),
      reportDeviation: (text) => set((state) => ({ trip: { ...state.trip, status: 'deviation', deviationText: text, offlineSaved: true } })),
      admitReception: (plate) => set((state) => ({ receptions: state.receptions.map((item) => item.plate === plate ? { ...item, status: 'admitted' } : item) })),
      updateReception: (plate, patch) => set((state) => ({ receptions: state.receptions.map((item) => item.plate === plate ? { ...item, ...patch } : item) })),
      confirmReception: (plate) => set((state) => ({ receptions: state.receptions.map((item) => item.plate === plate ? { ...item, status: 'completed', fgis: true } : item) })),
      startLabCase: (id) => set((state) => ({ labCases: state.labCases.map((item) => item.id === id ? { ...item, status: 'in_progress' } : item) })),
      updateLabCase: (id, patch) => set((state) => ({ labCases: state.labCases.map((item) => item.id === id ? { ...item, ...patch } : item) })),
      completeLabCase: (id) => set((state) => ({ labCases: state.labCases.map((item) => item.id === id ? { ...item, status: 'completed', protocolSigned: true, result: Number(item.moisture || 0) <= 14 ? 'pass' : 'review' } : item) })),
    }),
    { name: 'pc-field-runtime-v1' }
  )
);
