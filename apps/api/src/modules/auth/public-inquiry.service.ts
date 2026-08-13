import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AuthMailOutboxService } from '../auth-mail/auth-mail-outbox.service';
import { AuthPrismaService } from './auth-prisma.service';

const INQUIRY_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CANONICAL_INQUIRY_RECIPIENT = 'access@процент-агро.рф';

export type PublicInquiryInput = {
  name?: unknown;
  contact?: unknown;
  message?: unknown;
  consent?: unknown;
  sourceUrl?: unknown;
  website?: unknown;
  locale?: unknown;
};

function clean(value: unknown, max: number): string {
  return String(value ?? '').trim().slice(0, max);
}

function locale(value: unknown): 'ru' | 'en' | 'zh' {
  return value === 'en' || value === 'zh' ? value : 'ru';
}

function validRecipient(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+$/.test(value);
}

@Injectable()
export class PublicInquiryService {
  constructor(
    private readonly prisma: AuthPrismaService,
    private readonly mailOutbox: AuthMailOutboxService,
  ) {}

  async submit(input: PublicInquiryInput, idempotencyKeyInput: string, correlationId: string) {
    const idempotencyKey = String(idempotencyKeyInput || '').trim();
    if (idempotencyKey.length < 16 || idempotencyKey.length > 128) {
      throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    }

    // Honeypot requests receive the same accepted surface but never create durable work.
    if (clean(input.website, 200)) {
      return { accepted: true, queued: false, correlationId };
    }

    const name = clean(input.name, 120);
    const contact = clean(input.contact, 200);
    const message = clean(input.message, 4_000);
    const sourceUrl = clean(input.sourceUrl, 500);
    const selectedLocale = locale(input.locale);
    if (!name || name.length < 2 || !contact || message.length < 10 || input.consent !== true) {
      throw new BadRequestException({ code: 'PUBLIC_INQUIRY_INVALID' });
    }

    const recipient = String(
      process.env.PC_PUBLIC_INQUIRY_RECIPIENT || CANONICAL_INQUIRY_RECIPIENT,
    ).trim();
    if (!validRecipient(recipient)) {
      throw new ServiceUnavailableException({ code: 'PUBLIC_INQUIRY_TRANSPORT_UNAVAILABLE' });
    }

    const copy = {
      ru: { subject: 'Прозрачная Цена — новое обращение', label: 'Новое обращение с публичной страницы' },
      en: { subject: 'Transparent Price — new inquiry', label: 'New inquiry from the public website' },
      zh: { subject: '透明价格 — 新咨询', label: '来自公开网站的新咨询' },
    } as const;
    const selected = copy[selectedLocale];
    const contactHash = createHash('sha256').update(contact.toLowerCase()).digest('hex').slice(0, 16);

    await this.prisma.$transaction(async (tx) => {
      await this.mailOutbox.enqueue(tx, {
        kind: 'PUBLIC_INQUIRY',
        idempotencyKey: `auth-mail:public-inquiry:${idempotencyKey}`,
        correlationId,
        envelope: {
          to: recipient,
          subject: selected.subject,
          text: [
            selected.label,
            '',
            `Name: ${name}`,
            `Contact: ${contact}`,
            `Contact hash: ${contactHash}`,
            sourceUrl ? `Source: ${sourceUrl}` : '',
            '',
            message,
          ].filter(Boolean).join('\n'),
        },
        expiresAt: new Date(Date.now() + INQUIRY_TTL_MS),
      });
    });

    return { accepted: true, queued: true, correlationId };
  }
}
