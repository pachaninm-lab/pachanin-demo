import {
  isStrongPassword,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from './strong-password.validator';

// A password that satisfies every rule, used as the base for single-rule
// violations below so each test isolates one reason for rejection.
const VALID = 'Str0ng!Passw0rd';

describe('isStrongPassword', () => {
  it('accepts a password that satisfies every rule', () => {
    expect(isStrongPassword(VALID)).toBe(true);
  });

  it('rejects anything that is not a string', () => {
    for (const value of [undefined, null, 12345678901234, {}, []]) {
      expect(isStrongPassword(value)).toBe(false);
    }
  });

  describe('length', () => {
    it(`rejects below ${MIN_PASSWORD_LENGTH} and accepts exactly ${MIN_PASSWORD_LENGTH}`, () => {
      expect(isStrongPassword('Ab3!Ab3!Ab3')).toBe(false);
      expect('Ab3!Ab3!Ab3'.length).toBe(MIN_PASSWORD_LENGTH - 1);
      expect(isStrongPassword('Ab3!Ab3!Ab3!')).toBe(true);
      expect('Ab3!Ab3!Ab3!'.length).toBe(MIN_PASSWORD_LENGTH);
    });

    // The upper bound is the rule this module used to be missing while the two
    // former private copies enforced it, so a 240-character password was
    // accepted at registration and refused at reset.
    it(`accepts exactly ${MAX_PASSWORD_LENGTH} and rejects one character more`, () => {
      const atLimit = 'Ab3!'.repeat(MAX_PASSWORD_LENGTH / 4);
      expect(atLimit.length).toBe(MAX_PASSWORD_LENGTH);
      expect(isStrongPassword(atLimit)).toBe(true);
      expect(isStrongPassword(`${atLimit}x`)).toBe(false);
    });

    it('rejects the long password that the old split policy disagreed about', () => {
      const overLong = 'Aa1!'.repeat(60);
      expect(overLong.length).toBe(240);
      expect(isStrongPassword(overLong)).toBe(false);
    });
  });

  describe('character classes', () => {
    it('rejects fewer than three of lowercase, uppercase, digit, symbol', () => {
      expect(isStrongPassword('alllowercaseonly')).toBe(false);
      expect(isStrongPassword('ALLUPPERCASEONLY')).toBe(false);
      expect(isStrongPassword('123456789012345')).toBe(false);
      expect(isStrongPassword('lowerandUPPERon')).toBe(false);
    });

    it('accepts exactly three classes without requiring the fourth', () => {
      expect(isStrongPassword('lowerUPPER1234')).toBe(true);
      expect(isStrongPassword('lowerUPPER!!!!')).toBe(true);
    });
  });

  describe('trivial patterns', () => {
    it('rejects a single repeated character', () => {
      expect(isStrongPassword('aaaaaaaaaaaaaa')).toBe(false);
      expect(isStrongPassword('!!!!!!!!!!!!!!')).toBe(false);
    });

    it('rejects an ascending or descending run', () => {
      expect(isStrongPassword('abcdefghijklmn')).toBe(false);
      expect(isStrongPassword('nmlkjihgfedcba')).toBe(false);
      expect(isStrongPassword('012345678901')).toBe(false);
      expect(isStrongPassword('qwertyuiop12')).toBe(false);
    });
  });
});
