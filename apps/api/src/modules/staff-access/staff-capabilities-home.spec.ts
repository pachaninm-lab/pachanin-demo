import { ForbiddenException } from '@nestjs/common';
import { Role } from '../../common/types/request-user';
import { StaffCapabilitiesService } from './staff-capabilities.service';

const actor = { id: 'owner', email: 'owner@example.test', orgId: 'org-a', role: Role.ADMIN, mfaVerified: false };
const assignment = { id: 'assignment-owner', user_id: actor.id, role: 'PLATFORM_OWNER', status: 'ACTIVE', valid_from: new Date(), valid_until: null };
function fixture(rows: unknown[]) {
  const repository = { prisma: { $queryRaw: jest.fn() }, listActiveAssignments: jest.fn().mockResolvedValue(rows), listActiveSessions: jest.fn() };
  return { repository, service: new StaffCapabilitiesService(repository as never) };
}

describe('password-session staff home', () => {
  it('returns own active assignment labels with honest assurance and no operational data', async () => {
    const { service, repository } = fixture([assignment,
      { ...assignment, id: 'eligible', status: 'ELIGIBLE' },
      { ...assignment, id: 'other-subject', user_id: 'other' },
    ]);
    const home = await service.getHome(actor);
    expect(Object.keys(home).sort()).toEqual(['assignments', 'authenticationAssurance', 'identity']);
    expect(home.assignments.map((row) => row.id)).toEqual(['assignment-owner']);
    expect(home.authenticationAssurance.mfaVerified).toBe(false);
    expect(repository.listActiveSessions).not.toHaveBeenCalled();
    expect(repository.prisma.$queryRaw).not.toHaveBeenCalled();
    await expect(service.getMine(actor)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('does not promote eligibility or another subject to active staff authority', async () => {
    for (const rows of [[{ ...assignment, status: 'ELIGIBLE' }], [{ ...assignment, user_id: 'other' }], []]) {
      await expect(fixture(rows).service.getHome(actor)).rejects.toBeInstanceOf(ForbiddenException);
    }
  });
});
