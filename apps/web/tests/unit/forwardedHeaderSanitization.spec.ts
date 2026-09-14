// @vitest-environment node
//
// The runtime boundary asserted below is a property of the Node runtime this
// tier actually runs on. The default test environment supplies a different
// Headers implementation, which refuses nothing - asserting against that would
// have measured the test environment instead of production.
import { describe, expect, it } from 'vitest';
import {
  MAX_IDENTIFIER_LENGTH,
  MAX_USER_AGENT_LENGTH,
  clientIpFromRequest,
  nearestProxyAddress,
  safeClientIp,
  safeCorrelationId,
  safeIdempotencyKey,
  safeIdentifier,
  safeUserAgent,
} from '../../lib/server/forwarded-request-headers';

/**
 * ASVS V1.3.3. An HTTP field value is a dangerous context. The runtime is not
 * the control it is often taken for: the boundary below is measured, not
 * assumed, and it is much narrower than "rejects anything odd".
 */

const CTRL = (code: number) => String.fromCharCode(code);
const request = (headers: Record<string, string>) => ({
  headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
});

describe('what the runtime actually refuses in a header value', () => {
  it('accepts every control character except NUL, CR and LF', () => {
    const refused: number[] = [];
    for (let code = 0; code <= 0x1f; code += 1) {
      try {
        new Headers({ 'x-probe': `a${CTRL(code)}b` });
      } catch {
        refused.push(code);
      }
    }
    expect(refused).toEqual([0x00, 0x0a, 0x0d]);
  });

  it('accepts the whole high-byte range, which is exactly what arrives off the wire', () => {
    // Node decodes header bytes as latin1, so a value can never exceed U+00FF.
    expect(() => new Headers({ 'x-probe': CTRL(0x80) + CTRL(0xff) })).not.toThrow();
    expect(new Headers({ 'x-probe': CTRL(0xd0) + CTRL(0xaf) }).get('x-probe')).toBe(CTRL(0xd0) + CTRL(0xaf));
  });
});

describe('identifier sanitization', () => {
  it('keeps the characters every identifier this application generates uses', () => {
    const generated = crypto.randomUUID();
    expect(safeIdentifier(generated)).toBe(generated);
    expect(safeIdentifier('decision:0123456789abcdef')).toBe('decision:0123456789abcdef');
    expect(safeIdentifier('legacy-DL_1.2')).toBe('legacy-DL_1.2');
  });

  it('removes the characters the runtime would have forwarded', () => {
    expect(safeIdentifier(`abc${CTRL(0x07)}def`)).toBe('abcdef');
    expect(safeIdentifier(`abc${CTRL(0x1b)}[31mdef`)).toBe('abc31mdef');
    expect(safeIdentifier(`abc${CTRL(0xd0)}${CTRL(0xaf)}def`)).toBe('abcdef');
    expect(safeIdentifier('abc def')).toBe('abcdef');
    expect(safeIdentifier('a/b?c#d')).toBe('abcd');
  });

  it('trims what is too long, at the bound the API enforces', () => {
    expect(safeIdentifier('a'.repeat(5000))).toHaveLength(MAX_IDENTIFIER_LENGTH);
    expect(safeIdentifier('a'.repeat(MAX_IDENTIFIER_LENGTH))).toHaveLength(MAX_IDENTIFIER_LENGTH);
  });

  it('is not a type assumption', () => {
    expect(safeIdentifier(null)).toBe('');
    expect(safeIdentifier(undefined)).toBe('');
    expect(safeIdentifier(42)).toBe('');
  });
});

describe('correlation id', () => {
  it('passes a usable header through unchanged', () => {
    expect(safeCorrelationId('7f3a-b2c1')).toBe('7f3a-b2c1');
  });

  it('generates one when the header carries nothing usable, as an absent header always did', () => {
    for (const unusable of [null, '', CTRL(0x07), `${CTRL(0xd0)}${CTRL(0xaf)}`, '   ']) {
      const generated = safeCorrelationId(unusable);
      expect(generated).toMatch(/^[0-9a-f-]{36}$/u);
    }
  });

  it('never returns something a Headers constructor would refuse', () => {
    for (const hostile of [`a${CTRL(0)}b`, `a${CTRL(10)}b`, `a${CTRL(13)}b`, 'a'.repeat(9000)]) {
      expect(() => new Headers({ 'x-correlation-id': safeCorrelationId(hostile) })).not.toThrow();
    }
  });
});

describe('idempotency key', () => {
  it('is empty when nothing usable survives, which is what an absent header already produced', () => {
    expect(safeIdempotencyKey(null)).toBe('');
    expect(safeIdempotencyKey(`${CTRL(0xd0)}${CTRL(0xaf)}`)).toBe('');
  });

  it('does not invent a key the caller did not send', () => {
    // A generated idempotency key would make a replayed request look new.
    expect(safeIdempotencyKey('')).toBe('');
  });
});

describe('client address', () => {
  it('accepts address literals', () => {
    expect(safeClientIp('1.2.3.4')).toBe('1.2.3.4');
    expect(safeClientIp('255.255.255.255')).toBe('255.255.255.255');
    expect(safeClientIp(' 1.2.3.4 ')).toBe('1.2.3.4');
    expect(safeClientIp('::1')).toBe('::1');
    expect(safeClientIp('2001:db8::1')).toBe('2001:db8::1');
  });

  it('canonicalizes rather than echoes', () => {
    expect(safeClientIp('::FFFF:1.2.3.4')).toBe('::ffff:102:304');
  });

  it('refuses anything that is not an address', () => {
    for (const value of ['evil', '256.1.1.1', '01.2.3.4', '', '1.2.3.4, 5.6.7.8', 'a'.repeat(60), null, 7]) {
      expect(safeClientIp(value)).toBeNull();
    }
  });

  it('reads the same header chain the routes already read, and validates the result', () => {
    expect(clientIpFromRequest(request({ 'cf-connecting-ip': '1.2.3.4' }))).toBe('1.2.3.4');
    expect(clientIpFromRequest(request({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }))).toBe('1.2.3.4');
    // A junk value earlier in the chain must not mask a usable one after it.
    expect(clientIpFromRequest(request({ 'cf-connecting-ip': 'nonsense', 'x-real-ip': '9.9.9.9' }))).toBe('9.9.9.9');
    expect(clientIpFromRequest(request({ 'x-forwarded-for': 'nonsense' }))).toBeNull();
    expect(clientIpFromRequest(request({}))).toBeNull();
  });
});

describe('user agent', () => {
  it('passes a real user agent through', () => {
    const agent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
    expect(safeUserAgent(agent)).toBe(agent);
  });

  it('drops control characters and high bytes rather than forward them', () => {
    expect(safeUserAgent(`Mozilla${CTRL(0x1b)}[31m/5.0`)).toBe('Mozilla[31m/5.0');
    expect(safeUserAgent(`Mozilla${CTRL(0xd0)}${CTRL(0xaf)}/5.0`)).toBe('Mozilla/5.0');
  });

  it('bounds the length', () => {
    expect(safeUserAgent('a'.repeat(50000))).toHaveLength(MAX_USER_AGENT_LENGTH);
  });

  it('is null when nothing printable is left, so the header is omitted rather than sent empty', () => {
    expect(safeUserAgent(`${CTRL(0xd0)}${CTRL(0xaf)}`)).toBeNull();
    expect(safeUserAgent('')).toBeNull();
    expect(safeUserAgent(null)).toBeNull();
  });
});

describe('nearest hop, the stricter selection', () => {
  it('takes the last entry in the chain, not the first', () => {
    // The caller writes the left of the chain; only the edge writes the right.
    expect(nearestProxyAddress(request({ 'x-forwarded-for': '1.2.3.4, 9.9.9.9' }))).toBe('9.9.9.9');
    expect(clientIpFromRequest(request({ 'x-forwarded-for': '1.2.3.4, 9.9.9.9' }))).toBe('1.2.3.4');
  });

  it('ignores the provider headers that a caller can also set', () => {
    expect(nearestProxyAddress(request({ 'cf-connecting-ip': '1.2.3.4' }))).toBeNull();
    expect(clientIpFromRequest(request({ 'cf-connecting-ip': '1.2.3.4' }))).toBe('1.2.3.4');
  });

  it('validates the hop it selects', () => {
    expect(nearestProxyAddress(request({ 'x-forwarded-for': '9.9.9.9, nonsense' }))).toBeNull();
    expect(nearestProxyAddress(request({}))).toBeNull();
  });

  it('canonicalizes, which node:net isIP did not', () => {
    // The two routes that previously used isIP echoed the spelling they were
    // given; one address written two ways became two rate-limit buckets.
    expect(nearestProxyAddress(request({ 'x-forwarded-for': '::FFFF:1.2.3.4' }))).toBe('::ffff:102:304');
  });
});
