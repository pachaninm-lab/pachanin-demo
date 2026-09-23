import { describe, expect, it } from 'vitest';
import { marketHref, publicMarketContext } from '@/lib/platform-v7/public-market-navigation';
import { verifiedRegistrationContinuationHref } from '@/lib/platform-v7/public-registration-continuation';

const REF = 'market-11111111-1111-4111-8111-111111111111';
const STATUS = 'fixture-status-token';

describe('public registration verified continuation UX-14', () => {
  for (const locale of ['ru', 'en', 'zh'] as const) {
    it(`${locale}: drops the spent verify secret and preserves only a valid public selection`, () => {
      const filters = publicMarketContext({ q: 'wheat', region: 'Тамбов', sort: 'price-asc' });
      const before = new URLSearchParams({
        lang: 'ru', verify: 'spent-secret', intent: 'buy', crop: 'wheat', lot: REF,
        returnTo: marketHref('ru', filters), role: 'admin', tenantId: 'private',
        redirect: 'https://external.invalid/', error: 'success',
      });
      const result = new URL(verifiedRegistrationContinuationHref(`?${before}`, STATUS, locale), 'https://example.invalid');
      expect(result.pathname).toBe('/platform-v7/register');
      expect(Object.fromEntries(result.searchParams)).toEqual({
        lang: locale, statusToken: STATUS, intent: 'buy', crop: 'wheat', lot: REF,
        returnTo: marketHref(locale, filters),
      });
      expect(result.hash).toBe('');
    });

    it(`${locale}: preserves execution intent without inventing a role or market lot`, () => {
      const result = new URL(verifiedRegistrationContinuationHref('?lang=ru&intent=execution&verify=spent', STATUS, locale), 'https://example.invalid');
      expect(Object.fromEntries(result.searchParams)).toEqual({ lang: locale, statusToken: STATUS, intent: 'execution' });
    });

    it(`${locale}: rejects duplicate, malformed and external context independently`, () => {
      const malicious = new URLSearchParams({
        verify: 'spent', intent: 'owner', crop: '__proto__', lot: '0',
        returnTo: 'https://external.invalid/platform-v7/market?lang=ru#offers',
        statusToken: 'attacker-token', role: 'bank', tenantId: 'foreign',
      });
      malicious.append('intent', 'buy');
      malicious.append('lot', REF);
      const result = new URL(verifiedRegistrationContinuationHref(`?${malicious}`, STATUS, locale), 'https://example.invalid');
      expect(Object.fromEntries(result.searchParams)).toEqual({ lang: locale, statusToken: STATUS });
      const duplicateReturn = new URLSearchParams({ returnTo: marketHref('ru', { crop: 'wheat' }) });
      duplicateReturn.append('returnTo', marketHref('ru', { crop: 'barley' }));
      expect(new URL(verifiedRegistrationContinuationHref(`?${duplicateReturn}`, STATUS, locale), 'https://example.invalid')
        .searchParams.has('returnTo')).toBe(false);
    });
  }

  it('never writes an empty or malformed server status token into navigation', () => {
    for (const token of ['', 'x'.repeat(513), 'bad\nheader']) {
      expect(() => verifiedRegistrationContinuationHref('?verify=spent', token, 'ru')).toThrow(TypeError);
    }
  });
});
