import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RoleEligibilityEvidenceService } from './role-eligibility-evidence.service';
import { RoleEligibilityPolicy } from './role-eligibility-policy';
import { RoleEligibilityRepository } from './role-eligibility.repository';
import { RoleEligibilityWorkerRepository } from './role-eligibility-worker.repository';
import { sourceManifestHash } from './role-eligibility-security';
import type { EligibilitySource, SourceHealthStatus } from './role-eligibility.types';

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
    let createdOrExisting = 0;
    for (const candidate of candidates) {
      await this.repository.createOrGetCheck(
        candidate,
        this.policy.version,
        this.policy.hash,
        fingerprint,
        randomUUID(),
      );
      createdOrExisting += 1;
    }
    return createdOrExisting;
  }

  async recover(): Promise<number> {
    return this.workerRepository.recoverAbandonedChecking();
  }

  async processOne(): Promise<'EMPTY' | 'DONE'> {
    const check = await this.workerRepository.claimPending();
    if (!check) return 'EMPTY';
    const correlationId = check.correlationId || randomUUID();
    await this.repository.startCheck(check.id, correlationId);

    const startCandidate = await this.repository.readCandidate(check.applicationId);
    if (!startCandidate
      || startCandidate.applicationVersion !== check.applicationVersion
      || startCandidate.requestedRole !== check.requestedRole
      || startCandidate.requestedWorkspace !== check.requestedWorkspace) {
      const manifestHash = sourceManifestHash([]);
      await this.repository.publishVerdict(check, 'SUPERSEDED', ['APPLICATION_CHANGED_BEFORE_EVALUATION'], [], manifestHash, correlationId);
      return 'DONE';
    }

    const healthRows = await this.repository.sourceHealth();
    const sourceStates: Partial<Record<EligibilitySource, SourceHealthStatus>> = {};
    const now = Date.now();
    for (const row of healthRows) {
      sourceStates[row.source] = row.freshUntil && row.freshUntil.getTime() <= now ? 'STALE' : row.status;
    }

    let semanticRole;
    try {
      semanticRole = this.policy.resolveSemanticRole(startCandidate);
    } catch {
      const manifestHash = sourceManifestHash([]);
      await this.repository.publishVerdict(check, 'ERROR', ['REGISTRATION_ROLE_CONTRACT_MISMATCH'], [], manifestHash, correlationId);
      return 'DONE';
    }

    const collected = await this.evidenceService.collect(check, startCandidate, sourceStates);
    const decision = this.policy.evaluate({
      candidate: startCandidate,
      semanticRole,
      facts: collected.facts,
      sourceStates,
      evidenceSources: collected.evidenceSources,
    });

    const beforePublish = await this.repository.readCandidate(check.applicationId);
    const superseded = !beforePublish
      || beforePublish.applicationVersion !== check.applicationVersion
      || beforePublish.requestedRole !== check.requestedRole
      || beforePublish.requestedWorkspace !== check.requestedWorkspace
      || beforePublish.applicationStatus !== startCandidate.applicationStatus;
    const manifestHash = sourceManifestHash(collected.manifest);
    if (superseded) {
      await this.repository.publishVerdict(check, 'SUPERSEDED', ['APPLICATION_CHANGED_DURING_EVALUATION'], collected.manifest, manifestHash, correlationId);
      return 'DONE';
    }

    await this.repository.publishVerdict(check, decision.verdict, decision.reasonCodes, collected.manifest, manifestHash, correlationId);
    return 'DONE';
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
}
