import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(currentFile), '../../../..');
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const CHECKER = 'scripts/check-production-web-hardening.mjs';
const READINESS_ROUTE = 'apps/web/app/api/health/ready/route.ts';

const checker = read(CHECKER);
const readinessRoute = read(READINESS_ROUTE);

describe('production web hardening gate', () => {
  // Production Hosting Authority only runs on its own trigger paths, so a gate that
  // disagrees with the tree can stay red for days and only surface on the next PR
  // that happens to touch `docs/ops/**`. That is how the Cache-Control drift hid.
  // This suite runs on every pull request, so the disagreement cannot hide here.
  it('agrees with the repository it guards', () => {
    const result = spawnSync('node', [CHECKER], { cwd: root, encoding: 'utf8' });

    expect(`${result.stdout}${result.stderr}`.trim()).not.toContain('check failed');
    expect(result.status).toBe(0);
  });

  it('keeps the readiness probe uncacheable', () => {
    const header = /'Cache-Control':\s*'([^']*)'/.exec(readinessRoute);

    expect(header).not.toBeNull();
    // `no-store` is the binding directive; `max-age=0` is the belt-and-braces for
    // intermediaries that predate it. A release may add directives, never drop these.
    expect(header?.[1]).toMatch(/\bno-store\b/);
    expect(header?.[1]).toMatch(/\bmax-age=0(?![\d.])/);
  });

  it('states the caching property instead of pinning one spelling of the header', () => {
    // Re-pinning the current literal would "fix" the red gate and rearm the same
    // trap: the next commit that hardens the header would fail the build again.
    expect(checker).not.toContain("'Cache-Control': 'no-store, max-age=0'");
    expect(checker).not.toContain(
      "'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'",
    );
    expect(checker).toContain('requirePattern');
  });
});
