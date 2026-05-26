/**
 * EDO Adapter Emulator — pre-integration controlled-pilot layer.
 *
 * Models legally significant document exchange lifecycle events without live
 * EDO connectivity. Document status affects deal readiness only through
 * explicit status and blocker mapping — not through live system calls.
 *
 * Maturity: pre-integration. No live EDO, bank, FGIS or EPD connection.
 */

// ── Event types ──────────────────────────────────────────────────────────────

export type EdoEventType =
  | 'document_draft_created'
  | 'document_sent'
  | 'document_signed_by_one_side'
  | 'document_signed_by_all_sides'
  | 'document_rejected'
  | 'document_revoked'
  | 'manual_review';

export type EdoFailureState =
  | 'rejected'
  | 'conflict'
  | 'manual_review'
  | 'timeout'
  | 'invalid_payload';

export type EdoEmulatorStatus = EdoEventType | EdoFailureState;

// ── Event envelope ────────────────────────────────────────────────────────────

export interface EdoEventPayload {
  readonly dealId: string;
  readonly documentId?: string;
  readonly documentType?: string;
  readonly reason?: string;
}

export interface EdoAdapterEmulatorEvent {
  readonly source: 'edo_emulator';
  readonly receivedAt: string;
  readonly correlationId: string;
  readonly externalStatus: EdoEmulatorStatus;
  readonly maturity: 'pre-integration';
  readonly payload: EdoEventPayload;
}

// ── Configuration ─────────────────────────────────────────────────────────────

export interface EdoAdapterEmulatorConfig {
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

// Document lifecycle: each step requires the previous one for the same correlationId.
const REQUIRES_PRIOR: Readonly<Partial<Record<EdoEventType, EdoEventType>>> = {
  document_sent: 'document_draft_created',
  document_signed_by_one_side: 'document_sent',
  document_signed_by_all_sides: 'document_signed_by_one_side',
  document_rejected: 'document_sent',
  document_revoked: 'document_sent',
};

// ── Emulator ──────────────────────────────────────────────────────────────────

export class EdoAdapterEmulator {
  private readonly config: EdoAdapterEmulatorConfig;
  /**
   * Ledger key: `${eventType}:${correlationId}` → recorded event.
   * Ensures idempotency: same (type, correlationId) always returns the same result.
   */
  private readonly ledger: Map<string, EdoAdapterEmulatorEvent>;

  constructor(config: EdoAdapterEmulatorConfig = {}) {
    this.config = config;
    this.ledger = new Map();
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private now(): string {
    return this.config.fixedNow ?? new Date().toISOString();
  }

  private buildEvent(
    correlationId: string,
    externalStatus: EdoEmulatorStatus,
    payload: EdoEventPayload,
  ): EdoAdapterEmulatorEvent {
    return {
      source: 'edo_emulator',
      receivedAt: this.now(),
      correlationId,
      externalStatus,
      maturity: 'pre-integration',
      payload,
    } satisfies EdoAdapterEmulatorEvent;
  }

  private getOverride(correlationId: string): EdoEmulatorStatus | null {
    if (this.config.manualReviewCorrelationIds?.includes(correlationId)) return 'manual_review';
    if (this.config.timeoutCorrelationIds?.includes(correlationId)) return 'timeout';
    if (this.config.rejectedCorrelationIds?.includes(correlationId)) return 'rejected';
    if (this.config.conflictCorrelationIds?.includes(correlationId)) return 'conflict';
    return null;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Emit an EDO document lifecycle event.
   *
   * Rules:
   * - Idempotent: same (eventType, correlationId) returns the previously recorded event.
   * - Override config takes precedence over state-machine checks.
   * - Lifecycle events that require a prior step return invalid_payload if prior is absent.
   */
  emit(
    eventType: EdoEventType,
    correlationId: string,
    payload: EdoEventPayload,
  ): EdoAdapterEmulatorEvent {
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
  getLedger(): readonly EdoAdapterEmulatorEvent[] {
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
export function createEdoAdapterEmulator(
  config?: EdoAdapterEmulatorConfig,
): EdoAdapterEmulator {
  return new EdoAdapterEmulator(config);
}
