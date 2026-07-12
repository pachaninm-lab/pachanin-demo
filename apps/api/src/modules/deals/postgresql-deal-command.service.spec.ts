import { currentCommandExecutionId } from '../../common/command-execution.context';
import { parseLogisticsBasis } from './deal-command-payload';
import { currentLogisticsCommandContext } from './logistics-admission-context';
import { PostgresqlDealCommandService } from './postgresql-deal-command.service';

const user = {
  id: 'logistician-1',
  email: 'logistician@example.invalid',
  fullName: 'Logistician',
  role: 'LOGISTICIAN',
  orgId: 'carrier-org-1',
  tenantId: 'tenant-1',
  sessionId: 'session-1',
} as any;

const dto = {
  commandId: 'command-assign-logistics-0001',
  idempotencyKey: 'idempotency-assign-logistics-0001',
  expectedVersion: '2',
  payload: {
    carrierOrgId: 'carrier-org-1',
    driverUserId: 'driver-1',
    vehicleId: 'vehicle-1',
    routeFromFacilityId: 'facility-from-1',
    routeToFacilityId: 'facility-to-1',
  },
} as any;

const basis = {
  carriers: [{ id: 'carrier-org-1', status: 'VERIFIED' as const, tenantId: 'tenant-1' }],
  drivers: [{
    id: 'driver-1',
    carrierOrgId: 'carrier-org-1',
    status: 'ACTIVE' as const,
    vehicleIds: ['vehicle-1'],
  }],
  vehicles: [{ id: 'vehicle-1', carrierOrgId: 'carrier-org-1', status: 'ACTIVE' as const }],
  facilities: [
    { id: 'facility-from-1', organizationId: 'seller-org', status: 'ACTIVE' as const },
    { id: 'facility-to-1', organizationId: 'buyer-org', status: 'ACTIVE' as const },
  ],
};

describe('PostgresqlDealCommandService', () => {
  it('resolves admission before assign_logistics and isolates both async contexts', async () => {
    const base = {
      execute: jest.fn(async () => ({
        commandId: currentCommandExecutionId(),
        admissionId: currentLogisticsCommandContext()?.admissionId,
        parsedBasis: parseLogisticsBasis(null),
      })),
      workspace: jest.fn(),
    } as any;
    const admissions = {
      resolveForCommand: jest.fn().mockResolvedValue({
        commandId: dto.commandId,
        admissionId: 'admission-1',
        basis,
        carrierName: 'Carrier',
        driverName: 'Driver',
        vehicleRegistrationNumber: 'A000AA77',
        vehicleType: 'Grain truck',
        routeFromName: 'Origin',
        routeToName: 'Destination',
        sourceHash: 'a'.repeat(64),
        evidenceRef: null,
      }),
    } as any;
    const service = new PostgresqlDealCommandService(base, admissions);

    await expect(service.execute('deal-1', 'assign_logistics', dto, user)).resolves.toEqual({
      commandId: dto.commandId,
      admissionId: 'admission-1',
      parsedBasis: basis,
    });
    expect(admissions.resolveForCommand).toHaveBeenCalledWith(
      'deal-1', dto.payload, user, dto.commandId,
    );
    expect(currentCommandExecutionId()).toBeUndefined();
    expect(currentLogisticsCommandContext()).toBeUndefined();
  });

  it('does not resolve logistics for another command but still propagates correlation', async () => {
    const base = {
      execute: jest.fn(async () => currentCommandExecutionId()),
      workspace: jest.fn(),
    } as any;
    const admissions = { resolveForCommand: jest.fn() } as any;
    const service = new PostgresqlDealCommandService(base, admissions);

    await expect(service.execute('deal-1', 'confirm_loading', dto, user))
      .resolves.toBe(dto.commandId);
    expect(admissions.resolveForCommand).not.toHaveBeenCalled();
    expect(currentCommandExecutionId()).toBeUndefined();
  });

  it('fails closed without normalized context outside NODE_ENV=test', () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(() => parseLogisticsBasis({
        logisticsBasis: basis,
      })).toThrow(/PostgreSQL|допуска/);
    } finally {
      process.env.NODE_ENV = previous;
    }
  });
});
