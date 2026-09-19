/**
 * FGIS / SDIZ Adapter Emulator — pre-integration controlled-pilot layer.
 *
 * Models FGIS/SDIZ party traceability, SDIZ lifecycle and error/manual review
 * states without live FGIS connectivity. Hard rule enforced: FGIS/SDIZ status
 * affects deal readiness only through explicit status and blocker mapping — not
 * through live system calls.
 *
 * Maturity: pre-integration. No live FGIS, bank, EDO or EPD connection.
 */

// ── Event types ──────────────────────────────────────────────────────────────

export type FgisEventType =
  | 'party_link_requested'
  | 'party_linked'
  | 'sdiz_draft_created'
  | 'sdiz_ready_to_sign'
  | 'sdiz_signed'
  | 'sdiz_sent'
  | 'sdiz_redeemed'
  | 'sdiz_partially_redeemed'
  | 'sdiz_error'
  | 'manual_review';

export type FgisFailureState =
  | 'rejected'
  | 'conflict'
  | 'manual_review'
  | 'timeout'
  | 'invalid_payload';

export type FgisEmulatorStatus = FgisEventType | FgisFailureState;

// ── Event envelope ────────────────────────────────────────────────────────────

export interface FgisEventPayload {
  readonly dealId: string;
  readonly sdizId?: string;
  readonly partyInn?: string;
  readonly reason?: string;
}

export interface FgisAdapterEmulatorEvent {
  readonly source: 'fgis_emulator';
  readonly receivedAt: string;
  readonly correlationId: string;
  readonly externalStatus: FgisEmulatorStatus;
  readonly maturity: 'pre-integration';
  readonly payload: FgisEventPayload;
}

// ── Configuration ─────────────────────────────────────────────────────────────

export interface FgisAdapterEmulatorConfig {
  /** Fixed ISO timestamp for determinism in tests. Defaults to Date.now(). */
  readonly fixedNow?: string;
  /** Correlation IDs that should produce manual_review failure state. */
  readonly manualReviewCorrelationIds?: readonly string[];
  /** Correlation IDs that should produce sdiz_error event. */
  readonly sdizErrorCorrelationIds?: readonly string[];
  /** Correlation IDs that should produce timeout failure state. */
  readonly timeoutCorrelationIds?: readonly string[];
  /** Correlation IDs that should produce rejected failure state. */
  readonly rejectedCorrelationIds?: readonly string[];
  /** Correlation IDs that should produce conflict failure state. */
  readonly conflictCorrelationIds?: readonly string[];
}

// ── State machine ─────────────────────────────────────────────────────────────

// SDIZ lifecycle: each step requires the previous one for the same correlationId.
const REQUIRES_PRIOR: Readonly<Partial<Record<FgisEventType, FgisEventType>>> = {
  party_linked: 'party_link_requested',
  sdiz_ready_to_sign: 'sdiz_draft_created',
  sdiz_signed: 'sdiz_ready_to_sign',
  sdiz_sent: 'sdiz_signed',
  sdiz_redeemed: 'sdiz_sent',
  sdiz_partially_redeemed: 'sdiz_sent',
};

// ── Emulator ──────────────────────────────────────────────────────────────────

export class FgisAdapterEmulator {
  private readonly config: FgisAdapterEmulatorConfig;
  /**
   * Ledger key: `${eventType}:${correlationId}` → recorded event.
   * Ensures idempotency: same (type, correlationId) always returns the same result.
   */
  private readonly ledger: Map<string, FgisAdapterEmulatorEvent>;

  constructor(config: FgisAdapterEmulatorConfig = {}) {
    this.config = config;
    this.ledger = new Map();
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private now(): string {
    return this.config.fixedNow ?? new Date().toISOString();
  }

  private buildEvent(
    correlationId: string,
    externalStatus: FgisEmulatorStatus,
    payload: FgisEventPayload,
  ): FgisAdapterEmulatorEvent {
    return {
      source: 'fgis_emulator',
      receivedAt: this.now(),
      correlationId,
      externalStatus,
      maturity: 'pre-integration',
      payload,
    } satisfies FgisAdapterEmulatorEvent;
  }

  private getOverride(correlationId: string): FgisEmulatorStatus | null {
    if (this.config.manualReviewCorrelationIds?.includes(correlationId)) return 'manual_review';
    if (this.config.sdizErrorCorrelationIds?.includes(correlationId)) return 'sdiz_error';
    if (this.config.timeoutCorrelationIds?.includes(correlationId)) return 'timeout';
    if (this.config.rejectedCorrelationIds?.includes(correlationId)) return 'rejected';
    if (this.config.conflictCorrelationIds?.includes(correlationId)) return 'conflict';
    return null;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Emit a FGIS/SDIZ event.
   *
   * Rules:
   * - Idempotent: same (eventType, correlationId) returns the previously recorded event.
   * - Override config takes precedence over state-machine checks.
   * - Lifecycle events that require a prior step return invalid_payload if prior is absent.
   */
  emit(
    eventType: FgisEventType,
    correlationId: string,
    payload: FgisEventPayload,
  ): FgisAdapterEmulatorEvent {
    const ledgerKey = `${eventType}:${correlationId}`;

    const existing = this.ledger.get(ledgerKey);
    if (existing !== undefined) return existing;

    const override = this.getOverride(correlationId);
    if (override !== null) {
      const event = this.buildEvent(correlationId, override, payload);
      this.ledger.set(ledgerKey, event);
      return event;
    }

    const requiredPrior = REQUIRES_PRIOR[eventType];
    if (requiredPrior !== undefined) {
      const priorKey = `${requiredPrior}:${correlationId}`;
      if (!this.ledger.has(priorKey)) {
        const event = this.buildEvent(correlationId, 'invalid_payload', payload);
        this.ledger.set(ledgerKey, event);
        return event;
      }
    }

    const event = this.buildEvent(correlationId, eventType, payload);
    this.ledger.set(ledgerKey, event);
    return event;
  }

  /** Returns a snapshot of all recorded events for audit / test inspection. */
  getLedger(): readonly FgisAdapterEmulatorEvent[] {
    return [...this.ledger.values()];
  }

  /** Clears the emulator state. Use only between isolated test cases. */
  reset(): void {
    this.ledger.clear();
  }
}

/**
 * Factory function for dependency injection.
 */
export function createFgisAdapterEmulator(
  config?: FgisAdapterEmulatorConfig,
): FgisAdapterEmulator {
  return new FgisAdapterEmulator(config);
}
