import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const layoutSource = readFileSync(resolve(__dirname, '../../components/platform-v7/PlatformV7LayoutClient.tsx'), 'utf8');
const widgetSource = readFileSync(resolve(__dirname, '../../components/platform-v7/CalculatorHeaderWidget.tsx'), 'utf8');

describe('platform-v7 calculator header widget', () => {
  it('mounts the calculator widget inside the cabinet shell only', () => {
    expect(layoutSource).toContain("import { CalculatorHeaderWidget }");
    expect(layoutSource).toContain('<CalculatorHeaderWidget />');
    expect(layoutSource.indexOf('<CalculatorHeaderWidget />')).toBeGreaterThan(layoutSource.indexOf('<AppShellV4'));
  });

  it('provides a plain calculator popover without unsafe expression evaluation', () => {
    expect(widgetSource).toContain("aria-label='Открыть калькулятор'");
    expect(widgetSource).toContain("aria-label='Калькулятор'");
    expect(widgetSource).toContain('createPortal');
    expect(widgetSource).toContain('applyOperation');
    expect(widgetSource).not.toContain('eval(');
    expect(widgetSource).not.toContain('new Function');
  });
});
