import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const layoutSource = readFileSync(resolve(__dirname, '../../components/platform-v7/PlatformV7LayoutClient.tsx'), 'utf8');
const widgetSource = readFileSync(resolve(__dirname, '../../components/platform-v7/CalculatorHeaderWidget.tsx'), 'utf8');

const rolesWithAdvancedTools = ['operator', 'buyer', 'seller', 'logistics', 'elevator', 'bank', 'arbitrator', 'executive'];
const rolesWithoutAdvancedTools = ['driver', 'surveyor', 'lab', 'compliance'];

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

  it('keeps advanced role calculations only for roles that need them', () => {
    expect(widgetSource).toContain('ROLE_CALCULATORS');
    expect(widgetSource).toContain('Partial<Record<PlatformRole, RoleCalculatorPreset>>');
    expect(widgetSource).toContain('usePlatformV7RStore');
    expect(widgetSource).toContain('rolePreset ?');

    for (const role of rolesWithAdvancedTools) {
      expect(widgetSource).toContain(`${role}: {`);
    }

    for (const role of rolesWithoutAdvancedTools) {
      expect(widgetSource).not.toContain(`${role}: {`);
    }

    expect(widgetSource).toContain('Операционный маржинальный расчёт');
    expect(widgetSource).toContain('Итоговая стоимость закупки');
    expect(widgetSource).toContain('Чистая сумма продавца');
    expect(widgetSource).toContain('Стоимость перевозки');
    expect(widgetSource).toContain('Элеватор: хранение и доработка');
    expect(widgetSource).toContain('Банк: резерв и выпуск средств');
    expect(widgetSource).toContain('Арбитраж: сумма спора');
    expect(widgetSource).toContain('Руководитель: портфельная экономика');

    expect(widgetSource).not.toContain('Расчёт выплаты водителю');
    expect(widgetSource).not.toContain('Стоимость сюрвейерского контроля');
    expect(widgetSource).not.toContain('Лабораторный расчёт');
    expect(widgetSource).not.toContain('Комплаенс: стоимость риска');
  });
});
