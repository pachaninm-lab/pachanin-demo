import { describe, expect, it } from 'vitest';
import { buildEvidencePackReadinessUiModel } from '@/lib/v7r/evidence-pack-ui';

describe('platform-v7 evidence readiness UI model', () => {
  it('surfaces ready DK-2024-89 evidence pack without blockers', () => {
    const model = buildEvidencePackReadinessUiModel('DK-2024-89');

    expect(model).toMatchObject({
      disputeId: 'DK-2024-89',
      dealId: 'DL-9102',
      statusLabel: 'Готов к разбору',
      statusTone: 'success',
      scoreLabel: '100%',
      requiredLabel: '3/3 required',
      totalLabel: '4 evidence objects',
      blockers: [],
    });
    expect(model.items).toHaveLength(4);
    expect(model.items.map((item) => item.typeLabel)).toContain('Лабораторный протокол');
    expect(model.items.map((item) => item.sourceLabel)).toContain('Провайдер ЭДО');
    expect(model.items.find((item) => item.id === 'EV-DK-89-PHOTO-001')?.geoLabel).toContain('52.721');
  });

  it('surfaces controlled pilot limitations and incomplete unknown pack', () => {
    const model = buildEvidencePackReadinessUiModel('DK-UNKNOWN');

    expect(model.statusLabel).toBe('Неполный пакет');
    expect(model.statusTone).toBe('danger');
    expect(model.scoreLabel).toBe('0%');
    expect(model.items).toEqual([]);
    expect(model.blockers).toEqual(expect.arrayContaining([
      'Не хватает обязательного evidence: lab_protocol',
      'Не хватает обязательного evidence: transport_document',
      'Не хватает обязательного evidence: photo',
    ]));
    expect(model.limitations).toEqual(expect.arrayContaining([
      'Live file upload не подключён.',
      'Binary payload hashing не подключён.',
      'Квалифицированная электронная подпись не подключена.',
    ]));
  });
});
