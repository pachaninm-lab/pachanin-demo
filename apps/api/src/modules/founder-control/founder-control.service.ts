import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { RequestUser } from '../../common/types/request-user';
import { StaffAccessService } from '../staff-access/staff-access.service';
import {
  FOUNDER_CONTROL_SCHEMA_VERSION,
  FOUNDER_METRIC_DEFINITIONS,
  FounderDecisionQueueRow,
  FounderMetricDrillDownRow,
  FounderMetricId,
  FounderMetricRow,
  isFounderMetricId,
} from './founder-control.types';
import { FounderControlRepository } from './founder-control.repository';

type SourceFailure = Readonly<{
  availability: 'UNAVAILABLE';
  reasonCode: 'POSTGRESQL_SOURCE_UNAVAILABLE';
}>;

function iso(value: Date): string {
  return value.toISOString();
}

function authorizationSqlState(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as {
    code?: unknown;
    meta?: { code?: unknown };
  };
  return candidate.code === 'P2010' && candidate.meta?.code === '42501';
}

@Injectable()
export class FounderControlService {
  private readonly logger = new Logger(FounderControlService.name);

  constructor(
    private readonly repository: FounderControlRepository,
    private readonly staffAccess: StaffAccessService,
  ) {}

  async overview(user: RequestUser, decisionLimit = 50) {
    const authSessionId = await this.authorize(user);
    const [companyHealth, decisionQueue] = await Promise.all([
      this.companyHealthAuthorized(user.id, authSessionId),
      this.decisionQueueAuthorized(user.id, authSessionId, this.limit(decisionLimit)),
    ]);

    return {
      schemaVersion: FOUNDER_CONTROL_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      companyHealth,
      decisionQueue,
    };
  }

  async companyHealth(user: RequestUser) {
    const authSessionId = await this.authorize(user);
    return this.companyHealthAuthorized(user.id, authSessionId);
  }

  async decisionQueue(user: RequestUser, limit = 50) {
    const authSessionId = await this.authorize(user);
    return this.decisionQueueAuthorized(user.id, authSessionId, this.limit(limit));
  }

  async metricDrillDown(user: RequestUser, metricId: string, limit = 50) {
    const authSessionId = await this.authorize(user);
    if (!isFounderMetricId(metricId)) {
      throw new BadRequestException('Unknown Founder Company Health metric');
    }

    try {
      const rows = await this.repository.metricDrillDown(
        user.id,
        authSessionId,
        metricId,
        this.limit(limit),
      );
      return {
        schemaVersion: FOUNDER_CONTROL_SCHEMA_VERSION,
        metricId,
        availability: 'AVAILABLE' as const,
        source: this.definition(metricId).sourceRelation,
        generatedAt: new Date().toISOString(),
        items: rows.map((row) => this.drillDownRow(row)),
      };
    } catch (error) {
      this.rethrowAuthority(error);
      this.logger.warn(`Founder metric drill-down source unavailable: ${metricId}`);
      return {
        schemaVersion: FOUNDER_CONTROL_SCHEMA_VERSION,
        metricId,
        availability: 'UNAVAILABLE' as const,
        reasonCode: 'POSTGRESQL_SOURCE_UNAVAILABLE' as const,
        source: this.definition(metricId).sourceRelation,
        generatedAt: new Date().toISOString(),
        items: [],
      };
    }
  }

  private async authorize(user: RequestUser): Promise<string> {
    const authSessionId = String(user.sessionId ?? '').trim();
    if (!authSessionId) {
      throw new UnauthorizedException('Founder Control Center requires an authenticated durable session');
    }
    await this.staffAccess.requireActivePlatformOwner(user);
    return authSessionId;
  }

  private async companyHealthAuthorized(actorUserId: string, authSessionId: string) {
    try {
      const rows = await this.repository.companyHealth(actorUserId, authSessionId);
      const byId = new Map(rows.map((row) => [row.metric_id, row]));
      return {
        availability: 'AVAILABLE' as const,
        metrics: FOUNDER_METRIC_DEFINITIONS.map((definition) => {
          const row = byId.get(definition.id);
          if (!row) {
            return this.unavailableMetric(definition.id);
          }
          return this.metric(row, definition.id);
        }),
      };
    } catch (error) {
      this.rethrowAuthority(error);
      this.logger.warn('Founder Company Health PostgreSQL source unavailable');
      return {
        availability: 'UNAVAILABLE' as const,
        reasonCode: 'POSTGRESQL_SOURCE_UNAVAILABLE' as const,
        metrics: FOUNDER_METRIC_DEFINITIONS.map((definition) =>
          this.unavailableMetric(definition.id)),
      };
    }
  }

  private async decisionQueueAuthorized(
    actorUserId: string,
    authSessionId: string,
    limit: number,
  ) {
    try {
      const rows = await this.repository.decisionQueue(actorUserId, authSessionId, limit);
      return {
        availability: 'AVAILABLE' as const,
        source: 'dispute.cases',
        priorityPolicy: 'CRITICAL=>P0;HIGH=>P1',
        generatedAt: new Date().toISOString(),
        items: rows.map((row) => this.decisionRow(row)),
      };
    } catch (error) {
      this.rethrowAuthority(error);
      this.logger.warn('Founder P0/P1 decision queue PostgreSQL source unavailable');
      const failure: SourceFailure = {
        availability: 'UNAVAILABLE',
        reasonCode: 'POSTGRESQL_SOURCE_UNAVAILABLE',
      };
      return {
        ...failure,
        source: 'dispute.cases',
        priorityPolicy: 'CRITICAL=>P0;HIGH=>P1',
        generatedAt: new Date().toISOString(),
        items: [],
      };
    }
  }

  private metric(row: FounderMetricRow, metricId: FounderMetricId) {
    const definition = this.definition(metricId);
    if (
      row.metric_id !== metricId
      || row.category !== definition.category
      || row.source_relation !== definition.sourceRelation
      || row.unit !== definition.unit
      || row.freshness_state !== 'CURRENT'
    ) {
      return this.unavailableMetric(metricId, 'SOURCE_CONTRACT_MISMATCH');
    }

    return {
      id: metricId,
      category: definition.category,
      availability: 'AVAILABLE' as const,
      value: row.value_count.toString(),
      valueType: 'INTEGER' as const,
      unit: definition.unit,
      source: {
        authority: 'POSTGRESQL' as const,
        relation: row.source_relation,
        asOf: iso(row.as_of),
        freshness: row.freshness_state,
      },
      grain: row.grain,
      definition: row.definition,
      drillDown: {
        href: `/staff/founder-control/metrics/${encodeURIComponent(metricId)}/drill-down`,
        metricId,
      },
    };
  }

  private unavailableMetric(
    metricId: FounderMetricId,
    reasonCode: 'POSTGRESQL_SOURCE_UNAVAILABLE' | 'SOURCE_CONTRACT_MISMATCH' = 'POSTGRESQL_SOURCE_UNAVAILABLE',
  ) {
    const definition = this.definition(metricId);
    return {
      id: metricId,
      category: definition.category,
      availability: 'UNAVAILABLE' as const,
      reasonCode,
      value: null,
      valueType: 'INTEGER' as const,
      unit: definition.unit,
      source: {
        authority: 'POSTGRESQL' as const,
        relation: definition.sourceRelation,
        asOf: null,
        freshness: 'UNKNOWN' as const,
      },
      grain: definition.grain,
      definition: definition.definition,
      drillDown: {
        href: `/staff/founder-control/metrics/${encodeURIComponent(metricId)}/drill-down`,
        metricId,
      },
    };
  }

  private decisionRow(row: FounderDecisionQueueRow) {
    return {
      itemId: row.item_id,
      object: {
        type: row.object_type,
        id: row.object_id,
        version: row.object_version,
      },
      priority: row.priority,
      owner: row.owner_kind === 'UNASSIGNED'
        ? { kind: 'UNASSIGNED' as const, id: null }
        : { kind: row.owner_kind, id: row.owner_id },
      deadline: iso(row.deadline),
      impact: row.impact,
      nextAction: row.next_action,
      escalation: row.escalation,
      source: {
        authority: 'POSTGRESQL' as const,
        relation: row.source_relation,
        ref: row.source_ref,
        asOf: iso(row.as_of),
        freshness: row.freshness_state,
      },
    };
  }

  private drillDownRow(row: FounderMetricDrillDownRow) {
    return {
      metricId: row.metric_id,
      objectType: row.object_type,
      objectId: row.object_id,
      status: row.status,
      tenantId: row.tenant_id,
      observedAt: iso(row.observed_at),
      metadata: row.metadata,
    };
  }

  private definition(metricId: FounderMetricId) {
    const definition = FOUNDER_METRIC_DEFINITIONS.find((candidate) => candidate.id === metricId);
    if (!definition) throw new BadRequestException('Unknown Founder Company Health metric');
    return definition;
  }

  private limit(value: number): number {
    if (!Number.isInteger(value) || value < 1 || value > 100) {
      throw new BadRequestException('limit must be an integer between 1 and 100');
    }
    return value;
  }

  private rethrowAuthority(error: unknown): void {
    if (authorizationSqlState(error)) {
      throw new ForbiddenException('Founder Control Center authority is no longer valid');
    }
  }
}
