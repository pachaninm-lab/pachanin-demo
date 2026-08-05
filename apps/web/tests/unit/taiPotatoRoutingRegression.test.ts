import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(process.cwd(), '../..');
const middleware = fs.readFileSync(path.join(root, 'apps/web/middleware.ts'), 'utf8');
const workflow = fs.readFileSync(
  path.join(root, '.github/workflows/tai-restricted-qwen-reg-ru-activation.yml'),
  'utf8',
);
const acceptance = fs.readFileSync(
  path.join(root, 'scripts/tai-potato-mobile-live-acceptance.mjs'),
  'utf8',
);

describe('TAI broad agricultural production regression', () => {
  it('forces every public assistant POST request to the model-first agro route', () => {
    expect(middleware).toContain("p === '/api/public-platform-assistant' && req.method === 'POST'");
    expect(middleware).toContain("u.pathname = '/api/agro-chat'");
    expect(middleware).toContain('NextResponse.rewrite(u)');
  });

  it('uses an attempt-scoped controller id instead of the GitHub run id filesystem path', () => {
    expect(workflow).toContain('CONTROLLER_RUN_ID');
    expect(workflow).toContain("format('{0}{1}', github.run_id, github.run_attempt)");
    expect(workflow).toContain('runner-input/${CONTROLLER_RUN_ID}');
    expect(workflow).toContain('runner-output/${{ env.CONTROLLER_RUN_ID }}/activation.json');
    expect(workflow).not.toContain('runner-input/${GITHUB_RUN_ID}');
  });

  it('covers crops, gardens, livestock, machinery, storage, farm economics and village infrastructure', () => {
    const caseIds = [
      'potato-fertilizer',
      'cucumber-yellow-leaves',
      'wheat-low-yield',
      'tomato-blossom-drop',
      'apple-scab',
      'soil-acidity',
      'drip-irrigation',
      'cow-milk-drop',
      'pig-feed-conversion',
      'chicken-egg-drop',
      'bee-wintering',
      'tractor-overheat',
      'combine-losses',
      'mower-vibration',
      'grain-storage',
      'farm-costs',
      'village-water',
      'farm-excel',
      'potato-en',
      'cucumber-zh',
      'context-followup',
    ];
    expect(caseIds.length).toBeGreaterThanOrEqual(20);
    for (const id of caseIds) expect(acceptance).toContain(`id: '${id}'`);
  });

  it('requires real local Qwen, general agro mode, subject relevance and no platform-security misroute', () => {
    expect(acceptance).toContain("assessment.source !== 'local_qwen'");
    expect(acceptance).toContain("assessment.answerMode !== 'general_agro'");
    expect(acceptance).toContain('assertAgriculturalAnswer');
    expect(acceptance).toContain("'как защищаются данные'");
    expect(acceptance).toContain("'доступ назначает сервер'");
    expect(acceptance).toContain('TAI_AGRO_WIDE_MOBILE_LIVE=PASS');
  });

  it('checks RU plus representative EN and ZH questions and mobile UI cases', () => {
    expect(acceptance).toContain("id: 'potato-en'");
    expect(acceptance).toContain("id: 'cucumber-zh'");
    expect(acceptance).toContain('UI_CASE_IDS');
    expect(acceptance).toContain("viewport: '390x844'");
  });

  it('validates bee wintering by independent semantic factor groups', () => {
    const beeStart = acceptance.indexOf("id: 'bee-wintering'");
    const beeEnd = acceptance.indexOf("id: 'tractor-overheat'", beeStart);
    expect(beeStart).toBeGreaterThan(-1);
    expect(beeEnd).toBeGreaterThan(beeStart);
    const beeCase = acceptance.slice(beeStart, beeEnd);
    expect(beeCase).toContain("id: 'feed-reserves'");
    expect(beeCase).toContain("id: 'colony-health'");
    expect(beeCase).toContain("id: 'winter-microclimate'");
    expect(beeCase).toContain("'мед'");
    expect(beeCase).toContain("'болезн'");
    expect(beeCase).toContain("'утепл'");
  });
});
