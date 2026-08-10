import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const assistant = read('components/platform-v7/PublicPlatformAssistant.tsx');
const contactDock = read('components/platform-v7/PublicContactDock.tsx');
const dealJourney = read('i18n/public-deal-journey-v5.ts');
const publicBrandSources = `${assistant}\n${contactDock}\n${dealJourney}`;

describe('Gekta public brand contract', () => {
  it('uses the canonical Russian brand, descriptor and CTA', () => {
    expect(assistant).toContain("open: 'Спросить Гекту'");
    expect(assistant).toContain("title: 'Гекта'");
    expect(assistant).toContain("subtitle: 'Аграрный интеллект для земли, урожая и решений.'");
    expect(contactDock).toContain("assistant: 'Гекта'");
    expect(contactDock).toContain("assistantAria: 'Открыть Гекту'");
    expect(dealJourney).toContain("askTai: 'Спросить Гекту об этом этапе'");
    expect(dealJourney).toContain('Гекта объясняет текущий статус и риск');
  });

  it('uses Gekta consistently in English and Chinese public copy', () => {
    expect(assistant).toContain("open: 'Ask Gekta'");
    expect(assistant).toContain("title: 'Gekta'");
    expect(contactDock).toContain("assistant: 'Gekta'");
    expect(contactDock).toContain("assistantAria: 'Open Gekta'");
    expect(dealJourney).toContain("askTai: 'Ask Gekta about this stage'");
    expect(dealJourney).toContain("askTai: '向 Gekta 询问当前阶段'");
  });

  it('does not expose the retired TAI identity on the changed public surfaces', () => {
    const retiredVisibleCopy = [
      'Спросить TAI',
      'Ask TAI',
      '询问 TAI',
      'Спросить ИИ',
      'Открыть ИИ-помощника по платформе',
      'Open the platform AI assistant',
      '打开平台 AI 助手',
      'TAI объясняет текущий статус и риск',
      'TAI explains current status and risk',
      'TAI 解释当前状态和风险',
    ];

    for (const retired of retiredVisibleCopy) {
      expect(publicBrandSources).not.toContain(retired);
    }
  });

  it('rejects forbidden Gekta spellings without banning generic AI terminology', () => {
    for (const forbidden of ['Гекто', 'Gekto', 'Hekta', 'Gecta', 'TAI Гекта']) {
      expect(publicBrandSources).not.toContain(forbidden);
    }

    // Generic terms can remain where they describe technology or stable
    // internal contracts; this guard protects the named public product only.
    expect(assistant).toContain("import type { GatewayRefusal } from '@pc/ai-assistant-stream-contract';");
  });

  it('moves transcripts to the Gekta key while preserving one-time legacy recovery', () => {
    expect(assistant).toContain('return `pc-gekta-assistant-v1:${locale}`;');
    expect(assistant).toContain('return [`pc-public-assistant-v2:${locale}`] as const;');
    expect(assistant).toContain('const stored = window.sessionStorage.getItem(primaryKey);');
    expect(assistant).toContain('const legacyStored = window.sessionStorage.getItem(legacyKey);');
    expect(assistant).toContain('const migrated = safeStoredMessages(JSON.parse(legacyStored));');
    expect(assistant).toContain('window.sessionStorage.setItem(primaryKey, JSON.stringify(migrated));');
    expect(assistant).toContain('window.sessionStorage.removeItem(legacyKey);');
  });
});
