import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const layoutSource = readFileSync(resolve(__dirname, '../../app/platform-v7/layout.tsx'), 'utf8');
const widgetSource = readFileSync(resolve(__dirname, '../../components/platform-v7/NotepadHeaderWidget.tsx'), 'utf8');

describe('platform-v7 notepad header widget', () => {
  it('mounts the notepad widget inside the cabinet shell only', () => {
    expect(layoutSource).toContain('import { NotepadHeaderWidget }');
    expect(layoutSource).toContain('<NotepadHeaderWidget />');
    expect(layoutSource.indexOf('<NotepadHeaderWidget />')).toBeGreaterThan(layoutSource.indexOf('<AppShellV4'));
  });

  it('provides a local scratchpad popover persisted to this browser only', () => {
    expect(widgetSource).toContain("aria-label='Открыть блокнот'");
    expect(widgetSource).toContain("aria-label='Блокнот'");
    expect(widgetSource).toContain('createPortal');
    expect(widgetSource).toContain("'pc-v7-notepad'");
    expect(widgetSource).toContain('localStorage');
    // Honest framing: notes never leave the browser, no fake sync/cloud claims.
    expect(widgetSource).toContain('Локально, только в этом браузере');
    expect(widgetSource).not.toMatch(/синхронизац|облако|на сервере|production-ready/i);
  });
});
