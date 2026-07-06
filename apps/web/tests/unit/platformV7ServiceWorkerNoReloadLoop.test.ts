import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.join(process.cwd(), 'apps/web/public/sw.js'), 'utf8');

describe('platform-v7 service worker stability', () => {
  it('does not navigate clients during activate and does not intercept fetches', () => {
    expect(source).not.toContain('client.navigate');
    expect(source).not.toContain('clients.matchAll');
    expect(source).not.toContain('event.respondWith(fetch(event.request))');
    expect(source).toContain('self.registration.unregister');
  });
});
