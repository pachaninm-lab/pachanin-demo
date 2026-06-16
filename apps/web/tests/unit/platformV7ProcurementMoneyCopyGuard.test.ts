import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/v7r/BuyerProcurementRuntimeV2.tsx'), 'utf8');
const renderSource = source.replace(/function normalizeDraftNextStep[\s\S]*?\n}\n\nexport function/, 'export function');

describe('platform-v7 procurement money copy guard', () => {
  it('keeps procurement draft statuses framed as bank basis and bank event', () => {
    expect(source).toContain("if (status === 'release_ready') return 'Основание готово'");
    expect(source).toContain("if (status === 'released') return 'Банк подтвердил событие'");
    expect(source).toContain('normalizeDraftNextStep(item.nextStep)');
  });

  it('does not render autonomous money-release wording outside the normalizer', () => {
    expect(renderSource).not.toContain('Готово к выпуску');
    expect(renderSource).not.toContain('Деньги выпущены');
    expect(renderSource).not.toContain('Банк может выпускать деньги');
    expect(renderSource).not.toContain('Запросить выпуск денег');
    expect(renderSource).not.toContain('Запрошен выпуск денег');
    expect(renderSource).not.toContain('выпуск денег');
    expect(renderSource).not.toMatch(/пилот|демо/i);
    expect(renderSource).not.toContain('платформа гарантирует оплату');
    expect(renderSource).not.toContain('деньги автоматически выпускаются');
  });
});
