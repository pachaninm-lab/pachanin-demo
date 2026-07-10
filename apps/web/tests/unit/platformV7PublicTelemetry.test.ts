import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('platform-v7 public entry telemetry', () => {
  const component = read('apps/web/components/platform-v7/PublicEntryTelemetry.tsx');
  const route = read('apps/web/app/api/telemetry/public-entry/route.ts');
  const layout = read('apps/web/app/(platform-public)/platform-v7/layout.tsx');

  it('reports only allowlisted web vitals and coarse error categories', () => {
    expect(component).toContain("['CLS', 'FCP', 'INP', 'LCP', 'TTFB']");
    expect(component).toContain("category: /chunk|loading css chunk|dynamically imported module/i.test(message) ? 'chunk_load' : 'runtime'");
    expect(component).toContain("kind: 'blank_screen'");
    expect(component).not.toContain('event.error.stack');
    expect(component).not.toContain('event.reason.stack');
    expect(component).not.toContain('document.cookie');
    expect(component).not.toContain('localStorage');
    expect(component).not.toContain('sessionStorage');
  });

  it('mounts once in the isolated public layout', () => {
    expect(layout).toContain('<PublicEntryTelemetry />');
    expect(layout.split('<PublicEntryTelemetry />').length - 1).toBe(1);
  });

  it('rejects oversized, cross-origin and non-allowlisted payloads', () => {
    expect(route).toContain('contentLength > 2_048');
    expect(route).toContain("origin !== new URL(request.url).origin");
    expect(route).toContain('ALLOWED_KINDS');
    expect(route).toContain('ALLOWED_METRICS');
    expect(route).toContain('ALLOWED_ROUTES');
    expect(route).toContain('ALLOWED_CATEGORIES');
  });

  it('logs no password, token, email, session content or raw exception message', () => {
    const logBlock = route.slice(route.indexOf("console.info('public_entry_telemetry'"));
    for (const secret of ['password', 'token', 'email', 'refreshToken', 'accessToken', 'session', 'message', 'stack']) {
      expect(logBlock).not.toContain(secret);
    }
    expect(route).toContain('correlationId');
    expect(route).toContain('release');
  });
});
