import { RuntimeShipmentRepository } from './runtime-shipment.repository';
import { PrismaShipmentRepository } from './prisma-shipment.repository';
import { selectShipmentRepository } from './shipment-repository.factory';

function makeRuntime() {
  return {
    listShipments: jest.fn().mockReturnValue([{ id: 'SH-1' }]),
    getShipment: jest.fn().mockReturnValue({ id: 'SH-1', driverUserId: 'drv-1' }),
    shipmentWorkspace: jest.fn().mockReturnValue({ id: 'WS' }),
    createShipment: jest.fn().mockReturnValue({ id: 'SH-2' }),
    transitionShipment: jest.fn().mockReturnValue({ id: 'SH-1', status: 'IN_TRANSIT' }),
    recordCheckpoint: jest.fn().mockReturnValue({ checkpoint: { id: 'CP-1' } }),
    verifyPin: jest.fn().mockReturnValue({ ok: true }),
  } as any;
}

describe('RuntimeShipmentRepository (default adapter)', () => {
  it('delegates every read and write to RuntimeCore unchanged', async () => {
    const runtime = makeRuntime();
    const repo = new RuntimeShipmentRepository(runtime);
    const user = { id: 'u1' } as any;

    expect(await repo.list()).toEqual([{ id: 'SH-1' }]);
    expect(runtime.listShipments).toHaveBeenCalled();
    expect(await repo.getById('SH-1')).toEqual({ id: 'SH-1', driverUserId: 'drv-1' });
    expect(runtime.getShipment).toHaveBeenCalledWith('SH-1');
    expect(repo.workspace('SH-1')).toEqual({ id: 'WS' });
    expect(repo.create({}, user)).toEqual({ id: 'SH-2' });
    expect(repo.transition('SH-1', { to: 'IN_TRANSIT' }, user)).toEqual({ id: 'SH-1', status: 'IN_TRANSIT' });
    expect(repo.recordCheckpoint('SH-1', { type: 'GPS' }, user)).toEqual({ checkpoint: { id: 'CP-1' } });
    expect(repo.verifyPin('SH-1', '0000')).toEqual({ ok: true });
    expect(runtime.verifyPin).toHaveBeenCalledWith('SH-1', '0000');
  });
});

describe('PrismaShipmentRepository (disabled DB-backed skeleton)', () => {
  it('requires PrismaService — constructing without it fails loudly', () => {
    expect(() => new PrismaShipmentRepository(undefined)).toThrow(/PrismaService/);
  });

  it('supports list/getById read snapshots via Prisma when explicitly used', async () => {
    const prisma = {
      shipment: {
        findMany: jest.fn().mockResolvedValue([{ id: 'DB-SH1' }]),
        findUnique: jest.fn().mockResolvedValue({ id: 'DB-SH1' }),
      },
    } as any;
    const repo = new PrismaShipmentRepository(prisma);
    expect(await repo.list()).toEqual([{ id: 'DB-SH1' }]);
    expect(prisma.shipment.findMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'desc' } });
    expect(await repo.getById('DB-SH1')).toEqual({ id: 'DB-SH1' });
  });

  it('getById fails loudly when the row is missing — no silent fallback', async () => {
    const prisma = {
      shipment: { findMany: jest.fn(), findUnique: jest.fn().mockResolvedValue(null) },
    } as any;
    const repo = new PrismaShipmentRepository(prisma);
    await expect(repo.getById('X')).rejects.toThrow(/not found in DB-backed/);
  });

  it('does not support workspace/create/transition/recordCheckpoint/verifyPin (fails loudly)', () => {
    const prisma = { shipment: {} } as any;
    const repo = new PrismaShipmentRepository(prisma);
    expect(() => repo.workspace()).toThrow(/not supported/);
    expect(() => repo.create()).toThrow(/not supported/);
    expect(() => repo.transition()).toThrow(/not supported/);
    expect(() => repo.recordCheckpoint()).toThrow(/not supported/);
    expect(() => repo.verifyPin()).toThrow(/not supported/);
  });
});

describe('selectShipmentRepository (no silent Prisma activation)', () => {
  const runtime = makeRuntime();
  const prisma = { shipment: {} } as any;

  it('defaults to the runtime adapter when no flag is set', () => {
    expect(selectShipmentRepository(runtime, prisma, undefined)).toBeInstanceOf(RuntimeShipmentRepository);
  });

  it('keeps the runtime adapter for unrelated flag values', () => {
    expect(selectShipmentRepository(runtime, prisma, 'true')).toBeInstanceOf(RuntimeShipmentRepository);
  });

  it('selects the Prisma adapter only under the explicit prisma flag', () => {
    expect(selectShipmentRepository(runtime, prisma, 'prisma')).toBeInstanceOf(PrismaShipmentRepository);
  });
});
