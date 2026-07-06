import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const guard = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/platform-v7/MobileLogoutSoftExit.tsx'), 'utf8');
const layout = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/platform-v7/layout.tsx'), 'utf8');
const rail = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/platform-v7/MobileHeaderActionRail.tsx'), 'utf8');

describe('platform-v7 mobile logout soft exit', () => {
  it('mounts a capture-phase guard in the platform layout', () => {
    expect(layout).toContain("import { MobileLogoutSoftExit }");
    expect(layout).toContain('<MobileLogoutSoftExit />');
  });

  it('intercepts the mobile logout button before the hard navigation handler', () => {
    expect(guard).toContain("document.addEventListener('click', onClick, true)");
    expect(guard).toContain("target?.closest('.p7-mobile-danger')");
    expect(guard).toContain('event.stopImmediatePropagation()');
    expect(guard).toContain("router.replace('/platform-v7?from=logout'");
  });

  it('documents the legacy hard navigation source that must be intercepted on mobile', () => {
    expect(rail).toContain("window.location.assign('/platform-v7')");
  });
});
