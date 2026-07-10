import { RATE_LIMIT_OPTIONS, type RateLimitOptions } from '../../common/decorators/rate-limit.decorator';
import { MfaController } from './mfa.controller';

function options(method: keyof MfaController): RateLimitOptions | undefined {
  const handler = MfaController.prototype[method];
  return Reflect.getMetadata(RATE_LIMIT_OPTIONS, handler as object) as RateLimitOptions | undefined;
}

describe('MfaController rate limits', () => {
  it('limits challenge creation per authenticated user', () => {
    expect(options('initVerification')).toMatchObject({
      name: 'mfa_verify_init',
      scope: 'user',
      limit: 5,
      windowSeconds: 300,
    });
  });

  it('limits TOTP and backup-code verification per authenticated user', () => {
    expect(options('verify')).toMatchObject({
      name: 'mfa_verify',
      scope: 'user',
      limit: 8,
      windowSeconds: 300,
    });
  });

  it('also protects MFA enrollment endpoints', () => {
    expect(options('initSetup')).toMatchObject({ scope: 'user', limit: 3, windowSeconds: 300 });
    expect(options('verifySetup')).toMatchObject({ scope: 'user', limit: 8, windowSeconds: 300 });
  });
});
