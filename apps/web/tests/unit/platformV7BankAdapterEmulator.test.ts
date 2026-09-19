import { describe, it, expect } from 'vitest';
import {
  createBankAdapterEmulator,
  BankAdapterEmulator,
  type BankAdapterEmulatorEvent,
  type BankEventType,
} from '../../lib/platform-v7/bank-adapter-emulator';

const FIXED_NOW = '2026-05-26T10:00:00.000Z';
const DEAL_PAYLOAD = { dealId: 'DL-9102', amount: 100_000, currency: 'RUB' };
const BASE_CONFIG = { fixedNow: FIXED_NOW };

// ── Determinism ───────────────────────────────────────────────────────────────

describe('determinism', () => {
  it('same config + correlationId produces identical events', () => {
    const a = createBankAdapterEmulator(BASE_CONFIG);
    const b = createBankAdapterEmulator(BASE_CONFIG);
    expect(a.emit('reserve_requested', 'corr-det-1', DEAL_PAYLOAD)).toEqual(
      b.emit('reserve_requested', 'corr-det-1', DEAL_PAYLOAD),
    );
  });

  it('receivedAt is fixed when fixedNow is provided', () => {
    const emu = createBankAdapterEmulator(BASE_CONFIG);
    const event = emu.emit('hold_created', 'corr-det-2', DEAL_PAYLOAD);
    expect(event.receivedAt).toBe(FIXED_NOW);
  });

  it('source is always bank_emulator', () => {
    const emu = createBankAdapterEmulator(BASE_CONFIG);
    expect(emu.emit('reserve_requested', 'corr-det-3', DEAL_PAYLOAD).source).toBe('bank_emulator');
  });
});

// ── Maturity claim ────────────────────────────────────────────────────────────

describe('maturity: pre-integration', () => {
  it('every emitted event has maturity pre-integration', () => {
    const emu = createBankAdapterEmulator(BASE_CONFIG);
    const types: BankEventType[] = [
      'reserve_requested',
      'hold_created',
      'hold_released',
      'release_requested',
      'manual_review',
      'reconciliation_mismatch',
    ];
    for (const type of types) {
      emu.reset();
      expect(emu.emit(type, `corr-mat-${type}`, DEAL_PAYLOAD).maturity).toBe('pre-integration');
    }
  });

  it('source is bank_emulator, not live_bank or bank', () => {
    const emu = createBankAdapterEmulator(BASE_CONFIG);
    const event = emu.emit('reserve_requested', 'corr-src-1', DEAL_PAYLOAD);
    expect(event.source).toBe('bank_emulator');
    expect(event.source).not.toBe('bank');
    expect(event.source).not.toBe('live_bank');
  });
});

// ── Idempotency ───────────────────────────────────────────────────────────────

describe('idempotency', () => {
  it('same (eventType, correlationId) returns the same object reference', () => {
    const emu = createBankAdapterEmulator(BASE_CONFIG);
    const first = emu.emit('reserve_requested', 'corr-idem-1', DEAL_PAYLOAD);
    const second = emu.emit('reserve_requested', 'corr-idem-1', DEAL_PAYLOAD);
    expect(first).toBe(second);
  });

  it('duplicate call does not grow the ledger', () => {
    const emu = createBankAdapterEmulator(BASE_CONFIG);
    emu.emit('hold_created', 'corr-idem-2', DEAL_PAYLOAD);
    emu.emit('hold_created', 'corr-idem-2', DEAL_PAYLOAD);
    expect(emu.getLedger()).toHaveLength(1);
  });

  it('different correlationIds produce separate entries', () => {
    const emu = createBankAdapterEmulator(BASE_CONFIG);
    emu.emit('reserve_requested', 'corr-idem-3a', DEAL_PAYLOAD);
    emu.emit('reserve_requested', 'corr-idem-3b', DEAL_PAYLOAD);
    expect(emu.getLedger()).toHaveLength(2);
  });
});

// ── State machine: confirmation requires prior request ────────────────────────

describe('correlation state machine', () => {
  it('reserve_confirmed without prior reserve_requested → invalid_payload', () => {
    const emu = createBankAdapterEmulator(BASE_CONFIG);
    const event = emu.emit('reserve_confirmed', 'corr-sm-1', DEAL_PAYLOAD);
    expect(event.externalStatus).toBe('invalid_payload');
  });

  it('reserve_confirmed after reserve_requested → reserve_confirmed', () => {
    const emu = createBankAdapterEmulator(BASE_CONFIG);
    emu.emit('reserve_requested', 'corr-sm-2', DEAL_PAYLOAD);
    const event = emu.emit('reserve_confirmed', 'corr-sm-2', DEAL_PAYLOAD);
    expect(event.externalStatus).toBe('reserve_confirmed');
  });

  it('release_confirmed without prior release_requested → invalid_payload', () => {
    const emu = createBankAdapterEmulator(BASE_CONFIG);
    const event = emu.emit('release_confirmed', 'corr-sm-3', DEAL_PAYLOAD);
    expect(event.externalStatus).toBe('invalid_payload');
  });

  it('release_confirmed after release_requested → release_confirmed', () => {
    const emu = createBankAdapterEmulator(BASE_CONFIG);
    emu.emit('release_requested', 'corr-sm-4', DEAL_PAYLOAD);
    const event = emu.emit('release_confirmed', 'corr-sm-4', DEAL_PAYLOAD);
    expect(event.externalStatus).toBe('release_confirmed');
  });

  it('refund_confirmed without prior refund_requested → invalid_payload', () => {
    const emu = createBankAdapterEmulator(BASE_CONFIG);
    const event = emu.emit('refund_confirmed', 'corr-sm-5', DEAL_PAYLOAD);
    expect(event.externalStatus).toBe('invalid_payload');
  });

  it('refund_confirmed after refund_requested → refund_confirmed', () => {
    const emu = createBankAdapterEmulator(BASE_CONFIG);
    emu.emit('refund_requested', 'corr-sm-6', DEAL_PAYLOAD);
    const event = emu.emit('refund_confirmed', 'corr-sm-6', DEAL_PAYLOAD);
    expect(event.externalStatus).toBe('refund_confirmed');
  });

  it('request events emit without prior state', () => {
    const emu = createBankAdapterEmulator(BASE_CONFIG);
    expect(emu.emit('reserve_requested', 'corr-sm-7', DEAL_PAYLOAD).externalStatus).toBe('reserve_requested');
    expect(emu.emit('hold_created', 'corr-sm-8', DEAL_PAYLOAD).externalStatus).toBe('hold_created');
    expect(emu.emit('hold_released', 'corr-sm-9', DEAL_PAYLOAD).externalStatus).toBe('hold_released');
    expect(emu.emit('release_requested', 'corr-sm-10', DEAL_PAYLOAD).externalStatus).toBe('release_requested');
    expect(emu.emit('refund_requested', 'corr-sm-11', DEAL_PAYLOAD).externalStatus).toBe('refund_requested');
  });
});

// ── Invalid payload ───────────────────────────────────────────────────────────

describe('invalid_payload', () => {
  it('unknown correlationId for confirmed event → invalid_payload', () => {
    const emu = createBankAdapterEmulator(BASE_CONFIG);
    const event = emu.emit('release_confirmed', 'completely-unknown-corr', DEAL_PAYLOAD);
    expect(event.externalStatus).toBe('invalid_payload');
  });
});

// ── Failure states ────────────────────────────────────────────────────────────

describe('failure states via config overrides', () => {
  it('produces manual_review', () => {
    const emu = createBankAdapterEmulator({
      fixedNow: FIXED_NOW,
      manualReviewCorrelationIds: ['corr-fail-manual'],
    });
    expect(emu.emit('reserve_requested', 'corr-fail-manual', DEAL_PAYLOAD).externalStatus).toBe('manual_review');
  });

  it('produces reconciliation_mismatch', () => {
    const emu = createBankAdapterEmulator({
      fixedNow: FIXED_NOW,
      reconciliationMismatchCorrelationIds: ['corr-fail-recon'],
    });
    expect(emu.emit('release_confirmed', 'corr-fail-recon', DEAL_PAYLOAD).externalStatus).toBe('reconciliation_mismatch');
  });

  it('produces timeout', () => {
    const emu = createBankAdapterEmulator({
      fixedNow: FIXED_NOW,
      timeoutCorrelationIds: ['corr-fail-timeout'],
    });
    expect(emu.emit('reserve_requested', 'corr-fail-timeout', DEAL_PAYLOAD).externalStatus).toBe('timeout');
  });

  it('produces rejected', () => {
    const emu = createBankAdapterEmulator({
      fixedNow: FIXED_NOW,
      rejectedCorrelationIds: ['corr-fail-rejected'],
    });
    expect(emu.emit('reserve_requested', 'corr-fail-rejected', DEAL_PAYLOAD).externalStatus).toBe('rejected');
  });

  it('produces conflict', () => {
    const emu = createBankAdapterEmulator({
      fixedNow: FIXED_NOW,
      conflictCorrelationIds: ['corr-fail-conflict'],
    });
    expect(emu.emit('hold_created', 'corr-fail-conflict', DEAL_PAYLOAD).externalStatus).toBe('conflict');
  });
});

// ── Money rule ────────────────────────────────────────────────────────────────

describe('money rule: platform does not release money independently', () => {
  it('release_confirmed event source is bank_emulator, not platform', () => {
    const emu = createBankAdapterEmulator(BASE_CONFIG);
    emu.emit('release_requested', 'corr-money-1', DEAL_PAYLOAD);
    const event = emu.emit('release_confirmed', 'corr-money-1', DEAL_PAYLOAD);
    // Bank confirmed the release — the platform did not release money itself
    expect(event.externalStatus).toBe('release_confirmed');
    expect(event.source).toBe('bank_emulator');
    expect(event.maturity).toBe('pre-integration');
  });

  it('serialized event does not contain forbidden money-release claims', () => {
    const emu = createBankAdapterEmulator(BASE_CONFIG);
    emu.emit('release_requested', 'corr-money-2', DEAL_PAYLOAD);
    const event = emu.emit('release_confirmed', 'corr-money-2', DEAL_PAYLOAD);
    const json = JSON.stringify(event);
    expect(json).not.toMatch(/платформа.*выпускает/i);
    expect(json).not.toMatch(/platform.*releases.*money/i);
    expect(json).not.toMatch(/гарантирует оплату/i);
    expect(json).not.toMatch(/bank.*connected/i);
  });

  it('all ledger events carry maturity pre-integration', () => {
    const emu = createBankAdapterEmulator(BASE_CONFIG);
    emu.emit('reserve_requested', 'corr-money-3', DEAL_PAYLOAD);
    emu.emit('hold_created', 'corr-money-4', DEAL_PAYLOAD);
    emu.emit('manual_review', 'corr-money-5', DEAL_PAYLOAD);
    for (const ev of emu.getLedger()) {
      expect(ev.maturity).toBe('pre-integration');
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
      createBankAdapterEmulator(BASE_CONFIG);
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
      const emu = createBankAdapterEmulator(BASE_CONFIG);
      emu.emit('reserve_requested', 'corr-net-1', DEAL_PAYLOAD);
    } finally {
      globalThis.fetch = originalFetch;
    }
    expect(called).toBe(false);
  });
});

// ── All required event types ──────────────────────────────────────────────────

describe('all required event types', () => {
  it('covers the full required event type set', () => {
    const emu = createBankAdapterEmulator(BASE_CONFIG);
    // Emit request events directly
    expect(emu.emit('reserve_requested', 'full-1', DEAL_PAYLOAD).externalStatus).toBe('reserve_requested');
    expect(emu.emit('reserve_confirmed', 'full-1', DEAL_PAYLOAD).externalStatus).toBe('reserve_confirmed');
    expect(emu.emit('hold_created', 'full-2', DEAL_PAYLOAD).externalStatus).toBe('hold_created');
    expect(emu.emit('hold_released', 'full-3', DEAL_PAYLOAD).externalStatus).toBe('hold_released');
    expect(emu.emit('release_requested', 'full-4', DEAL_PAYLOAD).externalStatus).toBe('release_requested');
    expect(emu.emit('release_confirmed', 'full-4', DEAL_PAYLOAD).externalStatus).toBe('release_confirmed');
    expect(emu.emit('refund_requested', 'full-5', DEAL_PAYLOAD).externalStatus).toBe('refund_requested');
    expect(emu.emit('refund_confirmed', 'full-5', DEAL_PAYLOAD).externalStatus).toBe('refund_confirmed');
    expect(emu.emit('manual_review', 'full-6', DEAL_PAYLOAD).externalStatus).toBe('manual_review');
    expect(emu.emit('reconciliation_mismatch', 'full-7', DEAL_PAYLOAD).externalStatus).toBe('reconciliation_mismatch');
  });

  it('all events have required envelope fields', () => {
    const emu = createBankAdapterEmulator(BASE_CONFIG);
    const event = emu.emit('reserve_requested', 'full-env-1', DEAL_PAYLOAD);
    expect(event).toMatchObject({
      source: 'bank_emulator',
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
  it('createBankAdapterEmulator returns a BankAdapterEmulator instance', () => {
    expect(createBankAdapterEmulator()).toBeInstanceOf(BankAdapterEmulator);
  });

  it('reset clears the ledger', () => {
    const emu = createBankAdapterEmulator(BASE_CONFIG);
    emu.emit('reserve_requested', 'corr-reset-1', DEAL_PAYLOAD);
    expect(emu.getLedger()).toHaveLength(1);
    emu.reset();
    expect(emu.getLedger()).toHaveLength(0);
  });

  it('getLedger returns readonly snapshot', () => {
    const emu = createBankAdapterEmulator(BASE_CONFIG);
    emu.emit('hold_created', 'corr-snap-1', DEAL_PAYLOAD);
    const snap = emu.getLedger();
    expect(snap).toHaveLength(1);
    // Modifying snapshot does not affect emulator
    (snap as BankAdapterEmulatorEvent[]).pop();
    expect(emu.getLedger()).toHaveLength(1);
  });
});
