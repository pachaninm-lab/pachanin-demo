import { describe, expect, it } from 'vitest';
import { buildEvidencePackReadinessUiModel } from '@/lib/v7r/evidence-pack-ui';

describe('proof package ui labels', () => {
  it('returns Russian summary labels', () => {
    const model = buildEvidencePackReadinessUiModel('DK-2024-89');

    expect(model.requiredLabel).toContain('обязательных');
    expect(model.totalLabel).toContain('доказательств');
    expect(model.limitations.join(' ')).toContain('Данные тестового пилотного слоя');
  });
});
