import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const guard = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/platform-v7/MobileLogoutSoftExit.tsx'), 'utf8');
const template = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/platform-v7/template.tsx'), 'utf8');
const templateGuards = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/platform-v7/PlatformV7TemplateGuards.tsx'), 'utf8');
const rail = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/platform-v7/MobileHeaderActionRail.tsx'), 'utf8');

describe('platform-v7 mobile logout soft exit', () => {
  it('mounts the soft exit guard through the route-scoped template guard', () => {
    expect(template).toContain('PlatformV7TemplateGuards');
    expect(templateGuards).toContain("import { MobileLogoutSoftExit }");
    expect(templateGuards).toContain('<MobileLogoutSoftExit />');
    expect(templateGuards).toContain('if (publicPath)');
  });

  it('intercepts every mobile/header logout path before stale events can run', () => {
    expect(guard).toContain("document.addEventListener('click', onClick, true)");
    expect(guard).toContain('.p7-mobile-danger,.pc-v7-logout-btn,[data-platform-v7-logout="true"]');
    expect(guard).toContain('event.stopImmediatePropagation()');
    expect(guard).toContain("LOGOUT_TARGET = '/platform-v7/login?logout=1'");
    expect(guard).toContain('router.replace(LOGOUT_TARGET');
    expect(guard).not.toContain("router.replace('/platform-v7'");
  });

  it('removes hard public-home navigation from the mobile tools exit path', () => {
    expect(rail).not.toContain("window.location.assign('/platform-v7')");
    expect(rail).toContain("LOGOUT_TARGET = '/platform-v7/login?logout=1'");
    expect(rail).toContain('router.replace(LOGOUT_TARGET');
  });
});
