import type { Prisma } from '@prisma/client';
import { GektaAnonymousAdmissionService, _gektaAnonymousAdmissionTesting } from './gekta-anonymous-admission.service';

describe('Gekta anonymous admission persistence', () => {
  const originalLimit = process.env.GEKTA_ANONYMOUS_FREE_ANSWERS;

  afterEach(() => {
    if (originalLimit === undefined) delete process.env.GEKTA_ANONYMOUS_FREE_ANSWERS;
    else process.env.GEKTA_ANONYMOUS_FREE_ANSWERS = originalLimit;
  });

  it('passes only domain-separated HMAC digests and the bounded limit to SQL', async () => {
    process.env.GEKTA_ANONYMOUS_FREE_ANSWERS = '12';
    const queryRaw = jest.fn(async (_query: Prisma.Sql) => [{ allowed: true }]);
    const service = new GektaAnonymousAdmissionService({ $queryRaw: queryRaw } as never);
    const sid = 's'.repeat(22);
    const ticket = `${Date.now().toString(36)}.${'t'.repeat(16)}`;

    await expect(service.consume(sid, ticket)).resolves.toEqual({ allowed: true });
    const query = queryRaw.mock.calls[0]?.[0] as Prisma.Sql;
    expect(query.values).toHaveLength(3);
    expect(query.values[0]).toMatch(/^[a-f0-9]{64}$/u);
    expect(query.values[1]).toMatch(/^[a-f0-9]{64}$/u);
    expect(query.values[0]).not.toBe(query.values[1]);
    expect(query.values).not.toContain(sid);
    expect(query.values).not.toContain(ticket);
    expect(query.values[2]).toBe(12);
  });

  it('preserves a database denial and fails closed on a missing decision', async () => {
    const denied = new GektaAnonymousAdmissionService({
      $queryRaw: jest.fn(async () => [{ allowed: false }]),
    } as never);
    await expect(denied.consume('s'.repeat(22), `${Date.now().toString(36)}.${'t'.repeat(16)}`))
      .resolves.toEqual({ allowed: false });

    const unavailable = new GektaAnonymousAdmissionService({ $queryRaw: jest.fn(async () => []) } as never);
    await expect(unavailable.consume('s'.repeat(22), `${Date.now().toString(36)}.${'u'.repeat(16)}`))
      .rejects.toThrow(/no decision/iu);
  });

  it('uses ten by default and caps configuration at one thousand', () => {
    delete process.env.GEKTA_ANONYMOUS_FREE_ANSWERS;
    expect(_gektaAnonymousAdmissionTesting.freeAnswerLimit()).toBe(10);
    process.env.GEKTA_ANONYMOUS_FREE_ANSWERS = '1001';
    expect(_gektaAnonymousAdmissionTesting.freeAnswerLimit()).toBe(1000);
  });
});
