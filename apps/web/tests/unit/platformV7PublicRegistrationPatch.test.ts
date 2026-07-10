import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const legacyTemplate = fs.readFileSync(path.join(root, 'apps/web/app/platform-v7/template.tsx'), 'utf8');
const publicLayout = fs.readFileSync(path.join(root, 'apps/web/app/(platform-public)/platform-v7/layout.tsx'), 'utf8');
const landing = fs.readFileSync(path.join(root, 'apps/web/app/(platform-public)/platform-v7/page.tsx'), 'utf8');
const login = fs.readFileSync(path.join(root, 'apps/web/app/(platform-public)/platform-v7/login/page.tsx'), 'utf8');

describe('platform-v7 isolated public registration and login', () => {
  it('keeps the legacy patch only inside the legacy platform template', () => {
    expect(legacyTemplate).toContain('PlatformV7TemplateGuards');
    expect(publicLayout).not.toContain('PublicRegistrationEntryPatch');
    expect(publicLayout).not.toContain('PublicEntryCleanup');
    expect(publicLayout).not.toContain('PlatformV7TemplateGuards');
  });

  it('uses declarative registration links without role query parameters', () => {
    expect(landing).toContain("href='/platform-v7/register'");
    expect(landing).not.toContain('/platform-v7/register?role=');
    expect(landing).not.toContain('/platform-v7/login?role=');
    expect(landing).not.toContain('textContent =');
  });

  it('keeps login role-neutral and free of runtime workspace injection', () => {
    expect(login).not.toContain('Workspace');
    expect(login).not.toContain('login-workspace-picker');
    expect(login).not.toContain('requestedRole');
    expect(login).not.toContain('MutationObserver');
    expect(login).not.toContain('setTimeout');
    expect(login).not.toContain('textContent =');
  });
});
