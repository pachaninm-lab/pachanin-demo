import { DealsService } from './deals.service';

function makeRepo() {
  return {
    list: jest.fn().mockResolvedValue([{ id: 'D1', status: 'ACTIVE', sellerOrgId: 'S1', buyerOrgId: 'B1' }]),
    getById: jest.fn().mockResolvedValue({ id: 'D1', status: 'ACTIVE', sellerOrgId: 'S1', buyerOrgId: 'B1' }),
    workspace: jest.fn().mockReturnValue({ sellerOrgId: 'S1', buyerOrgId: 'B1', completeness: { isComplete: false }, payment: { status: 'PENDING' }, blockers: [] }),
    passport: jest.fn().mockReturnValue({}),
    timeline: jest.fn().mockReturnValue([]),
    create: jest.fn().mockReturnValue({ id: 'D2' }),
    transition: jest.fn().mockReturnValue({ id: 'D1', status: 'SIGNED' }),
  } as any;
}

function makeExecutor() {
  return {
    assertPermission: jest.fn(),
    assertObjectScope: jest.fn(),
    execute: jest.fn().mockResolvedValue({ result: { id: 'D1' }, auditId: 'A1' }),
  } as any;
}

const adminUser = { id: 'u1', role: 'ADMIN' as any, orgId: 'S1', email: 'admin@test.com' };

describe('DealsService (repository boundary)', () => {
  it('list() delegates to the deal repository', async () => {
    const repo = makeRepo();
    const svc = new DealsService(repo, makeExecutor());
    const result = await svc.list(adminUser);
    expect(repo.list).toHaveBeenCalledWith(adminUser);
    expect(result).toEqual([{ id: 'D1', status: 'ACTIVE', sellerOrgId: 'S1', buyerOrgId: 'B1' }]);
  });

  it('getOne() reads via repository and enforces object scope', async () => {
    const repo = makeRepo();
    const exec = makeExecutor();
    const svc = new DealsService(repo, exec);
    const result = await svc.getOne('D1', adminUser);
    expect(repo.getById).toHaveBeenCalledWith('D1');
    expect(exec.assertObjectScope).toHaveBeenCalledWith(
      adminUser,
      'deal.view',
      expect.objectContaining({ objectType: 'deal', objectId: 'D1', ownerOrgId: 'S1', counterpartyOrgId: 'B1' }),
    );
    expect(result.id).toBe('D1');
  });

  it('workspace() checks permission and object scope via repository', () => {
    const repo = makeRepo();
    const exec = makeExecutor();
    const svc = new DealsService(repo, exec);
    const ws = svc.workspace('D1', adminUser);
    expect(exec.assertPermission).toHaveBeenCalledWith(adminUser, 'deal.view');
    expect(repo.workspace).toHaveBeenCalledWith('D1');
    expect(ws.sellerOrgId).toBe('S1');
  });

  it('passport() and timeline() delegate to repository', () => {
    const repo = makeRepo();
    const svc = new DealsService(repo, makeExecutor());
    svc.passport('D1', adminUser);
    svc.timeline('D1', adminUser);
    expect(repo.passport).toHaveBeenCalledWith('D1');
    expect(repo.timeline).toHaveBeenCalledWith('D1');
  });

  it('create() routes through the action executor and repository', async () => {
    const repo = makeRepo();
    const exec = makeExecutor();
    exec.execute = jest.fn(async ({ fn }: any) => ({ result: await fn(), auditId: 'A1' }));
    const svc = new DealsService(repo, exec);
    await svc.create({} as any, adminUser);
    expect(repo.create).toHaveBeenCalledWith({}, adminUser);
  });

  it('transition() builds release gates from repository workspace and delegates', async () => {
    const repo = makeRepo();
    const exec = makeExecutor();
    let captured: any;
    exec.execute = jest.fn(async (args: any) => {
      captured = args;
      return { result: await args.fn(), auditId: 'A1' };
    });
    const svc = new DealsService(repo, exec);
    await svc.transition('D1', { nextState: 'SETTLED' }, adminUser);
    expect(repo.getById).toHaveBeenCalledWith('D1');
    expect(repo.workspace).toHaveBeenCalledWith('D1');
    // PENDING payment + incomplete docs => release gates closed
    expect(captured.gates.documentsComplete).toBe(false);
    expect(captured.gates.reserveConfirmed).toBe(false);
    expect(repo.transition).toHaveBeenCalledWith('D1', 'SETTLED', adminUser, undefined);
  });
});
