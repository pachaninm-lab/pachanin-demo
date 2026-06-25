import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const template = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/platform-v7/template.tsx'), 'utf8');
const patch = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/platform-v7/PublicRegistrationEntryPatch.tsx'), 'utf8');

describe('platform-v7 public registration entry patch', () => {
  it('mounts a registration patch on platform-v7 public pages', () => {
    expect(template).toContain("import { PublicRegistrationEntryPatch }");
    expect(template).toContain('<PublicRegistrationEntryPatch />');
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
