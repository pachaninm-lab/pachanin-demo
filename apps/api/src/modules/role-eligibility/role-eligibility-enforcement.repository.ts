import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { parseRoleEligibilityEnforcementPolicy } from './role-eligibility-enforcement-policy';
import type {
  RoleEligibilityEnforcementState,
  RoleEligibilityVerdictSnapshot,
  RoleEligibilityVerdictSourceSnapshot,
} from './role-eligibility-enforcement.types';

type StateRow = {
  enabled: boolean;
  generation: bigint;
  exactSha: string | null;
  policyId: string | null;
  policyVersion: string | null;
  policyHash: string | null;
  policyDocument: unknown;
};

type SourceRow = {
  source: RoleEligibilityVerdictSourceSnapshot['source'];
  generation: string;
  evidenceId: string;
  evidenceHash: string;
  sourcePublishedAt: Date;
  parserVersion: string;
  evidenceFreshUntil: Date;
  healthStatus: string | null;
  sourceFreshUntil: Date | null;
};

@Injectable()
export class RoleEligibilityEnforcementRepository {
  constructor(private readonly prisma: PrismaService) {}

  async state(): Promise<RoleEligibilityEnforcementState> {
    const rows = await this.prisma.$queryRaw<StateRow[]>(Prisma.sql`
      SELECT
        s.enabled,
        s.generation,
        s.exact_sha AS "exactSha",
        p.id AS "policyId",
        p.version AS "policyVersion",
        p.policy_hash AS "policyHash",
        p.document AS "policyDocument"
      FROM eligibility.enforcement_state s
      LEFT JOIN eligibility.enforcement_policies p ON p.id = s.policy_id
      WHERE s.singleton = 1
      LIMIT 1
    `);
    const row = rows[0];
    if (!row) {
      return {
        enabled: false,
        generation: 0n,
        exactSha: null,
        policyId: null,
        policyVersion: null,
        policyHash: null,
        policyDocument: null,
      };
    }
    return {
      enabled: row.enabled,
      generation: row.generation,
      exactSha: row.exactSha,
      policyId: row.policyId,
      policyVersion: row.policyVersion,
      policyHash: row.policyHash,
      policyDocument: parseRoleEligibilityEnforcementPolicy(row.policyDocument),
    };
  }

  async currentVerdict(
    applicationId: string,
    applicationVersion: bigint,
    requestedRole: string,
  ): Promise<RoleEligibilityVerdictSnapshot | null> {
    const rows = await this.prisma.$queryRaw<RoleEligibilityVerdictSnapshot[]>(Prisma.sql`
      SELECT
        id,
        verdict,
        policy_version AS "policyVersion",
        policy_hash AS "policyHash",
        source_manifest_hash AS "sourceManifestHash"
      FROM eligibility.verdicts
      WHERE application_id = ${applicationId}
        AND application_version = ${applicationVersion}
        AND requested_role = ${requestedRole}
        AND is_current
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `);
    return rows[0] || null;
  }

  async verdictSources(verdictId: string): Promise<RoleEligibilityVerdictSourceSnapshot[]> {
    return this.prisma.$queryRaw<SourceRow[]>(Prisma.sql`
      SELECT
        vs.source,
        vs.generation,
        vs.evidence_id AS "evidenceId",
        vs.evidence_hash AS "evidenceHash",
        vs.source_published_at AS "sourcePublishedAt",
        vs.parser_version AS "parserVersion",
        e.fresh_until AS "evidenceFreshUntil",
        sh.status AS "healthStatus",
        sh.fresh_until AS "sourceFreshUntil"
      FROM eligibility.verdict_sources vs
      INNER JOIN eligibility.evidence e ON e.id = vs.evidence_id AND e.check_id = (
        SELECT v.check_id FROM eligibility.verdicts v WHERE v.id = ${verdictId}
      )
      LEFT JOIN eligibility.source_health sh ON sh.source = vs.source
      WHERE vs.verdict_id = ${verdictId}
      ORDER BY vs.source, vs.evidence_id
    `);
  }
}
