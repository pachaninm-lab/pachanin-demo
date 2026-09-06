import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

const strategicHome = read('components/platform-v7/PlatformV7StrategicHome.tsx');
const homeOperating = read('i18n/platform-v7-home-v3-operating.ts');
const roleWorkspace = read('components/platform-v7/PublicDealRoleScenario.tsx');
const aiExperience = read('components/platform-v7/PublicAiInActionSimpleExperience.tsx');

describe('platform-v7 public presentation has no readiness/status model', () => {
  it('does not render Deal status labels in homepage mockups', () => {
    expect(strategicHome).not.toContain('{normalState.status}');
    expect(strategicHome).not.toContain('{state.status}');
    expect(strategicHome).toContain("title: 'Доверие встроено в логику одной Сделки'");
    expect(strategicHome).not.toContain('не считаются активными');
    expect(strategicHome).not.toContain('not presented as active');
    expect(strategicHome).not.toContain('描述为已启用');
  });

  it('uses process and evidence language instead of readiness language', () => {
    expect(homeOperating).toContain("controlTower: 'Упрощённый пример одной Сделки'");
    expect(homeOperating).toContain('Документы и основание расчёта');
    expect(homeOperating).toContain('Documents and settlement basis');
    expect(homeOperating).toContain('文件与结算依据');
    expect(homeOperating).not.toContain('готовность расчёта');
    expect(homeOperating).not.toContain('settlement readiness');
    expect(roleWorkspace).not.toContain('status:');
    expect(roleWorkspace).not.toContain('readiness');
  });

  it('keeps Gekta copy on context, grounds and human authority', () => {
    expect(aiExperience).toContain("boundary: 'Проверяемые границы'");
    expect(aiExperience).toContain("line: ['Контекст Сделки'");
    expect(aiExperience).not.toContain("hero: { eyebrow: 'Гекта внутри Сделки', title: 'Гекта объясняет состояние Сделки");
    expect(aiExperience).toContain('Критическое решение остаётся у человека');
  });
});
