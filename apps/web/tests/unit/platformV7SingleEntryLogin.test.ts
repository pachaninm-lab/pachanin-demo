import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const page = readFileSync(resolve(process.cwd(), 'apps/web/app/platform-v7/login/page.tsx'), 'utf8');
const client = readFileSync(resolve(process.cwd(), 'apps/web/app/platform-v7/login/LoginFormClient.tsx'), 'utf8');

describe('platform-v7 single-entry login', () => {
  it('contains one server-rendered credential entry without a role selector', () => {
    expect(page).toContain("getTranslations('publicEntry.login')");
    expect(page).toContain('<LoginFormClient copy={copy} />');
    expect(client).toContain("type LoginStep = 'password' | 'mfa' | 'backup-codes'");
    expect(client).toContain("fetch('/api/auth/mfa-login/cancel'");
    expect(client).not.toContain('workspace-picker');
    expect(client).not.toContain('data-role-selector');
    expect(client).not.toContain("name='role'");
    expect(client).not.toContain('?role=');
  });
});
