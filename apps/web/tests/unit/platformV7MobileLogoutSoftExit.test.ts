import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const guard = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/platform-v7/MobileLogoutSoftExit.tsx'), 'utf8');
const template = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/platform-v7/template.tsx'), 'utf8');
const rail = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/platform-v7/MobileHeaderActionRail.tsx'), 'utf8');

describe('platform-v7 mobile logout soft exit', () => {
  it('mounts the soft exit guard in the platform template', () => {
    expect(template).toContain("import { MobileLogoutSoftExit }");
    expect(template).toContain('<MobileLogoutSoftExit />');
  });

  it('intercepts every mobile/header logout path before stale events can run', () => {
    expect(guard).toContain("document.addEventListener('click', onClick, true)");
    expect(guard).toContain(".p7-mobile-danger,.pc-v7-logout-btn,[data-platform-v7-logout=\"true\"]");
    expect(guard).toContain('event.stopImmediatePropagation()');
    expect(guard).toContain("router.replace('/platform-v7'");
  });

  it('removes hard document navigation from the mobile tools exit path', () => {
    expect(rail).not.toContain("window.location.assign('/platform-v7')");
    expect(rail).toContain("router.replace('/platform-v7'");
  });
});
