import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { isValidRussianInn } from './role-eligibility-policy';

export type FnsEgrulResolutionState =
  | 'INVALID_IDENTIFIER'
  | 'FOUND'
  | 'REVIEW_REQUIRED'
  | 'SOURCE_UNAVAILABLE'
  | 'STALE'
  | 'COVERAGE_NOT_PROVEN'
  | 'COVERAGE_NOT_FINAL'
  | 'AUTHORITATIVE_NOT_FOUND';

export type FnsEgrulCoverageResolution = {
  state: FnsEgrulResolutionState;
  generationId: string | null;
  generation: string | null;
  authorityToken: string | null;
  matchedRecords: number;
  matchedOgrns: number;
};

type ResolutionRow = {
  state: FnsEgrulResolutionState;
  generation_id: string | null;
  generation: string | null;
  authority_token: string | null;
  matched_records: bigint;
  matched_ogrns: bigint;
};

/**
 * The only corpus-level FNS/EGRUL absence resolver introduced by #5064.
 * One SQL statement binds the row lookup, ACTIVE generation, health, coverage,
 * continuity and finality facts to one PostgreSQL MVCC snapshot.
 */
@Injectable()
export class RoleEligibilityFnsRegistryCoverageService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveEgrulInn(inn: string, decisionAt = new Date()): Promise<FnsEgrulCoverageResolution> {
    const normalized = String(inn || '').trim();
    if (normalized.length !== 10 || !isValidRussianInn(normalized)) {
      return {
        state: 'INVALID_IDENTIFIER',
        generationId: null,
        generation: null,
        authorityToken: null,
        matchedRecords: 0,
        matchedOgrns: 0,
      };
    }

    const rows = await this.prisma.$queryRaw<ResolutionRow[]>(Prisma.sql`
      WITH current_generation AS MATERIALIZED (
        SELECT g.id,g.generation,g.content_sha256,g.parser_version,g.schema_version,g.fresh_until
        FROM eligibility.registry_generations AS g
        WHERE g.source='FNS' AND g.registry_domain='EGRUL' AND g.status='ACTIVE'
        ORDER BY g.activated_at DESC NULLS LAST,g.published_at DESC,g.id DESC
        LIMIT 1
      ),
      bound_state AS MATERIALIZED (
        SELECT
          g.id AS generation_id,
          g.generation,
          g.content_sha256,
          g.parser_version,
          g.schema_version,
          g.fresh_until AS generation_fresh_until,
          h.status AS health_status,
          h.circuit_state,
          h.active_generation,
          h.parser_version AS health_parser_version,
          h.schema_version AS health_schema_version,
          h.fresh_until AS health_fresh_until,
          h.consecutive_failures,
          h.last_error_code,
          a.coverage_kind,
          a.acquisition_complete,
          a.local_import_integrity,
          a.baseline_coverage,
          a.update_continuity,
          a.source_finality,
          a.continuity_policy_version,
          a.continuity_policy_hash,
          a.finality_policy_version,
          a.finality_policy_hash,
          a.effective_cutoff,
          a.authority_token
        FROM current_generation AS g
        LEFT JOIN eligibility.source_health AS h
          ON h.source='FNS'
         AND h.registry_domain='EGRUL'
        LEFT JOIN eligibility.registry_generation_authority AS a
          ON a.generation_id=g.id
         AND a.source='FNS'
         AND a.registry_domain='EGRUL'
      ),
      matches AS MATERIALIZED (
        SELECT
          COUNT(r.id)::bigint AS matched_records,
          COUNT(DISTINCT r.subject_ogrn)::bigint AS matched_ogrns
        FROM current_generation AS g
        LEFT JOIN eligibility.registry_records AS r
          ON r.generation_id=g.id
         AND r.source='FNS'
         AND r.subject_inn=${normalized}
      )
      SELECT
        CASE
          WHEN s.generation_id IS NULL THEN 'SOURCE_UNAVAILABLE'
          WHEN s.parser_version IS DISTINCT FROM 'fns-egrul-v1'
            OR s.schema_version NOT IN ('EGRUL_408','EGRUL_407')
            OR s.health_status IS DISTINCT FROM 'HEALTHY'
            OR s.circuit_state IS DISTINCT FROM 'CLOSED'
            OR s.active_generation IS DISTINCT FROM s.generation
            OR s.health_parser_version IS DISTINCT FROM s.parser_version
            OR s.health_schema_version IS DISTINCT FROM s.schema_version
            OR s.consecutive_failures IS DISTINCT FROM 0
            OR s.last_error_code IS NOT NULL
            THEN 'SOURCE_UNAVAILABLE'
          WHEN s.generation_fresh_until <= ${decisionAt}
            OR s.health_fresh_until IS NULL
            OR s.health_fresh_until <= ${decisionAt}
            OR s.health_fresh_until IS DISTINCT FROM s.generation_fresh_until
            THEN 'STALE'
          WHEN COALESCE(m.matched_records,0) > 0 AND COALESCE(m.matched_ogrns,0) = 1
            THEN 'FOUND'
          WHEN COALESCE(m.matched_records,0) > 0
            THEN 'REVIEW_REQUIRED'
          WHEN s.authority_token IS NULL
            OR s.coverage_kind NOT IN ('COMPLETE_NATIONAL_CORPUS','COMPLETE_EFFECTIVE_CORPUS')
            OR s.acquisition_complete IS DISTINCT FROM TRUE
            OR s.local_import_integrity IS DISTINCT FROM TRUE
            OR s.baseline_coverage IS DISTINCT FROM TRUE
            OR s.update_continuity IS DISTINCT FROM TRUE
            OR s.effective_cutoff IS NULL
            OR s.effective_cutoff > ${decisionAt}
            OR s.continuity_policy_version IS NULL
            OR s.continuity_policy_hash IS NULL
            THEN 'COVERAGE_NOT_PROVEN'
          WHEN s.source_finality IS DISTINCT FROM TRUE
            OR s.finality_policy_version IS NULL
            OR s.finality_policy_hash IS NULL
            THEN 'COVERAGE_NOT_FINAL'
          ELSE 'AUTHORITATIVE_NOT_FOUND'
        END::text AS state,
        s.generation_id,
        s.generation,
        COALESCE(s.authority_token,s.content_sha256) AS authority_token,
        COALESCE(m.matched_records,0)::bigint AS matched_records,
        COALESCE(m.matched_ogrns,0)::bigint AS matched_ogrns
      FROM (SELECT 1) AS anchor
      LEFT JOIN bound_state AS s ON TRUE
      LEFT JOIN matches AS m ON TRUE
    `);

    const row = rows[0];
    if (!row) throw new Error('FNS_EGRUL_COVERAGE_RESOLUTION_EMPTY');
    return {
      state: row.state,
      generationId: row.generation_id,
      generation: row.generation,
      authorityToken: row.authority_token,
      matchedRecords: Number(row.matched_records),
      matchedOgrns: Number(row.matched_ogrns),
    };
  }
}
