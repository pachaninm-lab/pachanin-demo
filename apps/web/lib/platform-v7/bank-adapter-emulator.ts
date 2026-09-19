/**
 * Bank Adapter Emulator — pre-integration controlled-pilot layer.
 *
 * Models bank-side reserve/hold/release/refund/reconciliation events without
 * live bank connectivity. The platform does not release money independently;
 * release_confirmed means the bank confirmed the release, not that the platform
 * released funds on its own.
 *
 * Maturity: pre-integration. No live bank, FGIS, EDO or EPD connection.
 */

// ── Event types ──────────────────────────────────────────────────────────────

export type BankEventType =
  | 'reserve_requested'
  | 'reserve_confirmed'
  | 'hold_created'
  | 'hold_released'
  | 'release_requested'
  | 'release_confirmed'
  | 'refund_requested'
  | 'refund_confirmed'
  | 'manual_review'
  | 'reconciliation_mismatch';

export type BankFailureState =
  | 'rejected'
  | 'conflict'
  | 'manual_review'
  | 'timeout'
  | 'invalid_payload';

export type BankEmulatorStatus = BankEventType | BankFailureState;

// ── Event envelope ────────────────────────────────────────────────────────────

export interface BankEventPayload {
  readonly dealId: string;
  readonly amount?: number;
  readonly currency?: string;
  readonly reason?: string;
}

export interface BankAdapterEmulatorEvent {
  readonly source: 'bank_emulator';
  readonly receivedAt: string;
  readonly correlationId: string;
  readonly externalStatus: BankEmulatorStatus;
  readonly maturity: 'pre-integration';
  readonly payload: BankEventPayload;
}

// ── Configuration ─────────────────────────────────────────────────────────────

export interface BankAdapterEmulatorConfig {
  /** Fixed ISO timestamp used for determinism in tests. Defaults to Date.now(). */
  readonly fixedNow?: string;
  /** Correlation IDs that should produce manual_review failure state. */
  readonly manualReviewCorrelationIds?: readonly string[];
  /** Correlation IDs that should produce reconciliation_mismatch event. */
  readonly reconciliationMismatchCorrelationIds?: readonly string[];
  /** Correlation IDs that should produce timeout failure state. */
  readonly timeoutCorrelationIds?: readonly string[];
  /** Correlation IDs that should produce rejected failure state. */
  readonly rejectedCorrelationIds?: readonly string[];
  /** Correlation IDs that should produce conflict failure state. */
  readonly conflictCorrelationIds?: readonly string[];
}

// ── State-machine helpers ─────────────────────────────────────────────────────

// Events that require a prior "request" event with the same correlationId.
const CONFIRMATION_REQUIRES: Readonly<Partial<Record<BankEventType, BankEventType>>> = {
  reserve_confirmed: 'reserve_requested',
  release_confirmed: 'release_requested',
  refund_confirmed: 'refund_requested',
};

// ── Emulator ──────────────────────────────────────────────────────────────────

export class BankAdapterEmulator {
  private readonly config: BankAdapterEmulatorConfig;
  /**
   * Ledger key: `${eventType}:${correlationId}` → recorded event.
   * Enables idempotency: same (type, correlationId) pair always returns the
   * same event object.
   */
  private readonly ledger: Map<string, BankAdapterEmulatorEvent>;

  constructor(config: BankAdapterEmulatorConfig = {}) {
    this.config = config;
    this.ledger = new Map();
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private now(): string {
    return this.config.fixedNow ?? new Date().toISOString();
  }

  private buildEvent(
    correlationId: string,
    externalStatus: BankEmulatorStatus,
    payload: BankEventPayload,
  ): BankAdapterEmulatorEvent {
    return {
      source: 'bank_emulator',
      receivedAt: this.now(),
      correlationId,
      externalStatus,
      maturity: 'pre-integration',
      payload,
    } satisfies BankAdapterEmulatorEvent;
  }

  /**
   * Returns a forced override status for the given correlationId, or null if no
   * override is configured.
   */
  private getOverride(correlationId: string): BankEmulatorStatus | null {
    if (this.config.manualReviewCorrelationIds?.includes(correlationId)) return 'manual_review';
    if (this.config.reconciliationMismatchCorrelationIds?.includes(correlationId)) return 'reconciliation_mismatch';
    if (this.config.timeoutCorrelationIds?.includes(correlationId)) return 'timeout';
    if (this.config.rejectedCorrelationIds?.includes(correlationId)) return 'rejected';
    if (this.config.conflictCorrelationIds?.includes(correlationId)) return 'conflict';
    return null;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Emit a bank event.
   *
   * Rules:
   * - Idempotent: same (eventType, correlationId) pair returns the previously
   *   recorded event without re-evaluating logic.
   * - Override config takes precedence over state-machine checks.
   * - Confirmation events (reserve_confirmed, release_confirmed, refund_confirmed)
   *   require a prior request event with the same correlationId; without it, the
   *   result is invalid_payload.
   */
  emit(
    eventType: BankEventType,
    correlationId: string,
    payload: BankEventPayload,
  ): BankAdapterEmulatorEvent {
    const ledgerKey = `${eventType}:${correlationId}`;

    // Idempotency: return existing result if already processed.
    const existing = this.ledger.get(ledgerKey);
    if (existing !== undefined) return existing;

    // Apply configured overrides (deterministic failure injection for tests).
    const override = this.getOverride(correlationId);
    if (override !== null) {
      const event = this.buildEvent(correlationId, override, payload);
      this.ledger.set(ledgerKey, event);
      return event;
    }

    // State-machine: confirmation events require a prior request.
    const requiredPrior = CONFIRMATION_REQUIRES[eventType];
    if (requiredPrior !== undefined) {
      const priorKey = `${requiredPrior}:${correlationId}`;
      if (!this.ledger.has(priorKey)) {
        const event = this.buildEvent(correlationId, 'invalid_payload', payload);
        this.ledger.set(ledgerKey, event);
        return event;
      }
    }

    // Emit as requested.
    const event = this.buildEvent(correlationId, eventType, payload);
    this.ledger.set(ledgerKey, event);
    return event;
  }

  /**
   * Returns a snapshot of all recorded events for audit / test inspection.
   * Order is insertion order of the ledger.
   */
  getLedger(): readonly BankAdapterEmulatorEvent[] {
    return [...this.ledger.values()];
  }

  /**
   * Clears the emulator state. Use only between isolated test cases.
   */
  reset(): void {
    this.ledger.clear();
  }
}

/**
 * Factory function for dependency injection — preferred over `new` in
 * application code that does not want to import the class directly.
 */
export function createBankAdapterEmulator(
  config?: BankAdapterEmulatorConfig,
): BankAdapterEmulator {
  return new BankAdapterEmulator(config);
}
