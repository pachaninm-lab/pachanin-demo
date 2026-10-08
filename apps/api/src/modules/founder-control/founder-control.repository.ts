import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { StaffAuthorityPrismaService } from '../staff-access/staff-authority-prisma.service';
import {
  FounderDecisionQueueRow,
  FounderMetricDrillDownRow,
  FounderMetricId,
  FounderMetricRow,
} from './founder-control.types';

@Injectable()
export class FounderControlRepository {
  constructor(private readonly prisma: StaffAuthorityPrismaService) {}

  companyHealth(actorUserId: string, authSessionId: string): Promise<FounderMetricRow[]> {
    return this.prisma.$queryRaw<FounderMetricRow[]>(Prisma.sql`
      SELECT *
      FROM auth.founder_company_health(${actorUserId}, ${authSessionId})
    `);
  }

  decisionQueue(
    actorUserId: string,
    authSessionId: string,
    limit: number,
  ): Promise<FounderDecisionQueueRow[]> {
    return this.prisma.$queryRaw<FounderDecisionQueueRow[]>(Prisma.sql`
      SELECT *
      FROM auth.founder_decision_queue(${actorUserId}, ${authSessionId}, ${limit})
    `);
  }

  metricDrillDown(
    actorUserId: string,
    authSessionId: string,
    metricId: FounderMetricId,
    limit: number,
  ): Promise<FounderMetricDrillDownRow[]> {
    return this.prisma.$queryRaw<FounderMetricDrillDownRow[]>(Prisma.sql`
      SELECT *
      FROM auth.founder_metric_drilldown(
        ${actorUserId},
        ${authSessionId},
        ${metricId},
        ${limit}
      )
    `);
  }
}
