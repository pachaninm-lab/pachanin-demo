import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const source = fs.readFileSync(
  path.join(root, 'apps/web/components/platform-v7/PublicDealExplorerV4.tsx'),
  'utf8',
);
const journeyCss = fs.readFileSync(
  path.join(root, 'apps/web/styles/platform-v7-public-deal-journey-v5.css'),
  'utf8',
);
const journeyCopy = fs.readFileSync(
  path.join(root, 'apps/web/i18n/public-deal-journey-v5.ts'),
  'utf8',
);

describe('platform-v7 public Deal journey UX', () => {
  it('starts from user intent instead of system role terminology', () => {
    expect(source).toContain('DEAL_JOURNEY_INTENTS.map');
    expect(source).toContain("className='pc-ppe-v5-intent-option'");
    expect(source).toContain('journey.labels.intentQuestion');
    expect(source).toContain('journey.labels.otherParticipant');
    expect(journeyCopy).toContain("sell: { label: 'Продать продукцию'");
    expect(journeyCopy).toContain("buy: { label: 'Купить продукцию'");
    expect(journeyCopy).toContain("transport: { label: 'Организовать перевозку'");
    expect(journeyCopy).toContain("receive: { label: 'Принять и проверить груз'");
    expect(journeyCopy).toContain("settle: { label: 'Провести расчёт'");
    expect(journeyCopy).toContain("control: { label: 'Контролировать исполнение'");
  });

  it('uses progressive disclosure with quick and detailed modes', () => {
    expect(source).toContain("type JourneyMode = 'quick' | 'detailed'");
    expect(source).toContain("journeyMode === 'quick'");
    expect(source).toContain("data-testid='public-deal-detailed-mode'");
    expect(source).toContain('<PublicDealExplorer key={historyRevision}');
    expect(source).toContain('journey.labels.detailedOpen');
    expect(source).toContain('journey.labels.detailedBack');
  });

  it('keeps one Deal as the persistent object and explains the current stage around the visitor', () => {
    expect(source).toContain("data-testid='public-deal-journey-context'");
    expect(source).toContain('journey.labels.whatHappened');
    expect(source).toContain('journey.labels.yourAction');
    expect(source).toContain('journey.labels.platformAction');
    expect(source).toContain('journey.labels.nowActs');
    expect(source).toContain('ACTIVE_PERSPECTIVES_BY_STAGE');
  });

  it('shows plain-language scenarios and cross-cutting money documents and risk', () => {
    expect(source).toContain("className='pc-ppe-v5-scenario-grid pc-ppe-v4-mobile-scenario-list'");
    expect(source).toContain('TOUR_SCENARIOS.map');
    expect(source).toContain('journey.moneyByStage[historyState.stage]');
    expect(source).toContain('journey.documentsByStage[historyState.stage]');
    expect(source).toContain('scenarioRisk');
    expect(journeyCopy).toContain("standard: { label: 'Всё прошло нормально'");
    expect(journeyCopy).toContain("partial: { label: 'Приняли не весь объём'");
    expect(journeyCopy).toContain("dispute: { label: 'Качество не совпало'");
  });

  it('uses the existing public assistant as a stage-aware TAI layer', () => {
    expect(source).toContain("window.dispatchEvent(new CustomEvent('pc:public-assistant-context'");
    expect(source).toContain('journey.taiPrompts[historyState.stage]');
    expect(source).toContain("context: `deal-${historyState.stage}`");
    expect(source).toContain("name: 'tai_stage_prompt_opened'");
  });

  it('finishes with a concrete Deal result and one primary organization CTA', () => {
    expect(source).toContain("historyState.stage === 'closure'");
    expect(source).toContain('journey.finalChecks.map');
    expect(source).toContain('journey.labels.oneContour');
    expect(source).toContain("href='/platform-v7/register'");
    expect(source).toContain('journey.before.map');
    expect(source).toContain('journey.after.map');
  });

  it('keeps mobile targets usable without horizontal document overflow', () => {
    expect(journeyCss).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
    expect(journeyCss).toContain('min-height: 58px');
    expect(journeyCss).toContain('@media (max-width: 360px)');
    expect(journeyCss).toContain('min-height: 68px');
    expect(journeyCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(journeyCss).toContain('@media (forced-colors: active)');
  });
});
