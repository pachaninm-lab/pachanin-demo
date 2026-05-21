import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');

describe('platform-v7 public smoke audit', () => {
  it('keeps deployed platform routes, viewports and screenshots covered', () => {
    const smoke = read('apps/web/tests/e2e/platform-v7-public-smoke.spec.ts');

    expect(smoke).toContain('PLATFORM_V7_PUBLIC_URL');
    expect(smoke).toContain('pachanin-web.vercel.app');
    expect(smoke).toContain("'/platform-v7'");
    expect(smoke).toContain("'/platform-v7/bank'");
    expect(smoke).toContain("'/platform-v7/driver/field'");
    expect(smoke).toContain("'/platform-v7/deals/grain-release'");
    expect(smoke).toContain("label: 'mobile-390', width: 390, height: 844");
    expect(smoke).toContain("label: 'desktop-1440', width: 1440, height: 900");
    expect(smoke).toContain('page.screenshot({ fullPage: true })');
  });

  it('keeps user-visible risk checks stronger than page-load only', () => {
    const smoke = read('apps/web/tests/e2e/platform-v7-public-smoke.spec.ts');

    expect(smoke).toContain('response?.ok()');
    expect(smoke).toContain('Application error');
    expect(smoke).toContain('document.documentElement.scrollWidth > document.documentElement.clientWidth');
    expect(smoke).toContain('unsafeCopy');
    expect(smoke).toContain('Активная роль');
    expect(smoke).toContain('водитель|рейс|офлайн|действие');
    expect(smoke).toContain('деньг|документ|блокер|следующ');
  });

  it('keeps manual workflow non-blocking and artifact-based', () => {
    const workflow = read('.github/workflows/platform-v7-public-smoke.yml');

    expect(workflow).toContain('workflow_dispatch');
    expect(workflow).toContain('Run public platform-v7 smoke');
    expect(workflow).toContain('tests/e2e/platform-v7-public-smoke.spec.ts');
    expect(workflow).toContain('actions/upload-artifact@v4');
    expect(workflow).toContain('platform-v7-public-smoke-report');
    expect(workflow).toContain('platform-v7-public-smoke-results');
    expect(workflow).not.toContain('pull_request:');
    expect(workflow).not.toContain('push:');
  });
});
