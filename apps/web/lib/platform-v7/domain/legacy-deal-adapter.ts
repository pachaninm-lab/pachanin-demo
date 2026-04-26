import { toCanonicalDealStatus } from './status-mapper';
import type { CanonicalDeal, CounterpartyRef, DocumentRef, DriverRef, ElevatorRef } from './types';

type LegacyUserRef = {
  id: string;
  name: string;
  role: string;
  vehicle?: string;
};

type LegacyElevatorRef = {
  id: string;
  name: string;
  region: string;
};

type LegacyDocument = {
  id: string;
  name: string;
  status: string;
  uploadedAt: string | null;
  size: string | null;
  owner: string;
};

type LegacyTimelineEvent = {
  status: string;
  at: string;
  actor: string;
};

export type LegacyDealFixture = {
  id: string;
  status: string;
  phase?: string;
  grain: string;
  quantity: number;
  unit: 'т' | 'кг';
  pricePerUnit: number;
  totalAmount: number;
  reservedAmount: number;
  holdAmount: number;
  releaseAmount: number;
  seller: LegacyUserRef;
  buyer: LegacyUserRef;
  driver: LegacyUserRef | null;
  elevator: LegacyElevatorRef | null;
  createdAt: string;
  updatedAt: string;
  slaDeadline: string | null;
  dispute: { id: string; title: string } | null;
  riskScore: number;
  blockers: string[];
  timeline: LegacyTimelineEvent[];
  documents: LegacyDocument[];
};

function normalizeCounterparty(ref: LegacyUserRef): CounterpartyRef {
  return {
    id: ref.id,
    name: ref.name,
    role: ref.role as CounterpartyRef['role'],
  };
}

function normalizeDriver(ref: LegacyUserRef | null): DriverRef | null {
  if (!ref) return null;

  return {
    id: ref.id,
    name: ref.name,
    vehicle: ref.vehicle,
  };
}

function normalizeElevator(ref: LegacyElevatorRef | null): ElevatorRef | null {
  if (!ref) return null;

  return {
    id: ref.id,
    name: ref.name,
    region: ref.region,
  };
}

function normalizeDocument(document: LegacyDocument): DocumentRef {
  return {
    id: document.id,
    name: document.name,
    status: document.status as DocumentRef['status'],
    uploadedAt: document.uploadedAt,
    size: document.size,
    owner: document.owner,
    required: document.status === 'missing' || document.status === 'pending_signature',
    blocksMoneyRelease: document.status === 'missing' || document.status === 'pending_signature',
  };
}

export function normalizeLegacyDeal(deal: LegacyDealFixture): CanonicalDeal {
  const canonicalStatus = toCanonicalDealStatus(deal.status);

  return {
    id: deal.id,
    status: canonicalStatus,
    legacyStatus: deal.status,
    phase: deal.phase,
    grain: deal.grain,
    quantity: deal.quantity,
    unit: deal.unit,
    pricePerUnit: deal.pricePerUnit,
    money: {
      totalAmount: deal.totalAmount,
      reservedAmount: deal.reservedAmount,
      holdAmount: deal.holdAmount,
      releaseAmount: deal.releaseAmount,
    },
    seller: normalizeCounterparty(deal.seller),
    buyer: normalizeCounterparty(deal.buyer),
    driver: normalizeDriver(deal.driver),
    elevator: normalizeElevator(deal.elevator),
    createdAt: deal.createdAt,
    updatedAt: deal.updatedAt,
    slaDeadline: deal.slaDeadline,
    dispute: deal.dispute,
    riskScore: deal.riskScore,
    blockers: deal.blockers,
    timeline: deal.timeline.map((event) => ({
      ...event,
      canonicalStatus: toCanonicalDealStatus(event.status),
    })),
    documents: deal.documents.map(normalizeDocument),
    maturity: 'sandbox',
  };
}

export function normalizeLegacyDeals(deals: readonly LegacyDealFixture[]): CanonicalDeal[] {
  return deals.map(normalizeLegacyDeal);
}
