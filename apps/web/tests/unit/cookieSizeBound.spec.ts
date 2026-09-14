import { describe, expect, it } from 'vitest';
import {
  CookieBudgetExceededError,
  MAX_COOKIE_NAME_AND_VALUE_BYTES,
  boundedCookieValue,
  cookieNameAndValueBytes,
  serializeWithinCookieBudget,
  withinCookieBudget,
} from '../../lib/server/bounded-cookie';
import {
  STAFF_ACCESS_META_COOKIE,
  staffMetadataCookieValue,
} from '../../lib/server/staff-access-metadata-cookie';

/**
 * ASVS V3.3.5. A browser handed a cookie over 4096 bytes of name and value
 * stores nothing and says nothing, so the failure only ever shows up as a
 * feature that does not work. Everything here is about the byte count a browser
 * applies, which is not the count JavaScript reports for a string.
 */

const fill = (bytes: number) => 'a'.repeat(bytes);

describe('the cookie byte budget', () => {
  it('counts UTF-8 bytes on the wire, not UTF-16 code units', () => {
    // 'я' is one JavaScript character and two bytes; the browser counts two.
    expect('я'.repeat(10).length).toBe(10);
    expect(cookieNameAndValueBytes('n', 'я'.repeat(10))).toBe(1 + 20);
    // An astral character is two code units and four bytes.
    expect('🌾'.length).toBe(2);
    expect(cookieNameAndValueBytes('', '🌾')).toBe(4);
  });

  it('charges the name against the same budget as the value', () => {
    const name = fill(100);
    expect(cookieNameAndValueBytes(name, fill(MAX_COOKIE_NAME_AND_VALUE_BYTES - 100))).toBe(
      MAX_COOKIE_NAME_AND_VALUE_BYTES,
    );
    // The value alone is inside the budget; together with the name it is not.
    expect(withinCookieBudget(name, fill(MAX_COOKIE_NAME_AND_VALUE_BYTES - 99))).toBe(false);
  });

  it('admits a cookie at exactly the budget and refuses the next byte', () => {
    const name = 'pc_session';
    const exact = fill(MAX_COOKIE_NAME_AND_VALUE_BYTES - name.length);
    expect(boundedCookieValue(name, exact)).toBe(exact);
    expect(() => boundedCookieValue(name, `${exact}a`)).toThrow(CookieBudgetExceededError);
  });

  it('names the cookie and its measured size when it refuses', () => {
    let error: unknown = null;
    try {
      boundedCookieValue('pc_staff_access_meta', fill(5000));
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(CookieBudgetExceededError);
    expect((error as CookieBudgetExceededError).cookieName).toBe('pc_staff_access_meta');
    expect((error as CookieBudgetExceededError).byteLength).toBe(5000 + 'pc_staff_access_meta'.length);
    expect(String(error)).toContain('4096');
  });
});

describe('shortening the one variable-length part', () => {
  const serialize = (text: string) => `fixed:${text}`;

  it('returns the whole value untouched when it already fits', () => {
    const value = serializeWithinCookieBudget('n', serialize, 'short');
    expect(value).toBe('fixed:short');
  });

  it('shortens until it fits and marks that it did', () => {
    const value = serializeWithinCookieBudget('n', serialize, fill(9000));
    expect(value).not.toBeNull();
    expect(withinCookieBudget('n', value as string)).toBe(true);
    expect(value as string).toMatch(/…$/u);
    // Not shortened further than it had to be: one more character would not fit.
    const kept = (value as string).slice('fixed:'.length, -1);
    expect(withinCookieBudget('n', serialize(`${kept}a…`))).toBe(false);
  });

  it('cuts on a code point, never through a surrogate pair', () => {
    // Sweep the prefix length. An astral character is four bytes, so at most
    // offsets the budget happens to run out on a character boundary anyway and
    // a code-unit cut would look correct; the sweep makes sure at least one
    // offset puts the boundary in the middle of a pair.
    for (let offset = 0; offset < 8; offset += 1) {
      const padded = (text: string) => `${'x'.repeat(offset)}:${text}`;
      const value = serializeWithinCookieBudget('n', padded, '🌾'.repeat(3000));
      expect(value).not.toBeNull();
      const kept = (value as string).slice(offset + 1, -1);
      // Every retained character is a whole ear of wheat. A split pair leaves a
      // lone surrogate, which does not survive an encode/decode round trip.
      expect([...kept].every((character) => character === '🌾')).toBe(true);
      expect(Buffer.from(kept, 'utf8').toString('utf8')).toBe(kept);
      expect(withinCookieBudget('n', value as string)).toBe(true);
    }
  });

  it('returns null when the fixed part alone cannot be stored', () => {
    const immovable = (text: string) => `${fill(5000)}${text}`;
    expect(serializeWithinCookieBudget('n', immovable, 'anything')).toBeNull();
  });
});

describe('the staff activation metadata cookie', () => {
  const metadata = (reason: string | null) => ({
    accessSessionId: '11111111-2222-3333-4444-555555555555',
    staffRole: 'PLATFORM_SUPPORT_ENGINEER',
    accessMode: 'DELEGATED_IMPERSONATION',
    permissions: ['VIEW_DEAL', 'EDIT_DEAL', 'VIEW_SETTLEMENT', 'APPROVE_SETTLEMENT', 'VIEW_KYC', 'EXPORT_EVIDENCE', 'MANAGE_ACCESS', 'VIEW_AUDIT'],
    effectiveTenantId: '11111111-2222-3333-4444-555555555555',
    effectiveOrganizationId: '11111111-2222-3333-4444-555555555555',
    effectiveUserId: '11111111-2222-3333-4444-555555555555',
    effectiveRole: 'ORG_ADMIN',
    targetDealId: '11111111-2222-3333-4444-555555555555',
    reason,
    ticketId: 'T'.repeat(128),
    expiresAt: '2026-09-14T12:00:00.000Z',
  });

  it('serializes byte-for-byte as before when the record already fits', () => {
    const record = metadata('Плановая проверка расчётов по заявке.');
    expect(staffMetadataCookieValue(record)).toBe(encodeURIComponent(JSON.stringify(record)));
  });

  it('was over the budget at a reason length the API accepts', () => {
    // The API bounds reason at 2000 characters. Percent-encoding costs six
    // bytes per Cyrillic character, so the unbounded form left the budget far
    // below that - this is the write that silently produced no cookie at all.
    const record = metadata('я'.repeat(526));
    const unbounded = encodeURIComponent(JSON.stringify(record));
    expect(cookieNameAndValueBytes(STAFF_ACCESS_META_COOKIE, unbounded)).toBeGreaterThan(
      MAX_COOKIE_NAME_AND_VALUE_BYTES,
    );
  });

  it('keeps the longest Russian reason the API accepts inside the budget', () => {
    const value = staffMetadataCookieValue(metadata('я'.repeat(2000)));
    expect(value).not.toBeNull();
    expect(withinCookieBudget(STAFF_ACCESS_META_COOKIE, value as string)).toBe(true);
  });

  it('shortens the reason and nothing else', () => {
    const value = staffMetadataCookieValue(metadata('я'.repeat(2000))) as string;
    const parsed = JSON.parse(decodeURIComponent(value)) as ReturnType<typeof metadata>;
    const original = metadata('я'.repeat(2000));
    expect(parsed.reason).not.toBe(original.reason);
    expect(parsed.reason?.endsWith('…')).toBe(true);
    for (const key of Object.keys(original) as (keyof typeof original)[]) {
      if (key === 'reason') continue;
      expect(parsed[key]).toStrictEqual(original[key]);
    }
  });

  it('leaves every field the proxy actually reads intact', () => {
    const original = metadata('я'.repeat(2000));
    const parsed = JSON.parse(decodeURIComponent(staffMetadataCookieValue(original) as string));
    // verifiedSessionContext compares exactly these four against the database
    // row, and the revoke path compares accessSessionId.
    expect(parsed.accessSessionId).toBe(original.accessSessionId);
    expect(parsed.staffRole).toBe(original.staffRole);
    expect(parsed.accessMode).toBe(original.accessMode);
    expect(parsed.expiresAt).toBe(original.expiresAt);
  });

  it('keeps the shortened value parseable as the cookie the proxy expects', () => {
    const value = staffMetadataCookieValue(metadata('я'.repeat(2000))) as string;
    const parsed = JSON.parse(decodeURIComponent(value));
    expect(Array.isArray(parsed.permissions)).toBe(true);
    expect(typeof parsed.accessSessionId).toBe('string');
    expect(Number.isFinite(new Date(String(parsed.expiresAt)).getTime())).toBe(true);
  });

  it('drops the reason entirely rather than exceed the budget', () => {
    // Calibrate rather than guess: pad the record until one more byte of
    // padding would not fit even with no reason at all. There is then room for
    // the record and none for a reason, marked or otherwise.
    const padded = (pad: number, reason: string | null) => ({ ...metadata(reason), targetDealId: 'd'.repeat(pad) });
    const fits = (pad: number) => withinCookieBudget(
      STAFF_ACCESS_META_COOKIE,
      encodeURIComponent(JSON.stringify(padded(pad, null))),
    );
    let pad = 0;
    while (fits(pad + 1)) pad += 1;
    expect(fits(pad)).toBe(true);

    const value = staffMetadataCookieValue(padded(pad, 'причина'));
    expect(value).not.toBeNull();
    expect(withinCookieBudget(STAFF_ACCESS_META_COOKIE, value as string)).toBe(true);
    expect(JSON.parse(decodeURIComponent(value as string)).reason).toBeNull();
  });

  it('reports null when the record cannot be stored with no reason at all', () => {
    const impossible = { ...metadata(null), targetDealId: 'd'.repeat(5000) };
    expect(staffMetadataCookieValue(impossible)).toBeNull();
  });
});
