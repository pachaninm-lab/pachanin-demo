import { describe, expect, it } from 'vitest';
import { buildSmtpMimeMessage } from '@/lib/server/transactional-mail';

describe('transactional SMTP MIME', () => {
  it('serializes translated verification copy as canonical CRLF base64', () => {
    const text = [
      'Получен запрос на регистрацию в Гекте.',
      '',
      'https://xn----8sbjf4befbjgs9b.xn--p1ai/api/gekta/auth/email/verify?token=rev_fixture-token&lang=ru',
      '',
      'Ссылка действует 30 минут.',
    ].join('\n');

    const mime = buildSmtpMimeMessage({
      to: 'gekta-acceptance@example.test',
      subject: 'Гекта — подтвердите email',
      text,
    }, 'sender@example.test');

    expect(mime).toMatch(/^Date: [^\r\n]+\r\nMessage-ID: <[0-9a-f-]+@example\.test>\r\n/u);
    expect(mime).toContain('Content-Transfer-Encoding: base64\r\n\r\n');
    expect(mime.replace(/\r\n/gu, '')).not.toContain('\n');

    const encoded = mime.split('\r\n\r\n')[1];
    expect(encoded).toBeTruthy();
    expect(encoded.split('\r\n').every((line) => line.length > 0 && line.length <= 76)).toBe(true);
    expect(Buffer.from(encoded.replace(/\r\n/gu, ''), 'base64').toString('utf8'))
      .toBe(text.replace(/\r\n?|\n/gu, '\r\n'));
  });

  it('rejects mailbox header injection before opening SMTP DATA', () => {
    expect(() => buildSmtpMimeMessage({
      to: 'recipient@example.test\r\nBcc: attacker@example.test',
      subject: 'Verification',
      text: 'one-time link',
    }, 'sender@example.test')).toThrow('smtp_mailbox_invalid');
  });
});
