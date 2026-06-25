import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const layout = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/platform-v7/layout.tsx'), 'utf8');
const template = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/platform-v7/template.tsx'), 'utf8');
const patch = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/platform-v7/PublicRegistrationEntryPatch.tsx'), 'utf8');

describe('platform-v7 public registration entry patch', () => {
  it('keeps the platform shell mounted at the segment layout level', () => {
    expect(layout).toContain('<AppShellV4 initialRole={initialRole}>');
    expect(layout).not.toContain('if (isPublicPath(pathname))');
    expect(layout).not.toContain('PUBLIC_EXACT_PATHS');
  });

  it('mounts the client path controller from the persistent template', () => {
    expect(template).toContain("import { PublicRegistrationEntryPatch }");
    expect(template).toContain('<PublicRegistrationEntryPatch />');
  });

  it('hides shell chrome only for live public pathnames', () => {
    expect(patch).toContain("import { usePathname } from 'next/navigation';");
    expect(patch).toContain("const PUBLIC_PATHS = new Set(['/platform-v7', '/platform-v7/open', '/platform-v7/login', '/platform-v7/register', '/platform-v7/docs']);");
    expect(patch).toContain("shell.dataset.publicEntry = 'true';");
    expect(patch).toContain('delete shell.dataset.publicEntry;');
    expect(patch).toContain(".pc-shell-root-v4[data-public-entry='true'] .pc-v4-header");
  });

  it('rewrites the public hero access CTA to registration and preserves login', () => {
    expect(patch).toContain("headerLink.href = '/platform-v7/register';");
    expect(patch).toContain("headerLink.textContent = 'Регистрация';");
    expect(patch).toContain("heroLink.href = '/platform-v7/register';");
    expect(patch).toContain("heroLink.textContent = 'Зарегистрироваться';");
    expect(patch).toContain("const loginLink = headerActions.querySelector('.entry-login');");
    expect(patch).not.toContain("heroLink.href = '/platform-v7/login'");
  });
});
