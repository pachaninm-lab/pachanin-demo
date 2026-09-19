import type {
  FgisLegacyQuarantineAuditService,
  FgisQuarantineAuditFact,
  FgisQuarantineAuditReceipt,
} from './fgis-grain-legacy-quarantine.audit';
import { FgisQuarantineAuditUnavailableError } from './fgis-grain-legacy-quarantine.audit';

/**
 * Test double for the durable quarantine audit.
 *
 * Records every fact it is asked to commit so a suite can assert on what was
 * written — and, just as importantly, on what was not: no request body, no
 * headers, no credentials. Set `unavailable` to simulate PostgreSQL being
 * unreachable and prove the callers fail closed.
 */
export class RecordingFgisQuarantineAudit {
  readonly facts: FgisQuarantineAuditFact[] = [];
  unavailable = false;

  async recordDenial(fact: FgisQuarantineAuditFact): Promise<FgisQuarantineAuditReceipt> {
    if (this.unavailable) {
      throw new FgisQuarantineAuditUnavailableError(fact.correlationId);
    }
    this.facts.push(fact);
    return {
      auditEventId: `fgis-quarantine-audit-${this.facts.length}`,
      correlationId: fact.correlationId,
      outcome: 'DENIED',
      boundary: 'LEGACY_FGIS_QUARANTINE',
    };
  }

  get last(): FgisQuarantineAuditFact {
    const fact = this.facts[this.facts.length - 1];
    if (!fact) throw new Error('no denial was recorded');
    return fact;
  }

  asService(): FgisLegacyQuarantineAuditService {
    return this as unknown as FgisLegacyQuarantineAuditService;
  }
}

/** Serialised form of every recorded fact, for leak assertions. */
export function recordedMaterial(audit: RecordingFgisQuarantineAudit): string {
  return JSON.stringify(audit.facts);
}
