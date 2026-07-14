import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const page = read('apps/web/app/platform-v7/notifications/page.tsx');
const css = read('apps/web/app/platform-v7/notifications/notifications.module.css');
const routePolicy = read('apps/web/lib/platform-v7/design-system-v8-route-policy.ts');
const governance = JSON.parse(read('design-governance-v8.json'));
const migrationScope = JSON.parse(read('scripts/design-system-v8-route-migration-scope.json')) as string[];
const workflow = read('.github/workflows/design-system-v8.yml');

const pagePath = 'apps/web/app/platform-v7/notifications/page.tsx';
const cssPath = 'apps/web/app/platform-v7/notifications/notifications.module.css';
const testPath = 'apps/web/tests/unit/platformV7NotificationsAuthority.test.ts';

describe('platform-v7 notifications authority', () => {
  it('uses the governed v8 components and complete RU, EN and ZH copy', () => {
    expect(page).toContain("import { useLocale } from 'next-intl'");
    expect(page).toContain("import { Button, InlineNotice, StatusChip, Surface } from '@pc/design-system-v8'");
    expect(page).toContain("title: 'Уведомления'");
    expect(page).toContain("title: 'Notifications'");
    expect(page).toContain("title: '通知'");
    expect(page).not.toContain('style={{');
    expect(page).not.toContain('dangerouslySetInnerHTML');
  });

  it('keeps the account-scoped read and write API as the only notification authority', () => {
    expect(page).toContain("fetch('/api/proxy/notifications'");
    expect(page).toContain("fetch(`/api/proxy/notifications/${encodeURIComponent(id)}/read`");
    expect(page).toContain("fetch('/api/proxy/notifications/read-all'");
    expect(page).toContain("cache: 'no-store'");
    expect(page.match(/credentials: 'same-origin'/g)?.length).toBe(3);
    expect(page.match(/method: 'PATCH'/g)?.length).toBe(2);
    expect(page).toContain('AbortController');
    expect(page).toContain('12_000');
    expect(page).toContain('validNotification');
    expect(page).toContain('parseItems');
    expect(page).not.toContain('localStorage');
    expect(page).not.toContain('sessionStorage');
  });

  it('updates local read state only after a successful server response', () => {
    const singlePatch = page.indexOf("fetch(`/api/proxy/notifications/${encodeURIComponent(id)}/read`");
    const singleSuccessGuard = page.indexOf("if (!response.ok) throw new Error('mark_read_failed')", singlePatch);
    const singleStateUpdate = page.indexOf('setState((current) => current.kind', singleSuccessGuard);
    expect(singlePatch).toBeGreaterThan(-1);
    expect(singleSuccessGuard).toBeGreaterThan(singlePatch);
    expect(singleStateUpdate).toBeGreaterThan(singleSuccessGuard);

    const allPatch = page.indexOf("fetch('/api/proxy/notifications/read-all'");
    const allSuccessGuard = page.indexOf("if (!response.ok) throw new Error('mark_all_failed')", allPatch);
    const allStateUpdate = page.indexOf('setState((current) => current.kind', allSuccessGuard);
    expect(allPatch).toBeGreaterThan(-1);
    expect(allSuccessGuard).toBeGreaterThan(allPatch);
    expect(allStateUpdate).toBeGreaterThan(allSuccessGuard);
  });

  it('keeps fail-closed loading, error, empty and read states', () => {
    expect(page).toContain("kind: 'loading'");
    expect(page).toContain("kind: 'error'");
    expect(page).toContain("kind: 'ready'");
    expect(page).toContain('response.status === 401 || response.status === 403');
    expect(page).toContain('visibleItems.length === 0');
    expect(page).toContain('item.read');
    expect(page).toContain('actionError');
  });

  it('uses token-only mobile and accessibility styles', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/\brgba?\s*\(/i);
    expect(css).not.toContain('!important');
    expect(css).toContain('@media (max-width: 640px)');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('@media (forced-colors: active)');
    expect(css).toContain('var(--ds-color-focus)');
    expect(css).toContain('var(--pc-space-4)');
  });

  it('registers the route, files and regression in exact governance', () => {
    expect(routePolicy).toContain("'/platform-v7/notifications'");
    expect(governance.migratedFiles).toContain(pagePath);
    expect(governance.governedRoots).toContain(cssPath);
    expect(migrationScope).toContain(pagePath);
    expect(migrationScope).toContain(cssPath);
    expect(migrationScope).toContain(testPath);
    expect(workflow).toContain('tests/unit/platformV7NotificationsAuthority.test.ts');
  });
});
