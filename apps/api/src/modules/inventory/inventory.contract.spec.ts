import { ValidationPipe } from '@nestjs/common';
import { Role } from '../../common/types/request-user';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import { validateInventoryCommand, type InventoryCommand } from './inventory.contract';
import { InventoryRepository } from './inventory.repository';
import { InventoryCommandDto } from './dto/inventory-api.dto';

const declaration: InventoryCommand = {
  action: 'DECLARE', commandId: 'command-one', idempotencyKey: 'key-one', correlationId: 'correlation-one',
  expectedVersion: '0', reason: 'Declare physical stock for inventory.', stockKey: 'stock-one',
  profileVersionId: 'profile-one', sourceType: 'MANUAL', sourceReference: 'own-register:one', unitCode: 'TON', quantity: '10.123456',
};
describe('Inventory command boundary', () => {
  it('admits declarations and exact reservation/release commands', () => {
    expect(() => validateInventoryCommand(declaration)).not.toThrow();
    const common = { commandId: 'command-two', idempotencyKey: 'key-two', correlationId: 'correlation-two', expectedVersion: '1', reason: 'Reserve physically declared stock.' };
    expect(() => validateInventoryCommand({ ...common, action: 'RESERVE', positionId: 'position-one', lotId: 'lot-one', unitCode: 'TON', quantity: '1' })).not.toThrow();
    expect(() => validateInventoryCommand({ ...common, action: 'RELEASE', positionId: 'position-one', reservationId: 'reservation-one' })).not.toThrow();
  });
  it.each(['tenantId', 'organizationId', 'verified', 'confirmedQuantity', 'tradePermission', 'policyId', 'ownership', 'isOrgAdmin'])('rejects caller authority field %s', (field) => {
    expect(() => validateInventoryCommand({ ...declaration, [field]: 'forged' })).toThrow('INVENTORY_UNKNOWN_FIELD');
  });
  it('rejects number quantities, missing versions and fields from another action', () => {
    expect(() => validateInventoryCommand({ ...declaration, quantity: 10 })).toThrow();
    expect(() => validateInventoryCommand({ ...declaration, expectedVersion: undefined })).toThrow();
    expect(() => validateInventoryCommand({ ...declaration, action: 'RELEASE' })).toThrow();
    expect(() => validateInventoryCommand({ ...declaration, expectedVersion: '1' })).toThrow();
  });
  it('keeps the same restrictions through DTO transformation', async () => {
    const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
    const metadata = { type: 'body' as const, metatype: InventoryCommandDto };
    const dto = await pipe.transform(declaration, metadata);
    expect(() => validateInventoryCommand(dto)).not.toThrow();
    await expect(pipe.transform({ ...declaration, tenantId: 'forged' }, metadata)).rejects.toBeDefined();
    await expect(pipe.transform({ ...declaration, quantity: 1 }, metadata)).rejects.toBeDefined();
  });
  it('does not acknowledge a command when deferred database evidence fails', async () => {
    const tx = { $queryRaw: jest.fn().mockResolvedValue([{ receipt: { commandId: 'command-one' } }]), $executeRaw: jest.fn().mockRejectedValue(new Error('deferred evidence failed')) };
    const withTrustedContext = jest.fn(async (_user, work) => work(tx));
    const inventory = new InventoryRepository({ withTrustedContext } as unknown as RlsTransactionService);
    await expect(inventory.execute({ id: 'actor-one', email: 'actor@example.invalid', role: Role.ADMIN, orgId: 'org-one', tenantId: 'tenant-one', sessionId: 'session-one' }, declaration)).rejects.toThrow('deferred evidence failed');
    expect(withTrustedContext.mock.calls[0]?.[0].id).toBe('actor-one');
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });
});
