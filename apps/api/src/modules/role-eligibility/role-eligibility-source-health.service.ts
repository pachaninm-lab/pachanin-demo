import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { CircuitState, EligibilitySource, SourceHealthSnapshot, SourceHealthStatus } from './role-eligibility.types';

const FAILURE_THRESHOLD = 3;
const OPEN_SECONDS = 300;

@Injectable()
export class RoleEligibilitySourceHealthService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<SourceHealthSnapshot[]> {
    return this.prisma.$transaction(async (tx) => tx.$queryRaw<SourceHealthSnapshot[]>(Prisma.sql`
      SELECT source,status,circuit_state AS "circuitState",active_generation AS "activeGeneration",
             parser_version AS "parserVersion",schema_version AS "schemaVersion",last_success_at AS "lastSuccessAt",
             last_failure_at AS "lastFailureAt",checked_at AS "checkedAt",fresh_until AS "freshUntil",
             consecutive_failures AS "consecutiveFailures",last_error_code AS "lastErrorCode"
      FROM eligibility.source_health ORDER BY source
    `));
  }

  async get(source: EligibilitySource): Promise<SourceHealthSnapshot | null> {
    return (await this.list()).find((row) => row.source === source) ?? null;
  }

  async assertFetchAllowed(source: EligibilitySource): Promise<void> {
    const row = await this.get(source);
    if (!row || row.circuitState === 'CLOSED') return;
    if (row.circuitState === 'HALF_OPEN') return;
    const sinceFailure = row.lastFailureAt ? Date.now() - row.lastFailureAt.getTime() : Number.POSITIVE_INFINITY;
    if (sinceFailure >= OPEN_SECONDS * 1000) {
      await this.write(source, row.status, 'HALF_OPEN', row.consecutiveFailures, row.lastErrorCode, row.freshUntil, row.activeGeneration, row.parserVersion, row.schemaVersion, false);
      return;
    }
    throw new Error(`${source}_CIRCUIT_OPEN`);
  }

  async success(source: EligibilitySource, input: { generation: string; parserVersion: string; schemaVersion: string; freshUntil: Date }): Promise<void> {
    await this.write(source, 'HEALTHY', 'CLOSED', 0, null, input.freshUntil, input.generation, input.parserVersion, input.schemaVersion, true);
  }

  async failure(source: EligibilitySource, status: Extract<SourceHealthStatus, 'DEGRADED' | 'UNAVAILABLE' | 'SCHEMA_CHANGED'>, errorCode: string): Promise<void> {
    const current = await this.get(source);
    const failures = (current?.consecutiveFailures ?? 0) + 1;
    const circuit: CircuitState = failures >= FAILURE_THRESHOLD ? 'OPEN' : current?.circuitState === 'HALF_OPEN' ? 'OPEN' : 'CLOSED';
    await this.write(source, status, circuit, failures, errorCode, current?.freshUntil ?? null, current?.activeGeneration ?? null, current?.parserVersion ?? null, current?.schemaVersion ?? null, false);
  }

  async stale(source: EligibilitySource): Promise<void> {
    const current = await this.get(source);
    await this.write(source, 'STALE', current?.circuitState ?? 'CLOSED', current?.consecutiveFailures ?? 0, 'SOURCE_FRESHNESS_EXPIRED', current?.freshUntil ?? null, current?.activeGeneration ?? null, current?.parserVersion ?? null, current?.schemaVersion ?? null, false);
  }

  private async write(source: EligibilitySource, status: SourceHealthStatus, circuit: CircuitState, failures: number, errorCode: string | null, freshUntil: Date | null, generation: string | null, parserVersion: string | null, schemaVersion: string | null, success: boolean): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO eligibility.source_health (
          source,status,circuit_state,active_generation,parser_version,schema_version,
          last_success_at,last_failure_at,checked_at,fresh_until,consecutive_failures,last_error_code,updated_at
        ) VALUES (
          ${source},${status},${circuit},${generation},${parserVersion},${schemaVersion},
          ${success ? new Date() : null},${success ? null : new Date()},clock_timestamp(),${freshUntil},${failures},${errorCode},clock_timestamp()
        ) ON CONFLICT (source) DO UPDATE SET
          status=EXCLUDED.status,circuit_state=EXCLUDED.circuit_state,active_generation=COALESCE(EXCLUDED.active_generation,eligibility.source_health.active_generation),
          parser_version=COALESCE(EXCLUDED.parser_version,eligibility.source_health.parser_version),schema_version=COALESCE(EXCLUDED.schema_version,eligibility.source_health.schema_version),
          last_success_at=COALESCE(EXCLUDED.last_success_at,eligibility.source_health.last_success_at),
          last_failure_at=COALESCE(EXCLUDED.last_failure_at,eligibility.source_health.last_failure_at),checked_at=EXCLUDED.checked_at,
          fresh_until=COALESCE(EXCLUDED.fresh_until,eligibility.source_health.fresh_until),consecutive_failures=EXCLUDED.consecutive_failures,
          last_error_code=EXCLUDED.last_error_code,updated_at=clock_timestamp()
      `);
    });
  }
}
