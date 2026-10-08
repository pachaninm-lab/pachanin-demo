import { MaskedLoggerService } from './masked-logger.service';
import {
  REDACTED,
  SENSITIVE_FIELD_NAMES,
  isSensitiveFieldName,
} from '../security/sensitive-data';

/**
 * MaskedLoggerService is the global Nest logger (main.ts, outbox-worker.ts,
 * marketing-outbox-worker.ts), so every this.logger.* call in the API passes
 * through it. It had no tests at all, and it carried a private pattern list
 * that had drifted from the canonical classification in
 * common/security/sensitive-data.ts.
 *
 * These tests assert the property that matters: the global logger is not
 * weaker than the classification the platform declares.
 */

/** Capture what actually reaches the underlying ConsoleLogger. */
function captureLog(invoke: (logger: MaskedLoggerService) => void): string {
  const written: string[] = [];
  const logger = new MaskedLoggerService();
  const spy = jest
    .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(logger)) as any, 'log')
    .mockImplementation((...args: unknown[]) => {
      written.push(args.map((a) => String(a)).join(' '));
    });
  try {
    invoke(logger);
  } finally {
    spy.mockRestore();
  }
  return written.join('\n');
}

const SECRET = 'zXqvT7-secret-value-do-not-log';

/**
 * Fixture for the long-opaque-run heuristic: at least 16 uppercase alphanumerics
 * and longer than 20 characters, which is what that rule keys on.
 *
 * Deliberately low-entropy and not named after a credential. A realistic-looking
 * high-entropy literal here was flagged by gitleaks as a generic-api-key and
 * failed the blocking secret scan — correctly, since the scanner cannot tell a
 * fixture from the real thing. The fix belongs in the fixture, not in
 * .gitleaksignore: suppressing the finding would weaken the gate for every
 * future file rather than remove the thing that looks like a secret.
 */
const OPAQUE_RUN = 'AAAABBBBCCCCDDDDEEEEFFFF';

describe('MaskedLoggerService', () => {
  it('is wired to the canonical classification rather than a private list', () => {
    // The regression this file exists for: the service used to import nothing
    // from sensitive-data.ts while claiming the platform had one list.
    const source = require('fs').readFileSync(
      require('path').join(__dirname, 'masked-logger.service.ts'),
      'utf8',
    );
    expect(source).toContain("from '../security/sensitive-data'");
  });

  describe('field names', () => {
    // Every name the platform classifies as sensitive - not a hand-picked
    // subset - must be redacted when it appears as a JSON key in a log line.
    it.each([...SENSITIVE_FIELD_NAMES])('redacts %s', (field) => {
      const line = captureLog((l) => l.log(`payload ${JSON.stringify({ [field]: SECRET })}`));
      expect(line).not.toContain(SECRET);
    });

    it('redacts regardless of case and separators', () => {
      for (const spelling of ['accessToken', 'access_token', 'access-token', 'ACCESSTOKEN']) {
        expect(isSensitiveFieldName(spelling)).toBe(true);
        const line = captureLog((l) => l.log(`{"${spelling}":"${SECRET}"}`));
        expect(line).not.toContain(SECRET);
      }
    });

    it('leaves a non-sensitive key that merely contains a sensitive name', () => {
      const line = captureLog((l) => l.log('{"tokenCount":"41"}'));
      expect(line).toContain('41');
      expect(line).not.toContain(REDACTED);
    });
  });

  describe('value patterns', () => {
    // Classes the private list did not express at all.
    it.each([
      ['bik', 'реквизиты 044525225 конец', '044525225'],
      ['bank-account', 'счёт 40702810900000012345 конец', '40702810900000012345'],
      ['inn-12', 'ИНН 500100732259 конец', '500100732259'],
      ['ogrn-15', 'ОГРНИП 304500116000157 конец', '304500116000157'],
    ])('masks %s in free text', (_name, message, raw) => {
      const line = captureLog((l) => l.log(message));
      expect(line).not.toContain(raw);
    });

    it('masks an email and a Russian phone number', () => {
      const line = captureLog((l) => l.log('ivanov.petr@example.com +7 912 345-67-89'));
      expect(line).not.toContain('ivanov.petr@example.com');
      expect(line).not.toContain('912 345-67-89');
    });
  });

  describe('coverage retained from the previous private list', () => {
    // These two are heuristics the canonical classification deliberately does
    // not express, so they stay local. Dropping them would have made this
    // change a net loss of masking.
    it('masks a quoted 10-digit INN', () => {
      const line = captureLog((l) => l.log('{"value":"7707083893"}'));
      expect(line).not.toContain('7707083893');
    });

    it('masks a long opaque uppercase run', () => {
      const line = captureLog((l) => l.log(`bearer ${OPAQUE_RUN}`));
      expect(line).not.toContain(OPAQUE_RUN);
    });

    it('masks a card number', () => {
      const line = captureLog((l) => l.log('4111 1111 1111 1111'));
      expect(line).not.toContain('4111 1111 1111 1111');
    });
  });

  it('applies the same masking to optional params, not only the message', () => {
    const line = captureLog((l) => l.log('context', `{"resetToken":"${SECRET}"}`));
    expect(line).not.toContain(SECRET);
  });

  /**
   * The migration to the canonical classification must not lose coverage, so
   * the private list this service used to carry is kept here as the floor and
   * checked mechanically. Replacing a list by a wider one is only an
   * improvement if nothing the old one caught falls through the new one, and
   * that is a property to verify rather than assert.
   *
   * These are the twelve patterns verbatim as they stood before the change.
   */
  const PREVIOUS_PRIVATE_PATTERNS: Array<[RegExp, string | ((s: string) => string)]> = [
    [/"password"\s*:\s*"[^"]*"/gi, '"password":"***"'],
    [/"token"\s*:\s*"[^"]*"/gi, '"token":"***"'],
    [/"accessToken"\s*:\s*"[^"]*"/gi, '"accessToken":"***"'],
    [/"refreshToken"\s*:\s*"[^"]*"/gi, '"refreshToken":"***"'],
    [/"secret"\s*:\s*"[^"]*"/gi, '"secret":"***"'],
    [/"apiKey"\s*:\s*"[^"]*"/gi, '"apiKey":"***"'],
    [/"hmacSecret"\s*:\s*"[^"]*"/gi, '"hmacSecret":"***"'],
    [/"\d{10,12}"/g, '"***INN***"'],
    [/\b\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b/g, '****-****-****-****'],
    [/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, '***@***.***'],
    [/\+7\s?\(?\d{3}\)?\s?\d{3}-?\d{2}-?\d{2}/g, '+7(***)*****'],
    [/\b[A-Z0-9]{16,}\b/g, (match: string) => (match.length > 20 ? '***REDACTED***' : match)],
  ];

  function maskWithPreviousList(message: string): string {
    let result = message;
    for (const [pattern, replacement] of PREVIOUS_PRIVATE_PATTERNS) {
      pattern.lastIndex = 0;
      result = result.replace(pattern, replacement as any);
    }
    return result;
  }

  describe('coverage floor: nothing the previous private list masked falls through', () => {
    const CORPUS = [
      '{"password":"hunter2hunter2"}',
      '{"PASSWORD":"hunter2hunter2"}',
      '{"token":"abcdefghijklmnop"}',
      '{"accessToken":"abcdefghijklmnop"}',
      '{"refreshToken":"abcdefghijklmnop"}',
      '{"secret":"abcdefghijklmnop"}',
      '{"apiKey":"abcdefghijklmnop"}',
      '{"hmacSecret":"abcdefghijklmnop"}',
      '{"inn":"7707083893"}',
      '{"value":"500100732259"}',
      'card 4111 1111 1111 1111 paid',
      'card 4111111111111111 paid',
      'write to ivanov.petr@example.com today',
      'call +7 912 345-67-89 now',
      'call +7(912)345-67-89 now',
      `bearer ${OPAQUE_RUN} end`,
      'mixed {"password":"p"} and 7707083893 and a@b.co and +7 912 345-67-89',
      'plain line with nothing sensitive at all',
    ];

    /**
     * One documented, deliberate divergence, named rather than waved through.
     *
     * The old private rule blanked a card number entirely; the canonical rule
     * keeps the leading and trailing four digits, which is the platform's
     * declared policy and is already what the Sentry channel and the access
     * log do. Converging this channel on that policy is the point of the
     * change, so restoring the stricter local rule would recreate exactly the
     * divergence being removed. First four plus last four is a permitted
     * presentation of a PAN, not a disclosure of one.
     */
    // The first and last four-digit groups of the card sample above.
    const CARD_DIGITS_KEPT_BY_CANONICAL_POLICY = new Set(['4111', '1111']);

    it.each(CORPUS)('%s', (sample) => {
      const previous = maskWithPreviousList(sample);
      const current = captureLog((l) => l.log(sample));

      // Every run of characters the old list removed must also be absent now.
      // Compared on the raw substrings the old masking deleted, so a different
      // replacement token in the new implementation does not count as a miss.
      for (const fragment of sample.split(/\s+/u)) {
        if (CARD_DIGITS_KEPT_BY_CANONICAL_POLICY.has(fragment)) continue;
        const survivedPreviously = previous.includes(fragment);
        const survivesNow = current.includes(fragment);
        if (!survivedPreviously) {
          expect(survivesNow).toBe(false);
        }
      }
    });

    /**
     * Second documented divergence, found the same way as the card one.
     *
     * The old private rule replaced a whole address with ***@***.***, domain
     * included. The canonical rules keep the domain and mask the local part,
     * which is what every other rule in the classification does and what the
     * Sentry channel and the access log already did. Converging on that is the
     * point of this change, so the stricter local behaviour is not restored -
     * but it is a real reduction against the old list on this channel, and it
     * is written down rather than left to be discovered later.
     *
     * The corpus check above compares whole whitespace-delimited tokens, so it
     * would not have caught this by itself. These cases pin the actual
     * behaviour instead, so a future change to it cannot pass silently.
     */
    it.each([
      ['a@b.co', 'a', 'b.co'],
      ['x@mail.ru', 'x', 'mail.ru'],
      ['q@example.org', 'q', 'example.org'],
    ])('masks the local part of %s and keeps the domain', (sample, local, domain) => {
      const current = captureLog((l) => l.log(sample));
      expect(current).toContain(`***@${domain}`);
      expect(current).not.toContain(`${local}@`);
    });

    it('masks a one-character address embedded in a sentence', () => {
      const current = captureLog((l) => l.log('contact q@example.org now'));
      expect(current).toBe('contact ***@example.org now');
    });
  });
});
