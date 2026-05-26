import { describe, it, expect } from 'vitest';
import {
  createEdoAdapterEmulator,
  EdoAdapterEmulator,
  type EdoAdapterEmulatorEvent,
  type EdoEventType,
} from '../../lib/platform-v7/edo-adapter-emulator';

const FIXED_NOW = '2026-05-26T10:00:00.000Z';
const DEAL_PAYLOAD = { dealId: 'DL-3701', documentId: 'DOC-001', documentType: 'supply_contract' };
const BASE_CONFIG = { fixedNow: FIXED_NOW };

// ── Determinism ───────────────────────────────────────────────────────────────

describe('determinism', () => {
  it('same config + correlationId produces identical events', () => {
    const a = createEdoAdapterEmulator(BASE_CONFIG);
    const b = createEdoAdapterEmulator(BASE_CONFIG);
    expect(
      a.emit('document_draft_created', 'corr-det-1', DEAL_PAYLOAD),
    ).toEqual(
      b.emit('document_draft_created', 'corr-det-1', DEAL_PAYLOAD),
    );
  });

  it('receivedAt is fixed when fixedNow is provided', () => {
    const emu = createEdoAdapterEmulator(BASE_CONFIG);
    expect(emu.emit('document_draft_created', 'corr-det-2', DEAL_PAYLOAD).receivedAt).toBe(FIXED_NOW);
  });

  it('source is always edo_emulator', () => {
    const emu = createEdoAdapterEmulator(BASE_CONFIG);
    expect(emu.emit('document_draft_created', 'corr-det-3', DEAL_PAYLOAD).source).toBe('edo_emulator');
  });
});

// ── Maturity claim ────────────────────────────────────────────────────────────

describe('maturity: pre-integration', () => {
  it('every emitted event has maturity pre-integration', () => {
    const emu = createEdoAdapterEmulator(BASE_CONFIG);
    const types: EdoEventType[] = [
      'document_draft_created',
      'manual_review',
    ];
    for (const type of types) {
      emu.reset();
      expect(emu.emit(type, `corr-mat-${type}`, DEAL_PAYLOAD).maturity).toBe('pre-integration');
    }
  });

  it('source is edo_emulator, not live_edo or edo', () => {
    const emu = createEdoAdapterEmulator(BASE_CONFIG);
    const event = emu.emit('document_draft_created', 'corr-src-1', DEAL_PAYLOAD);
    expect(event.source).toBe('edo_emulator');
    expect(event.source).not.toBe('edo');
    expect(event.source).not.toBe('live_edo');
  });
});

// ── Idempotency ───────────────────────────────────────────────────────────────

describe('idempotency', () => {
  it('same (eventType, correlationId) returns the same object reference', () => {
    const emu = createEdoAdapterEmulator(BASE_CONFIG);
    const first = emu.emit('document_draft_created', 'corr-idem-1', DEAL_PAYLOAD);
    const second = emu.emit('document_draft_created', 'corr-idem-1', DEAL_PAYLOAD);
    expect(first).toBe(second);
  });

  it('duplicate call does not grow the ledger', () => {
    const emu = createEdoAdapterEmulator(BASE_CONFIG);
    emu.emit('document_draft_created', 'corr-idem-2', DEAL_PAYLOAD);
    emu.emit('document_draft_created', 'corr-idem-2', DEAL_PAYLOAD);
    expect(emu.getLedger()).toHaveLength(1);
  });

  it('different correlationIds produce separate entries', () => {
    const emu = createEdoAdapterEmulator(BASE_CONFIG);
    emu.emit('document_draft_created', 'corr-idem-3a', DEAL_PAYLOAD);
    emu.emit('document_draft_created', 'corr-idem-3b', DEAL_PAYLOAD);
    expect(emu.getLedger()).toHaveLength(2);
  });
});

// ── Document lifecycle state machine ──────────────────────────────────────────

describe('document lifecycle state machine', () => {
  it('document_sent without prior document_draft_created → invalid_payload', () => {
    const emu = createEdoAdapterEmulator(BASE_CONFIG);
    expect(emu.emit('document_sent', 'corr-sm-1', DEAL_PAYLOAD).externalStatus).toBe('invalid_payload');
  });

  it('document_sent after document_draft_created → document_sent', () => {
    const emu = createEdoAdapterEmulator(BASE_CONFIG);
    emu.emit('document_draft_created', 'corr-sm-2', DEAL_PAYLOAD);
    expect(emu.emit('document_sent', 'corr-sm-2', DEAL_PAYLOAD).externalStatus).toBe('document_sent');
  });

  it('document_signed_by_one_side without prior document_sent → invalid_payload', () => {
    const emu = createEdoAdapterEmulator(BASE_CONFIG);
    expect(emu.emit('document_signed_by_one_side', 'corr-sm-3', DEAL_PAYLOAD).externalStatus).toBe('invalid_payload');
  });

  it('document_signed_by_all_sides without prior document_signed_by_one_side → invalid_payload', () => {
    const emu = createEdoAdapterEmulator(BASE_CONFIG);
    expect(emu.emit('document_signed_by_all_sides', 'corr-sm-4', DEAL_PAYLOAD).externalStatus).toBe('invalid_payload');
  });

  it('document_rejected without prior document_sent → invalid_payload', () => {
    const emu = createEdoAdapterEmulator(BASE_CONFIG);
    expect(emu.emit('document_rejected', 'corr-sm-5', DEAL_PAYLOAD).externalStatus).toBe('invalid_payload');
  });

  it('document_revoked without prior document_sent → invalid_payload', () => {
    const emu = createEdoAdapterEmulator(BASE_CONFIG);
    expect(emu.emit('document_revoked', 'corr-sm-6', DEAL_PAYLOAD).externalStatus).toBe('invalid_payload');
  });

  it('full happy path: draft → sent → signed_by_one → signed_by_all', () => {
    const emu = createEdoAdapterEmulator(BASE_CONFIG);
    const id = 'corr-sm-full';
    expect(emu.emit('document_draft_created', id, DEAL_PAYLOAD).externalStatus).toBe('document_draft_created');
    expect(emu.emit('document_sent', id, DEAL_PAYLOAD).externalStatus).toBe('document_sent');
    expect(emu.emit('document_signed_by_one_side', id, DEAL_PAYLOAD).externalStatus).toBe('document_signed_by_one_side');
    expect(emu.emit('document_signed_by_all_sides', id, DEAL_PAYLOAD).externalStatus).toBe('document_signed_by_all_sides');
  });

  it('document_rejected succeeds after document_sent', () => {
    const emu = createEdoAdapterEmulator(BASE_CONFIG);
    const id = 'corr-sm-7';
    emu.emit('document_draft_created', id, DEAL_PAYLOAD);
    emu.emit('document_sent', id, DEAL_PAYLOAD);
    expect(emu.emit('document_rejected', id, DEAL_PAYLOAD).externalStatus).toBe('document_rejected');
  });

  it('document_revoked succeeds after document_sent', () => {
    const emu = createEdoAdapterEmulator(BASE_CONFIG);
    const id = 'corr-sm-8';
    emu.emit('document_draft_created', id, DEAL_PAYLOAD);
    emu.emit('document_sent', id, DEAL_PAYLOAD);
    expect(emu.emit('document_revoked', id, DEAL_PAYLOAD).externalStatus).toBe('document_revoked');
  });

  it('events without prior requirements emit directly', () => {
    const emu = createEdoAdapterEmulator(BASE_CONFIG);
    expect(emu.emit('document_draft_created', 'corr-sm-9', DEAL_PAYLOAD).externalStatus).toBe('document_draft_created');
    expect(emu.emit('manual_review', 'corr-sm-10', DEAL_PAYLOAD).externalStatus).toBe('manual_review');
  });

  it('signed_by_one_side requires sent, not just draft', () => {
    const emu = createEdoAdapterEmulator(BASE_CONFIG);
    const id = 'corr-sm-11';
    emu.emit('document_draft_created', id, DEAL_PAYLOAD);
    expect(emu.emit('document_signed_by_one_side', id, DEAL_PAYLOAD).externalStatus).toBe('invalid_payload');
  });
});

// ── Invalid payload ───────────────────────────────────────────────────────────

describe('invalid_payload', () => {
  it('missing prior step for lifecycle event → invalid_payload', () => {
    const emu = createEdoAdapterEmulator(BASE_CONFIG);
    expect(emu.emit('document_signed_by_all_sides', 'corr-inv-1', DEAL_PAYLOAD).externalStatus).toBe('invalid_payload');
  });

  it('unknown correlationId for state-dependent event → invalid_payload', () => {
    const emu = createEdoAdapterEmulator(BASE_CONFIG);
    expect(emu.emit('document_sent', 'never-seen-corr', DEAL_PAYLOAD).externalStatus).toBe('invalid_payload');
  });
});

// ── Failure states ────────────────────────────────────────────────────────────

describe('failure states via config overrides', () => {
  it('produces manual_review', () => {
    const emu = createEdoAdapterEmulator({
      fixedNow: FIXED_NOW,
      manualReviewCorrelationIds: ['corr-fail-manual'],
    });
    expect(emu.emit('document_draft_created', 'corr-fail-manual', DEAL_PAYLOAD).externalStatus).toBe('manual_review');
  });

  it('produces timeout', () => {
    const emu = createEdoAdapterEmulator({
      fixedNow: FIXED_NOW,
      timeoutCorrelationIds: ['corr-fail-timeout'],
    });
    expect(emu.emit('document_draft_created', 'corr-fail-timeout', DEAL_PAYLOAD).externalStatus).toBe('timeout');
  });

  it('produces rejected', () => {
    const emu = createEdoAdapterEmulator({
      fixedNow: FIXED_NOW,
      rejectedCorrelationIds: ['corr-fail-rejected'],
    });
    expect(emu.emit('document_draft_created', 'corr-fail-rejected', DEAL_PAYLOAD).externalStatus).toBe('rejected');
  });

  it('produces conflict', () => {
    const emu = createEdoAdapterEmulator({
      fixedNow: FIXED_NOW,
      conflictCorrelationIds: ['corr-fail-conflict'],
    });
    expect(emu.emit('document_draft_created', 'corr-fail-conflict', DEAL_PAYLOAD).externalStatus).toBe('conflict');
  });

  it('override takes precedence over state-machine validation', () => {
    const emu = createEdoAdapterEmulator({
      fixedNow: FIXED_NOW,
      timeoutCorrelationIds: ['corr-override-1'],
    });
    // document_sent normally requires draft; override bypasses that check
    expect(emu.emit('document_sent', 'corr-override-1', DEAL_PAYLOAD).externalStatus).toBe('timeout');
  });
});

// ── No live EDO claim ─────────────────────────────────────────────────────────

describe('no live EDO claim', () => {
  it('all ledger events carry maturity pre-integration', () => {
    const emu = createEdoAdapterEmulator(BASE_CONFIG);
    emu.emit('document_draft_created', 'corr-live-1', DEAL_PAYLOAD);
    emu.emit('manual_review', 'corr-live-2', DEAL_PAYLOAD);
    for (const ev of emu.getLedger()) {
      expect(ev.maturity).toBe('pre-integration');
    }
  });

  it('serialized events do not contain forbidden EDO-connected claims', () => {
    const emu = createEdoAdapterEmulator(BASE_CONFIG);
    const id = 'corr-live-3';
    emu.emit('document_draft_created', id, DEAL_PAYLOAD);
    emu.emit('document_sent', id, DEAL_PAYLOAD);
    emu.emit('document_signed_by_one_side', id, DEAL_PAYLOAD);
    emu.emit('document_signed_by_all_sides', id, DEAL_PAYLOAD);
    for (const ev of emu.getLedger()) {
      const json = JSON.stringify(ev);
      expect(json).not.toMatch(/ЭДО подключён/i);
      expect(json).not.toMatch(/edo.*connected/i);
      expect(json).not.toMatch(/production.ready/i);
      expect(json).not.toMatch(/fully.live/i);
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
      createEdoAdapterEmulator(BASE_CONFIG);
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
      const emu = createEdoAdapterEmulator(BASE_CONFIG);
      emu.emit('document_draft_created', 'corr-net-1', DEAL_PAYLOAD);
    } finally {
      globalThis.fetch = originalFetch;
    }
    expect(called).toBe(false);
  });
});

// ── All required event types ──────────────────────────────────────────────────

describe('all required event types', () => {
  it('covers the full required event type set', () => {
    const emu = createEdoAdapterEmulator(BASE_CONFIG);
    const id = 'full-path';

    expect(emu.emit('document_draft_created', id, DEAL_PAYLOAD).externalStatus).toBe('document_draft_created');
    expect(emu.emit('document_sent', id, DEAL_PAYLOAD).externalStatus).toBe('document_sent');
    expect(emu.emit('document_signed_by_one_side', id, DEAL_PAYLOAD).externalStatus).toBe('document_signed_by_one_side');
    expect(emu.emit('document_signed_by_all_sides', id, DEAL_PAYLOAD).externalStatus).toBe('document_signed_by_all_sides');

    const rejId = 'full-rej';
    emu.emit('document_draft_created', rejId, DEAL_PAYLOAD);
    emu.emit('document_sent', rejId, DEAL_PAYLOAD);
    expect(emu.emit('document_rejected', rejId, DEAL_PAYLOAD).externalStatus).toBe('document_rejected');

    const revId = 'full-rev';
    emu.emit('document_draft_created', revId, DEAL_PAYLOAD);
    emu.emit('document_sent', revId, DEAL_PAYLOAD);
    expect(emu.emit('document_revoked', revId, DEAL_PAYLOAD).externalStatus).toBe('document_revoked');

    expect(emu.emit('manual_review', 'full-mr', DEAL_PAYLOAD).externalStatus).toBe('manual_review');
  });

  it('all events have required envelope fields', () => {
    const emu = createEdoAdapterEmulator(BASE_CONFIG);
    const event = emu.emit('document_draft_created', 'full-env-1', DEAL_PAYLOAD);
    expect(event).toMatchObject({
      source: 'edo_emulator',
      maturity: 'pre-integration',
      correlationId: 'full-env-1',
      receivedAt: FIXED_NOW,
    });
    expect(typeof event.externalStatus).toBe('string');
    expect(event.payload).toEqual(DEAL_PAYLOAD);
  });

  it('all required failure states are reachable via config', () => {
    const failureStates = ['rejected', 'conflict', 'manual_review', 'timeout', 'invalid_payload'] as const;

    const emu1 = createEdoAdapterEmulator({ fixedNow: FIXED_NOW, rejectedCorrelationIds: ['f-r'] });
    expect(emu1.emit('document_draft_created', 'f-r', DEAL_PAYLOAD).externalStatus).toBe('rejected');

    const emu2 = createEdoAdapterEmulator({ fixedNow: FIXED_NOW, conflictCorrelationIds: ['f-c'] });
    expect(emu2.emit('document_draft_created', 'f-c', DEAL_PAYLOAD).externalStatus).toBe('conflict');

    const emu3 = createEdoAdapterEmulator({ fixedNow: FIXED_NOW, manualReviewCorrelationIds: ['f-m'] });
    expect(emu3.emit('document_draft_created', 'f-m', DEAL_PAYLOAD).externalStatus).toBe('manual_review');

    const emu4 = createEdoAdapterEmulator({ fixedNow: FIXED_NOW, timeoutCorrelationIds: ['f-t'] });
    expect(emu4.emit('document_draft_created', 'f-t', DEAL_PAYLOAD).externalStatus).toBe('timeout');

    const emu5 = createEdoAdapterEmulator(BASE_CONFIG);
    expect(emu5.emit('document_sent', 'f-ip', DEAL_PAYLOAD).externalStatus).toBe('invalid_payload');

    // Verify all 5 are covered
    const covered = new Set<string>();
    covered.add('rejected'); covered.add('conflict'); covered.add('manual_review');
    covered.add('timeout'); covered.add('invalid_payload');
    expect(covered.size).toBe(failureStates.length);
  });
});

// ── Factory and class API ─────────────────────────────────────────────────────

describe('factory and class API', () => {
  it('createEdoAdapterEmulator returns an EdoAdapterEmulator instance', () => {
    expect(createEdoAdapterEmulator()).toBeInstanceOf(EdoAdapterEmulator);
  });

  it('reset clears the ledger', () => {
    const emu = createEdoAdapterEmulator(BASE_CONFIG);
    emu.emit('document_draft_created', 'corr-reset-1', DEAL_PAYLOAD);
    expect(emu.getLedger()).toHaveLength(1);
    emu.reset();
    expect(emu.getLedger()).toHaveLength(0);
  });

  it('getLedger returns readonly snapshot', () => {
    const emu = createEdoAdapterEmulator(BASE_CONFIG);
    emu.emit('document_draft_created', 'corr-snap-1', DEAL_PAYLOAD);
    const snap = emu.getLedger();
    expect(snap).toHaveLength(1);
    (snap as EdoAdapterEmulatorEvent[]).pop();
    expect(emu.getLedger()).toHaveLength(1);
  });

  it('constructor accepts no arguments (default config)', () => {
    const emu = new EdoAdapterEmulator();
    const event = emu.emit('document_draft_created', 'corr-noarg-1', DEAL_PAYLOAD);
    expect(event.maturity).toBe('pre-integration');
    expect(event.source).toBe('edo_emulator');
  });
});
