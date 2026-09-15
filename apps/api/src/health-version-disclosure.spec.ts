import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { HealthController } from './health.controller';
import { PUBLIC_ROUTE } from './common/decorators/public.decorator';

// ASVS V13.4.6. A backend that names its own build and runtime lets anyone
// decide which published advisories apply to it before trying any of them.
// The requirement carries no "unless explicitly intended" allowance, so being
// a deliberate endpoint does not excuse it.
//
// Two handlers answered /version: this controller, and a second registered
// straight onto Express in main.ts, which ran before Nest's router and so
// bypassed every guard. Only the controller survives, and these check both
// halves - a route that is no longer public, and a bootstrap that no longer
// registers an unguardable twin.

const isPublic = (handler: unknown): boolean => Reflect.getMetadata(PUBLIC_ROUTE, handler as object) === true;

const handler = (name: string): unknown => (HealthController.prototype as never as Record<string, unknown>)[name];

const mainSource = readFileSync(join(__dirname, 'main.ts'), 'utf8');

describe('version disclosure', () => {
  it('no longer answers without a session', () => {
    expect(isPublic(handler('version'))).toBe(false);
  });

  it('leaves the probes public, which is what they are for', () => {
    // Liveness and readiness are consumed by infrastructure that holds no
    // session; narrowing them would be a different change with a real cost.
    for (const name of ['health', 'ready']) {
      expect([name, isPublic(handler(name))]).toEqual([name, true]);
    }
  });

  it('does not name the Node runtime any more', () => {
    const body = new HealthController(null as never).version() as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['buildDate', 'commit', 'version']);
    expect(JSON.stringify(body)).not.toContain(process.version);
  });

  it('still answers the operator who is authenticated', () => {
    // Withholding it from everyone would be the easy way to pass and would
    // take a real diagnostic away; the point is that a session is required.
    const body = new HealthController(null as never).version();
    expect(typeof body.version).toBe('string');
    expect(body.version.length).toBeGreaterThan(0);
  });

  it('has no second, unguardable handler registered on the adapter', () => {
    // A route registered through getHttpAdapter() never passes a Nest guard,
    // so it cannot be authenticated at all. If one is reintroduced for
    // /version, no decorator on the controller will matter.
    expect(mainSource).not.toMatch(/getHttpAdapter\(\)\s*\.\s*get\(\s*['"]\/version['"]/u);
  });

  it('keeps the adapter-level probes that were never the problem', () => {
    // Guards against a fix that quietly deletes more than it needed to.
    expect(mainSource).toMatch(/getHttpAdapter\(\)\s*\.\s*get\(\s*['"]\/metrics['"]/u);
  });
});
