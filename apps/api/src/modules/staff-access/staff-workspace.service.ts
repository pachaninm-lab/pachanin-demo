import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RequestUser } from '../../common/types/request-user';
import { StaffAccessRepository } from './staff-access.repository';
import { StaffAccessService } from './staff-access.service';
import { StaffAccessContext, StaffPermission } from './staff-access.types';

type CriticalActionProjection = {
  id: string;
  requester_user_id: string;
  access_session_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  target_tenant_id: string | null;
  target_organization_id: string | null;
  required_approvals: number;
  approvals: number;
  status: string;
  expires_at: Date;
  created_at: Date;
};

@Injectable()
export class StaffWorkspaceService {
  constructor(
    private readonly repository: StaffAccessRepository,
    private readonly access: StaffAccessService,
  ) {}

  async supportQueue(user: RequestUser) {
    await this.access.requirePermission(user, StaffPermission.SUPPORT_CASE_READ);
    const now = new Date();
    const [deals, kycTasks] = await Promise.all([
      this.repository.prisma.deal.findMany({
        where: {
          OR: [
            { status: { notIn: ['CLOSED', 'CANCELLED'] }, slaAt: { lt: now } },
            { shipments: { some: { blockers: { not: null } } } },
          ],
        },
        select: {
          id: true,
          dealNumber: true,
          status: true,
          sellerOrgId: true,
          buyerOrgId: true,
          nextAction: true,
          slaAt: true,
          updatedAt: true,
          shipments: {
            where: { blockers: { not: null } },
            select: { id: true, status: true, blockers: true, nextAction: true, updatedAt: true },
            orderBy: { updatedAt: 'desc' },
            take: 10,
          },
        },
        orderBy: [{ slaAt: 'asc' }, { updatedAt: 'desc' }],
        take: 200,
      }),
      this.repository.prisma.kycTask.findMany({
        where: { status: { notIn: ['RESOLVED', 'CLOSED', 'APPROVED'] } },
        select: { id: true, organizationId: true, type: true, status: true, assignedTo: true, createdAt: true, updatedAt: true },
        orderBy: { updatedAt: 'asc' },
        take: 100,
      }),
    ]);
    const organizationIds = [...new Set([
      ...deals.flatMap((deal) => [deal.sellerOrgId, deal.buyerOrgId]),
      ...kycTasks.map((task) => task.organizationId),
    ])];
    const organizations = organizationIds.length
      ? await this.repository.prisma.organization.findMany({
          where: { id: { in: organizationIds } },
          select: { id: true, name: true, inn: true, status: true, kycStatus: true, amlStatus: true },
        })
      : [];
    const organizationById = new Map(organizations.map((organization) => [organization.id, organization]));
    return {
      generatedAt: now.toISOString(),
      deals: deals.map((deal) => ({
        id: deal.id,
        dealNumber: deal.dealNumber,
        status: deal.status,
        seller: organizationById.get(deal.sellerOrgId) || { id: deal.sellerOrgId },
        buyer: organizationById.get(deal.buyerOrgId) || { id: deal.buyerOrgId },
        nextAction: deal.nextAction,
        slaAt: deal.slaAt,
        overdue: Boolean(deal.slaAt && deal.slaAt < now),
        updatedAt: deal.updatedAt,
        blockers: deal.shipments.map((shipment) => ({
          shipmentId: shipment.id,
          status: shipment.status,
          blocker: shipment.blockers,
          nextAction: shipment.nextAction,
          updatedAt: shipment.updatedAt,
        })),
      })),
      kycTasks: kycTasks.map((task) => ({
        ...task,
        organization: organizationById.get(task.organizationId) || { id: task.organizationId },
      })),
    };
  }

  async operationsQueue(user: RequestUser, staffAccess: StaffAccessContext) {
    await this.access.requirePermission(user, StaffPermission.DEAL_LIST);
    const now = new Date();
    const dealScope = this.dealScope(staffAccess);
    const deals = await this.repository.prisma.deal.findMany({
      where: { AND: [dealScope, { status: { notIn: ['CLOSED', 'CANCELLED'] } }] },
      select: {
        id: true,
        dealNumber: true,
        status: true,
        tenantId: true,
        sellerOrgId: true,
        buyerOrgId: true,
        nextAction: true,
        slaAt: true,
        updatedAt: true,
        shipments: {
          select: { id: true, status: true, blockers: true, nextAction: true, updatedAt: true },
          orderBy: { updatedAt: 'desc' },
          take: 20,
        },
        documents: { select: { status: true, bankRequired: true, releaseRequired: true }, take: 200 },
        payments: { select: { status: true, callbackState: true, updatedAt: true }, orderBy: { updatedAt: 'desc' }, take: 1 },
        bankOperations: { select: { type: true, status: true, failureReason: true, updatedAt: true }, orderBy: { updatedAt: 'desc' }, take: 5 },
        acceptanceRecords: { select: { status: true, qualityStatus: true, updatedAt: true }, orderBy: { updatedAt: 'desc' }, take: 5 },
      },
      orderBy: [{ slaAt: 'asc' }, { updatedAt: 'desc' }],
      take: 500,
    });
    const organizationIds = [...new Set(deals.flatMap((deal) => [deal.sellerOrgId, deal.buyerOrgId]))];
    const organizations = organizationIds.length
      ? await this.repository.prisma.organization.findMany({
          where: { id: { in: organizationIds } },
          select: { id: true, name: true, inn: true },
        })
      : [];
    const organizationById = new Map(organizations.map((organization) => [organization.id, organization]));
    const dealIds = deals.map((deal) => deal.id);
    const disputeRows = dealIds.length
      ? await this.repository.prisma.dispute.groupBy({
          by: ['dealId'],
          where: { dealId: { in: dealIds }, status: { notIn: ['RESOLVED', 'CLOSED', 'CANCELLED'] } },
          _count: { _all: true },
        })
      : [];
    const disputesByDeal = new Map(disputeRows.map((row) => [row.dealId, row._count._all]));
    return {
      generatedAt: now.toISOString(),
      items: deals.map((deal) => {
        const blockedShipments = deal.shipments.filter((shipment) => Boolean(shipment.blockers));
        const pendingDocuments = deal.documents.filter((document) => !['SIGNED', 'ACCEPTED', 'VERIFIED', 'COMPLETED'].includes(document.status));
        return {
          id: deal.id,
          dealNumber: deal.dealNumber,
          status: deal.status,
          tenantId: deal.tenantId,
          seller: organizationById.get(deal.sellerOrgId) || { id: deal.sellerOrgId },
          buyer: organizationById.get(deal.buyerOrgId) || { id: deal.buyerOrgId },
          nextAction: deal.nextAction,
          slaAt: deal.slaAt,
          overdue: Boolean(deal.slaAt && deal.slaAt < now),
          updatedAt: deal.updatedAt,
          shipmentSummary: {
            total: deal.shipments.length,
            blocked: blockedShipments.length,
            active: deal.shipments.filter((shipment) => !['DELIVERED', 'CANCELLED', 'CLOSED'].includes(shipment.status)).length,
            blockers: blockedShipments.map((shipment) => ({ shipmentId: shipment.id, blocker: shipment.blockers, nextAction: shipment.nextAction })),
          },
          documentSummary: {
            total: deal.documents.length,
            pending: pendingDocuments.length,
            releaseBlocking: pendingDocuments.filter((document) => document.releaseRequired || document.bankRequired).length,
          },
          payment: deal.payments[0] || null,
          bankOperations: deal.bankOperations,
          acceptance: deal.acceptanceRecords[0] || null,
          openDisputes: disputesByDeal.get(deal.id) || 0,
        };
      }),
    };
  }

  async financeQueue(user: RequestUser, staffAccess: StaffAccessContext) {
    await this.access.requirePermission(user, StaffPermission.PAYMENT_METADATA_READ);
    const dealScope = this.dealScope(staffAccess);
    const [payments, operations] = await Promise.all([
      this.repository.prisma.payment.findMany({
        where: { deal: { is: dealScope } },
        select: {
          id: true,
          dealId: true,
          status: true,
          amountKopecks: true,
          holdAmountKopecks: true,
          refundedKopecks: true,
          commissionKopecks: true,
          callbackState: true,
          bankRef: true,
          reservedAt: true,
          releasedAt: true,
          updatedAt: true,
          deal: { select: { dealNumber: true, status: true, nextAction: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 300,
      }),
      this.repository.prisma.bankOperation.findMany({
        where: { deal: { is: dealScope } },
        select: {
          id: true,
          dealId: true,
          type: true,
          status: true,
          amountKopecks: true,
          currency: true,
          bankRef: true,
          bankName: true,
          failureReason: true,
          confirmedAt: true,
          createdAt: true,
          updatedAt: true,
          deal: { select: { dealNumber: true, status: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 300,
      }),
    ]);
    return {
      generatedAt: new Date().toISOString(),
      payments,
      bankOperations: operations.map((operation) => ({
        ...operation,
        amountKopecks: operation.amountKopecks.toString(),
      })),
    };
  }

  async diagnostics(user: RequestUser, staffAccess: StaffAccessContext) {
    await this.access.requirePermission(user, StaffPermission.DIAGNOSTIC_READ);
    const dealScope = this.dealScope(staffAccess);
    const scopedDealIds = await this.scopedDealIds(staffAccess, dealScope);
    const dealIdWhere = scopedDealIds === null ? undefined : { dealId: { in: scopedDealIds } };
    const attemptWhere = scopedDealIds === null
      ? undefined
      : { snapshot: { is: { deal: { is: dealScope } } } };
    const [integrations, outbox, attempts] = await Promise.all([
      this.repository.prisma.integrationEvent.findMany({
        where: dealIdWhere,
        select: { id: true, adapterName: true, direction: true, eventType: true, dealId: true, status: true, errorMessage: true, httpStatus: true, durationMs: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 300,
      }),
      this.repository.prisma.outboxEntry.findMany({
        where: dealIdWhere,
        select: { id: true, type: true, dealId: true, status: true, retryCount: true, maxRetries: true, nextRetryAt: true, lastError: true, correlationId: true, createdAt: true, sentAt: true, confirmedAt: true, failedAt: true },
        orderBy: { createdAt: 'desc' },
        take: 300,
      }),
      this.repository.prisma.dealWorkspaceRuntimeTransactionAttempt.findMany({
        where: attemptWhere,
        select: { id: true, transactionId: true, correlationId: true, stage: true, outcome: true, failureCode: true, failureReason: true, isReplay: true, startedAt: true, completedAt: true },
        orderBy: { startedAt: 'desc' },
        take: 300,
      }),
    ]);
    return {
      generatedAt: new Date().toISOString(),
      integrations,
      outbox,
      runtimeAttempts: attempts,
    };
  }

  private dealScope(staffAccess: StaffAccessContext): Prisma.DealWhereInput {
    const filters: Prisma.DealWhereInput[] = [];
    if (staffAccess.targetDealId) filters.push({ id: staffAccess.targetDealId });
    if (staffAccess.effectiveTenantId) filters.push({ tenantId: staffAccess.effectiveTenantId });
    if (staffAccess.effectiveOrganizationId) {
      filters.push({
        OR: [
          { sellerOrgId: staffAccess.effectiveOrganizationId },
          { buyerOrgId: staffAccess.effectiveOrganizationId },
        ],
      });
    }
    return filters.length === 0 ? {} : { AND: filters };
  }

  private async scopedDealIds(
    staffAccess: StaffAccessContext,
    dealScope: Prisma.DealWhereInput,
  ): Promise<string[] | null> {
    const scoped = Boolean(
      staffAccess.targetDealId
      || staffAccess.effectiveTenantId
      || staffAccess.effectiveOrganizationId,
    );
    if (!scoped) return null;
    const deals = await this.repository.prisma.deal.findMany({
      where: dealScope,
      select: { id: true },
    });
    return deals.map((deal) => deal.id);
  }

  async ownCriticalActions(user: RequestUser) {
    await this.access.requirePermission(user, StaffPermission.CRITICAL_ACTION_REQUEST);
    return this.repository.prisma.$queryRaw<CriticalActionProjection[]>(Prisma.sql`
      SELECT
        r.id,
        r.requester_user_id,
        r.access_session_id,
        r.action,
        r.resource_type,
        r.resource_id,
        r.target_tenant_id,
        r.target_organization_id,
        r.required_approvals,
        COUNT(a.id)::INTEGER AS approvals,
        r.status,
        r.expires_at,
        r.created_at
      FROM auth.staff_critical_action_requests r
      LEFT JOIN auth.staff_critical_action_approvals a
        ON a.critical_request_id = r.id AND a.decision = 'APPROVE'
      WHERE r.requester_user_id = ${user.id}
        AND r.status IN ('PENDING', 'APPROVED')
        AND r.expires_at > NOW()
      GROUP BY r.id
      ORDER BY r.created_at DESC
      LIMIT 200
    `);
  }

  async criticalActions(user: RequestUser) {
    await this.access.requirePermission(user, StaffPermission.CRITICAL_ACTION_APPROVE);
    return this.repository.prisma.$queryRaw<CriticalActionProjection[]>(Prisma.sql`
      SELECT
        r.id,
        r.requester_user_id,
        r.access_session_id,
        r.action,
        r.resource_type,
        r.resource_id,
        r.target_tenant_id,
        r.target_organization_id,
        r.required_approvals,
        COUNT(a.id)::INTEGER AS approvals,
        r.status,
        r.expires_at,
        r.created_at
      FROM auth.staff_critical_action_requests r
      LEFT JOIN auth.staff_critical_action_approvals a
        ON a.critical_request_id = r.id AND a.decision = 'APPROVE'
      WHERE r.status IN ('PENDING', 'APPROVED')
        AND r.expires_at > NOW()
      GROUP BY r.id
      ORDER BY r.created_at DESC
      LIMIT 200
    `);
  }
}
