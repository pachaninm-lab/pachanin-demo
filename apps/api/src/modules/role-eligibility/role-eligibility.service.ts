import { BadRequestException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { StaffAccessContext } from '../staff-access/staff-access.types';
import { RoleEligibilityPolicy } from './role-eligibility-policy';
import { RoleEligibilityRepository } from './role-eligibility.repository';
import { sha256 } from './role-eligibility-security';

export type RoleEligibilityFlags = {
  enabled: boolean;
  shadowMode: boolean;
  enforcement: false;
  configurationError: string | null;
};

@Injectable()
export class RoleEligibilityService {
  private readonly policy = new RoleEligibilityPolicy();

  constructor(private readonly repository: RoleEligibilityRepository) {}

  flags(): RoleEligibilityFlags {
    const enabled = String(process.env.ROLE_ELIGIBILITY_ENABLED || 'false').toLowerCase() === 'true';
    const shadowMode = String(process.env.ROLE_ELIGIBILITY_SHADOW_MODE || 'true').toLowerCase() === 'true';
    const enforcementRequested = String(process.env.ROLE_ELIGIBILITY_ENFORCEMENT || 'false').toLowerCase() === 'true';
    return {
      enabled,
      shadowMode,
      enforcement: false,
      configurationError: enforcementRequested ? 'ROLE_ELIGIBILITY_ENFORCEMENT_UNSUPPORTED_IN_SHADOW_RELEASE' : null,
    };
  }

  async application(applicationId: string, access: StaffAccessContext) {
    const candidate = await this.requireCandidate(applicationId, access);
    const semanticRole = this.policy.resolveSemanticRole(candidate);
    const current = await this.repository.latestCheck(applicationId);
    return {
      flags: this.flags(),
      applicationId: candidate.applicationId,
      applicationVersion: candidate.applicationVersion.toString(),
      organization: {
        id: candidate.organizationId,
        inn: candidate.inn,
        ogrn: candidate.ogrn,
        kpp: candidate.kpp,
        legalName: candidate.legalName,
      },
      requestedWorkspace: candidate.requestedWorkspace,
      requestedRole: candidate.requestedRole,
      semanticRole,
      applicationStatus: candidate.applicationStatus,
      policy: { version: this.policy.version, hash: this.policy.hash },
      current: current ? {
        checkId: current.id,
        status: current.status,
        verdict: current.verdict,
        reasonCodes: current.reasonCodes,
        sourceManifestHash: current.sourceManifestHash,
        startedAt: current.startedAt,
        completedAt: current.completedAt,
        nextRecheckAt: current.nextRecheckAt,
      } : null,
      legalText: current?.verdict === 'ELIGIBLE'
        ? 'По сведениям официальных источников организация соответствует критериям платформы для выбранной роли.'
        : 'По имеющимся официальным сведениям автоматически подтвердить соответствие выбранной роли не удалось.',
    };
  }

  async evidence(applicationId: string, access: StaffAccessContext) {
    await this.requireCandidate(applicationId, access);
    const current = await this.repository.latestCheck(applicationId);
    if (!current) return { applicationId, checkId: null, evidence: [] };
    const evidence = await this.repository.evidenceForCheck(current.id);
    return {
      applicationId,
      checkId: current.id,
      evidence: evidence.map((item) => ({
        id: item.id,
        source: item.sourceType,
        sourceName: item.sourceName,
        sourceRecordId: item.sourceRecordId,
        generation: item.registryGeneration,
        evidenceType: item.evidenceType,
        sourcePublishedAt: item.sourcePublishedAt,
        sourceCheckedAt: item.sourceCheckedAt,
        validFrom: item.validFrom,
        validUntil: item.validUntil,
        freshUntil: item.freshUntil,
        parserVersion: item.parserVersion,
        evidenceHash: item.payloadSha256,
        confidenceClass: item.confidenceClass,
        normalizedPayload: item.normalizedPayload,
      })),
    };
  }

  async recheck(
    applicationId: string,
    access: StaffAccessContext,
    idempotencyKey: string,
    correlationId: string = randomUUID(),
  ) {
    const flags = this.flags();
    if (!flags.enabled) throw new ServiceUnavailableException({ code: 'ROLE_ELIGIBILITY_DISABLED' });
    if (flags.configurationError) {
      throw new ServiceUnavailableException({ code: flags.configurationError });
    }
    const normalizedKey = String(idempotencyKey || '').trim();
    if (!/^[A-Za-z0-9._:-]{16,200}$/.test(normalizedKey)) {
      throw new BadRequestException({ code: 'ROLE_ELIGIBILITY_IDEMPOTENCY_KEY_REQUIRED' });
    }
    const candidate = await this.requireCandidate(applicationId, access);
    const semanticRole = this.policy.resolveSemanticRole(candidate);
    const fingerprint = await this.repository.activeGenerationFingerprint();
    const previous = await this.repository.latestCheck(applicationId);
    const requestDiscriminator = `manual:${sha256(normalizedKey)}`;
    const check = await this.repository.createOrGetCheck(
      candidate,
      this.policy.version,
      this.policy.hash,
      fingerprint,
      correlationId,
      requestDiscriminator,
    );
    const reusedExisting = Boolean(previous && previous.id === check.id);
    return {
      accepted: true,
      reusedExisting,
      authoritativeInputChanged: !reusedExisting,
      shadowMode: flags.shadowMode,
      enforcement: false,
      applicationId: candidate.applicationId,
      applicationVersion: candidate.applicationVersion.toString(),
      requestedRole: candidate.requestedRole,
      semanticRole,
      checkId: check.id,
      status: check.status,
      policyVersion: check.policyVersion,
      policyHash: check.policyHash,
      correlationId: check.correlationId,
    };
  }

  private async requireCandidate(applicationId: string, access: StaffAccessContext) {
    const candidate = await this.repository.readCandidate(applicationId);
    if (!candidate) throw new NotFoundException({ code: 'ROLE_ELIGIBILITY_APPLICATION_NOT_FOUND' });

    if (access.effectiveTenantId && access.effectiveTenantId !== candidate.tenantId) {
      throw new ForbiddenException({ code: 'ROLE_ELIGIBILITY_CROSS_TENANT_DENIED' });
    }
    if (access.effectiveOrganizationId && access.effectiveOrganizationId !== candidate.organizationId) {
      throw new ForbiddenException({ code: 'ROLE_ELIGIBILITY_CROSS_ORGANIZATION_DENIED' });
    }
    return candidate;
  }
}
