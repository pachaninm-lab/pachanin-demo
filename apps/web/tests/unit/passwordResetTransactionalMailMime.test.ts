import { describe, expect, it } from 'vitest';
import { buildSmtpMimeMessage } from '@/lib/server/transactional-mail';

describe('PC-CROP password-reset SMTP MIME', () => {
  it('serializes Russian reset copy as canonical CRLF/base64 with ASCII mailbox domains', () => {
    const text = [
      'Получен запрос на восстановление доступа к платформе «Прозрачная Цена».',
      '',
      'Чтобы установить новый пароль, открой ссылку:',
      'https://xn----8sbjf4befbjgs9b.xn--p1ai/platform-v7/forgot-password?token=fixture&lang=ru',
      '',
      'Ссылка действует 15 минут и может быть использована только один раз.',
      'Если запрос отправил не ты, ничего не делай.',
    ].join('\n');

    const mime = buildSmtpMimeMessage({
      to: 'reviewer@example.test',
      subject: 'Прозрачная Цена — восстановление доступа',
      text,
    }, 'access@процент-агро.рф');

    expect(mime).toMatch(
      /^Date: [^\r\n]+\r\nMessage-ID: <[0-9a-f-]+@xn----8sbjf4befbjgs9b\.xn--p1ai>\r\n/u,
    );
    expect(mime).toContain('From: <access@xn----8sbjf4befbjgs9b.xn--p1ai>\r\n');
    expect(mime).toContain('To: reviewer@example.test\r\n');
    expect(mime).not.toContain('From: <access@процент-агро.рф>');
    expect(mime).toContain('Content-Type: text/plain; charset=UTF-8\r\n');
    expect(mime).toContain('Content-Transfer-Encoding: base64\r\n\r\n');
    expect(mime.replace(/\r\n/gu, '')).not.toContain('\n');
    expect(mime.replace(/\r\n/gu, '')).not.toContain('\r');

    const encoded = mime.split('\r\n\r\n')[1];
    expect(encoded).toBeTruthy();
    expect(encoded.split('\r\n').every((line) => line.length > 0 && line.length <= 76)).toBe(true);
    expect(Buffer.from(encoded.replace(/\r\n/gu, ''), 'base64').toString('utf8'))
      .toBe(text.replace(/\r\n?|\n/gu, '\r\n'));
  });

  it('canonicalizes an internationalized recipient domain to ASCII', () => {
    const mime = buildSmtpMimeMessage({
      to: 'reviewer@пример.рф',
      subject: 'Reset',
      text: 'one-time reset link',
    }, 'access@процент-агро.рф');

    expect(mime).toContain('To: reviewer@xn--e1afmkfd.xn--p1ai\r\n');
  });

  it('fails closed for an internationalized local part because SMTPUTF8 is not negotiated', () => {
    expect(() => buildSmtpMimeMessage({
      to: 'проверка@example.test',
      subject: 'Reset',
      text: 'one-time reset link',
    }, 'access@процент-агро.рф')).toThrow('smtp_mailbox_smtputf8_required');
  });

  it('rejects mailbox header injection before an SMTP transaction can start', () => {
    expect(() => buildSmtpMimeMessage({
      to: 'reviewer@example.test\r\nBcc: attacker@example.test',
      subject: 'Reset',
      text: 'one-time reset link',
    }, 'access@процент-агро.рф')).toThrow('smtp_mailbox_invalid');
  });
});
