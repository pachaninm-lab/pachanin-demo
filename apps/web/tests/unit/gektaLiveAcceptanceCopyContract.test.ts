import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const assistant = read('components/platform-v7/PublicPlatformAssistant.tsx');
const liveAcceptance = read('../../scripts/tai-live-public-ai-acceptance.mjs');

const canonicalSubtitles = [
  "subtitle: 'ИИ для сельского хозяйства и агробизнеса от «Прозрачной Цены»'",
  "subtitle: 'AI for farming and agribusiness by Prozrachnaya Tsena'",
  "subtitle: '“透明价格”推出的农业与农业经营 AI'",
] as const;

const retiredAcceptanceSubtitles = [
  "subtitle: 'Аграрный интеллект для земли, урожая и решений.'",
  "subtitle: 'Agricultural intelligence for land, crops and decisions.'",
  "subtitle: '服务于土地、作物与决策的农业智能。'",
] as const;

describe('Gekta live acceptance copy contract', () => {
  it('keeps the governed browser acceptance aligned with the public UI in RU, EN and ZH', () => {
    for (const subtitle of canonicalSubtitles) {
      expect(assistant).toContain(subtitle);
      expect(liveAcceptance).toContain(subtitle);
    }
  });

  it('does not reintroduce the retired live-acceptance subtitles', () => {
    for (const subtitle of retiredAcceptanceSubtitles) {
      expect(liveAcceptance).not.toContain(subtitle);
    }
  });
});
