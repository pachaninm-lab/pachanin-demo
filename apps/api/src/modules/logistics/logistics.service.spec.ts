import { GoneException } from '@nestjs/common';
import { Role } from '../../common/types/request-user';
import { LogisticsService } from './logistics.service';

function makeRepo() {
  return {
    list: jest.fn().mockResolvedValue([{ id: 'SHIP-1', status: 'IN_TRANSIT' }]),
    getById: jest.fn().mockResolvedValue({ id: 'SHIP-1' }),
    workspace: jest.fn().mockResolvedValue({ shipment: { id: 'SHIP-1' }, checkpoints: [], gpsTrack: [] }),
    recordCheckpoint: jest.fn().mockResolvedValue({ shipment: { id: 'SHIP-1' }, duplicate: false }),
    recordGps: jest.fn().mockResolvedValue({ shipment: { id: 'SHIP-1' }, duplicate: false }),
    getGpsTrack: jest.fn().mockResolvedValue([]),
    verifyPin: jest.fn().mockResolvedValue({ shipment: { id: 'SHIP-1' }, valid: true, duplicate: false }),
  } as any;
}

const user = {
  id: 'driver-1',
  role: Role.DRIVER,
  orgId: 'carrier-1',
  tenantId: 'tenant-1',
  sessionId: 'session-1',
  email: 'driver@example.test',
} as any;

describe('LogisticsService PostgreSQL authority boundary', () => {
  it('passes trusted user scope to every repository read', async () => {
    const repo = makeRepo();
    const service = new LogisticsService(repo);

    await service.list(user);
    await service.getOne('SHIP-1', user);
    await service.workspace('SHIP-1', user);
    await service.getGpsTrack('SHIP-1', user);

    expect(repo.list).toHaveBeenCalledWith(user);
    expect(repo.getById).toHaveBeenCalledWith('SHIP-1', user);
    expect(repo.workspace).toHaveBeenCalledWith('SHIP-1', user);
    expect(repo.getGpsTrack).toHaveBeenCalledWith('SHIP-1', user);
  });

  it('delegates typed checkpoint, GPS and PIN commands without local mutation', async () => {
    const repo = makeRepo();
    const service = new LogisticsService(repo);
    const base = {
      commandId: 'command-1',
      idempotencyKey: 'key-1',
      expectedVersion: '0',
    };

    await service.recordCheckpoint('SHIP-1', {
      ...base,
      type: 'ARRIVAL',
      occurredAt: new Date().toISOString(),
    }, user);
    await service.updateGps('SHIP-1', {
      ...base,
      lat: 52,
      lng: 41,
      recordedAt: new Date().toISOString(),
    }, user);
    await service.verifyPin('SHIP-1', { ...base, pin: '1234' }, user);

    expect(repo.recordCheckpoint).toHaveBeenCalledWith('SHIP-1', expect.objectContaining({ type: 'ARRIVAL' }), user);
    expect(repo.recordGps).toHaveBeenCalledWith('SHIP-1', expect.objectContaining({ lat: 52, lng: 41 }), user);
    expect(repo.verifyPin).toHaveBeenCalledWith('SHIP-1', expect.objectContaining({ pin: '1234' }), user);
  });

  it('fails closed on legacy create and free-form transition routes', () => {
    const service = new LogisticsService(makeRepo());
    expect(() => service.create({ dealId: 'DEAL-1' } as any, user)).toThrow(GoneException);
    expect(() => service.transition('SHIP-1', { nextState: 'IN_TRANSIT' } as any, user)).toThrow(GoneException);
  });
});
