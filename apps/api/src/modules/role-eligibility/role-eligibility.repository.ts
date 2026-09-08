import { Injectable } from '@nestjs/common';
import { Prisma, type PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { sha256, stableJson } from './role-eligibility-security';
import type {
  EligibilityCheck,
  EligibilityEvidence,
  EligibilitySource,
  EligibilityVerdict,
  RoleEligibilityCandidate,
  SourceHealthSnapshot,
  SourceManifestEntry,
} from './role-eligibility.types';

type SqlClient = Pick<PrismaClient, '$queryRaw' | '$executeRaw'>;
type CandidateRow = {
  application_id: string; application_version: bigint; application_status: string;
  organization_id: string; tenant_id: string; requested_workspace: string; requested_role: string;
  inn: string; ogrn: string | null; kpp: string | null; legal_name: string; submitted_at: Date;
};
type CheckRow = {
  id: string; application_id: string; application_version: bigint; application_status_at_start: string;
  organization_id: string; tenant_id: string; inn: string; ogrn: string | null; kpp: string | null;
  requested_workspace: string; requested_role: string; status: EligibilityCheck['status']; policy_version: string;
  policy_hash: string; source_manifest_hash: string | null; request_key: string; correlation_id: string;
  started_at: Date | null; completed_at: Date | null; next_recheck_at: Date | null;
};
type EvidenceRow = {
  id: string; check_id: string; source_type: EligibilitySource; source_name: string; source_record_id: string;
  registry_generation: string; subject_inn: string | null; subject_ogrn: string | null; evidence_type: string;
  normalized_payload: Record<string, unknown>; source_published_at: Date; source_checked_at: Date;
  valid_from: Date | null; valid_until: Date | null; fresh_until: Date; parser_version: string;
  payload_sha256: string; confidence_class: EligibilityEvidence['confidenceClass'];
};

const mapCandidate = (row: CandidateRow): RoleEligibilityCandidate => ({
  applicationId: row.application_id, applicationVersion: row.application_version, applicationStatus: row.application_status,
  organizationId: row.organization_id, tenantId: row.tenant_id, requestedWorkspace: row.requested_workspace,
  requestedRole: row.requested_role, inn: row.inn, ogrn: row.ogrn, kpp: row.kpp, legalName: row.legal_name,
  submittedAt: row.submitted_at,
});
const mapCheck = (row: CheckRow): EligibilityCheck => ({
  id: row.id, applicationId: row.application_id, applicationVersion: row.application_version,
  applicationStatusAtStart: row.application_status_at_start, organizationId: row.organization_id, tenantId: row.tenant_id,
  inn: row.inn, ogrn: row.ogrn, kpp: row.kpp, requestedWorkspace: row.requested_workspace,
  requestedRole: row.requested_role, status: row.status, policyVersion: row.policy_version, policyHash: row.policy_hash,
  sourceManifestHash: row.source_manifest_hash, requestKey: row.request_key, correlationId: row.correlation_id,
  startedAt: row.started_at, completedAt: row.completed_at, nextRecheckAt: row.next_recheck_at,
});
const mapEvidence = (row: EvidenceRow): EligibilityEvidence => ({
  id: row.id, checkId: row.check_id, sourceType: row.source_type, sourceName: row.source_name,
  sourceRecordId: row.source_record_id, registryGeneration: row.registry_generation, subjectInn: row.subject_inn,
  subjectOgrn: row.subject_ogrn, evidenceType: row.evidence_type, normalizedPayload: row.normalized_payload,
  sourcePublishedAt: row.source_published_at, sourceCheckedAt: row.source_checked_at, validFrom: row.valid_from,
  validUntil: row.valid_until, freshUntil: row.fresh_until, parserVersion: row.parser_version,
  payloadSha256: row.payload_sha256, confidenceClass: row.confidence_class,
});

/**
 * Verdict publication is idempotent per immutable logical check, not merely per
 * source manifest. Different checks may legitimately produce different
 * decisions from the same empty manifest when an authoritative source recovers
 * or becomes stale. Binding the key to requestKey preserves exact replay while
 * allowing the newer check to become current atomically.
 */
export function verdictPublicationIdempotencyKey(
  check: Pick<EligibilityCheck, 'applicationId' | 'applicationVersion' | 'requestedRole' | 'policyVersion' | 'policyHash' | 'requestKey'>,
  sourceManifestHash: string,
): string {
  return sha256(stableJson({
    applicationId: check.applicationId,
    applicationVersion: check.applicationVersion.toString(),
    requestedRole: check.requestedRole,
    policyVersion: check.policyVersion,
    policyHash: check.policyHash,
    checkRequestKey: check.requestKey,
    sourceManifestHash,
  }));
}

@Injectable()
export class RoleEligibilityRepository {
  constructor(private readonly prisma: PrismaService) {}

  private db<T>(task: (client: SqlClient) => Promise<T>, serializable = false): Promise<T> {
    return this.prisma.$transaction(
      async (tx) => task(tx as unknown as SqlClient),
      serializable ? { isolationLevel: Prisma.TransactionIsolationLevel.Serializable } : undefined,
    );
  }

  async readCandidate(applicationId: string): Promise<RoleEligibilityCandidate | null> {
    const rows = await this.db((client) => client.$queryRaw<CandidateRow[]>(Prisma.sql`
      SELECT * FROM auth.read_role_eligibility_candidates(${applicationId})
    `));
    return rows[0] ? mapCandidate(rows[0]) : null;
  }

  async activeGenerationFingerprint(): Promise<string> {
    const rows = await this.db((client) => client.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
      SELECT source, generation, content_sha256, parser_version, schema_version
      FROM eligibility.registry_generations WHERE status = 'ACTIVE' ORDER BY source
    `));
    return sha256(stableJson(rows));
  }

  async createOrGetCheck(
    candidate: RoleEligibilityCandidate,
    policyVersion: string,
    policyHash: string,
    generationFingerprint: string,
    correlationId: string,
    requestDiscriminator = 'automatic',
  ): Promise<EligibilityCheck> {
    const requestKey = sha256(stableJson({
      applicationId: candidate.applicationId,
      applicationVersion: candidate.applicationVersion.toString(),
      requestedRole: candidate.requestedRole,
      policyVersion,
      policyHash,
      generationFingerprint,
      requestDiscriminator,
    }));
    const id = `elc_${randomUUID()}`;
    const rows = await this.db(async (client) => {
      await client.$executeRaw(Prisma.sql`
        INSERT INTO eligibility.organization_checks (
          id, application_id, application_version, application_status_at_start, organization_id, tenant_id,
          inn, ogrn, kpp, requested_workspace, requested_role, status, policy_version, policy_hash,
          request_key, correlation_id, created_at, updated_at
        ) VALUES (
          ${id}, ${candidate.applicationId}, ${candidate.applicationVersion}, ${candidate.applicationStatus},
          ${candidate.organizationId}, ${candidate.tenantId}, ${candidate.inn}, ${candidate.ogrn}, ${candidate.kpp},
          ${candidate.requestedWorkspace}, ${candidate.requestedRole}, 'PENDING', ${policyVersion}, ${policyHash},
          ${requestKey}, ${correlationId}, clock_timestamp(), clock_timestamp()
        ) ON CONFLICT (request_key) DO NOTHING
      `);
      return client.$queryRaw<CheckRow[]>(Prisma.sql`SELECT * FROM eligibility.organization_checks WHERE request_key = ${requestKey}`);
    });
    if (!rows[0]) throw new Error('ROLE_ELIGIBILITY_CHECK_CREATE_FAILED');
    return mapCheck(rows[0]);
  }

  async startCheck(checkId: string, correlationId: string, recheck = false): Promise<void> {
    const eventType = recheck ? 'ROLE_ELIGIBILITY_RECHECK_STARTED' : 'ROLE_ELIGIBILITY_STARTED';
    const auditId = `ela_${sha256(`${checkId}\u001f${eventType}`).slice(0, 36)}`;
    await this.db(async (client) => {
      await client.$executeRaw(Prisma.sql`
        UPDATE eligibility.organization_checks
        SET status='CHECKING', started_at=COALESCE(started_at, clock_timestamp()), updated_at=clock_timestamp()
        WHERE id=${checkId} AND status IN ('PENDING','CHECKING')
      `);
      await client.$executeRaw(Prisma.sql`
        INSERT INTO eligibility.audit_events (id,event_type,check_id,correlation_id,payload,created_at)
        VALUES (${auditId}, ${eventType}, ${checkId}, ${correlationId}, '{}'::jsonb, clock_timestamp())
        ON CONFLICT (id) DO NOTHING
      `);
    });
  }

  async setNextRecheckAt(checkId: string, nextRecheckAt: Date): Promise<void> {
    await this.db((client) => client.$executeRaw(Prisma.sql`
      UPDATE eligibility.organization_checks
      SET next_recheck_at=${nextRecheckAt},updated_at=clock_timestamp()
      WHERE id=${checkId}
    `));
  }

  async activeRecords(source: EligibilitySource, inn: string, ogrn: string | null): Promise<Array<{
    generation: string; sourceRecordId: string; subjectInn: string | null; subjectOgrn: string | null;
    recordType: string; normalizedPayload: Record<string, unknown>; sourcePublishedAt: Date; validFrom: Date | null;
    validUntil: Date | null; payloadSha256: string; parserVersion: string; freshUntil: Date;
  }>> {
    // This is one MVCC statement: it observes either the old ACTIVE generation
    // or the new ACTIVE generation atomically. A wrapping transaction adds pool
    // queue/BEGIN-COMMIT overhead without strengthening the snapshot guarantee.
    return this.prisma.$queryRaw(Prisma.sql`
      SELECT g.generation, r.source_record_id AS "sourceRecordId", r.subject_inn AS "subjectInn",
             r.subject_ogrn AS "subjectOgrn", r.record_type AS "recordType", r.normalized_payload AS "normalizedPayload",
             r.source_published_at AS "sourcePublishedAt", r.valid_from AS "validFrom", r.valid_until AS "validUntil",
             r.payload_sha256 AS "payloadSha256", g.parser_version AS "parserVersion", g.fresh_until AS "freshUntil"
      FROM eligibility.registry_records r JOIN eligibility.registry_generations g ON g.id=r.generation_id
      WHERE g.status='ACTIVE' AND r.source=${source}
        AND (r.subject_inn=${inn} OR (${ogrn}::text IS NOT NULL AND r.subject_ogrn=${ogrn}))
      ORDER BY r.source_record_id,r.id
    `);
  }

  async createEvidence(input: Omit<EligibilityEvidence, 'id'>): Promise<EligibilityEvidence> {
    const id = `ele_${randomUUID()}`;
    const payload = JSON.stringify(input.normalizedPayload);
    const rows = await this.db(async (client) => {
      await client.$executeRaw(Prisma.sql`
        INSERT INTO eligibility.evidence (
          id,check_id,source_type,source_name,source_record_id,registry_generation,subject_inn,subject_ogrn,
          evidence_type,normalized_payload,source_published_at,source_checked_at,valid_from,valid_until,fresh_until,
          parser_version,payload_sha256,confidence_class,created_at
        ) VALUES (
          ${id},${input.checkId},${input.sourceType},${input.sourceName},${input.sourceRecordId},${input.registryGeneration},
          ${input.subjectInn},${input.subjectOgrn},${input.evidenceType},${payload}::jsonb,${input.sourcePublishedAt},
          ${input.sourceCheckedAt},${input.validFrom},${input.validUntil},${input.freshUntil},${input.parserVersion},
          ${input.payloadSha256},${input.confidenceClass},clock_timestamp()
        ) ON CONFLICT (check_id,source_type,source_record_id,registry_generation,payload_sha256) DO NOTHING
      `);
      return client.$queryRaw<EvidenceRow[]>(Prisma.sql`
        SELECT * FROM eligibility.evidence WHERE check_id=${input.checkId} AND source_type=${input.sourceType}
          AND source_record_id=${input.sourceRecordId} AND registry_generation=${input.registryGeneration}
          AND payload_sha256=${input.payloadSha256}
      `);
    });
    if (!rows[0]) throw new Error('ROLE_ELIGIBILITY_EVIDENCE_CREATE_FAILED');
    return mapEvidence(rows[0]);
  }

  async evidenceForCheck(checkId: string): Promise<EligibilityEvidence[]> {
    const rows = await this.db((client) => client.$queryRaw<EvidenceRow[]>(Prisma.sql`
      SELECT * FROM eligibility.evidence WHERE check_id=${checkId} ORDER BY source_type,source_record_id,id
    `));
    return rows.map(mapEvidence);
  }

  async latestCheck(applicationId: string): Promise<(EligibilityCheck & { verdict: EligibilityVerdict | null; reasonCodes: unknown }) | null> {
    const rows = await this.db((client) => client.$queryRaw<Array<CheckRow & { verdict: EligibilityVerdict | null; reason_codes: unknown }>>(Prisma.sql`
      SELECT c.*,v.verdict,v.reason_codes FROM eligibility.organization_checks c
      LEFT JOIN eligibility.verdicts v ON v.check_id=c.id AND v.is_current
      WHERE c.application_id=${applicationId}
      ORDER BY (c.status IN ('PENDING','CHECKING')) DESC, (v.is_current IS TRUE) DESC, c.created_at DESC,c.id DESC
      LIMIT 1
    `));
    return rows[0] ? { ...mapCheck(rows[0]), verdict: rows[0].verdict, reasonCodes: rows[0].reason_codes } : null;
  }

  async publishVerdict(check: EligibilityCheck, verdict: EligibilityVerdict, reasonCodes: string[], manifest: SourceManifestEntry[], sourceManifestHash: string, correlationId: string): Promise<string> {
    const idempotencyKey = verdictPublicationIdempotencyKey(check, sourceManifestHash);
    const sources = JSON.stringify(manifest);
    const reasons = JSON.stringify([...new Set(reasonCodes)].sort());
    const verdictId = `elv_${randomUUID()}`;
    const rows = await this.db((client) => client.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT eligibility.publish_verdict(
        ${verdictId}, ${`elh_${randomUUID()}`}, ${`ela_${randomUUID()}`}, ${`elo_${randomUUID()}`},
        ${check.id}, ${verdict}, ${reasons}::jsonb, ${sourceManifestHash}, ${idempotencyKey},
        ${sources}::jsonb, ${correlationId}
      ) AS id
    `), true);
    return rows[0]?.id || verdictId;
  }

  async sourceHealth(): Promise<SourceHealthSnapshot[]> {
    return this.db((client) => client.$queryRaw<SourceHealthSnapshot[]>(Prisma.sql`
      SELECT source,status,circuit_state AS "circuitState",active_generation AS "activeGeneration",
             parser_version AS "parserVersion",schema_version AS "schemaVersion",last_success_at AS "lastSuccessAt",
             last_failure_at AS "lastFailureAt",checked_at AS "checkedAt",fresh_until AS "freshUntil",
             consecutive_failures AS "consecutiveFailures",last_error_code AS "lastErrorCode"
      FROM eligibility.source_health ORDER BY source
    `));
  }
}
