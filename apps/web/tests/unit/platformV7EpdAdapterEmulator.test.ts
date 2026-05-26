import { describe, it, expect } from 'vitest';
import {
  createEpdAdapterEmulator,
  EpdAdapterEmulator,
  type EpdAdapterEmulatorEvent,
  type EpdEventType,
} from '../../lib/platform-v7/epd-adapter-emulator';

const FIXED_NOW = '2026-05-26T10:00:00.000Z';
const DEAL_PAYLOAD = { dealId: 'DL-5501', tripId: 'TRIP-001', documentId: 'EPD-001' };
const BASE_CONFIG = { fixedNow: FIXED_NOW };

// ── Determinism ───────────────────────────────────────────────────────────────

describe('determinism', () => {
  it('same config + correlationId produces identical events', () => {
    const a = createEpdAdapterEmulator(BASE_CONFIG);
    const b = createEpdAdapterEmulator(BASE_CONFIG);
    expect(
      a.emit('epd_draft_created', 'corr-det-1', DEAL_PAYLOAD),
    ).toEqual(
      b.emit('epd_draft_created', 'corr-det-1', DEAL_PAYLOAD),
    );
  });

  it('receivedAt is fixed when fixedNow is provided', () => {
    const emu = createEpdAdapterEmulator(BASE_CONFIG);
    expect(emu.emit('epd_draft_created', 'corr-det-2', DEAL_PAYLOAD).receivedAt).toBe(FIXED_NOW);
  });

  it('source is always epd_emulator', () => {
    const emu = createEpdAdapterEmulator(BASE_CONFIG);
    expect(emu.emit('epd_draft_created', 'corr-det-3', DEAL_PAYLOAD).source).toBe('epd_emulator');
  });
});

// ── Maturity claim ────────────────────────────────────────────────────────────

describe('maturity: pre-integration', () => {
  it('every emitted event has maturity pre-integration', () => {
    const emu = createEpdAdapterEmulator(BASE_CONFIG);
    const types: EpdEventType[] = [
      'epd_draft_created',
      'trip_event_received',
      'manual_review',
    ];
    for (const type of types) {
      emu.reset();
      expect(emu.emit(type, `corr-mat-${type}`, DEAL_PAYLOAD).maturity).toBe('pre-integration');
    }
  });

  it('source is epd_emulator, not live_epd or epd', () => {
    const emu = createEpdAdapterEmulator(BASE_CONFIG);
    const event = emu.emit('epd_draft_created', 'corr-src-1', DEAL_PAYLOAD);
    expect(event.source).toBe('epd_emulator');
    expect(event.source).not.toBe('epd');
    expect(event.source).not.toBe('live_epd');
  });
});

// ── Idempotency ───────────────────────────────────────────────────────────────

describe('idempotency', () => {
  it('same (eventType, correlationId) returns the same object reference', () => {
    const emu = createEpdAdapterEmulator(BASE_CONFIG);
    const first = emu.emit('epd_draft_created', 'corr-idem-1', DEAL_PAYLOAD);
    const second = emu.emit('epd_draft_created', 'corr-idem-1', DEAL_PAYLOAD);
    expect(first).toBe(second);
  });

  it('duplicate call does not grow the ledger', () => {
    const emu = createEpdAdapterEmulator(BASE_CONFIG);
    emu.emit('epd_draft_created', 'corr-idem-2', DEAL_PAYLOAD);
    emu.emit('epd_draft_created', 'corr-idem-2', DEAL_PAYLOAD);
    expect(emu.getLedger()).toHaveLength(1);
  });

  it('different correlationIds produce separate entries', () => {
    const emu = createEpdAdapterEmulator(BASE_CONFIG);
    emu.emit('epd_draft_created', 'corr-idem-3a', DEAL_PAYLOAD);
    emu.emit('epd_draft_created', 'corr-idem-3b', DEAL_PAYLOAD);
    expect(emu.getLedger()).toHaveLength(2);
  });
});

// ── EPD lifecycle state machine ───────────────────────────────────────────────

describe('EPD lifecycle state machine', () => {
  it('epd_sent without prior epd_draft_created → invalid_payload', () => {
    const emu = createEpdAdapterEmulator(BASE_CONFIG);
    expect(emu.emit('epd_sent', 'corr-sm-1', DEAL_PAYLOAD).externalStatus).toBe('invalid_payload');
  });

  it('epd_sent after epd_draft_created → epd_sent', () => {
    const emu = createEpdAdapterEmulator(BASE_CONFIG);
    emu.emit('epd_draft_created', 'corr-sm-2', DEAL_PAYLOAD);
    expect(emu.emit('epd_sent', 'corr-sm-2', DEAL_PAYLOAD).externalStatus).toBe('epd_sent');
  });

  it('epd_confirmed without prior epd_sent → invalid_payload', () => {
    const emu = createEpdAdapterEmulator(BASE_CONFIG);
    expect(emu.emit('epd_confirmed', 'corr-sm-3', DEAL_PAYLOAD).externalStatus).toBe('invalid_payload');
  });

  it('epd_rejected without prior epd_sent → invalid_payload', () => {
    const emu = createEpdAdapterEmulator(BASE_CONFIG);
    expect(emu.emit('epd_rejected', 'corr-sm-4', DEAL_PAYLOAD).externalStatus).toBe('invalid_payload');
  });

  it('arrival_confirmed without prior trip_event_received → invalid_payload', () => {
    const emu = createEpdAdapterEmulator(BASE_CONFIG);
    expect(emu.emit('arrival_confirmed', 'corr-sm-5', DEAL_PAYLOAD).externalStatus).toBe('invalid_payload');
  });

  it('arrival_confirmed after trip_event_received → arrival_confirmed', () => {
    const emu = createEpdAdapterEmulator(BASE_CONFIG);
    emu.emit('trip_event_received', 'corr-sm-6', DEAL_PAYLOAD);
    expect(emu.emit('arrival_confirmed', 'corr-sm-6', DEAL_PAYLOAD).externalStatus).toBe('arrival_confirmed');
  });

  it('full EPD happy path: draft → sent → confirmed', () => {
    const emu = createEpdAdapterEmulator(BASE_CONFIG);
    const id = 'corr-sm-full';
    expect(emu.emit('epd_draft_created', id, DEAL_PAYLOAD).externalStatus).toBe('epd_draft_created');
    expect(emu.emit('epd_sent', id, DEAL_PAYLOAD).externalStatus).toBe('epd_sent');
    expect(emu.emit('epd_confirmed', id, DEAL_PAYLOAD).externalStatus).toBe('epd_confirmed');
  });

  it('epd_rejected succeeds after epd_sent', () => {
    const emu = createEpdAdapterEmulator(BASE_CONFIG);
    const id = 'corr-sm-7';
    emu.emit('epd_draft_created', id, DEAL_PAYLOAD);
    emu.emit('epd_sent', id, DEAL_PAYLOAD);
    expect(emu.emit('epd_rejected', id, DEAL_PAYLOAD).externalStatus).toBe('epd_rejected');
  });

  it('events without prior requirements emit directly', () => {
    const emu = createEpdAdapterEmulator(BASE_CONFIG);
    expect(emu.emit('epd_draft_created', 'corr-sm-8', DEAL_PAYLOAD).externalStatus).toBe('epd_draft_created');
    expect(emu.emit('trip_event_received', 'corr-sm-9', DEAL_PAYLOAD).externalStatus).toBe('trip_event_received');
    expect(emu.emit('route_deviation_received', 'corr-sm-10', DEAL_PAYLOAD).externalStatus).toBe('route_deviation_received');
    expect(emu.emit('manual_review', 'corr-sm-11', DEAL_PAYLOAD).externalStatus).toBe('manual_review');
  });

  it('epd_confirmed requires sent, not just draft', () => {
    const emu = createEpdAdapterEmulator(BASE_CONFIG);
    const id = 'corr-sm-12';
    emu.emit('epd_draft_created', id, DEAL_PAYLOAD);
    expect(emu.emit('epd_confirmed', id, DEAL_PAYLOAD).externalStatus).toBe('invalid_payload');
  });
});

// ── Invalid payload ───────────────────────────────────────────────────────────

describe('invalid_payload', () => {
  it('missing prior step for lifecycle event → invalid_payload', () => {
    const emu = createEpdAdapterEmulator(BASE_CONFIG);
    expect(emu.emit('epd_confirmed', 'corr-inv-1', DEAL_PAYLOAD).externalStatus).toBe('invalid_payload');
  });

  it('unknown correlationId for state-dependent event → invalid_payload', () => {
    const emu = createEpdAdapterEmulator(BASE_CONFIG);
    expect(emu.emit('epd_sent', 'never-seen-corr', DEAL_PAYLOAD).externalStatus).toBe('invalid_payload');
  });
});

// ── Failure states ────────────────────────────────────────────────────────────

describe('failure states via config overrides', () => {
  it('produces manual_review', () => {
    const emu = createEpdAdapterEmulator({
      fixedNow: FIXED_NOW,
      manualReviewCorrelationIds: ['corr-fail-manual'],
    });
    expect(emu.emit('epd_draft_created', 'corr-fail-manual', DEAL_PAYLOAD).externalStatus).toBe('manual_review');
  });

  it('produces timeout', () => {
    const emu = createEpdAdapterEmulator({
      fixedNow: FIXED_NOW,
      timeoutCorrelationIds: ['corr-fail-timeout'],
    });
    expect(emu.emit('epd_draft_created', 'corr-fail-timeout', DEAL_PAYLOAD).externalStatus).toBe('timeout');
  });

  it('produces rejected', () => {
    const emu = createEpdAdapterEmulator({
      fixedNow: FIXED_NOW,
      rejectedCorrelationIds: ['corr-fail-rejected'],
    });
    expect(emu.emit('epd_draft_created', 'corr-fail-rejected', DEAL_PAYLOAD).externalStatus).toBe('rejected');
  });

  it('produces conflict', () => {
    const emu = createEpdAdapterEmulator({
      fixedNow: FIXED_NOW,
      conflictCorrelationIds: ['corr-fail-conflict'],
    });
    expect(emu.emit('epd_draft_created', 'corr-fail-conflict', DEAL_PAYLOAD).externalStatus).toBe('conflict');
  });

  it('override takes precedence over state-machine validation', () => {
    const emu = createEpdAdapterEmulator({
      fixedNow: FIXED_NOW,
      timeoutCorrelationIds: ['corr-override-1'],
    });
    // epd_sent normally requires draft; override bypasses that check
    expect(emu.emit('epd_sent', 'corr-override-1', DEAL_PAYLOAD).externalStatus).toBe('timeout');
  });
});

// ── No live EPD claim ─────────────────────────────────────────────────────────

describe('no live EPD claim', () => {
  it('all ledger events carry maturity pre-integration', () => {
    const emu = createEpdAdapterEmulator(BASE_CONFIG);
    emu.emit('epd_draft_created', 'corr-live-1', DEAL_PAYLOAD);
    emu.emit('trip_event_received', 'corr-live-2', DEAL_PAYLOAD);
    emu.emit('manual_review', 'corr-live-3', DEAL_PAYLOAD);
    for (const ev of emu.getLedger()) {
      expect(ev.maturity).toBe('pre-integration');
    }
  });

  it('serialized events do not contain forbidden EPD-connected claims', () => {
    const emu = createEpdAdapterEmulator(BASE_CONFIG);
    const id = 'corr-live-4';
    emu.emit('epd_draft_created', id, DEAL_PAYLOAD);
    emu.emit('epd_sent', id, DEAL_PAYLOAD);
    emu.emit('epd_confirmed', id, DEAL_PAYLOAD);
    for (const ev of emu.getLedger()) {
      const json = JSON.stringify(ev);
      expect(json).not.toMatch(/EPD подключён/i);
      expect(json).not.toMatch(/epd.*connected/i);
      expect(json).not.toMatch(/production.ready/i);
      expect(json).not.toMatch(/fully.live/i);
    }
  });

  it('logistics events do not claim to override bank or quality gates', () => {
    const emu = createEpdAdapterEmulator(BASE_CONFIG);
    const id = 'corr-live-5';
    emu.emit('trip_event_received', id, DEAL_PAYLOAD);
    emu.emit('arrival_confirmed', id, DEAL_PAYLOAD);
    for (const ev of emu.getLedger()) {
      const json = JSON.stringify(ev);
      expect(json).not.toMatch(/платформа гарантирует оплату/i);
      expect(json).not.toMatch(/platform guarantees payment/i);
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
      createEpdAdapterEmulator(BASE_CONFIG);
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
      const emu = createEpdAdapterEmulator(BASE_CONFIG);
      emu.emit('epd_draft_created', 'corr-net-1', DEAL_PAYLOAD);
    } finally {
      globalThis.fetch = originalFetch;
    }
    expect(called).toBe(false);
  });
});

// ── All required event types ──────────────────────────────────────────────────

describe('all required event types', () => {
  it('covers the full required event type set', () => {
    const emu = createEpdAdapterEmulator(BASE_CONFIG);
    const id = 'full-path';

    expect(emu.emit('epd_draft_created', id, DEAL_PAYLOAD).externalStatus).toBe('epd_draft_created');
    expect(emu.emit('epd_sent', id, DEAL_PAYLOAD).externalStatus).toBe('epd_sent');
    expect(emu.emit('epd_confirmed', id, DEAL_PAYLOAD).externalStatus).toBe('epd_confirmed');

    const rejId = 'full-rej';
    emu.emit('epd_draft_created', rejId, DEAL_PAYLOAD);
    emu.emit('epd_sent', rejId, DEAL_PAYLOAD);
    expect(emu.emit('epd_rejected', rejId, DEAL_PAYLOAD).externalStatus).toBe('epd_rejected');

    const tripId = 'full-trip';
    expect(emu.emit('trip_event_received', tripId, DEAL_PAYLOAD).externalStatus).toBe('trip_event_received');
    expect(emu.emit('arrival_confirmed', tripId, DEAL_PAYLOAD).externalStatus).toBe('arrival_confirmed');

    expect(emu.emit('route_deviation_received', 'full-dev', DEAL_PAYLOAD).externalStatus).toBe('route_deviation_received');
    expect(emu.emit('manual_review', 'full-mr', DEAL_PAYLOAD).externalStatus).toBe('manual_review');
  });

  it('all events have required envelope fields', () => {
    const emu = createEpdAdapterEmulator(BASE_CONFIG);
    const event = emu.emit('epd_draft_created', 'full-env-1', DEAL_PAYLOAD);
    expect(event).toMatchObject({
      source: 'epd_emulator',
      maturity: 'pre-integration',
      correlationId: 'full-env-1',
      receivedAt: FIXED_NOW,
    });
    expect(typeof event.externalStatus).toBe('string');
    expect(event.payload).toEqual(DEAL_PAYLOAD);
  });

  it('all required failure states are reachable via config', () => {
    const failureStates = ['rejected', 'conflict', 'manual_review', 'timeout', 'invalid_payload'] as const;

    const emu1 = createEpdAdapterEmulator({ fixedNow: FIXED_NOW, rejectedCorrelationIds: ['f-r'] });
    expect(emu1.emit('epd_draft_created', 'f-r', DEAL_PAYLOAD).externalStatus).toBe('rejected');

    const emu2 = createEpdAdapterEmulator({ fixedNow: FIXED_NOW, conflictCorrelationIds: ['f-c'] });
    expect(emu2.emit('epd_draft_created', 'f-c', DEAL_PAYLOAD).externalStatus).toBe('conflict');

    const emu3 = createEpdAdapterEmulator({ fixedNow: FIXED_NOW, manualReviewCorrelationIds: ['f-m'] });
    expect(emu3.emit('epd_draft_created', 'f-m', DEAL_PAYLOAD).externalStatus).toBe('manual_review');

    const emu4 = createEpdAdapterEmulator({ fixedNow: FIXED_NOW, timeoutCorrelationIds: ['f-t'] });
    expect(emu4.emit('epd_draft_created', 'f-t', DEAL_PAYLOAD).externalStatus).toBe('timeout');

    const emu5 = createEpdAdapterEmulator(BASE_CONFIG);
    expect(emu5.emit('epd_sent', 'f-ip', DEAL_PAYLOAD).externalStatus).toBe('invalid_payload');

    const covered = new Set<string>();
    covered.add('rejected'); covered.add('conflict'); covered.add('manual_review');
    covered.add('timeout'); covered.add('invalid_payload');
    expect(covered.size).toBe(failureStates.length);
  });
});

// ── Factory and class API ─────────────────────────────────────────────────────

describe('factory and class API', () => {
  it('createEpdAdapterEmulator returns an EpdAdapterEmulator instance', () => {
    expect(createEpdAdapterEmulator()).toBeInstanceOf(EpdAdapterEmulator);
  });

  it('reset clears the ledger', () => {
    const emu = createEpdAdapterEmulator(BASE_CONFIG);
    emu.emit('epd_draft_created', 'corr-reset-1', DEAL_PAYLOAD);
    expect(emu.getLedger()).toHaveLength(1);
    emu.reset();
    expect(emu.getLedger()).toHaveLength(0);
  });

  it('getLedger returns readonly snapshot', () => {
    const emu = createEpdAdapterEmulator(BASE_CONFIG);
    emu.emit('epd_draft_created', 'corr-snap-1', DEAL_PAYLOAD);
    const snap = emu.getLedger();
    expect(snap).toHaveLength(1);
    (snap as EpdAdapterEmulatorEvent[]).pop();
    expect(emu.getLedger()).toHaveLength(1);
  });

  it('constructor accepts no arguments (default config)', () => {
    const emu = new EpdAdapterEmulator();
    const event = emu.emit('epd_draft_created', 'corr-noarg-1', DEAL_PAYLOAD);
    expect(event.maturity).toBe('pre-integration');
    expect(event.source).toBe('epd_emulator');
  });
});
