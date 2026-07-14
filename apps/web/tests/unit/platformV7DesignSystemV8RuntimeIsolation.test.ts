import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const exists = (relativePath: string) => fs.existsSync(path.join(root, relativePath));

const layout = read('apps/web/app/platform-v7/layout.tsx');
const template = read('apps/web/app/platform-v7/template.tsx');
const protectedRuntime = read('apps/web/components/platform-v7/PlatformV7DesignSystemV8Runtime.tsx');
const publicRuntime = read('apps/web/components/platform-v7/PlatformV7PublicRuntime.tsx');
const supportingStyles = read('apps/web/app/platform-v7/_styles/supporting-v8.module.css');
const controlTower = read('apps/web/app/platform-v7/control-tower/page.tsx');

const removedLegacyFiles = [
  'apps/web/components/platform-v7/PlatformV7FullStyleRuntime.tsx',
  'apps/web/components/platform-v7/PlatformV7ProtectedTemplateRuntime.tsx',
  'apps/web/components/platform-v7/PlatformV7TemplateGuards.tsx',
  'apps/web/lib/platform-v7/design-system-v8-route-policy.ts',
];

const forbiddenRuntimeCode = [
  'MutationObserver',
  'ResizeObserver',
  'visualViewport',
  'document.querySelector',
  'dangerouslySetInnerHTML',
  '<style',
  "@/styles/platform-v7-",
  "@/app/v9",
];

describe('platform-v7 final Design System v8 runtime isolation', () => {
  it('uses one minimal public runtime and one minimal protected runtime', () => {
    expect(layout).toContain("await import('@/components/platform-v7/PlatformV7PublicRuntime')");
    expect(layout).toContain("await import('@/components/platform-v7/PlatformV7DesignSystemV8Runtime')");
    expect(layout).toContain('<PlatformV7PublicRuntime>{publicContent}</PlatformV7PublicRuntime>');
    expect(layout).toContain('<PlatformV7DesignSystemV8Runtime>{protectedContent}</PlatformV7DesignSystemV8Runtime>');
    expect(layout).not.toContain('PlatformV7FullStyleRuntime');
    expect(layout).not.toContain('isDesignSystemV8Route');
  });

  it('keeps authorization ahead of protected presentation', () => {
    expect(layout.indexOf('if (!role) redirect')).toBeGreaterThanOrEqual(0);
    expect(layout.indexOf('if (!role) redirect')).toBeLessThan(
      layout.indexOf("await import('@/components/platform-v7/PlatformV7DesignSystemV8Runtime')"),
    );
    expect(layout.indexOf('if (!canRoleAccessCabinet')).toBeLessThan(
      layout.indexOf("await import('@/components/platform-v7/PlatformV7DesignSystemV8Runtime')"),
    );
    expect(layout).not.toContain('localStorage');
    expect(layout).not.toContain('sessionStorage');
    expect(layout).not.toContain('?role=');
  });

  it('removes legacy style and template runtime files', () => {
    for (const file of removedLegacyFiles) expect(exists(file)).toBe(false);
    expect(template).toContain('return children');
    expect(template).not.toContain('next/headers');
    expect(template).not.toContain('PlatformV7ProtectedTemplateRuntime');
  });

  it('keeps both active runtimes token-only and free of DOM repair code', () => {
    for (const runtime of [protectedRuntime, publicRuntime]) {
      expect(runtime).toContain('packages/design-tokens/tokens.css');
      expect(runtime).toContain('<ChatSupportWidget />');
      for (const forbidden of forbiddenRuntimeCode) expect(runtime).not.toContain(forbidden);
    }
    expect(supportingStyles).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(supportingStyles).not.toMatch(/\brgba?\s*\(/i);
    expect(supportingStyles).not.toContain('!important');
    expect(supportingStyles).toContain('@media (forced-colors: active)');
    expect(supportingStyles).toContain('env(safe-area-inset-top, 0px)');
  });

  it('keeps one canonical role-safe operator or executive workspace', () => {
    expect(controlTower).toContain('readVerifiedCabinetSessionRole');
    expect(controlTower).toContain('readVerifiedCabinetRole');
    expect(controlTower).toContain("role === 'executive'");
    expect(controlTower).toContain("redirect('/platform-v7/executive')");
    expect(controlTower).toContain("redirect('/platform-v7/operator')");
    expect(controlTower).not.toContain('selectRuntimeDeals');
    expect(controlTower).not.toContain('ControlTowerCharts');
    expect(controlTower).not.toContain('style=');
    expect(controlTower).not.toContain('localStorage');
  });
});
