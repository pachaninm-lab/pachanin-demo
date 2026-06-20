/**
 * RuntimeCore decomposition — Step 2: CompletenessChecker.
 *
 * Pure document-completeness computation extracted verbatim from
 * RuntimeCoreService. Stateless and source-agnostic: it operates only on the
 * documents passed in, so it does not reach into RuntimeCore's in-memory store.
 * This keeps the engine ready to run over a DB-backed document source later
 * (scaling target) without a rewrite. Behavior is unchanged — required types,
 * "present" statuses, missing set and completion rate match the previous inline
 * logic. Controlled-pilot / pre-integration.
 */

/** Document types required before a deal is bank/release complete. */
export const REQUIRED_DOC_TYPES = [
  'contract',
  'transport_waybill',
  'quality_certificate',
  'acceptance_act',
];

/** Document statuses that count a required type as present. */
export const PRESENT_DOC_STATUSES = ['SIGNED', 'GENERATED', 'UPLOADED'];

export interface DocumentCompleteness {
  dealId: string;
  required: string[];
  missing: string[];
  isComplete: boolean;
  bankRequiredMissing: string[];
  releaseRequiredMissing: string[];
  completionRate: number;
}

/**
 * Stateless completeness engine. Safe to instantiate once and reuse; holds no
 * state and performs no side effects.
 */
export class RuntimeCompletenessChecker {
  /** The required document types (fresh array per call — callers may filter it). */
  requiredDocTypes(): string[] {
    return [...REQUIRED_DOC_TYPES];
  }

  /**
   * Computes completeness for a deal from its documents. `docs` must already be
   * scoped to the deal — the engine does not filter by dealId itself.
   */
  completeness(dealId: string, docs: any[]): DocumentCompleteness {
    const required = this.requiredDocTypes();
    const present = new Set(
      docs
        .filter((doc) => PRESENT_DOC_STATUSES.includes(doc.status))
        .map((doc) => doc.type),
    );
    const missing = required.filter((type) => !present.has(type));
    return {
      dealId,
      required,
      missing,
      isComplete: missing.length === 0,
      bankRequiredMissing: missing,
      releaseRequiredMissing: missing,
      completionRate: Math.round(((required.length - missing.length) / required.length) * 100),
    };
  }
}
