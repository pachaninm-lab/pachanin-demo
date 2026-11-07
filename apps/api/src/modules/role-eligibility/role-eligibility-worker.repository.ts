import { Injectable } from '@nestjs/common';
import { Prisma, type PrismaClient } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { EligibilityCheck, RoleEligibilityCandidate } from './role-eligibility.types';

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

const VALID_RUSSIAN_INN_SQL = Prisma.sql`
  (
    CASE
      WHEN candidate.inn ~ '^[0-9]{10}$' THEN
        mod(mod(
          2 * substr(candidate.inn,1,1)::int +
          4 * substr(candidate.inn,2,1)::int +
          10 * substr(candidate.inn,3,1)::int +
          3 * substr(candidate.inn,4,1)::int +
          5 * substr(candidate.inn,5,1)::int +
          9 * substr(candidate.inn,6,1)::int +
          4 * substr(candidate.inn,7,1)::int +
          6 * substr(candidate.inn,8,1)::int +
          8 * substr(candidate.inn,9,1)::int
        ,11),10) = substr(candidate.inn,10,1)::int
      WHEN candidate.inn ~ '^[0-9]{12}$' THEN
        mod(mod(
          7 * substr(candidate.inn,1,1)::int +
          2 * substr(candidate.inn,2,1)::int +
          4 * substr(candidate.inn,3,1)::int +
          10 * substr(candidate.inn,4,1)::int +
          3 * substr(candidate.inn,5,1)::int +
          5 * substr(candidate.inn,6,1)::int +
          9 * substr(candidate.inn,7,1)::int +
          4 * substr(candidate.inn,8,1)::int +
          6 * substr(candidate.inn,9,1)::int +
          8 * substr(candidate.inn,10,1)::int
        ,11),10) = substr(candidate.inn,11,1)::int
        AND mod(mod(
          3 * substr(candidate.inn,1,1)::int +
          7 * substr(candidate.inn,2,1)::int +
          2 * substr(candidate.inn,3,1)::int +
          4 * substr(candidate.inn,4,1)::int +
          10 * substr(candidate.inn,5,1)::int +
          3 * substr(candidate.inn,6,1)::int +
          5 * substr(candidate.inn,7,1)::int +
          9 * substr(candidate.inn,8,1)::int +
          4 * substr(candidate.inn,9,1)::int +
          6 * substr(candidate.inn,10,1)::int +
          8 * substr(candidate.inn,11,1)::int
        ,11),10) = substr(candidate.inn,12,1)::int
      ELSE FALSE
    END
  )
`;

@Injectable()
export class RoleEligibilityWorkerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listCandidates(limit = 250): Promise<RoleEligibilityCandidate[]> {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 1000);
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<CandidateRow[]>(Prisma.sql`
        SELECT candidate.*
        FROM auth.read_role_eligibility_candidates(NULL) AS candidate
        WHERE candidate.application_status NOT IN ('REJECTED','CANCELLED','EXPIRED')
          AND ${VALID_RUSSIAN_INN_SQL}
        ORDER BY candidate.submitted_at,candidate.application_id
        LIMIT ${safeLimit}
      `);
      return rows.map(mapCandidate);
    });
  }

  async claimPending(): Promise<EligibilityCheck | null> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<CheckRow[]>(Prisma.sql`
        WITH next_check AS (
          SELECT id FROM eligibility.organization_checks
          WHERE status='PENDING'
          ORDER BY created_at,id
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )
        UPDATE eligibility.organization_checks c
        SET status='CHECKING',started_at=COALESCE(started_at,clock_timestamp()),updated_at=clock_timestamp()
        FROM next_check n
        WHERE c.id=n.id
        RETURNING c.*
      `);
      return rows[0] ? mapCheck(rows[0]) : null;
    });
  }

  async recoverAbandonedChecking(maxAgeSeconds = 900): Promise<number> {
    const bounded = Math.min(Math.max(Math.trunc(maxAgeSeconds), 60), 3600);
    return this.prisma.$transaction(async (tx) => tx.$executeRaw(Prisma.sql`
      UPDATE eligibility.organization_checks
      SET status='PENDING',updated_at=clock_timestamp()
      WHERE status='CHECKING'
        AND started_at < clock_timestamp() - (${bounded} * interval '1 second')
        AND completed_at IS NULL
    `));
  }

  async queueDepth(): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
        SELECT COUNT(*)::bigint AS count FROM eligibility.organization_checks WHERE status IN ('PENDING','CHECKING')
      `);
      return Number(rows[0]?.count || 0n);
    });
  }
}
