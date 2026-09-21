import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { FounderControlRepository } from './founder-control.repository';
import { FounderControlService } from './founder-control.service';

const user = {
  id: 'founder-user',
  orgId: 'owner-org',
  role: 'EXECUTIVE',
  email: 'founder@example.test',
  sessionId: 'auth-session-1',
  mfaVerified: true,
  mfaVerifiedAt: '2026-09-21T07:00:00.000Z',
} as const;

describe('FounderControlService', () => {
  const repository = {
    companyHealth: jest.fn(),
    decisionQueue: jest.fn(),
    metricDrillDown: jest.fn(),
  };
  const staffAccess = {
    requireActivePlatformOwner: jest.fn(),
  };

  let service: FounderControlService;

  beforeEach(() => {
    jest.resetAllMocks();
    staffAccess.requireActivePlatformOwner.mockResolvedValue({ id: 'assignment-1' });
    service = new FounderControlService(
      repository as unknown as FounderControlRepository,
      staffAccess as never,
    );
  });

  it('returns real PostgreSQL metric metadata and exact integer strings', async () => {
    repository.companyHealth.mockResolvedValue([
      {
        metric_id: 'business.open_deals',
        category: 'BUSINESS',
        value_count: 7n,
        unit: 'COUNT',
        as_of: new Date('2026-09-21T07:01:00.000Z'),
        source_relation: 'public.deals',
        freshness_state: 'CURRENT',
        grain: 'platform-wide canonical Deal rows at query time',
        definition: 'Deals whose canonical status is not SETTLED, CLOSED, CANCELLATION or CANCELLED.',
      },
      {
        metric_id: 'operations.active_shipments',
        category: 'OPERATIONS',
        value_count: 3n,
        unit: 'COUNT',
        as_of: new Date('2026-09-21T07:01:00.000Z'),
        source_relation: 'public.shipments',
        freshness_state: 'CURRENT',
        grain: 'platform-wide canonical Shipment rows at query time',
        definition: 'Shipments not in DELIVERED, COMPLETED, CANCELLED, CLOSED or FAILED terminal states.',
      },
      {
        metric_id: 'finance.unmatched_statement_entries',
        category: 'FINANCE',
        value_count: 2n,
        unit: 'COUNT',
        as_of: new Date('2026-09-21T07:01:00.000Z'),
        source_relation: 'public.bank_statement_entries',
        freshness_state: 'CURRENT',
        grain: 'platform-wide bank statement entries at query time',
        definition: 'Bank statement entries whose reconciliation match state is UNMATCHED or MISMATCH.',
      },
      {
        metric_id: 'risk.high_critical_open_disputes',
        category: 'RISK',
        value_count: 1n,
        unit: 'COUNT',
        as_of: new Date('2026-09-21T07:01:00.000Z'),
        source_relation: 'dispute.cases',
        freshness_state: 'CURRENT',
        grain: 'platform-wide canonical dispute cases at query time',
        definition: 'Unresolved canonical disputes with HIGH or CRITICAL severity.',
      },
      {
        metric_id: 'system.outbox_attention_entries',
        category: 'SYSTEM',
        value_count: 4n,
        unit: 'COUNT',
        as_of: new Date('2026-09-21T07:01:00.000Z'),
        source_relation: 'public.outbox_entries',
        freshness_state: 'CURRENT',
        grain: 'platform-wide canonical durable outbox rows at query time',
        definition: 'Canonical durable outbox entries in DEAD_LETTER or MANUAL_REVIEW.',
      },
    ]);

    const result = await service.companyHealth(user as never);

    expect(staffAccess.requireActivePlatformOwner).toHaveBeenCalledWith(user);
    expect(repository.companyHealth).toHaveBeenCalledWith(user.id, user.sessionId);
    expect(result.availability).toBe('AVAILABLE');
    expect(result.metrics).toHaveLength(5);
    expect(result.metrics[0]).toMatchObject({
      id: 'business.open_deals',
      availability: 'AVAILABLE',
      value: '7',
      source: {
        authority: 'POSTGRESQL',
        relation: 'public.deals',
        freshness: 'CURRENT',
      },
    });
    expect(result.metrics[0].drillDown.href).toContain('business.open_deals');
  });

  it('never converts source failure into fake or zero Company Health values', async () => {
    repository.companyHealth.mockRejectedValue(new Error('database unavailable'));

    const result = await service.companyHealth(user as never);

    expect(result.availability).toBe('UNAVAILABLE');
    for (const metric of result.metrics) {
      expect(metric.availability).toBe('UNAVAILABLE');
      expect(metric.value).toBeNull();
      expect(metric.source.asOf).toBeNull();
      expect(metric.source.freshness).toBe('UNKNOWN');
    }
  });

  it('returns the server-owned P0/P1 queue contract with owner, deadline, impact and source', async () => {
    repository.decisionQueue.mockResolvedValue([
      {
        item_id: 'dispute:d1:v3',
        object_type: 'DISPUTE',
        object_id: 'd1',
        object_version: '3',
        priority: 'P0',
        owner_kind: 'UNASSIGNED',
        owner_id: null,
        deadline: new Date('2026-09-21T07:05:00.000Z'),
        impact: { dealId: 'deal-1', claimAmountMinor: '500000' },
        next_action: 'ASSIGN_AND_TRIAGE',
        escalation: 'ASSIGN_OWNER',
        source_relation: 'dispute.cases',
        source_ref: 'dispute.cases/d1',
        as_of: new Date('2026-09-21T07:01:00.000Z'),
        freshness_state: 'CURRENT',
      },
    ]);

    const result = await service.decisionQueue(user as never, 25);

    expect(repository.decisionQueue).toHaveBeenCalledWith(user.id, user.sessionId, 25);
    expect(result.items[0]).toMatchObject({
      itemId: 'dispute:d1:v3',
      priority: 'P0',
      owner: { kind: 'UNASSIGNED', id: null },
      deadline: '2026-09-21T07:05:00.000Z',
      nextAction: 'ASSIGN_AND_TRIAGE',
      escalation: 'ASSIGN_OWNER',
      source: {
        authority: 'POSTGRESQL',
        relation: 'dispute.cases',
        ref: 'dispute.cases/d1',
        freshness: 'CURRENT',
      },
    });
  });

  it('requires the authenticated durable session before reading Founder data', async () => {
    await expect(service.companyHealth({ ...user, sessionId: undefined } as never))
      .rejects.toBeInstanceOf(UnauthorizedException);
    expect(repository.companyHealth).not.toHaveBeenCalled();
  });

  it('fails closed when PostgreSQL says Founder authority was revoked after server precheck', async () => {
    repository.companyHealth.mockRejectedValue({
      code: 'P2010',
      meta: { code: '42501' },
    });

    await expect(service.companyHealth(user as never))
      .rejects.toBeInstanceOf(ForbiddenException);
  });
});
