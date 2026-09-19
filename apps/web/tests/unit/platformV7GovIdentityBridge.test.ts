import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
function read(relativePath: string) { return fs.readFileSync(path.join(root, relativePath), 'utf8'); }

describe('platform-v7 government identity bridge', () => {
  it('keeps bridge utilities environment-driven and state-protected', () => {
    const bridge = read('apps/web/lib/platform-v7/govIdentityBridge.ts');
    expect(bridge).toContain('PLATFORM_V7_GOV_ID_ENABLED');
    expect(bridge).toContain('PLATFORM_V7_GOV_ID_AUTHORIZATION_URL');
    expect(bridge).toContain('PLATFORM_V7_GOV_ID_CLIENT_ID');
    expect(bridge).toContain('PLATFORM_V7_GOV_ID_REDIRECT_URI');
    expect(bridge).toContain('state');
    expect(bridge).toContain('nonce');
  });

  it('keeps start and callback routes present', () => {
    const start = read('apps/web/app/api/platform-v7/gov-id/start/route.ts');
    const callback = read('apps/web/app/api/platform-v7/gov-id/callback/route.ts');
    expect(start).toContain('buildGovIdentityStartUrl');
    expect(start).toContain('Cache-Control');
    expect(callback).toContain('state-error');
    expect(callback).toContain('code-missing');
    expect(callback).toContain('callback-received');
  });

  it('keeps registration connected to the identity bridge without bypassing role review', () => {
    const register = read('apps/web/app/platform-v7/register/page.tsx');
    expect(register).toContain('/api/platform-v7/gov-id/start?flow=register');
    expect(register).toContain('Подтвердить через гос-ID');
    expect(register).toContain('Подтверждение не выдаёт роль автоматически');
    expect(register).toContain('role-lock');
  });
});
