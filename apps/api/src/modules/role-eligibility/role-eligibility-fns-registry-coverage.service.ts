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

    if (!(decisionAt instanceof Date) || !Number.isFinite(decisionAt.getTime())) {
      throw new Error('FNS_EGRUL_DECISION_TIME_INVALID');
    }

    const rows = await this.prisma.$queryRaw<ResolutionRow[]>(Prisma.sql`
      SELECT state,generation_id,generation,authority_token,matched_records,matched_ogrns
      FROM eligibility.resolve_fns_egrul_inn(${normalized},${decisionAt})
    `);

    const row = rows[0];
    if (!row) throw new Error('FNS_EGRUL_COVERAGE_RESOLUTION_EMPTY');
    if (rows.length !== 1) throw new Error('FNS_EGRUL_COVERAGE_RESOLUTION_AMBIGUOUS');
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
