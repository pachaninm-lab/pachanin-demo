import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { StaffAccessService } from '../staff-access/staff-access.service';
import { GektaOperatorGuard } from './gekta-operator.guard';

describe('GektaOperatorGuard dependency injection', () => {
  it('resolves the concrete StaffAccessService token instead of Object metadata', async () => {
    const staffAccess = {
      enrichActor: jest.fn(async () => ({ staffRoles: ['PLATFORM_OWNER'] })),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        Reflector,
        { provide: StaffAccessService, useValue: staffAccess },
        GektaOperatorGuard,
      ],
    }).compile();

    try {
      expect(moduleRef.get(GektaOperatorGuard)).toBeInstanceOf(GektaOperatorGuard);
    } finally {
      await moduleRef.close();
    }
  });
});
