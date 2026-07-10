import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('platform-v7 canonical login route', () => {
  const page = read('app/platform-v7/login/page.tsx');
  const layout = read('app/platform-v7/login/layout.tsx');
  const template = read('app/platform-v7/login/template.tsx');

  it('renders the actual login page instead of a legacy workspace overlay', () => {
    expect(template).toContain('return children;');
    expect(template).not.toContain('LoginLegacyOverlay');
    expect(template).not.toContain('void children');
  });

  it('keeps the route layout passive and lets the canonical public header own navigation', () => {
    expect(layout).toContain('return children;');
    expect(layout).not.toContain('LoginHeaderExitButton');
    expect(page).toContain('PublicSiteHeader');
  });

  it('keeps single-entry authentication and recovery visible', () => {
    expect(page).toContain("useTranslations('publicEntry.login')");
    expect(page).toContain("fetch('/api/auth/login'");
    expect(page).toContain("href='/platform-v7/forgot-password'");
    expect(page).not.toContain('workspace-picker');
    expect(page).not.toContain('Выберите один рабочий кабинет');
    expect(page).not.toContain('/platform-v7/login?role=');
  });
});
