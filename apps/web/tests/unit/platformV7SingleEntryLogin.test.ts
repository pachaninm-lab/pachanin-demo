import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'apps/web/app/platform-v7/login/page.tsx'), 'utf8');

describe('platform-v7 single-entry login', () => {
  it('contains one credential form without a role selector', () => {
    expect(source).toContain("useTranslations('publicEntry.login')");
    expect(source).toContain("type LoginStep = 'password' | 'mfa' | 'backup-codes'");
    expect(source).toContain("fetch('/api/auth/mfa-login/cancel'");
    expect(source).not.toContain('workspace-picker');
    expect(source).not.toContain('data-role-selector');
    expect(source).not.toContain('name=\'role\'');
    expect(source).not.toContain('?role=');
  });
});
