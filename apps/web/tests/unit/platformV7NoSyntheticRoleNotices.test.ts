import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const controller = fs.readFileSync(path.join(process.cwd(), 'components/platform-v7/PlatformV7ShellUxController.tsx'), 'utf8');

describe('role shell notices', () => {
  it('does not render hard-coded role notices or duplicate logout controls', () => {
    expect(controller).not.toContain('NOTICES_BY_ROLE');
    expect(controller).not.toContain('Уведомления роли');
    expect(controller).not.toContain('pc-v7-notice-panel');
    expect(controller).not.toContain('LogOut');
  });
});
