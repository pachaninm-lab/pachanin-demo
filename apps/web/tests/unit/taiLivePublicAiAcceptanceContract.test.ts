import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const acceptance = read('scripts/tai-live-public-ai-acceptance.mjs');
const polish = read('apps/web/styles/platform-v7-public-assistant-polish.css');

describe('TAI live public AI mobile acceptance contract', () => {
  it('counts the native fullscreen control in the DOM instead of requiring it to be visible', () => {
    expect(acceptance).toContain("dialog.locator('button[aria-label=\"Развернуть на весь экран\"]')");
    expect(acceptance).toContain('fullscreenDomCount = await fullscreen.count()');
    expect(acceptance).toContain('native_fullscreen_dom_count_invalid');
    expect(acceptance).toContain('fullscreenVisible = await fullscreen.isVisible()');
    expect(acceptance).toContain('mobile_fullscreen_control_visible');
    expect(acceptance).not.toContain("getByRole('button', { name: 'Развернуть на весь экран' }).count()");
  });

  it('waits for the governed mobile viewport before checking the hidden control', () => {
    expect(acceptance).toContain("data-pc-mobile-viewport-authority') === 'true'");
    expect(polish).toContain('A mobile viewport is already full screen; a second expand control is noise.');
    expect(polish).toContain('> .pc-public-assistant-icon-button:first-of-type');
    expect(polish).toContain('display: none !important;');
  });

  it('retains diagnostics and screenshot evidence on assertion failure', () => {
    expect(acceptance).toContain('public-ai-window-failure-390x844.png');
    expect(acceptance).toContain('public-ai-window-failure.json');
    expect(acceptance).toContain("schemaVersion: 'tai.public-ai-ui.acceptance-failure.v1'");
    expect(acceptance).toContain("status: 'FAIL'");
  });
});
