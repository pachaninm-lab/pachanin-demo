import {
  assertIdempotentReplay,
  commodityProfileCommandFingerprint,
  CommodityProfileCommandValidationError,
  type CommodityProfileCommand,
} from './commodity-profile-command.contract';

function command(overrides: Partial<CommodityProfileCommand> = {}): CommodityProfileCommand {
  return {
    commandId: 'command-001',
    idempotencyKey: 'idempotency-001',
    correlationId: 'correlation-001',
    profileId: 'profile-wheat',
    profileVersionId: 'profile-wheat-v1',
    action: 'SUBMIT_REVIEW',
    expectedVersion: '0',
    reason: 'Передача канонического профиля на обязательную проверку.',
    payload: { b: 2, a: 1 },
    ...overrides,
  };
}

describe('commodity profile command contract', () => {
  it('produces deterministic SHA-256 fingerprint for reordered payload keys', () => {
    const left = commodityProfileCommandFingerprint(command({ payload: { b: 2, a: 1 } }));
    const right = commodityProfileCommandFingerprint(command({ payload: { a: 1, b: 2 } }));
    expect(left).toBe(right);
    expect(left).toMatch(/^[a-f0-9]{64}$/);
  });

  it('binds the fingerprint to expected version and human reason', () => {
    expect(commodityProfileCommandFingerprint(command({ expectedVersion: '1' })))
      .not.toBe(commodityProfileCommandFingerprint(command({ expectedVersion: '2' })));
    expect(commodityProfileCommandFingerprint(command({ reason: 'Первая обоснованная причина изменения профиля.' })))
      .not.toBe(commodityProfileCommandFingerprint(command({ reason: 'Вторая обоснованная причина изменения профиля.' })));
  });

  it('rejects unsafe command identifiers', () => {
    expect(() => commodityProfileCommandFingerprint(command({ commandId: '../unsafe' })))
      .toThrow(CommodityProfileCommandValidationError);
  });

  it('rejects numeric expectedVersion supplied in an unsafe textual form', () => {
    expect(() => commodityProfileCommandFingerprint(command({ expectedVersion: '01' })))
      .toThrow('expectedVersion must be a non-negative integer string');
  });

  it('requires a meaningful human reason', () => {
    expect(() => commodityProfileCommandFingerprint(command({ reason: 'коротко' })))
      .toThrow('reason must contain 10..2000 characters');
  });

  it('accepts exact replay and rejects payload mismatch', () => {
    const original = command();
    const fingerprint = commodityProfileCommandFingerprint(original);
    expect(() => assertIdempotentReplay(fingerprint, command({ payload: { a: 1, b: 2 } })))
      .not.toThrow();
    expect(() => assertIdempotentReplay(fingerprint, command({ payload: { a: 1, b: 3 } })))
      .toThrow('IDEMPOTENCY_PAYLOAD_MISMATCH');
  });
});
