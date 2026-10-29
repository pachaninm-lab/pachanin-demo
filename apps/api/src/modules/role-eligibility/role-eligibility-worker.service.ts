import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RoleEligibilityEvidenceService } from './role-eligibility-evidence.service';
import { RoleEligibilityPolicy } from './role-eligibility-policy';
import { RoleEligibilityRepository } from './role-eligibility.repository';
import { RoleEligibilityWorkerRepository } from './role-eligibility-worker.repository';
import { sourceManifestHash } from './role-eligibility-security';
import type {
  EligibilityCheck,
  EligibilitySource,
  EligibilityVerdict,
  SemanticEligibilityRole,
  SourceHealthSnapshot,
  SourceHealthStatus,
  SourceManifestEntry,
} from './role-eligibility.types';

const RECHECK_MS: Readonly<Record<SemanticEligibilityRole, number | null>> = Object.freeze({
  FARMER: 7 * 24 * 60 * 60 * 1000,
  BUYER: 7 * 24 * 60 * 60 * 1000,
  LOGISTICS: 7 * 24 * 60 * 60 * 1000,
  ELEVATOR: 7 * 24 * 60 * 60 * 1000,
  LABORATORY: 24 * 60 * 60 * 1000,
  SURVEYOR: 7 * 24 * 60 * 60 * 1000,
  BANK: 24 * 60 * 60 * 1000,
  DRIVER: null,
  EMPLOYEE: null,
});

function terminal(status: EligibilityCheck['status']): boolean {
  return !['PENDING', 'CHECKING'].includes(status);
}

function safeErrorCode(error: unknown): string {
  return (error instanceof Error ? error.message : String(error || 'ROLE_ELIGIBILITY_INTERNAL_ERROR'))
    .toUpperCase().replace(/[^A-Z0-9_:-]/g, '_').slice(0, 120) || 'ROLE_ELIGIBILITY_INTERNAL_ERROR';
}

/**
 * A failed refresh must not discard a previously validated ACTIVE generation
 * while that generation is still inside its source-specific freshness window.
 * The health endpoint still reports the real external failure; only policy
 * evaluation is allowed to use the fresh cached authority in DEGRADED mode.
 */
export function eligibilityEvaluationSourceState(
  row: Pick<SourceHealthSnapshot, 'status' | 'activeGeneration' | 'freshUntil'>,
  nowMs = Date.now(),
): SourceHealthStatus {
  if (row.freshUntil && row.freshUntil.getTime() <= nowMs) return 'STALE';
  const freshActive = Boolean(row.activeGeneration && row.freshUntil && row.freshUntil.getTime() > nowMs);
  if (freshActive && ['DEGRADED', 'UNAVAILABLE', 'SCHEMA_CHANGED'].includes(row.status)) return 'DEGRADED';
  if (!row.activeGeneration && row.status === 'DEGRADED') return 'UNAVAILABLE';
  return row.status;
}

@Injectable()
export class RoleEligibilityWorkerService {
  private readonly policy = new RoleEligibilityPolicy();

  constructor(
    private readonly repository: RoleEligibilityRepository,
    private readonly workerRepository: RoleEligibilityWorkerRepository,
    private readonly evidenceService: RoleEligibilityEvidenceService,
  ) {}

  async discover(limit = 250): Promise<number> {
    const fingerprint = await this.repository.activeGenerationFingerprint();
    const candidates = await this.workerRepository.listCandidates(limit);
    let newlyCreated = 0;
    const now = Date.now();
    for (const candidate of candidates) {
      const latest = await this.repository.latestCheck(candidate.applicationId);
      const scheduledDue = Boolean(
        latest
        && terminal(latest.status)
        && latest.nextRecheckAt
        && latest.nextRecheckAt.getTime() <= now,
      );
      const check = await this.repository.createOrGetCheck(
        candidate,
        this.policy.version,
        this.policy.hash,
        fingerprint,
        randomUUID(),
      );
      if (!latest || check.id !== latest.id) {
        newlyCreated += 1;
        continue;
      }

      // Same application version, role, policy and ACTIVE source generations
      // are the same authoritative input. A time-based recheck is therefore an
      // idempotent no-op until one of those inputs changes.
      if (scheduledDue) {
        try {
          const role = this.policy.resolveSemanticRole(candidate);
          const interval = RECHECK_MS[role];
          if (interval) await this.repository.setNextRecheckAt(check.id, new Date(now + interval));
        } catch {
          // Existing check remains authoritative; role mismatch is not turned
          // into a new logical result merely because the schedule elapsed.
        }
      }
    }
    return newlyCreated;
  }

  async recover(): Promise<number> {
    return this.workerRepository.recoverAbandonedChecking();
  }

  async processOne(): Promise<'EMPTY' | 'DONE'> {
    const check = await this.workerRepository.claimPending();
    if (!check) return 'EMPTY';
    const correlationId = check.correlationId || randomUUID();
    await this.repository.startCheck(check.id, correlationId);

    let collectedManifest: SourceManifestEntry[] = [];
    let semanticRole: SemanticEligibilityRole | null = null;
    try {
      const startCandidate = await this.repository.readCandidate(check.applicationId);
      if (!startCandidate
        || startCandidate.applicationVersion !== check.applicationVersion
        || startCandidate.requestedRole !== check.requestedRole
        || startCandidate.requestedWorkspace !== check.requestedWorkspace
        || startCandidate.applicationStatus !== check.applicationStatusAtStart) {
        await this.publish(check, 'SUPERSEDED', ['APPLICATION_CHANGED_BEFORE_EVALUATION'], [], correlationId, null);
        return 'DONE';
      }

      const healthRows = await this.repository.sourceHealth();
      const sourceStates: Partial<Record<EligibilitySource, SourceHealthStatus>> = {};
      const now = Date.now();
      for (const row of healthRows) {
        sourceStates[row.source] = eligibilityEvaluationSourceState(row, now);
      }

      try {
        semanticRole = this.policy.resolveSemanticRole(startCandidate);
      } catch {
        await this.publish(check, 'ERROR', ['REGISTRATION_ROLE_CONTRACT_MISMATCH'], [], correlationId, null);
        return 'DONE';
      }

      const collected = await this.evidenceService.collect(check, startCandidate, sourceStates);
      collectedManifest = collected.manifest;
      const decision = this.policy.evaluate({
        candidate: startCandidate,
        semanticRole,
        facts: collected.facts,
        sourceStates,
        evidenceSources: collected.evidenceSources,
      });

      // Mandatory race protection immediately before terminal publication.
      const beforePublish = await this.repository.readCandidate(check.applicationId);
      const superseded = !beforePublish
        || beforePublish.applicationVersion !== check.applicationVersion
        || beforePublish.requestedRole !== check.requestedRole
        || beforePublish.requestedWorkspace !== check.requestedWorkspace
        || beforePublish.applicationStatus !== startCandidate.applicationStatus;
      if (superseded) {
        await this.publish(check, 'SUPERSEDED', ['APPLICATION_CHANGED_DURING_EVALUATION'], collected.manifest, correlationId, null);
        return 'DONE';
      }

      await this.publish(check, decision.verdict, decision.reasonCodes, collected.manifest, correlationId, semanticRole);
      return 'DONE';
    } catch (error) {
      // Technical errors are terminal and deterministic when the bounded
      // registration authority is still the same. If it moved, history is
      // SUPERSEDED instead. A failure of this terminal transaction itself is
      // deliberately left CHECKING for bounded recovery.
      const current = await this.repository.readCandidate(check.applicationId).catch(() => null);
      const superseded = !current
        || current.applicationVersion !== check.applicationVersion
        || current.requestedRole !== check.requestedRole
        || current.requestedWorkspace !== check.requestedWorkspace
        || current.applicationStatus !== check.applicationStatusAtStart;
      await this.publish(
        check,
        superseded ? 'SUPERSEDED' : 'ERROR',
        [superseded ? 'APPLICATION_CHANGED_DURING_TECHNICAL_FAILURE' : safeErrorCode(error)],
        collectedManifest,
        correlationId,
        null,
      );
      return 'DONE';
    }
  }

  async drain(limit = 100): Promise<number> {
    const bounded = Math.max(1, Math.min(1000, Math.trunc(limit)));
    let processed = 0;
    while (processed < bounded) {
      if (await this.processOne() === 'EMPTY') break;
      processed += 1;
    }
    return processed;
  }

  private async publish(
    check: EligibilityCheck,
    verdict: EligibilityVerdict,
    reasonCodes: string[],
    manifest: SourceManifestEntry[],
    correlationId: string,
    semanticRole: SemanticEligibilityRole | null,
  ): Promise<void> {
    const manifestHash = sourceManifestHash(manifest);
    await this.repository.publishVerdict(check, verdict, reasonCodes, manifest, manifestHash, correlationId);
    const interval = semanticRole ? RECHECK_MS[semanticRole] : null;
    if (interval && !['SUPERSEDED', 'NOT_APPLICABLE'].includes(verdict)) {
      await this.repository.setNextRecheckAt(check.id, new Date(Date.now() + interval));
    }
  }
}
