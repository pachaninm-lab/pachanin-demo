import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Телефон аккаунта Гекты.
 *
 * Канонический номер шифруется, а поиск идёт по отдельному HMAC-индексу с
 * собственным перцем: компрометация индекса не раскрывает номера, а по
 * шифротексту нельзя искать. Только точное совпадение — частичный поиск и
 * перебор по частям невозможны по построению.
 */
@Injectable()
export class GektaPhoneService {
  constructor(private readonly prisma: PrismaService) {}

  private key(): Buffer {
    const raw = process.env.GEKTA_PHONE_ENCRYPTION_KEY?.trim();
    if (!raw) throw new Error('GEKTA_PHONE_ENCRYPTION_KEY is not configured');
    const buffer = /^[0-9a-f]{64}$/iu.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
    if (buffer.length !== 32) throw new Error('GEKTA_PHONE_ENCRYPTION_KEY must decode to 32 bytes');
    return buffer;
  }

  private pepper(): string {
    const raw = process.env.GEKTA_PHONE_LOOKUP_PEPPER?.trim();
    if (!raw) throw new Error('GEKTA_PHONE_LOOKUP_PEPPER is not configured');
    return raw;
  }

  available(): boolean {
    try {
      this.key();
      this.pepper();
      return true;
    } catch {
      return false;
    }
  }

  /** Российские записи одного номера дают один канонический E.164. */
  normalize(raw: string): string | null {
    const input = raw.trim();
    if (!input) return null;
    const hasPlus = input.startsWith('+');
    const digits = input.replace(/\D/gu, '');
    if (!digits) return null;
    if (!hasPlus && digits.length === 11 && (digits.startsWith('8') || digits.startsWith('7'))) return `+7${digits.slice(1)}`;
    if (!hasPlus && digits.length === 10) return `+7${digits}`;
    if (digits.startsWith('7') && digits.length === 11) return `+7${digits.slice(1)}`;
    if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
    return null;
  }

  encrypt(e164: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const ciphertext = Buffer.concat([cipher.update(e164, 'utf8'), cipher.final()]);
    return `v1.${iv.toString('base64url')}.${ciphertext.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}`;
  }

  decrypt(stored: string): string | null {
    const parts = stored.split('.');
    if (parts.length !== 4 || parts[0] !== 'v1') return null;
    try {
      const decipher = createDecipheriv('aes-256-gcm', this.key(), Buffer.from(parts[1], 'base64url'));
      decipher.setAuthTag(Buffer.from(parts[3], 'base64url'));
      return Buffer.concat([decipher.update(Buffer.from(parts[2], 'base64url')), decipher.final()]).toString('utf8');
    } catch {
      return null;
    }
  }

  lookupHash(e164: string): string {
    return createHmac('sha256', this.pepper()).update(`gekta-phone-v1:${e164}`).digest('base64url').slice(0, 64);
  }

  mask(e164: string): string {
    if (e164.length < 6) return '***';
    return `${e164.slice(0, 2)}${'*'.repeat(Math.max(0, e164.length - 4))}${e164.slice(-2)}`;
  }

  /**
   * Привязка номера к аккаунту.
   *
   * Неподтверждённый номер, уже заявленный другим аккаунтом, не отклоняется и не
   * блокирует ни одну из сторон: обе заявки становятся CONFLICTED, и владелец
   * разбирает коллизию по account ID. Иначе злоумышленник мог бы навсегда
   * «занять» чужой номер, ничего не доказав.
   */
  async declarePhone(accountId: string, rawPhone: string) {
    const e164 = this.normalize(rawPhone);
    if (!e164) throw new Error('phone_invalid');
    const lookupHash = this.lookupHash(e164);

    return this.prisma.$transaction(async (tx) => {
      const others = await tx.gektaPhoneIdentity.findMany({
        where: { lookupHash, accountId: { not: accountId }, revokedAt: null },
      });
      const verifiedElsewhere = others.some((row) => row.state === 'VERIFIED');
      const state = others.length > 0 ? 'CONFLICTED' : 'DECLARED';

      if (verifiedElsewhere || others.length > 0) {
        await tx.gektaPhoneIdentity.updateMany({
          where: { id: { in: others.map((row) => row.id) }, state: 'DECLARED' },
          data: { state: 'CONFLICTED' },
        });
      }

      return tx.gektaPhoneIdentity.upsert({
        where: { accountId },
        create: { accountId, encryptedPhone: this.encrypt(e164), lookupHash, state },
        update: { encryptedPhone: this.encrypt(e164), lookupHash, state, verifiedAt: null, verifiedVia: null },
      });
    });
  }

  /**
   * Собственный номер пользователя. Наружу уходит только состояние и маска:
   * полный номер не нужен ни одному экрану, а хранится он зашифрованным.
   */
  async currentIdentity(accountId: string) {
    const identity = await this.prisma.gektaPhoneIdentity.findUnique({ where: { accountId } });
    if (!identity || identity.revokedAt) return { state: null, declaredAt: null, masked: null };
    const decrypted = this.decrypt(identity.encryptedPhone);
    return {
      state: identity.state,
      declaredAt: identity.declaredAt?.toISOString() ?? null,
      masked: decrypted ? this.mask(decrypted) : null,
    };
  }

  /** Поиск владельцем: только точное совпадение канонического номера. */
  async findAccountsByPhone(rawPhone: string) {
    const e164 = this.normalize(rawPhone);
    if (!e164) return [];
    return this.prisma.gektaPhoneIdentity.findMany({
      where: { lookupHash: this.lookupHash(e164), revokedAt: null },
      select: { accountId: true, state: true, declaredAt: true },
      orderBy: { declaredAt: 'asc' },
    });
  }
}
