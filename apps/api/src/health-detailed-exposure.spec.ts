import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { HealthController } from './health.controller';
import { PUBLIC_ROUTE } from './common/decorators/public.decorator';

/**
 * ASVS 5.0 V13.4.5: monitoring endpoints are not exposed unless explicitly
 * intended.
 *
 * The comment above health/detailed read "for internal monitoring only" while
 * the decorator above it read @Public(), and the decorator was the one being
 * enforced. The requirement's "unless explicitly intended" allowance cannot be
 * claimed for an endpoint whose own author wrote the opposite.
 *
 * As with /version, two handlers answered this path: the controller, and one
 * registered straight onto Express in main.ts that ran before Nest's router
 * and so could be reached by no guard at all. Both halves are checked here,
 * because fixing only the decorator would have changed nothing observable.
 */

const isPublic = (handler: unknown): boolean => Reflect.getMetadata(PUBLIC_ROUTE, handler as object) === true;

const handler = (name: string): unknown => (HealthController.prototype as never as Record<string, unknown>)[name];

const mainSource = readFileSync(join(__dirname, 'main.ts'), 'utf8');

const outbox = { queueStats: jest.fn().mockResolvedValue({ deadLetter: 0, pending: 0, processing: 0 }) };

describe('detailed health exposure', () => {
  it('no longer answers without a session', () => {
    expect(isPublic(handler('healthDetailed'))).toBe(false);
  });

  it('has no second, unguardable handler registered on the adapter', () => {
    // A route registered through getHttpAdapter() never reaches a Nest guard,
    // so no decorator on the controller would matter if one came back.
    expect(mainSource).not.toMatch(/getHttpAdapter\(\)\s*\.\s*get\(\s*['"]\/health\/detailed['"]/u);
  });

  it('leaves liveness and readiness public, which is what they are for', () => {
    // Infrastructure probes hold no session, and neither endpoint discloses
    // topology. Narrowing them would be a different change with a real cost.
    for (const name of ['health', 'ready']) {
      expect([name, isPublic(handler(name))]).toEqual([name, true]);
    }
    expect(mainSource).toMatch(/getHttpAdapter\(\)\s*\.\s*get\(\s*['"]\/health['"]/u);
    expect(mainSource).toMatch(/getHttpAdapter\(\)\s*\.\s*get\(\s*['"]\/ready['"]/u);
  });

  it('still answers the operator who is authenticated, rather than being deleted', () => {
    // Withholding the signal from everyone would be the easy way to pass and
    // would take a real diagnostic away; the point is that it needs a session.
    return expect(new HealthController(outbox as never).healthDetailed()).resolves.toHaveProperty('checks');
  });

  it('is the endpoint that names the deployment, which is why it needed closing', async () => {
    // Recorded so the reason survives: this body says which dependencies exist
    // and which of them are currently failing.
    const body = await new HealthController(outbox as never).healthDetailed();
    expect(Object.keys(body.checks)).toEqual(
      expect.arrayContaining(['database', 'outbox', 'kafka', 'redis', 'integrations']),
    );
    expect(Object.keys(body.details)).toEqual(
      expect.arrayContaining(['outboxDeadCount', 'uptime', 'memoryMb']),
    );
  });
});
