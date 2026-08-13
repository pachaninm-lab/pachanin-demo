import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { GektaAnonymousAdmissionController } from './gekta-anonymous-admission.controller';
import type { GektaAnonymousAdmissionService } from './gekta-anonymous-admission.service';

const SID = 's'.repeat(22);
const DELIVERY_FIXTURE = `delivery-fixture-${'x'.repeat(48)}`;

function ticket(now = Date.now()): string {
  return `${now.toString(36)}.${'t'.repeat(16)}`;
}

describe('Gekta anonymous answer admission', () => {
  const originalDelivery = process.env.REGISTRATION_DELIVERY_KEY;

  beforeEach(() => {
    process.env.REGISTRATION_DELIVERY_KEY = DELIVERY_FIXTURE;
  });

  afterEach(() => {
    if (originalDelivery === undefined) delete process.env.REGISTRATION_DELIVERY_KEY;
    else process.env.REGISTRATION_DELIVERY_KEY = originalDelivery;
  });

  it('atomically consumes a fresh ticket and its whole-session quota', async () => {
    const consume = jest.fn().mockResolvedValue({ allowed: true });
    const controller = new GektaAnonymousAdmissionController({ consume } as unknown as GektaAnonymousAdmissionService);
    await expect(controller.admit({ sid: SID, ticket: ticket() }, DELIVERY_FIXTURE)).resolves.toEqual({ allowed: true });
    expect(consume).toHaveBeenCalledWith(SID, expect.stringMatching(/^[0-9a-z]+\.t+$/u));
  });

  it('returns denied for a ticket replay or an exhausted session quota', async () => {
    const consume = jest.fn().mockResolvedValue({ allowed: false });
    const controller = new GektaAnonymousAdmissionController({ consume } as unknown as GektaAnonymousAdmissionService);
    await expect(controller.admit({ sid: SID, ticket: ticket() }, DELIVERY_FIXTURE)).resolves.toEqual({ allowed: false });
  });

  it('rejects missing internal authority before touching storage', async () => {
    const consume = jest.fn();
    const controller = new GektaAnonymousAdmissionController({ consume } as unknown as GektaAnonymousAdmissionService);
    await expect(controller.admit({ sid: SID, ticket: ticket() }, 'wrong')).rejects.toBeInstanceOf(ForbiddenException);
    expect(consume).not.toHaveBeenCalled();
  });

  it('rejects stale tickets before touching storage', async () => {
    const consume = jest.fn();
    const controller = new GektaAnonymousAdmissionController({ consume } as unknown as GektaAnonymousAdmissionService);
    const stale = ticket(Date.now() - 10 * 60_000 - 1);
    await expect(controller.admit({ sid: SID, ticket: stale }, DELIVERY_FIXTURE)).rejects.toBeInstanceOf(BadRequestException);
    expect(consume).not.toHaveBeenCalled();
  });
});
