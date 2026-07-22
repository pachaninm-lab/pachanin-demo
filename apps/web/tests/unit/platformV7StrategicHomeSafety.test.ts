import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const formPath = 'components/platform-v7/OrganizationConnectForm.tsx';
const formCssPath = 'components/platform-v7/OrganizationConnectForm.module.css';
const rolePath = 'components/platform-v7/PublicDealRoleScenario.tsx';
const roleCssPath = 'components/platform-v7/PublicDealRoleScenario.module.css';

function read(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('platform-v7 strategic public home contracts', () => {
  it('keeps organization intake staged and does not persist personal data in the browser', () => {
    const source = read(formPath);

    expect(source).toContain("mode: 'staged_client_validation'");
    expect(source).toContain("window.location.assign(`/platform-v7/register");
    expect(source).not.toContain('localStorage');
    expect(source).not.toContain('sessionStorage');
    expect(source).not.toContain("fetch('");
    expect(source).not.toContain('fake_success');
  });

  it('uses native validation, explicit consent and an accessible error channel', () => {
    const source = read(formPath);

    expect(source).toContain('form.checkValidity()');
    expect(source).toContain('form.reportValidity()');
    expect(source).toContain("name='consent'");
    expect(source).toContain("role='alert'");
    expect(source).toContain("autoComplete='organization'");
    expect(source).toContain("autoComplete='email'");
  });

  it('keeps the role scenario demonstrational and outside RBAC authority', () => {
    const source = read(rolePath);

    expect(source).toContain("role='tablist'");
    expect(source).toContain("aria-selected={active === item.id}");
    expect(source).toContain("aria-live='polite'");
    expect(source).toContain("mode: 'public_simulation'");
    expect(source).not.toContain('/api/');
    expect(source).not.toContain('setRole');
    expect(source).not.toContain('tenantId');
  });

  it('preserves mobile touch targets and reduced-motion behavior', () => {
    const formCss = read(formCssPath);
    const roleCss = read(roleCssPath);
    const combined = `${formCss}\n${roleCss}`;

    expect(combined).toMatch(/min-height:\s*44px/);
    expect(combined).toContain('@media (prefers-reduced-motion: reduce)');
    expect(roleCss).toContain('overflow-x: auto');
  });
});
