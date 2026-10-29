import {
  buildProviderCategorySummary,
  buildProviderSelection,
  buildProviderStagePlan,
  listServiceProviders,
  type ServiceProviderEntry,
} from '../../../../../packages/domain-core/src';
import {
  assertProviderRegistryReplay,
  PROVIDER_CATEGORIES,
  PROVIDER_CATEGORY_CAPABILITY,
  ProviderRegistryValidationError,
  providerRegistryCommandFingerprint,
  type ServiceOfferingCommand,
} from './provider-registry.contract';

const offering: ServiceProviderEntry = {
  id: 'offering-1',
  providerId: 'provider-1',
  name: 'Проверяемый перевозчик',
  category: 'LOGISTICS',
  regions: ['Тамбовская область'],
  cultures: ['Пшеница'],
  stages: ['DISPATCH'],
  evidenceMaturity: 'VERIFIED',
};

function command(overrides: Partial<ServiceOfferingCommand> = {}): ServiceOfferingCommand {
  return {
    entityType: 'SERVICE_OFFERING',
    action: 'UPSERT',
    offeringKey: 'carrier-main',
    category: 'LOGISTICS',
    title: 'Перевозка зерна',
    description: 'Перевозка зерна автомобильным транспортом.',
    regions: ['Воронежская область', 'Тамбовская область'],
    cultures: ['Кукуруза', 'Пшеница'],
    stages: ['RECEIVING', 'DISPATCH'],
    commandId: 'command-provider-001',
    idempotencyKey: 'idempotency-provider-001',
    correlationId: 'correlation-provider-001',
    expectedVersion: '1',
    reason: 'Добавляем проверяемое предложение перевозки.',
    ...overrides,
  };
}

describe('provider registry contract', () => {
  it('keeps the bounded provider categories mapped to organization capabilities', () => {
    expect(PROVIDER_CATEGORIES).toEqual([
      'LOGISTICS', 'INSURANCE', 'LAB', 'SURVEY', 'ELEVATOR', 'PORT', 'RAIL', 'BANK',
    ]);
    expect(Object.keys(PROVIDER_CATEGORY_CAPABILITY).sort()).toEqual([...PROVIDER_CATEGORIES].sort());
    expect(PROVIDER_CATEGORY_CAPABILITY.BANK).toBe('PROVIDE_FINANCING');
  });

  it('has no implicit provider or bank when durable rows are empty', () => {
    expect(listServiceProviders([])).toEqual([]);
    expect(buildProviderCategorySummary([]).every((item) => item.count === 0)).toBe(true);
    expect(buildProviderSelection('BANK', {}, []).selection.recommended).toBeNull();
  });

  it('ranks only supplied durable candidates with explainable coverage criteria', () => {
    const selection = buildProviderSelection('LOGISTICS', {
      region: 'Тамбовская область',
      culture: 'Пшеница',
    }, [offering]);
    expect(selection.strategy).toBe('durable-coverage-match-v1');
    expect(selection.selection.recommended).toMatchObject({
      id: 'offering-1',
      score: 100,
      why: expect.arrayContaining([
        'категория подтверждена реестром',
        'обязательные evidence подтверждены',
        'регион: Тамбовская область',
      ]),
    });
  });

  it('filters a stage plan by the durable offering stages', () => {
    const plan = buildProviderStagePlan('PAYMENT', {}, [offering]);
    expect(plan.items.flatMap((item) => item.selection.ranked)).toEqual([]);
  });

  it('canonicalizes unordered coverage fields in the idempotency fingerprint', () => {
    expect(providerRegistryCommandFingerprint(command())).toBe(
      providerRegistryCommandFingerprint(command({
        regions: ['Тамбовская область', 'Воронежская область'],
        cultures: ['Пшеница', 'Кукуруза'],
        stages: ['DISPATCH', 'RECEIVING'],
      })),
    );
  });

  it('rejects changed payload under the same idempotency key', () => {
    const original = command();
    const fingerprint = providerRegistryCommandFingerprint(original);
    expect(() => assertProviderRegistryReplay(fingerprint, command({
      description: 'Другое предложение перевозки с изменёнными условиями.',
    }))).toThrow(ProviderRegistryValidationError);
  });
});
