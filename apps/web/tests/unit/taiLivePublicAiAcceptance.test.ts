import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(process.cwd(), '../..');
const acceptance = fs.readFileSync(
  path.join(root, 'scripts/tai-live-public-ai-acceptance.mjs'),
  'utf8',
);

describe('TAI live public AI acceptance', () => {
  it('requires one native fullscreen control and rejects the legacy duplicate', () => {
    expect(acceptance).toContain("dialog.locator('.pc-modal-sheet-fullscreen-button').count()");
    expect(acceptance).toContain("[data-pc-public-assistant-fullscreen=\"native\"]");
    expect(acceptance).toContain("throw new Error('native_fullscreen_control_count_invalid')");
    expect(acceptance).not.toContain("getByRole('button', { name: 'Развернуть на весь экран' }).count()");
  });

  it('validates fullscreen labels against state, exercises the toggle, and restores state', () => {
    expect(acceptance).toContain("initialStateValue !== 'true' && initialStateValue !== 'false'");
    expect(acceptance).toContain("fullscreenInitialState ? 'Вернуть компактный режим' : 'Развернуть на весь экран'");
    expect(acceptance).toContain('await fullscreenControl.click()');
    expect(acceptance).toContain("toggledStateValue !== expectedToggledState");
    expect(acceptance).toContain("panel?.getAttribute('data-fullscreen') === initialState");
    expect(acceptance).toContain("throw new Error('fullscreen_restore_label_invalid')");
  });

  it('preserves redacted evidence for both PASS and FAIL outcomes', () => {
    expect(acceptance).toContain("schemaVersion: 'tai.public-ai-ui.acceptance.v2'");
    expect(acceptance).toContain("schemaVersion: 'tai.public-ai-ui.failure.v1'");
    expect(acceptance).toContain("writeJson('public-ai-window-failure.json'");
    expect(acceptance).toContain("public-ai-window-failure-390x844.png");
    expect(acceptance).toContain(".replaceAll(liveBase, '[LIVE_BASE]')");
    expect(acceptance).toContain('pageErrors: pageErrors.slice(0, 20)');
  });

  it('keeps exact-main manifest, branding, streaming, alert and overflow gates intact', () => {
    for (const fragment of [
      'manifestSha !== targetSha',
      "title !== 'ИИ для агробизнеса'",
      "subtitle !== 'Разработан Прозрачной ценой для сельского хозяйства.'",
      'data-stream-status=\"answered\"',
      "dialog.locator('[role=\"alert\"]')",
      'overflow.horizontal > 1 || overflow.viewportRight > 1',
      'if (pageErrors.length)',
    ]) expect(acceptance).toContain(fragment);
  });
});
