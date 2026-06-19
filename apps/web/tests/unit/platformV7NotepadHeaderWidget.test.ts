import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const layoutSource = readFileSync(resolve(__dirname, '../../components/platform-v7/PlatformV7LayoutClient.tsx'), 'utf8');
const widgetSource = readFileSync(resolve(__dirname, '../../components/platform-v7/NotepadHeaderWidget.tsx'), 'utf8');

describe('platform-v7 notepad header widget', () => {
  it('mounts the notepad widget inside the cabinet shell only', () => {
    expect(layoutSource).toContain("import { NotepadHeaderWidget }");
    expect(layoutSource).toContain('<NotepadHeaderWidget />');
    expect(layoutSource.indexOf('<NotepadHeaderWidget />')).toBeGreaterThan(layoutSource.indexOf('<AppShellV4'));
  });

  it('provides a plain local notepad popover without backend maturity claims', () => {
    expect(widgetSource).toContain("aria-label='Открыть блокнот'");
    expect(widgetSource).toContain("aria-label='Блокнот'");
    expect(widgetSource).toContain("aria-label='Текст блокнота'");
    expect(widgetSource).toContain('createPortal');
    expect(widgetSource).toContain('window.localStorage');
    expect(widgetSource).toContain('platform-v7-header-notepad');
    expect(widgetSource).not.toContain('production-ready');
    expect(widgetSource).not.toContain('fully live');
    expect(widgetSource).not.toContain('fully integrated');
  });
});
