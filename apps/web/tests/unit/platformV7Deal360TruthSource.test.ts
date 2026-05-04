import { describe, expect, it } from 'vitest';
import {
  DEAL360_SCENARIOS,
  canShowProviderAsLive,
  getBlockedIrreversibleActions,
  getDeal360ProviderReadinessSummary,
} from '@/lib/platform-v7/deal360-source-of-truth';

describe('platform-v7 Deal 360 truth source', () => {
  it('does not mark demo, sandbox, test or prelive providers as live', () => {
    const scenario = DEAL360_SCENARIOS['DL-9106'];

    expect(scenario.providerGates.some((gate) => gate.readiness !== 'live')).toBe(true);
    expect(scenario.providerGates.filter(canShowProviderAsLive)).toHaveLength(0);
    expect(getDeal360ProviderReadinessSummary(scenario).live).toBe(0);
  });

  it('blocks irreversible money release when bank, document and government gates are open', () => {
    const blocked = getBlockedIrreversibleActions(DEAL360_SCENARIOS['DL-9106']);
    const joined = blocked.join(' | ');

    expect(blocked.length).toBeGreaterThan(0);
    expect(joined).toContain('Сбер · Безопасные сделки');
    expect(joined).toContain('СДИЗ');
    expect(joined).toContain('УПД');
    expect(joined).toContain('ЭТрН');
  });

  it('keeps legal level and external status for every release-critical document', () => {
    const docs = DEAL360_SCENARIOS['DL-9106'].documents.filter((doc) => doc.requiredForRelease);

    expect(docs.length).toBeGreaterThan(0);

    for (const doc of docs) {
      expect(['internal', 'external_edo', 'government', 'bank']).toContain(doc.legalLevel);
      expect(doc.externalStatus.length).toBeGreaterThan(8);
    }
  });
});
