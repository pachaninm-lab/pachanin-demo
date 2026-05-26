/**
 * EPD / Logistics Adapter Emulator — pre-integration controlled-pilot layer.
 *
 * Models transport document and logistics event exchange without live EPD
 * or logistics system connectivity. Logistics events must not override
 * evidence, quality, document or bank gates without explicit domain rules.
 *
 * Maturity: pre-integration. No live EDO, bank, FGIS, EPD or logistics connection.
 */

// ── Event types ──────────────────────────────────────────────────────────────

export type EpdEventType =
  | 'epd_draft_created'
  | 'epd_sent'
  | 'epd_confirmed'
  | 'epd_rejected'
  | 'trip_event_received'
  | 'route_deviation_received'
  | 'arrival_confirmed'
  | 'manual_review';

export type EpdFailureState =
  | 'rejected'
  | 'conflict'
  | 'manual_review'
  | 'timeout'
  | 'invalid_payload';

export type EpdEmulatorStatus = EpdEventType | EpdFailureState;

// ── Event envelope ────────────────────────────────────────────────────────────

export interface EpdEventPayload {
  readonly dealId: string;
  readonly tripId?: string;
  readonly documentId?: string;
  readonly reason?: string;
}

export interface EpdAdapterEmulatorEvent {
  readonly source: 'epd_emulator';
  readonly receivedAt: string;
  readonly correlationId: string;
  readonly externalStatus: EpdEmulatorStatus;
  readonly maturity: 'pre-integration';
  readonly payload: EpdEventPayload;
}

// ── Configuration ─────────────────────────────────────────────────────────────

export interface EpdAdapterEmulatorConfig {
  /** Fixed ISO timestamp for determinism in tests. Defaults to Date.now(). */
  readonly fixedNow?: string;
  /** Correlation IDs that should produce manual_review failure state. */
  readonly manualReviewCorrelationIds?: readonly string[];
  /** Correlation IDs that should produce timeout failure state. */
  readonly timeoutCorrelationIds?: readonly string[];
  /** Correlation IDs that should produce rejected failure state. */
  readonly rejectedCorrelationIds?: readonly string[];
  /** Correlation IDs that should produce conflict failure state. */
  readonly conflictCorrelationIds?: readonly string[];
}

// ── State machine ─────────────────────────────────────────────────────────────

// EPD/logistics lifecycle: each step requires the previous one for the same correlationId.
const REQUIRES_PRIOR: Readonly<Partial<Record<EpdEventType, EpdEventType>>> = {
  epd_sent: 'epd_draft_created',
  epd_confirmed: 'epd_sent',
  epd_rejected: 'epd_sent',
  arrival_confirmed: 'trip_event_received',
};

// ── Emulator ──────────────────────────────────────────────────────────────────

export class EpdAdapterEmulator {
  private readonly config: EpdAdapterEmulatorConfig;
  /**
   * Ledger key: `${eventType}:${correlationId}` → recorded event.
   * Ensures idempotency: same (type, correlationId) always returns the same result.
   */
  private readonly ledger: Map<string, EpdAdapterEmulatorEvent>;

  constructor(config: EpdAdapterEmulatorConfig = {}) {
    this.config = config;
    this.ledger = new Map();
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private now(): string {
    return this.config.fixedNow ?? new Date().toISOString();
  }

  private buildEvent(
    correlationId: string,
    externalStatus: EpdEmulatorStatus,
    payload: EpdEventPayload,
  ): EpdAdapterEmulatorEvent {
    return {
      source: 'epd_emulator',
      receivedAt: this.now(),
      correlationId,
      externalStatus,
      maturity: 'pre-integration',
      payload,
    } satisfies EpdAdapterEmulatorEvent;
  }

  private getOverride(correlationId: string): EpdEmulatorStatus | null {
    if (this.config.manualReviewCorrelationIds?.includes(correlationId)) return 'manual_review';
    if (this.config.timeoutCorrelationIds?.includes(correlationId)) return 'timeout';
    if (this.config.rejectedCorrelationIds?.includes(correlationId)) return 'rejected';
    if (this.config.conflictCorrelationIds?.includes(correlationId)) return 'conflict';
    return null;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Emit an EPD / logistics event.
   *
   * Rules:
   * - Idempotent: same (eventType, correlationId) returns the previously recorded event.
   * - Override config takes precedence over state-machine checks.
   * - Lifecycle events that require a prior step return invalid_payload if prior is absent.
   */
  emit(
    eventType: EpdEventType,
    correlationId: string,
    payload: EpdEventPayload,
  ): EpdAdapterEmulatorEvent {
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
  getLedger(): readonly EpdAdapterEmulatorEvent[] {
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
export function createEpdAdapterEmulator(
  config?: EpdAdapterEmulatorConfig,
): EpdAdapterEmulator {
  return new EpdAdapterEmulator(config);
}
