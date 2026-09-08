import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * ASVS V6.5.5 caps an out-of-band authentication request at ten minutes. The
 * API enforces that; this file is about the other half of the same claim - what
 * the mail tells the recipient.
 *
 * The sentence used to be a fixed string in three languages saying thirty
 * minutes, while the type it is rendered from already carried the real
 * lifetime and ignored it. A number that is restated rather than read is wrong
 * the moment the bound moves, so what is asserted here is that the copy is a
 * function of the delivered lifetime and never overstates it.
 */

const sent: Array<{ to: string; subject: string; text: string }> = [];

vi.mock('../../lib/server/transactional-mail', () => ({
  sendTransactionalMail: vi.fn(async (mail: { to: string; subject: string; text: string }) => {
    sent.push(mail);
    return { delivered: true, provider: 'test' };
  }),
  isTransactionalMailConfigured: () => true,
}));

const { deliverMfaRecovery } = await import('../../lib/server/mfa-recovery-mail');

const request = new Request('https://example.test/api/auth/mfa-recovery');

async function deliver(expiresInSeconds: number | undefined, locale: string) {
  sent.length = 0;
  await deliverMfaRecovery(
    request,
    { email: 'user@example.test', token: 'opaque-recovery-token', expiresInSeconds },
    locale,
  );
  return sent[0].text;
}

afterEach(() => {
  sent.length = 0;
});

describe('MFA recovery mail states the lifetime it was given (ASVS V6.5.5)', () => {
  it('reads the delivered lifetime rather than restating a fixed one', async () => {
    expect(await deliver(600, 'ru')).toContain('10 минут');
    expect(await deliver(600, 'en')).toContain('10 minutes');
    expect(await deliver(600, 'zh')).toContain('10 分钟');
  });

  it('follows the lifetime down when it is shorter', async () => {
    const ru = await deliver(120, 'ru');
    expect(ru).toContain('2 минуты');
    expect(ru).not.toContain('10 минут');
    expect(await deliver(60, 'en')).toContain('1 minute');
    expect(await deliver(300, 'en')).toContain('5 minutes');
  });

  it('never claims longer than the ten-minute ceiling, whatever it is handed', async () => {
    for (const seconds of [1800, 3600, 86_400, Number.MAX_SAFE_INTEGER]) {
      expect(await deliver(seconds, 'en')).toContain('10 minutes');
    }
  });

  it('falls back to the ceiling rather than guessing when the lifetime is missing or nonsense', async () => {
    for (const bad of [undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(await deliver(bad as number | undefined, 'en')).toContain('10 minutes');
    }
  });

  it('rounds a partial minute down to a whole one rather than to zero', async () => {
    expect(await deliver(90, 'en')).toContain('1 minute');
    expect(await deliver(30, 'en')).toContain('1 minute');
  });

  it('does not say thirty minutes in any language any more', async () => {
    for (const locale of ['ru', 'en', 'zh']) {
      const text = await deliver(600, locale);
      expect(text).not.toContain('30 минут');
      expect(text).not.toContain('30 minutes');
      expect(text).not.toContain('30分钟');
    }
  });

  it('still carries the single-use statement and the recovery link', async () => {
    const text = await deliver(600, 'ru');
    expect(text).toContain('только один раз');
    expect(text).toContain('/platform-v7/mfa-recovery');
    expect(text).toContain('opaque-recovery-token');
  });

  it('declines Russian plurals correctly, so the sentence reads as Russian', async () => {
    expect(await deliver(60, 'ru')).toContain('1 минуту');
    expect(await deliver(180, 'ru')).toContain('3 минуты');
    expect(await deliver(300, 'ru')).toContain('5 минут');
  });
});
