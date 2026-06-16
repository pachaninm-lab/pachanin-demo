import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const visibleRuntimeFiles = [
  'apps/web/components/v7r/DocumentsDropzone.tsx',
  'apps/web/components/v7r/DomainDealsSummary.tsx',
  'apps/web/components/v7r/LiveDealDetailRuntime.tsx',
  'apps/web/components/v7r/LiveDealInvestorRuntime.tsx',
  'apps/web/components/v7r/ControlTowerOperatorPanel.tsx',
  'apps/web/components/v7r/EvidencePackOperationsQueue.tsx',
  'apps/web/components/v7r/ExecutionSimulationActionPanel.tsx',
  'apps/web/components/v7r/CatchAllPage.tsx',
] as const;

function read(file: string) {
  return fs.readFileSync(path.join(process.cwd(), file), 'utf8');
}

describe('platform-v7 visible runtime money copy guard', () => {
  it('documents the remaining visible runtime cleanup surface', () => {
    for (const file of visibleRuntimeFiles) {
      expect(read(file).length).toBeGreaterThan(0);
    }
  });

  it('forbids strongest autonomous money movement claims in visible runtime', () => {
    const combined = visibleRuntimeFiles.map(read).join('\n');

    expect(combined).not.toContain('платформа гарантирует оплату');
    expect(combined).not.toContain('деньги автоматически выпускаются');
    expect(combined).not.toContain('платформа выпускает деньги');
    expect(combined).not.toContain('самостоятельный выпуск денег платформой');
  });
});
