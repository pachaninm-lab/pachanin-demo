import type { Dispute } from './disputes.service';

/**
 * Injection token for the dispute data-access boundary.
 *
 * Controlled-pilot / pre-integration: default is the in-memory runtime adapter
 * that owns the dispute store. The DB-backed (Prisma) adapter is a disabled
 * skeleton selected only under the explicit PLATFORM_V7_DISPUTE_REPOSITORY=prisma
 * flag. No silent Prisma activation, no silent fallback.
 *
 * Money safety: this boundary abstracts dispute DATA ACCESS only. All money
 * logic (money holds, decision money instructions) stays in DisputesService and
 * is never moved into a repository adapter.
 */
export const DISPUTE_REPOSITORY = 'DISPUTE_REPOSITORY';

/**
 * Repository boundary for dispute storage. Abstracts how disputes are read and
 * appended away from DisputesService.
 *
 * `list()` is async so a future DB-backed adapter can resolve over the wire;
 * `getById()`/`add()` stay synchronous because the in-memory store returns a
 * live object reference that the service mutates in place (triage, evidence,
 * decision). The disabled Prisma adapter supports only the `list()` read
 * snapshot and fails loud on the mutation-bearing getById/add — the DB-backed
 * mutation path is not active.
 */
export interface DisputeRepository {
  list(): Promise<Dispute[]>;
  getById(id: string): Dispute | undefined;
  add(dispute: Dispute): void;
}
