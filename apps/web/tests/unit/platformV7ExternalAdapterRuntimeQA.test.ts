/**
 * PR 6.6 — External Adapter Runtime QA
 *
 * Cross-emulator integration tests for all four pre-integration adapter emulators:
 * bank, FGIS, EDO, EPD/logistics.
 *
 * Maturity: pre-integration. No live external system connectivity.
 * No network calls. Deterministic, DI-friendly.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  BankAdapterEmulator,
  createBankAdapterEmulator,
  type BankAdapterEmulatorEvent,
} from '../../lib/platform-v7/bank-adapter-emulator';

import {
  FgisAdapterEmulator,
  createFgisAdapterEmulator,
  type FgisAdapterEmulatorEvent,
} from '../../lib/platform-v7/fgis-adapter-emulator';

import {
  EdoAdapterEmulator,
  createEdoAdapterEmulator,
  type EdoAdapterEmulatorEvent,
} from '../../lib/platform-v7/edo-adapter-emulator';

import {
  EpdAdapterEmulator,
  createEpdAdapterEmulator,
  type EpdAdapterEmulatorEvent,
} from '../../lib/platform-v7/epd-adapter-emulator';

// ── Shared fixtures ───────────────────────────────────────────────────────────

const FIXED_NOW = '2024-01-15T10:00:00.000Z';
const DEAL_ID = 'deal-qa-001';
const CID = 'corr-qa-001';

// ── 1. Emulator instantiation and reset ──────────────────────────────────────

describe('PR 6.6 — external adapter runtime QA: instantiation', () => {
  it('bank emulator instantiates via class', () => {
    const emulator = new BankAdapterEmulator();
    expect(emulator).toBeDefined();
  });

  it('bank emulator instantiates via factory', () => {
    const emulator = createBankAdapterEmulator();
    expect(emulator).toBeDefined();
  });

  it('fgis emulator instantiates via class', () => {
    const emulator = new FgisAdapterEmulator();
    expect(emulator).toBeDefined();
  });

  it('fgis emulator instantiates via factory', () => {
    const emulator = createFgisAdapterEmulator();
    expect(emulator).toBeDefined();
  });

  it('edo emulator instantiates via class', () => {
    const emulator = new EdoAdapterEmulator();
    expect(emulator).toBeDefined();
  });

  it('edo emulator instantiates via factory', () => {
    const emulator = createEdoAdapterEmulator();
    expect(emulator).toBeDefined();
  });

  it('epd emulator instantiates via class', () => {
    const emulator = new EpdAdapterEmulator();
    expect(emulator).toBeDefined();
  });

  it('epd emulator instantiates via factory', () => {
    const emulator = createEpdAdapterEmulator();
    expect(emulator).toBeDefined();
  });

  it('all emulators reset cleanly', () => {
    const bank = new BankAdapterEmulator({ fixedNow: FIXED_NOW });
    const fgis = new FgisAdapterEmulator({ fixedNow: FIXED_NOW });
    const edo = new EdoAdapterEmulator({ fixedNow: FIXED_NOW });
    const epd = new EpdAdapterEmulator({ fixedNow: FIXED_NOW });

    bank.emit('reserve_requested', CID, { dealId: DEAL_ID });
    fgis.emit('party_link_requested', CID, { dealId: DEAL_ID });
    edo.emit('document_draft_created', CID, { dealId: DEAL_ID });
    epd.emit('epd_draft_created', CID, { dealId: DEAL_ID });

    bank.reset();
    fgis.reset();
    edo.reset();
    epd.reset();

    expect(bank.getLedger()).toHaveLength(0);
    expect(fgis.getLedger()).toHaveLength(0);
    expect(edo.getLedger()).toHaveLength(0);
    expect(epd.getLedger()).toHaveLength(0);
  });
});

// ── 2. Event envelope validation ─────────────────────────────────────────────

describe('PR 6.6 — event envelope fields', () => {
  it('bank emulator emits correct envelope', () => {
    const emulator = new BankAdapterEmulator({ fixedNow: FIXED_NOW });
    const event = emulator.emit('reserve_requested', CID, { dealId: DEAL_ID });

    expect(event.source).toBe('bank_emulator');
    expect(event.maturity).toBe('pre-integration');
    expect(event.correlationId).toBe(CID);
    expect(event.receivedAt).toBe(FIXED_NOW);
    expect(event.externalStatus).toBe('reserve_requested');
    expect(event.payload.dealId).toBe(DEAL_ID);
  });

  it('fgis emulator emits correct envelope', () => {
    const emulator = new FgisAdapterEmulator({ fixedNow: FIXED_NOW });
    const event = emulator.emit('party_link_requested', CID, { dealId: DEAL_ID });

    expect(event.source).toBe('fgis_emulator');
    expect(event.maturity).toBe('pre-integration');
    expect(event.correlationId).toBe(CID);
    expect(event.receivedAt).toBe(FIXED_NOW);
    expect(event.externalStatus).toBe('party_link_requested');
    expect(event.payload.dealId).toBe(DEAL_ID);
  });

  it('edo emulator emits correct envelope', () => {
    const emulator = new EdoAdapterEmulator({ fixedNow: FIXED_NOW });
    const event = emulator.emit('document_draft_created', CID, { dealId: DEAL_ID });

    expect(event.source).toBe('edo_emulator');
    expect(event.maturity).toBe('pre-integration');
    expect(event.correlationId).toBe(CID);
    expect(event.receivedAt).toBe(FIXED_NOW);
    expect(event.externalStatus).toBe('document_draft_created');
    expect(event.payload.dealId).toBe(DEAL_ID);
  });

  it('epd emulator emits correct envelope', () => {
    const emulator = new EpdAdapterEmulator({ fixedNow: FIXED_NOW });
    const event = emulator.emit('epd_draft_created', CID, { dealId: DEAL_ID });

    expect(event.source).toBe('epd_emulator');
    expect(event.maturity).toBe('pre-integration');
    expect(event.correlationId).toBe(CID);
    expect(event.receivedAt).toBe(FIXED_NOW);
    expect(event.externalStatus).toBe('epd_draft_created');
    expect(event.payload.dealId).toBe(DEAL_ID);
  });
});

// ── 3. Maturity: always pre-integration ──────────────────────────────────────

describe('PR 6.6 — maturity is always pre-integration', () => {
  const FIXED = '2024-01-15T10:00:00.000Z';

  it('bank emulator never claims live connectivity', () => {
    const bank = new BankAdapterEmulator({ fixedNow: FIXED });
    bank.emit('reserve_requested', 'c1', { dealId: 'd1' });
    for (const ev of bank.getLedger()) {
      expect(ev.maturity).toBe('pre-integration');
    }
  });

  it('fgis emulator never claims live connectivity', () => {
    const fgis = new FgisAdapterEmulator({ fixedNow: FIXED });
    fgis.emit('party_link_requested', 'c1', { dealId: 'd1' });
    for (const ev of fgis.getLedger()) {
      expect(ev.maturity).toBe('pre-integration');
    }
  });

  it('edo emulator never claims live connectivity', () => {
    const edo = new EdoAdapterEmulator({ fixedNow: FIXED });
    edo.emit('document_draft_created', 'c1', { dealId: 'd1' });
    for (const ev of edo.getLedger()) {
      expect(ev.maturity).toBe('pre-integration');
    }
  });

  it('epd emulator never claims live connectivity', () => {
    const epd = new EpdAdapterEmulator({ fixedNow: FIXED });
    epd.emit('epd_draft_created', 'c1', { dealId: 'd1' });
    for (const ev of epd.getLedger()) {
      expect(ev.maturity).toBe('pre-integration');
    }
  });
});

// ── 4. Idempotency across all emulators ──────────────────────────────────────

describe('PR 6.6 — idempotency', () => {
  it('bank: same (eventType, correlationId) returns identical event', () => {
    const emulator = new BankAdapterEmulator({ fixedNow: FIXED_NOW });
    const a = emulator.emit('reserve_requested', CID, { dealId: DEAL_ID, amount: 1000 });
    const b = emulator.emit('reserve_requested', CID, { dealId: DEAL_ID, amount: 9999 });
    expect(a).toBe(b);
    expect(emulator.getLedger()).toHaveLength(1);
  });

  it('fgis: same (eventType, correlationId) returns identical event', () => {
    const emulator = new FgisAdapterEmulator({ fixedNow: FIXED_NOW });
    const a = emulator.emit('party_link_requested', CID, { dealId: DEAL_ID });
    const b = emulator.emit('party_link_requested', CID, { dealId: 'other' });
    expect(a).toBe(b);
    expect(emulator.getLedger()).toHaveLength(1);
  });

  it('edo: same (eventType, correlationId) returns identical event', () => {
    const emulator = new EdoAdapterEmulator({ fixedNow: FIXED_NOW });
    const a = emulator.emit('document_draft_created', CID, { dealId: DEAL_ID });
    const b = emulator.emit('document_draft_created', CID, { dealId: 'other' });
    expect(a).toBe(b);
    expect(emulator.getLedger()).toHaveLength(1);
  });

  it('epd: same (eventType, correlationId) returns identical event', () => {
    const emulator = new EpdAdapterEmulator({ fixedNow: FIXED_NOW });
    const a = emulator.emit('epd_draft_created', CID, { dealId: DEAL_ID });
    const b = emulator.emit('epd_draft_created', CID, { dealId: 'other' });
    expect(a).toBe(b);
    expect(emulator.getLedger()).toHaveLength(1);
  });
});

// ── 5. Failure injection across all emulators ────────────────────────────────

describe('PR 6.6 — failure injection', () => {
  it('bank: manualReview override', () => {
    const emulator = new BankAdapterEmulator({
      fixedNow: FIXED_NOW,
      manualReviewCorrelationIds: ['mr-1'],
    });
    const event = emulator.emit('reserve_requested', 'mr-1', { dealId: DEAL_ID });
    expect(event.externalStatus).toBe('manual_review');
  });

  it('bank: timeout override', () => {
    const emulator = new BankAdapterEmulator({
      fixedNow: FIXED_NOW,
      timeoutCorrelationIds: ['t-1'],
    });
    const event = emulator.emit('reserve_requested', 't-1', { dealId: DEAL_ID });
    expect(event.externalStatus).toBe('timeout');
  });

  it('bank: rejected override', () => {
    const emulator = new BankAdapterEmulator({
      fixedNow: FIXED_NOW,
      rejectedCorrelationIds: ['r-1'],
    });
    const event = emulator.emit('reserve_requested', 'r-1', { dealId: DEAL_ID });
    expect(event.externalStatus).toBe('rejected');
  });

  it('bank: conflict override', () => {
    const emulator = new BankAdapterEmulator({
      fixedNow: FIXED_NOW,
      conflictCorrelationIds: ['con-1'],
    });
    const event = emulator.emit('reserve_requested', 'con-1', { dealId: DEAL_ID });
    expect(event.externalStatus).toBe('conflict');
  });

  it('fgis: manualReview override', () => {
    const emulator = new FgisAdapterEmulator({
      fixedNow: FIXED_NOW,
      manualReviewCorrelationIds: ['mr-f1'],
    });
    const event = emulator.emit('party_link_requested', 'mr-f1', { dealId: DEAL_ID });
    expect(event.externalStatus).toBe('manual_review');
  });

  it('fgis: timeout override', () => {
    const emulator = new FgisAdapterEmulator({
      fixedNow: FIXED_NOW,
      timeoutCorrelationIds: ['t-f1'],
    });
    const event = emulator.emit('party_link_requested', 't-f1', { dealId: DEAL_ID });
    expect(event.externalStatus).toBe('timeout');
  });

  it('fgis: rejected override', () => {
    const emulator = new FgisAdapterEmulator({
      fixedNow: FIXED_NOW,
      rejectedCorrelationIds: ['r-f1'],
    });
    const event = emulator.emit('party_link_requested', 'r-f1', { dealId: DEAL_ID });
    expect(event.externalStatus).toBe('rejected');
  });

  it('fgis: conflict override', () => {
    const emulator = new FgisAdapterEmulator({
      fixedNow: FIXED_NOW,
      conflictCorrelationIds: ['c-f1'],
    });
    const event = emulator.emit('party_link_requested', 'c-f1', { dealId: DEAL_ID });
    expect(event.externalStatus).toBe('conflict');
  });

  it('edo: manualReview override', () => {
    const emulator = new EdoAdapterEmulator({
      fixedNow: FIXED_NOW,
      manualReviewCorrelationIds: ['mr-e1'],
    });
    const event = emulator.emit('document_draft_created', 'mr-e1', { dealId: DEAL_ID });
    expect(event.externalStatus).toBe('manual_review');
  });

  it('edo: timeout override', () => {
    const emulator = new EdoAdapterEmulator({
      fixedNow: FIXED_NOW,
      timeoutCorrelationIds: ['t-e1'],
    });
    const event = emulator.emit('document_draft_created', 't-e1', { dealId: DEAL_ID });
    expect(event.externalStatus).toBe('timeout');
  });

  it('edo: rejected override', () => {
    const emulator = new EdoAdapterEmulator({
      fixedNow: FIXED_NOW,
      rejectedCorrelationIds: ['r-e1'],
    });
    const event = emulator.emit('document_draft_created', 'r-e1', { dealId: DEAL_ID });
    expect(event.externalStatus).toBe('rejected');
  });

  it('edo: conflict override', () => {
    const emulator = new EdoAdapterEmulator({
      fixedNow: FIXED_NOW,
      conflictCorrelationIds: ['c-e1'],
    });
    const event = emulator.emit('document_draft_created', 'c-e1', { dealId: DEAL_ID });
    expect(event.externalStatus).toBe('conflict');
  });

  it('epd: manualReview override', () => {
    const emulator = new EpdAdapterEmulator({
      fixedNow: FIXED_NOW,
      manualReviewCorrelationIds: ['mr-p1'],
    });
    const event = emulator.emit('epd_draft_created', 'mr-p1', { dealId: DEAL_ID });
    expect(event.externalStatus).toBe('manual_review');
  });

  it('epd: timeout override', () => {
    const emulator = new EpdAdapterEmulator({
      fixedNow: FIXED_NOW,
      timeoutCorrelationIds: ['t-p1'],
    });
    const event = emulator.emit('epd_draft_created', 't-p1', { dealId: DEAL_ID });
    expect(event.externalStatus).toBe('timeout');
  });

  it('epd: rejected override', () => {
    const emulator = new EpdAdapterEmulator({
      fixedNow: FIXED_NOW,
      rejectedCorrelationIds: ['r-p1'],
    });
    const event = emulator.emit('epd_draft_created', 'r-p1', { dealId: DEAL_ID });
    expect(event.externalStatus).toBe('rejected');
  });

  it('epd: conflict override', () => {
    const emulator = new EpdAdapterEmulator({
      fixedNow: FIXED_NOW,
      conflictCorrelationIds: ['c-p1'],
    });
    const event = emulator.emit('epd_draft_created', 'c-p1', { dealId: DEAL_ID });
    expect(event.externalStatus).toBe('conflict');
  });
});

// ── 6. State machine lifecycles ───────────────────────────────────────────────

describe('PR 6.6 — state machine lifecycles', () => {
  it('bank: reserve_confirmed requires prior reserve_requested', () => {
    const emulator = new BankAdapterEmulator({ fixedNow: FIXED_NOW });
    const event = emulator.emit('reserve_confirmed', 'no-prior', { dealId: DEAL_ID });
    expect(event.externalStatus).toBe('invalid_payload');
  });

  it('bank: reserve_confirmed succeeds after reserve_requested', () => {
    const emulator = new BankAdapterEmulator({ fixedNow: FIXED_NOW });
    emulator.emit('reserve_requested', 'b-chain', { dealId: DEAL_ID });
    const confirmed = emulator.emit('reserve_confirmed', 'b-chain', { dealId: DEAL_ID });
    expect(confirmed.externalStatus).toBe('reserve_confirmed');
  });

  it('bank: release_confirmed requires prior release_requested', () => {
    const emulator = new BankAdapterEmulator({ fixedNow: FIXED_NOW });
    const event = emulator.emit('release_confirmed', 'no-prior', { dealId: DEAL_ID });
    expect(event.externalStatus).toBe('invalid_payload');
  });

  it('fgis: party_linked requires prior party_link_requested', () => {
    const emulator = new FgisAdapterEmulator({ fixedNow: FIXED_NOW });
    const event = emulator.emit('party_linked', 'no-prior', { dealId: DEAL_ID });
    expect(event.externalStatus).toBe('invalid_payload');
  });

  it('fgis: sdiz_signed chain: draft → ready_to_sign → signed', () => {
    const emulator = new FgisAdapterEmulator({ fixedNow: FIXED_NOW });
    const cid = 'f-chain';
    emulator.emit('sdiz_draft_created', cid, { dealId: DEAL_ID });
    emulator.emit('sdiz_ready_to_sign', cid, { dealId: DEAL_ID });
    const signed = emulator.emit('sdiz_signed', cid, { dealId: DEAL_ID });
    expect(signed.externalStatus).toBe('sdiz_signed');
  });

  it('fgis: sdiz_signed without sdiz_ready_to_sign → invalid_payload', () => {
    const emulator = new FgisAdapterEmulator({ fixedNow: FIXED_NOW });
    const cid = 'f-no-ready';
    emulator.emit('sdiz_draft_created', cid, { dealId: DEAL_ID });
    const event = emulator.emit('sdiz_signed', cid, { dealId: DEAL_ID });
    expect(event.externalStatus).toBe('invalid_payload');
  });

  it('edo: document_sent requires prior document_draft_created', () => {
    const emulator = new EdoAdapterEmulator({ fixedNow: FIXED_NOW });
    const event = emulator.emit('document_sent', 'no-prior', { dealId: DEAL_ID });
    expect(event.externalStatus).toBe('invalid_payload');
  });

  it('edo: full signing chain: draft → sent → signed_by_one → signed_by_all', () => {
    const emulator = new EdoAdapterEmulator({ fixedNow: FIXED_NOW });
    const cid = 'e-chain';
    emulator.emit('document_draft_created', cid, { dealId: DEAL_ID });
    emulator.emit('document_sent', cid, { dealId: DEAL_ID });
    emulator.emit('document_signed_by_one_side', cid, { dealId: DEAL_ID });
    const all = emulator.emit('document_signed_by_all_sides', cid, { dealId: DEAL_ID });
    expect(all.externalStatus).toBe('document_signed_by_all_sides');
  });

  it('epd: epd_sent requires prior epd_draft_created', () => {
    const emulator = new EpdAdapterEmulator({ fixedNow: FIXED_NOW });
    const event = emulator.emit('epd_sent', 'no-prior', { dealId: DEAL_ID });
    expect(event.externalStatus).toBe('invalid_payload');
  });

  it('epd: epd_confirmed requires prior epd_sent', () => {
    const emulator = new EpdAdapterEmulator({ fixedNow: FIXED_NOW });
    emulator.emit('epd_draft_created', 'p-chain', { dealId: DEAL_ID });
    const event = emulator.emit('epd_confirmed', 'p-chain', { dealId: DEAL_ID });
    expect(event.externalStatus).toBe('invalid_payload');
  });

  it('epd: arrival_confirmed requires prior trip_event_received', () => {
    const emulator = new EpdAdapterEmulator({ fixedNow: FIXED_NOW });
    const event = emulator.emit('arrival_confirmed', 'no-trip', { dealId: DEAL_ID });
    expect(event.externalStatus).toBe('invalid_payload');
  });

  it('epd: arrival_confirmed succeeds after trip_event_received', () => {
    const emulator = new EpdAdapterEmulator({ fixedNow: FIXED_NOW });
    emulator.emit('trip_event_received', 'trip-chain', { dealId: DEAL_ID });
    const arrival = emulator.emit('arrival_confirmed', 'trip-chain', { dealId: DEAL_ID });
    expect(arrival.externalStatus).toBe('arrival_confirmed');
  });
});

// ── 7. Cross-emulator deal scenario ──────────────────────────────────────────

describe('PR 6.6 — cross-emulator deal scenario', () => {
  const DEAL = 'deal-cross-001';
  const FIXED = '2024-01-15T12:00:00.000Z';

  let bank: BankAdapterEmulator;
  let fgis: FgisAdapterEmulator;
  let edo: EdoAdapterEmulator;
  let epd: EpdAdapterEmulator;

  beforeEach(() => {
    bank = new BankAdapterEmulator({ fixedNow: FIXED });
    fgis = new FgisAdapterEmulator({ fixedNow: FIXED });
    edo = new EdoAdapterEmulator({ fixedNow: FIXED });
    epd = new EpdAdapterEmulator({ fixedNow: FIXED });
  });

  it('complete deal flow: all four emulators, same dealId, all pre-integration', () => {
    const cid = 'corr-cross-001';

    // Bank: reserve_requested → reserve_confirmed
    bank.emit('reserve_requested', cid, { dealId: DEAL });
    const bankConfirmed = bank.emit('reserve_confirmed', cid, { dealId: DEAL });

    // FGIS: party_link_requested → party_linked → sdiz_draft_created → sdiz_ready_to_sign → sdiz_signed
    fgis.emit('party_link_requested', cid, { dealId: DEAL });
    fgis.emit('party_linked', cid, { dealId: DEAL });
    fgis.emit('sdiz_draft_created', cid, { dealId: DEAL });
    fgis.emit('sdiz_ready_to_sign', cid, { dealId: DEAL });
    const fgisSigned = fgis.emit('sdiz_signed', cid, { dealId: DEAL });

    // EDO: document_draft_created → document_sent → document_signed_by_all_sides
    edo.emit('document_draft_created', cid, { dealId: DEAL });
    edo.emit('document_sent', cid, { dealId: DEAL });
    edo.emit('document_signed_by_one_side', cid, { dealId: DEAL });
    const edoSigned = edo.emit('document_signed_by_all_sides', cid, { dealId: DEAL });

    // EPD: epd_draft_created → epd_sent → epd_confirmed; trip_event_received → arrival_confirmed
    epd.emit('epd_draft_created', cid, { dealId: DEAL });
    epd.emit('epd_sent', cid, { dealId: DEAL });
    const epdConfirmed = epd.emit('epd_confirmed', cid, { dealId: DEAL });
    epd.emit('trip_event_received', cid, { dealId: DEAL, tripId: 'trip-001' });
    const epdArrival = epd.emit('arrival_confirmed', cid, { dealId: DEAL, tripId: 'trip-001' });

    // All terminal events are successful
    expect(bankConfirmed.externalStatus).toBe('reserve_confirmed');
    expect(fgisSigned.externalStatus).toBe('sdiz_signed');
    expect(edoSigned.externalStatus).toBe('document_signed_by_all_sides');
    expect(epdConfirmed.externalStatus).toBe('epd_confirmed');
    expect(epdArrival.externalStatus).toBe('arrival_confirmed');
  });

  it('all events in deal scenario reference the same dealId', () => {
    const cid = 'corr-cross-deal';

    bank.emit('reserve_requested', cid, { dealId: DEAL });
    fgis.emit('party_link_requested', cid, { dealId: DEAL });
    edo.emit('document_draft_created', cid, { dealId: DEAL });
    epd.emit('epd_draft_created', cid, { dealId: DEAL });

    const allEvents: ReadonlyArray<
      BankAdapterEmulatorEvent | FgisAdapterEmulatorEvent | EdoAdapterEmulatorEvent | EpdAdapterEmulatorEvent
    > = [
      ...bank.getLedger(),
      ...fgis.getLedger(),
      ...edo.getLedger(),
      ...epd.getLedger(),
    ];

    for (const ev of allEvents) {
      expect(ev.payload.dealId).toBe(DEAL);
    }
  });

  it('all events in deal scenario have maturity pre-integration', () => {
    const cid = 'corr-cross-mat';

    bank.emit('reserve_requested', cid, { dealId: DEAL });
    fgis.emit('party_link_requested', cid, { dealId: DEAL });
    edo.emit('document_draft_created', cid, { dealId: DEAL });
    epd.emit('epd_draft_created', cid, { dealId: DEAL });

    const allEvents = [
      ...bank.getLedger(),
      ...fgis.getLedger(),
      ...edo.getLedger(),
      ...epd.getLedger(),
    ];

    for (const ev of allEvents) {
      expect(ev.maturity).toBe('pre-integration');
    }
  });
});

// ── 8. No live external system claims ────────────────────────────────────────

describe('PR 6.6 — no live external system claims across all emulators', () => {
  const FORBIDDEN = [
    'production-ready',
    'fully live',
    'fully integrated',
    'bank connected',
    'FGIS connected',
    'EDO connected',
    'EPD connected',
    'platform guarantees payment',
    'platform releases money',
    'банк подключён',
    'ФГИС подключён',
    'ЭДО подключён',
    'EPD подключён',
  ];

  function collectAllEvents(): string {
    const bank = new BankAdapterEmulator({ fixedNow: FIXED_NOW });
    const fgis = new FgisAdapterEmulator({ fixedNow: FIXED_NOW });
    const edo = new EdoAdapterEmulator({ fixedNow: FIXED_NOW });
    const epd = new EpdAdapterEmulator({ fixedNow: FIXED_NOW });

    bank.emit('reserve_requested', 'nr-1', { dealId: 'd1' });
    bank.emit('reserve_confirmed', 'nr-1', { dealId: 'd1' });
    fgis.emit('party_link_requested', 'nf-1', { dealId: 'd1' });
    fgis.emit('party_linked', 'nf-1', { dealId: 'd1' });
    edo.emit('document_draft_created', 'ne-1', { dealId: 'd1' });
    edo.emit('document_sent', 'ne-1', { dealId: 'd1' });
    epd.emit('epd_draft_created', 'np-1', { dealId: 'd1' });
    epd.emit('epd_sent', 'np-1', { dealId: 'd1' });

    return JSON.stringify([
      ...bank.getLedger(),
      ...fgis.getLedger(),
      ...edo.getLedger(),
      ...epd.getLedger(),
    ]);
  }

  it('serialized events contain no forbidden live-claim phrases', () => {
    const serialized = collectAllEvents();
    for (const phrase of FORBIDDEN) {
      expect(serialized).not.toContain(phrase);
    }
  });
});
