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
import { GektaAnonymousAdmissionService } from './gekta-anonymous-admission.service';

const ANSWER_TICKET_MAX_AGE_MS = 10 * 60 * 1_000;
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
 * PostgreSQL-backed admission authority makes its ticket single-use and keeps
 * the whole anonymous-session quota across requests, processes and replicas.
 */
@Controller('gekta/internal/anonymous-answer')
export class GektaAnonymousAdmissionController {
  constructor(private readonly admissions: GektaAnonymousAdmissionService) {}

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

    const decision = await this.admissions.consume(sid, ticket);
    return { allowed: decision.allowed };
  }
}
