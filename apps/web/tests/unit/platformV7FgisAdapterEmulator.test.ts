import { describe, it, expect } from 'vitest';
import {
  createFgisAdapterEmulator,
  FgisAdapterEmulator,
  type FgisAdapterEmulatorEvent,
  type FgisEventType,
} from '../../lib/platform-v7/fgis-adapter-emulator';

const FIXED_NOW = '2026-05-26T10:00:00.000Z';
const DEAL_PAYLOAD = { dealId: 'DL-9102', sdizId: 'SDIZ-001', partyInn: '7700000001' };
const BASE_CONFIG = { fixedNow: FIXED_NOW };

// ── Determinism ───────────────────────────────────────────────────────────────

describe('determinism', () => {
  it('same config + correlationId produces identical events', () => {
    const a = createFgisAdapterEmulator(BASE_CONFIG);
    const b = createFgisAdapterEmulator(BASE_CONFIG);
    expect(
      a.emit('party_link_requested', 'corr-det-1', DEAL_PAYLOAD),
    ).toEqual(
      b.emit('party_link_requested', 'corr-det-1', DEAL_PAYLOAD),
    );
  });

  it('receivedAt is fixed when fixedNow is provided', () => {
    const emu = createFgisAdapterEmulator(BASE_CONFIG);
    expect(emu.emit('sdiz_draft_created', 'corr-det-2', DEAL_PAYLOAD).receivedAt).toBe(FIXED_NOW);
  });

  it('source is always fgis_emulator', () => {
    const emu = createFgisAdapterEmulator(BASE_CONFIG);
    expect(emu.emit('party_link_requested', 'corr-det-3', DEAL_PAYLOAD).source).toBe('fgis_emulator');
  });
});

// ── Maturity claim ────────────────────────────────────────────────────────────

describe('maturity: pre-integration', () => {
  it('every emitted event has maturity pre-integration', () => {
    const emu = createFgisAdapterEmulator(BASE_CONFIG);
    const types: FgisEventType[] = [
      'party_link_requested',
      'sdiz_draft_created',
      'sdiz_error',
      'manual_review',
    ];
    for (const type of types) {
      emu.reset();
      expect(emu.emit(type, `corr-mat-${type}`, DEAL_PAYLOAD).maturity).toBe('pre-integration');
    }
  });

  it('source is fgis_emulator, not live_fgis or fgis', () => {
    const emu = createFgisAdapterEmulator(BASE_CONFIG);
    const event = emu.emit('party_link_requested', 'corr-src-1', DEAL_PAYLOAD);
    expect(event.source).toBe('fgis_emulator');
    expect(event.source).not.toBe('fgis');
    expect(event.source).not.toBe('live_fgis');
  });
});

// ── Idempotency ───────────────────────────────────────────────────────────────

describe('idempotency', () => {
  it('same (eventType, correlationId) returns the same object reference', () => {
    const emu = createFgisAdapterEmulator(BASE_CONFIG);
    const first = emu.emit('party_link_requested', 'corr-idem-1', DEAL_PAYLOAD);
    const second = emu.emit('party_link_requested', 'corr-idem-1', DEAL_PAYLOAD);
    expect(first).toBe(second);
  });

  it('duplicate call does not grow the ledger', () => {
    const emu = createFgisAdapterEmulator(BASE_CONFIG);
    emu.emit('sdiz_draft_created', 'corr-idem-2', DEAL_PAYLOAD);
    emu.emit('sdiz_draft_created', 'corr-idem-2', DEAL_PAYLOAD);
    expect(emu.getLedger()).toHaveLength(1);
  });

  it('different correlationIds produce separate entries', () => {
    const emu = createFgisAdapterEmulator(BASE_CONFIG);
    emu.emit('party_link_requested', 'corr-idem-3a', DEAL_PAYLOAD);
    emu.emit('party_link_requested', 'corr-idem-3b', DEAL_PAYLOAD);
    expect(emu.getLedger()).toHaveLength(2);
  });
});

// ── SDIZ lifecycle state machine ──────────────────────────────────────────────

describe('SDIZ lifecycle state machine', () => {
  it('party_linked without prior party_link_requested → invalid_payload', () => {
    const emu = createFgisAdapterEmulator(BASE_CONFIG);
    expect(emu.emit('party_linked', 'corr-sm-1', DEAL_PAYLOAD).externalStatus).toBe('invalid_payload');
  });

  it('party_linked after party_link_requested → party_linked', () => {
    const emu = createFgisAdapterEmulator(BASE_CONFIG);
    emu.emit('party_link_requested', 'corr-sm-2', DEAL_PAYLOAD);
    expect(emu.emit('party_linked', 'corr-sm-2', DEAL_PAYLOAD).externalStatus).toBe('party_linked');
  });

  it('sdiz_ready_to_sign without prior sdiz_draft_created → invalid_payload', () => {
    const emu = createFgisAdapterEmulator(BASE_CONFIG);
    expect(emu.emit('sdiz_ready_to_sign', 'corr-sm-3', DEAL_PAYLOAD).externalStatus).toBe('invalid_payload');
  });

  it('sdiz_signed without prior sdiz_ready_to_sign → invalid_payload', () => {
    const emu = createFgisAdapterEmulator(BASE_CONFIG);
    expect(emu.emit('sdiz_signed', 'corr-sm-4', DEAL_PAYLOAD).externalStatus).toBe('invalid_payload');
  });

  it('full SDIZ happy path: draft → ready_to_sign → signed → sent → redeemed', () => {
    const emu = createFgisAdapterEmulator(BASE_CONFIG);
    const id = 'corr-sm-full';
    expect(emu.emit('sdiz_draft_created', id, DEAL_PAYLOAD).externalStatus).toBe('sdiz_draft_created');
    expect(emu.emit('sdiz_ready_to_sign', id, DEAL_PAYLOAD).externalStatus).toBe('sdiz_ready_to_sign');
    expect(emu.emit('sdiz_signed', id, DEAL_PAYLOAD).externalStatus).toBe('sdiz_signed');
    expect(emu.emit('sdiz_sent', id, DEAL_PAYLOAD).externalStatus).toBe('sdiz_sent');
    expect(emu.emit('sdiz_redeemed', id, DEAL_PAYLOAD).externalStatus).toBe('sdiz_redeemed');
  });

  it('sdiz_partially_redeemed requires prior sdiz_sent', () => {
    const emu = createFgisAdapterEmulator(BASE_CONFIG);
    expect(emu.emit('sdiz_partially_redeemed', 'corr-sm-5', DEAL_PAYLOAD).externalStatus).toBe('invalid_payload');
  });

  it('sdiz_partially_redeemed succeeds after sdiz_sent', () => {
    const emu = createFgisAdapterEmulator(BASE_CONFIG);
    const id = 'corr-sm-6';
    emu.emit('sdiz_draft_created', id, DEAL_PAYLOAD);
    emu.emit('sdiz_ready_to_sign', id, DEAL_PAYLOAD);
    emu.emit('sdiz_signed', id, DEAL_PAYLOAD);
    emu.emit('sdiz_sent', id, DEAL_PAYLOAD);
    expect(emu.emit('sdiz_partially_redeemed', id, DEAL_PAYLOAD).externalStatus).toBe('sdiz_partially_redeemed');
  });

  it('sdiz_redeemed requires prior sdiz_sent', () => {
    const emu = createFgisAdapterEmulator(BASE_CONFIG);
    expect(emu.emit('sdiz_redeemed', 'corr-sm-7', DEAL_PAYLOAD).externalStatus).toBe('invalid_payload');
  });

  it('events without prior requirements emit directly', () => {
    const emu = createFgisAdapterEmulator(BASE_CONFIG);
    expect(emu.emit('party_link_requested', 'corr-sm-8', DEAL_PAYLOAD).externalStatus).toBe('party_link_requested');
    expect(emu.emit('sdiz_draft_created', 'corr-sm-9', DEAL_PAYLOAD).externalStatus).toBe('sdiz_draft_created');
    expect(emu.emit('sdiz_error', 'corr-sm-10', DEAL_PAYLOAD).externalStatus).toBe('sdiz_error');
    expect(emu.emit('manual_review', 'corr-sm-11', DEAL_PAYLOAD).externalStatus).toBe('manual_review');
  });
});

// ── Invalid payload ───────────────────────────────────────────────────────────

describe('invalid_payload', () => {
  it('missing prior step for lifecycle event → invalid_payload', () => {
    const emu = createFgisAdapterEmulator(BASE_CONFIG);
    expect(emu.emit('sdiz_sent', 'corr-inv-1', DEAL_PAYLOAD).externalStatus).toBe('invalid_payload');
  });
});

// ── Failure states ────────────────────────────────────────────────────────────

describe('failure states via config overrides', () => {
  it('produces manual_review', () => {
    const emu = createFgisAdapterEmulator({
      fixedNow: FIXED_NOW,
      manualReviewCorrelationIds: ['corr-fail-manual'],
    });
    expect(emu.emit('party_link_requested', 'corr-fail-manual', DEAL_PAYLOAD).externalStatus).toBe('manual_review');
  });

  it('produces sdiz_error', () => {
    const emu = createFgisAdapterEmulator({
      fixedNow: FIXED_NOW,
      sdizErrorCorrelationIds: ['corr-fail-error'],
    });
    expect(emu.emit('sdiz_ready_to_sign', 'corr-fail-error', DEAL_PAYLOAD).externalStatus).toBe('sdiz_error');
  });

  it('produces timeout', () => {
    const emu = createFgisAdapterEmulator({
      fixedNow: FIXED_NOW,
      timeoutCorrelationIds: ['corr-fail-timeout'],
    });
    expect(emu.emit('sdiz_draft_created', 'corr-fail-timeout', DEAL_PAYLOAD).externalStatus).toBe('timeout');
  });

  it('produces rejected', () => {
    const emu = createFgisAdapterEmulator({
      fixedNow: FIXED_NOW,
      rejectedCorrelationIds: ['corr-fail-rejected'],
    });
    expect(emu.emit('party_link_requested', 'corr-fail-rejected', DEAL_PAYLOAD).externalStatus).toBe('rejected');
  });

  it('produces conflict', () => {
    const emu = createFgisAdapterEmulator({
      fixedNow: FIXED_NOW,
      conflictCorrelationIds: ['corr-fail-conflict'],
    });
    expect(emu.emit('sdiz_draft_created', 'corr-fail-conflict', DEAL_PAYLOAD).externalStatus).toBe('conflict');
  });
});

// ── No live FGIS claim ────────────────────────────────────────────────────────

describe('no live FGIS claim', () => {
  it('all ledger events carry maturity pre-integration', () => {
    const emu = createFgisAdapterEmulator(BASE_CONFIG);
    emu.emit('party_link_requested', 'corr-live-1', DEAL_PAYLOAD);
    emu.emit('sdiz_draft_created', 'corr-live-2', DEAL_PAYLOAD);
    emu.emit('manual_review', 'corr-live-3', DEAL_PAYLOAD);
    for (const ev of emu.getLedger()) {
      expect(ev.maturity).toBe('pre-integration');
    }
  });

  it('serialized events do not contain forbidden FGIS-connected claims', () => {
    const emu = createFgisAdapterEmulator(BASE_CONFIG);
    const id = 'corr-live-4';
    emu.emit('sdiz_draft_created', id, DEAL_PAYLOAD);
    emu.emit('sdiz_ready_to_sign', id, DEAL_PAYLOAD);
    emu.emit('sdiz_signed', id, DEAL_PAYLOAD);
    for (const ev of emu.getLedger()) {
      const json = JSON.stringify(ev);
      expect(json).not.toMatch(/ФГИС подключён/i);
      expect(json).not.toMatch(/fgis.*connected/i);
      expect(json).not.toMatch(/production.ready/i);
    }
  });
});

// ── No network calls ──────────────────────────────────────────────────────────

describe('no network calls', () => {
  it('constructor does not invoke fetch', () => {
    const originalFetch = globalThis.fetch;
    let called = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = async () => { called = true; return new Response(); };
    try {
      createFgisAdapterEmulator(BASE_CONFIG);
    } finally {
      globalThis.fetch = originalFetch;
    }
    expect(called).toBe(false);
  });

  it('emit does not invoke fetch', () => {
    const originalFetch = globalThis.fetch;
    let called = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = async () => { called = true; return new Response(); };
    try {
      const emu = createFgisAdapterEmulator(BASE_CONFIG);
      emu.emit('party_link_requested', 'corr-net-1', DEAL_PAYLOAD);
    } finally {
      globalThis.fetch = originalFetch;
    }
    expect(called).toBe(false);
  });
});

// ── All required event types ──────────────────────────────────────────────────

describe('all required event types', () => {
  it('covers the full required event type set', () => {
    const emu = createFgisAdapterEmulator(BASE_CONFIG);
    const id = 'full-path';
    expect(emu.emit('party_link_requested', 'full-1', DEAL_PAYLOAD).externalStatus).toBe('party_link_requested');
    expect(emu.emit('party_linked', 'full-1', DEAL_PAYLOAD).externalStatus).toBe('party_linked');
    expect(emu.emit('sdiz_draft_created', id, DEAL_PAYLOAD).externalStatus).toBe('sdiz_draft_created');
    expect(emu.emit('sdiz_ready_to_sign', id, DEAL_PAYLOAD).externalStatus).toBe('sdiz_ready_to_sign');
    expect(emu.emit('sdiz_signed', id, DEAL_PAYLOAD).externalStatus).toBe('sdiz_signed');
    expect(emu.emit('sdiz_sent', id, DEAL_PAYLOAD).externalStatus).toBe('sdiz_sent');
    expect(emu.emit('sdiz_redeemed', id, DEAL_PAYLOAD).externalStatus).toBe('sdiz_redeemed');
    expect(emu.emit('sdiz_error', 'full-2', DEAL_PAYLOAD).externalStatus).toBe('sdiz_error');
    expect(emu.emit('manual_review', 'full-3', DEAL_PAYLOAD).externalStatus).toBe('manual_review');
    // sdiz_partially_redeemed needs its own correlationId with sdiz_sent
    const pid = 'full-partial';
    emu.emit('sdiz_draft_created', pid, DEAL_PAYLOAD);
    emu.emit('sdiz_ready_to_sign', pid, DEAL_PAYLOAD);
    emu.emit('sdiz_signed', pid, DEAL_PAYLOAD);
    emu.emit('sdiz_sent', pid, DEAL_PAYLOAD);
    expect(emu.emit('sdiz_partially_redeemed', pid, DEAL_PAYLOAD).externalStatus).toBe('sdiz_partially_redeemed');
  });

  it('all events have required envelope fields', () => {
    const emu = createFgisAdapterEmulator(BASE_CONFIG);
    const event = emu.emit('party_link_requested', 'full-env-1', DEAL_PAYLOAD);
    expect(event).toMatchObject({
      source: 'fgis_emulator',
      maturity: 'pre-integration',
      correlationId: 'full-env-1',
      receivedAt: FIXED_NOW,
    });
    expect(typeof event.externalStatus).toBe('string');
    expect(event.payload).toEqual(DEAL_PAYLOAD);
  });
});

// ── Factory and class API ─────────────────────────────────────────────────────

describe('factory and class API', () => {
  it('createFgisAdapterEmulator returns a FgisAdapterEmulator instance', () => {
    expect(createFgisAdapterEmulator()).toBeInstanceOf(FgisAdapterEmulator);
  });

  it('reset clears the ledger', () => {
    const emu = createFgisAdapterEmulator(BASE_CONFIG);
    emu.emit('party_link_requested', 'corr-reset-1', DEAL_PAYLOAD);
    expect(emu.getLedger()).toHaveLength(1);
    emu.reset();
    expect(emu.getLedger()).toHaveLength(0);
  });

  it('getLedger returns readonly snapshot', () => {
    const emu = createFgisAdapterEmulator(BASE_CONFIG);
    emu.emit('sdiz_draft_created', 'corr-snap-1', DEAL_PAYLOAD);
    const snap = emu.getLedger();
    expect(snap).toHaveLength(1);
    (snap as FgisAdapterEmulatorEvent[]).pop();
    expect(emu.getLedger()).toHaveLength(1);
  });
});
