import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('platform-v7 login mobile stability', () => {
  it('mounts the login stability style only on the login route', () => {
    const guards = read('apps/web/components/platform-v7/PlatformV7TemplateGuards.tsx');
    const style = read('apps/web/components/platform-v7/LoginMobileStabilityStyle.tsx');

    expect(guards).toContain('LoginMobileStabilityStyle');
    expect(guards).toContain("normalizePath(pathname) === '/platform-v7/login'");
    expect(guards).toContain('loginPath ? <LoginMobileStabilityStyle /> : null');
    expect(style).toContain('.pc-v7-login-single .login-grid');
    expect(style).toContain('grid-template-columns:repeat(2,minmax(0,1fr))');
    expect(style).toContain('padding-top:calc(env(safe-area-inset-top,0px) + 86px)');
  });
});
