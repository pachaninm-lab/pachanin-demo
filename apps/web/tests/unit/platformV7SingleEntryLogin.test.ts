import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const page = readFileSync(resolve(process.cwd(), 'apps/web/app/platform-v7/login/page.tsx'), 'utf8');
const flow = readFileSync(resolve(process.cwd(), 'apps/web/components/platform-v7/PublicAuthLoginFlow.tsx'), 'utf8');

describe('platform-v7 single entry login', () => {
  it('keeps one credential form without role selection or client authority', () => {
    expect(page).toContain('<PublicAuthLoginFlow />');
    expect(flow).toContain("useTranslations('publicEntry.login')");
    expect(flow).toContain("type Step = 'password' | 'mfa' | 'backup-codes'");
    expect(flow).toContain("postJson('/api/auth/login'");
    expect(flow).toContain('payload.redirectTo');
    expect(flow).not.toContain('Выберите один рабочий кабинет');
    expect(flow).not.toContain('usePlatformV7RStore');
    expect(flow).not.toContain('sessionStorage');
    expect(flow).not.toContain('?role=');
  });
});
