import { DisputesService } from './disputes.service';
import { Role, type RequestUser } from '../../common/types/request-user';
import type { DisputeCommandService } from './dispute-command.service';
import type { DisputeQueryService } from './dispute-query.service';

const USER: RequestUser = {
  id: 'user-buyer',
  email: 'buyer@example.invalid',
  orgId: 'org-buyer',
  tenantId: 'tenant-1',
  sessionId: 'session-1',
  role: Role.BUYER,
};

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dispute:1',
    dealId: 'deal-1',
    status: 'OPEN',
    type: 'quality',
    description: 'Quality deviation',
    initiatorOrgId: 'org-buyer',
    respondentOrgId: 'org-seller',
    claimAmountKopecks: '5000000',
    severity: 'MEDIUM',
    createdAt: '2026-07-15T09:00:00.000Z',
    updatedAt: '2026-07-15T09:00:00.000Z',
    evidence: [],
    appeals: [],
    moneyHold: {
      amountKopecks: '5000000',
      status: 'HELD',
      reason: 'Claim hold',
      heldAt: '2026-07-15T09:00:00.000Z',
    },
    ...overrides,
  };
}

describe('DisputesService — canonical PostgreSQL authority facade', () => {
  let queries: jest.Mocked<Pick<DisputeQueryService, 'list' | 'get'>>;
  let commands: jest.Mocked<Pick<
    DisputeCommandService,
    'open' | 'triage' | 'addEvidence' | 'resolve' | 'openAppeal' | 'resolveAppeal'
  >>;
  let service: DisputesService;

  beforeEach(() => {
    queries = {
      list: jest.fn().mockResolvedValue([snapshot()]),
      get: jest.fn().mockResolvedValue(snapshot()),
    };
    commands = {
      open: jest.fn().mockResolvedValue(snapshot()),
      triage: jest.fn().mockResolvedValue(snapshot({ status: 'UNDER_REVIEW' })),
      addEvidence: jest.fn().mockResolvedValue(snapshot()),
      resolve: jest.fn().mockResolvedValue(snapshot({ status: 'RESOLVED', outcome: 'BUYER_WINS' })),
      openAppeal: jest.fn().mockResolvedValue(snapshot({ status: 'APPEALED' })),
      resolveAppeal: jest.fn().mockResolvedValue(snapshot({ status: 'FINAL' })),
    };
    service = new DisputesService(
      queries as unknown as DisputeQueryService,
      commands as unknown as DisputeCommandService,
    );
  });

  it('converts compatibility rubles to integer kopecks before the command boundary', async () => {
    await service.create({
      dealId: 'deal-1',
      reason: 'quality',
      detail: 'Quality deviation',
      claimAmountRub: 50_000,
      idempotencyKey: 'open-1',
    }, USER);

    expect(commands.open).toHaveBeenCalledWith(expect.objectContaining({
      claimAmountKopecks: '5000000',
      idempotencyKey: 'open-1',
    }), USER);
  });

  it('maps legacy decision wording onto the canonical outcome without owning money logic', async () => {
    const result = await service.decision('dispute:1', {
      outcome: 'BUYER_WIN',
      note: 'Evidence confirmed',
      idempotencyKey: 'resolve-1',
    }, { ...USER, role: Role.ARBITRATOR });

    expect(commands.resolve).toHaveBeenCalledWith('dispute:1', expect.objectContaining({
      outcome: 'BUYER_WINS',
      idempotencyKey: 'resolve-1',
    }), expect.objectContaining({ role: Role.ARBITRATOR }));
    expect(result.moneyInstruction.action).toBe('REFUND_BUYER');
  });

  it('derives presentation amounts from persisted minor units', async () => {
    const result = await service.getOne('dispute:1', USER);
    expect(result.claimAmountRub).toBe(50_000);
    expect(result.moneyHold?.amountRub).toBe(50_000);
  });
});
