import { describe, expect, it } from 'vitest';
import { canPlatformV7RoleSeeField } from '@/lib/platform-v7/role-access';

describe('platform-v7 field decision reasons', () => {
  it('returns a clear reason for restricted buyer fields', () => {
    expect(canPlatformV7RoleSeeField('buyer', 'bankDetails')).toEqual({
      allowed: false,
      reason: 'Поле закрыто для роли до наступления допустимого этапа сделки.',
    });
  });

  it('returns a clear reason for restricted driver fields', () => {
    expect(canPlatformV7RoleSeeField('driver', 'fullDocuments')).toEqual({
      allowed: false,
      reason: 'Поле закрыто для роли до наступления допустимого этапа сделки.',
    });
  });

  it('returns the standard reason for visible fields', () => {
    expect(canPlatformV7RoleSeeField('operator', 'bankDetails')).toEqual({
      allowed: true,
      reason: 'Поле доступно для роли.',
    });
  });
});
