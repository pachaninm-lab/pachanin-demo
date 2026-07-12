import { DealsService } from './deals.service';

function makeRepo() {
  return {
    list: jest.fn().mockResolvedValue([{ id: 'D1', status: 'ACTIVE' }]),
    getById: jest.fn().mockResolvedValue({ id: 'D1', status: 'ACTIVE' }),
    workspace: jest.fn().mockResolvedValue({ deal: { id: 'D1' } }),
    passport: jest.fn().mockResolvedValue({ identity: { id: 'D1' } }),
    timeline: jest.fn().mockResolvedValue({ dealId: 'D1', items: [] }),
    create: jest.fn().mockResolvedValue({ id: 'D2', status: 'DRAFT' }),
  } as any;
}

const user = {
  id: 'u1',
  role: 'FARMER' as any,
  orgId: 'S1',
  tenantId: 'T1',
  sessionId: 'session-u1',
  email: 'farmer@test.com',
};

describe('DealsService PostgreSQL repository boundary', () => {
  it('passes verified user context to every read projection', async () => {
    const repo = makeRepo();
    const service = new DealsService(repo);

    await expect(service.list(user)).resolves.toEqual([{ id: 'D1', status: 'ACTIVE' }]);
    await expect(service.getOne('D1', user)).resolves.toEqual({ id: 'D1', status: 'ACTIVE' });
    await expect(service.workspace('D1', user)).resolves.toEqual({ deal: { id: 'D1' } });
    await expect(service.passport('D1', user)).resolves.toEqual({ identity: { id: 'D1' } });
    await expect(service.timeline('D1', user)).resolves.toEqual({ dealId: 'D1', items: [] });

    expect(repo.list).toHaveBeenCalledWith(user);
    expect(repo.getById).toHaveBeenCalledWith('D1', user);
    expect(repo.workspace).toHaveBeenCalledWith('D1', user);
    expect(repo.passport).toHaveBeenCalledWith('D1', user);
    expect(repo.timeline).toHaveBeenCalledWith('D1', user);
  });

  it('delegates atomic creation without a second event, saga or audit side effect', async () => {
    const repo = makeRepo();
    const service = new DealsService(repo);
    const dto = {
      commandId: 'command-create-0001',
      idempotencyKey: 'idempotency-create-0001',
      lotId: 'LOT-1',
      winnerBidId: 'BID-1',
    };

    await expect(service.create(dto, user)).resolves.toEqual({ id: 'D2', status: 'DRAFT' });
    expect(repo.create).toHaveBeenCalledTimes(1);
    expect(repo.create).toHaveBeenCalledWith(dto, user);
  });

  it('contains no legacy transition method', () => {
    const service = new DealsService(makeRepo());
    expect('transition' in service).toBe(false);
  });
});
