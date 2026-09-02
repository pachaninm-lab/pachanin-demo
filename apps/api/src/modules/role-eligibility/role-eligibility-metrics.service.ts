import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

function metric(name: string, value: number, labels?: Record<string, string>): string {
  const suffix = labels && Object.keys(labels).length
    ? `{${Object.entries(labels).map(([key, item]) => `${key}=${JSON.stringify(item)}`).join(',')}}`
    : '';
  return `${name}${suffix} ${Number.isFinite(value) ? value : 0}`;
}

@Injectable()
export class RoleEligibilityMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async prometheus(): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE pc_role_eligibility_runtime');
      const counts = await tx.$queryRaw<Array<{
        total: bigint;
        eligible: bigint;
        review_required: bigint;
        mismatch: bigint;
        source_unavailable: bigint;
        superseded: bigint;
        errors: bigint;
        queue_depth: bigint;
        p95_ms: number | null;
      }>>(Prisma.sql`
        SELECT
          COUNT(*)::bigint AS total,
          COUNT(*) FILTER (WHERE status='ELIGIBLE')::bigint AS eligible,
          COUNT(*) FILTER (WHERE status='REVIEW_REQUIRED')::bigint AS review_required,
          COUNT(*) FILTER (WHERE status='APPARENT_MISMATCH')::bigint AS mismatch,
          COUNT(*) FILTER (WHERE status='SOURCE_UNAVAILABLE')::bigint AS source_unavailable,
          COUNT(*) FILTER (WHERE status='SUPERSEDED')::bigint AS superseded,
          COUNT(*) FILTER (WHERE status='ERROR')::bigint AS errors,
          COUNT(*) FILTER (WHERE status IN ('PENDING','CHECKING'))::bigint AS queue_depth,
          percentile_cont(0.95) WITHIN GROUP (
            ORDER BY EXTRACT(EPOCH FROM (completed_at-started_at))*1000
          ) FILTER (WHERE started_at IS NOT NULL AND completed_at IS NOT NULL)::double precision AS p95_ms
        FROM eligibility.organization_checks
      `);
      const generations = await tx.$queryRaw<Array<{
        source: string;
        record_count: bigint;
        generation_age_seconds: number;
        sync_duration_seconds: number | null;
      }>>(Prisma.sql`
        SELECT source,record_count,
          EXTRACT(EPOCH FROM (clock_timestamp()-published_at))::double precision AS generation_age_seconds,
          CASE WHEN activated_at IS NULL THEN NULL
               ELSE EXTRACT(EPOCH FROM (activated_at-downloaded_at))::double precision END AS sync_duration_seconds
        FROM eligibility.registry_generations
        WHERE status='ACTIVE'
        ORDER BY source
      `);
      const health = await tx.$queryRaw<Array<{ source: string; status: string; consecutive_failures: number }>>(Prisma.sql`
        SELECT source,status,consecutive_failures FROM eligibility.source_health ORDER BY source
      `);
      const roleCounts = await tx.$queryRaw<Array<{ requested_role: string; status: string; policy_version: string; count: bigint }>>(Prisma.sql`
        SELECT requested_role,status,policy_version,COUNT(*)::bigint AS count
        FROM eligibility.organization_checks
        GROUP BY requested_role,status,policy_version
        ORDER BY requested_role,status,policy_version
      `);

      const row = counts[0];
      const lines = [
        '# TYPE eligibility_checks_total counter',
        metric('eligibility_checks_total', Number(row?.total || 0n)),
        '# TYPE eligibility_eligible_total counter',
        metric('eligibility_eligible_total', Number(row?.eligible || 0n)),
        '# TYPE eligibility_review_required_total counter',
        metric('eligibility_review_required_total', Number(row?.review_required || 0n)),
        '# TYPE eligibility_mismatch_total counter',
        metric('eligibility_mismatch_total', Number(row?.mismatch || 0n)),
        '# TYPE eligibility_source_unavailable_total counter',
        metric('eligibility_source_unavailable_total', Number(row?.source_unavailable || 0n)),
        '# TYPE eligibility_superseded_total counter',
        metric('eligibility_superseded_total', Number(row?.superseded || 0n)),
        '# TYPE eligibility_errors_total counter',
        metric('eligibility_errors_total', Number(row?.errors || 0n)),
        '# TYPE eligibility_check_latency_ms gauge',
        metric('eligibility_check_latency_ms', Number(row?.p95_ms || 0)),
        '# TYPE eligibility_queue_depth gauge',
        metric('eligibility_queue_depth', Number(row?.queue_depth || 0n)),
      ];
      for (const generation of generations) {
        lines.push(metric('registry_generation_age_seconds', generation.generation_age_seconds, { source: generation.source }));
        lines.push(metric('registry_sync_duration_seconds', Number(generation.sync_duration_seconds || 0), { source: generation.source }));
        lines.push(metric('registry_records_total', Number(generation.record_count), { source: generation.source }));
      }
      for (const item of health) {
        lines.push(metric('source_health', 1, { source: item.source }));
        lines.push(metric('registry_sync_failure_total', item.consecutive_failures, { source: item.source }));
      }
      for (const item of roleCounts) {
        lines.push(metric('eligibility_checks_by_role_verdict_total', Number(item.count), {
          role: item.requested_role,
          verdict: item.status,
          policy_version: item.policy_version,
        }));
      }
      return `${lines.join('\n')}\n`;
    });
  }
}
