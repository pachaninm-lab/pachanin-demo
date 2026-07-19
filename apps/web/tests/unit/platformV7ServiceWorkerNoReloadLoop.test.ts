import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const serviceWorker = fs.readFileSync(path.join(root, 'apps/web/public/sw.js'), 'utf8');
const rootLayout = fs.readFileSync(path.join(root, 'apps/web/app/layout.tsx'), 'utf8');
const nextConfig = fs.readFileSync(path.join(root, 'apps/web/next.config.js'), 'utf8');

describe('platform-v7 service worker recovery', () => {
  it('navigates stale entry clients once, unregisters, and never intercepts fetches', () => {
    expect(serviceWorker).toContain("const RECOVERY_VERSION = '2026-07-19-contact-dock-v3'");
    expect(serviceWorker).toContain("const RECOVERY_PARAMETER = 'pc-sw-recovery'");
    expect(serviceWorker).toContain("new Set(['/', '/platform-v7', '/pc-public-entry/platform-v7'])");
    expect(serviceWorker).toContain('self.clients.claim()');
    expect(serviceWorker).toContain("self.clients.matchAll({ type: 'window', includeUncontrolled: true })");
    expect(serviceWorker).toContain('url.searchParams.get(RECOVERY_PARAMETER) === RECOVERY_VERSION');
    expect(serviceWorker).toContain('client.navigate(url.toString())');
    expect(serviceWorker).toContain('self.registration.unregister');
    expect(serviceWorker).not.toContain('event.respondWith');
  });

  it('clears legacy registrations from every document and serves the recovery worker uncached', () => {
    expect(rootLayout).toContain('const serviceWorkerRecoveryScript =');
    expect(rootLayout).toContain('navigator.serviceWorker.getRegistrations()');
    expect(rootLayout).toContain('navigator.serviceWorker.controller');
    expect(rootLayout).toContain('caches.keys()');
    expect(rootLayout).toContain('window.location.replace(url.toString())');
    expect(rootLayout).toContain("url.searchParams.delete(parameter)");
    expect(nextConfig).toContain("source: '/sw.js'");
    expect(nextConfig).toContain("{ key: 'Service-Worker-Allowed', value: '/' }");
    expect(nextConfig).toContain("{ key: 'Netlify-CDN-Cache-Control', value: 'no-store' }");
  });
});
