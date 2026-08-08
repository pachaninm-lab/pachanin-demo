import { type PublicWorkspaceClass } from './dto/register.dto';
import {
  registrationIdempotencyPayload,
  registrationRequestHash,
} from './registration-application.service';

const PASSWORD = 'Correct-Horse-Battery-9!';
const KEY = 'idempotency-key-registration-0001';

function dto(overrides: Record<string, unknown> = {}) {
  return {
    email: 'Applicant@Example.Test',
    phone: '+7 (900) 000-00-01',
    password: PASSWORD,
    fullName: 'Иванов Иван Иванович',
    position: 'Директор',
    orgLegalName: 'ООО «Пример»',
    orgInn: '7707083893',
    orgKpp: '770701001',
    orgOgrn: '1027700132195',
    orgType: 'LLC',
    region: 'Москва',
    workspace: 'seller' as PublicWorkspaceClass,
    termsVersion: '2026-07-01',
    privacyVersion: '2026-07-01',
    ...overrides,
  } as never;
}

const hashOf = (overrides: Record<string, unknown> = {}, key = KEY) =>
  registrationRequestHash(registrationIdempotencyPayload(dto(overrides), key));

describe('registration idempotency contract', () => {
  it('does not change when only the password changes', () => {
    expect(hashOf({ password: 'Totally-Different-Password-7!' })).toBe(hashOf());
  });

  it('carries no password or password-derived field', () => {
    const payload = registrationIdempotencyPayload(dto(), KEY);
    const serialized = JSON.stringify(payload);

    expect(Object.keys(payload).some((key) => /password/i.test(key))).toBe(false);
    expect(serialized).not.toContain(PASSWORD);
    expect(serialized.toLowerCase()).not.toContain(PASSWORD.toLowerCase());
  });

  it.each([
    ['email', { email: 'someone.else@example.test' }],
    ['phone', { phone: '+7 (900) 000-00-02' }],
    ['fullName', { fullName: 'Петров Пётр Петрович' }],
    ['orgInn', { orgInn: '7736207543' }],
    ['workspace', { workspace: 'buyer' as PublicWorkspaceClass }],
    ['termsVersion', { termsVersion: '2026-08-01' }],
  ])('changes when the non-secret payload changes: %s', (_field, overrides) => {
    expect(hashOf(overrides)).not.toBe(hashOf());
  });

  it('binds the fingerprint to its idempotency key and its purpose', () => {
    const payload = registrationIdempotencyPayload(dto(), KEY);

    expect(payload.idempotencyKey).toBe(KEY);
    expect(payload.purpose).toBe('auth.registration.public_submit');
    expect(hashOf({}, 'idempotency-key-registration-0002')).not.toBe(hashOf());
  });

  it('normalizes before fingerprinting, so cosmetic input differences still replay', () => {
    expect(hashOf({
      email: '  applicant@example.test  ',
      fullName: 'Иванов Иван Иванович  ',
      orgInn: '7707-083-893',
    })).toBe(hashOf());
  });
});
