import { timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  Post,
} from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { RateLimitService } from '../../common/security/rate-limit.service';

const ANSWER_TICKET_MAX_AGE_MS = 10 * 60 * 1_000;
const ANSWER_TICKET_WINDOW_SECONDS = 15 * 60;
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{20,32}$/u;
const TICKET_PATTERN = /^([0-9a-z]{8,12})\.([A-Za-z0-9_-]{16})$/u;

function deliveryAuthorized(provided: string | undefined): boolean {
  const expected = String(process.env.REGISTRATION_DELIVERY_KEY || '').trim();
  const candidate = String(provided || '').trim();
  if (expected.length < 32 || candidate.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(candidate), Buffer.from(expected));
}

function freshTicket(ticket: string, now = Date.now()): boolean {
  const match = TICKET_PATTERN.exec(ticket);
  if (!match) return false;
  const issuedAt = Number.parseInt(match[1] || '', 36);
  if (!Number.isSafeInteger(issuedAt)) return false;
  const age = now - issuedAt;
  return age >= -60_000 && age <= ANSWER_TICKET_MAX_AGE_MS;
}

/**
 * Internal web → API boundary for anonymous answer admission.
 *
 * The browser cookie proves that a reservation was issued, while the
 * PostgreSQL-backed distributed rate-limit function makes its ticket
 * single-use across requests, processes and replicas.
 */
@Controller('gekta/internal/anonymous-answer')
export class GektaAnonymousAdmissionController {
  constructor(private readonly rateLimits: RateLimitService) {}

  @Public()
  @HttpCode(200)
  @Post('admit')
  async admit(
    @Body() body: { sid?: string; ticket?: string },
    @Headers('x-registration-delivery-key') deliveryKey?: string,
  ) {
    if (!deliveryAuthorized(deliveryKey)) throw new ForbiddenException({ code: 'GEKTA_INTERNAL_FORBIDDEN' });

    const sid = String(body?.sid || '').trim();
    const ticket = String(body?.ticket || '').trim();
    if (!SESSION_ID_PATTERN.test(sid) || !freshTicket(ticket)) {
      throw new BadRequestException({ code: 'GEKTA_ANSWER_RESERVATION_INVALID' });
    }

    const decision = await this.rateLimits.consume(
      'gekta_anonymous_answer_ticket',
      `${sid}|${ticket}`,
      1,
      ANSWER_TICKET_WINDOW_SECONDS,
    );
    return { allowed: decision.allowed };
  }
}
