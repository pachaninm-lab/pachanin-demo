import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { RateLimitService } from '../../common/security/rate-limit.service';
import { GektaAnonymousAdmissionController } from './gekta-anonymous-admission.controller';

const SID = 's'.repeat(22);
const DELIVERY_FIXTURE = `delivery-fixture-${'x'.repeat(48)}`;

function ticket(now = Date.now()): string {
  return `${now.toString(36)}.${'t'.repeat(16)}`;
}

function decision(allowed: boolean) {
  return { allowed, count: allowed ? 1 : 2, remaining: 0, limit: 1, resetAt: Date.now() + 900_000 };
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

  it('consumes one PostgreSQL-backed bucket for a fresh signed-session ticket', async () => {
    const consume = jest.fn().mockResolvedValue(decision(true));
    const controller = new GektaAnonymousAdmissionController({ consume } as unknown as RateLimitService);
    await expect(controller.admit({ sid: SID, ticket: ticket() }, DELIVERY_FIXTURE)).resolves.toEqual({ allowed: true });
    expect(consume).toHaveBeenCalledWith('gekta_anonymous_answer_ticket', expect.stringMatching(/^s+\|[0-9a-z]+\.t+$/u), 1, 900);
  });

  it('returns denied for a replay atomically rejected by the shared bucket', async () => {
    const consume = jest.fn().mockResolvedValue(decision(false));
    const controller = new GektaAnonymousAdmissionController({ consume } as unknown as RateLimitService);
    await expect(controller.admit({ sid: SID, ticket: ticket() }, DELIVERY_FIXTURE)).resolves.toEqual({ allowed: false });
  });

  it('rejects missing internal authority before touching storage', async () => {
    const consume = jest.fn();
    const controller = new GektaAnonymousAdmissionController({ consume } as unknown as RateLimitService);
    await expect(controller.admit({ sid: SID, ticket: ticket() }, 'wrong')).rejects.toBeInstanceOf(ForbiddenException);
    expect(consume).not.toHaveBeenCalled();
  });

  it('rejects stale tickets before touching storage', async () => {
    const consume = jest.fn();
    const controller = new GektaAnonymousAdmissionController({ consume } as unknown as RateLimitService);
    const stale = ticket(Date.now() - 10 * 60_000 - 1);
    await expect(controller.admit({ sid: SID, ticket: stale }, DELIVERY_FIXTURE)).rejects.toBeInstanceOf(BadRequestException);
    expect(consume).not.toHaveBeenCalled();
  });
});
