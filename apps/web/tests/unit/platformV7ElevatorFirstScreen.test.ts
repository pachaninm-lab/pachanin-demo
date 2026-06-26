import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const elevatorPage = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/platform-v7/elevator/page.tsx'), 'utf8');
const elevatorGrainPage = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/platform-v7/elevator/grain/page.tsx'), 'utf8');

describe('platform-v7 elevator first screen', () => {
  it('shows the operational first-screen contract before collapsible workflow details', () => {
    expect(elevatorPage).toContain("data-testid='platform-v7-elevator-first-screen'");
    expect(elevatorPage).toContain('Что произошло');
    expect(elevatorPage).toContain('Что заблокировано');
    expect(elevatorPage).toContain('Деньги под риском');
    expect(elevatorPage).toContain('Кто отвечает');
    expect(elevatorPage).toContain('Следующее действие');
    expect(elevatorPage.indexOf("data-testid='platform-v7-elevator-first-screen'")).toBeLessThan(elevatorPage.indexOf("<CollapsibleSection title='Обзор приёмки'"));
  });

  it('keeps visible first-screen actions wired to real sections', () => {
    expect(elevatorPage).toContain("<a href='#weight' style={primaryBtn}>Открыть фиксацию веса</a>");
    expect(elevatorPage).toContain("<a href='#quality' style={ghostBtn}>Открыть качество</a>");
    expect(elevatorPage).toContain("<section id='weight'");
    expect(elevatorPage).toContain("<section id='quality'");
  });

  it('keeps elevator grain visible action targets touch-safe', () => {
    expect(elevatorGrainPage).toContain('const primaryBtn = { textDecoration: \'none\', minHeight: 46');
    expect(elevatorGrainPage).toContain('const ghostBtn = { textDecoration: \'none\', minHeight: 46');
    expect(elevatorGrainPage).not.toContain('const primaryBtn = { textDecoration: \'none\', minHeight: 44');
    expect(elevatorGrainPage).not.toContain('const ghostBtn = { textDecoration: \'none\', minHeight: 44');
  });

  it('keeps the elevator pass honest about pre-integration maturity', () => {
    expect(elevatorPage).toContain('controlled-pilot / pre-integration');
    expect(elevatorPage).not.toContain('production ready');
    expect(elevatorPage).not.toContain('полностью готов');
  });
});
