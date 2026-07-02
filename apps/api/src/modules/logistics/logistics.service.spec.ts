import { LogisticsService } from './logistics.service';
import { Role } from '../../common/types/request-user';

function makeRepo(shipment: any) {
  return {
    getById: jest.fn().mockResolvedValue(shipment),
    workspace: jest.fn().mockReturnValue(shipment),
    list: jest.fn().mockResolvedValue([shipment]),
    create: jest.fn((dto: any) => dto),
  } as any;
}

const OWN_SHIPMENT = { id: 'SHIP-1', dealId: 'D1', logisticsOrgId: 'org-log-1', driverUserId: 'drv-1' };

describe('LogisticsService access scope', () => {
  it('lets a logistician read a shipment stamped with their own org (H5)', async () => {
    const svc = new LogisticsService(makeRepo(OWN_SHIPMENT));
    const logi = { id: 'u1', role: Role.LOGISTICIAN, orgId: 'org-log-1', email: 'l@x.ru' } as any;
    await expect(svc.getOne('SHIP-1', logi)).resolves.toMatchObject({ id: 'SHIP-1' });
  });

  it('denies a logistician from another org (H5 — carrier-org isolation)', async () => {
    const svc = new LogisticsService(makeRepo(OWN_SHIPMENT));
    const foreign = { id: 'u2', role: Role.LOGISTICIAN, orgId: 'org-log-2', email: 'l2@x.ru' } as any;
    await expect(svc.getOne('SHIP-1', foreign)).rejects.toThrow(/own organization shipments/);
  });

  it('keeps legacy unstamped shipments accessible to logisticians (non-breaking)', async () => {
    const legacy = { ...OWN_SHIPMENT, logisticsOrgId: null };
    const svc = new LogisticsService(makeRepo(legacy));
    const anyLogi = { id: 'u3', role: Role.LOGISTICIAN, orgId: 'org-log-9', email: 'l3@x.ru' } as any;
    await expect(svc.getOne('SHIP-1', anyLogi)).resolves.toMatchObject({ id: 'SHIP-1' });
  });

  it('denies a driver an unassigned shipment (driver isolation hardening)', async () => {
    const svc = new LogisticsService(makeRepo({ ...OWN_SHIPMENT, driverUserId: null }));
    const driver = { id: 'drv-x', role: Role.DRIVER, orgId: 'org-log-1', email: 'd@x.ru' } as any;
    await expect(svc.getOne('SHIP-1', driver)).rejects.toThrow(/own assigned shipment/);
  });

  it('stamps the creating logistician org onto new shipments', () => {
    const repo = makeRepo(OWN_SHIPMENT);
    const svc = new LogisticsService(repo);
    const logi = { id: 'u1', role: Role.LOGISTICIAN, orgId: 'org-log-7', email: 'l@x.ru' } as any;
    svc.create({ dealId: 'D9' } as any, logi);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ logisticsOrgId: 'org-log-7' }), logi);
  });
});
