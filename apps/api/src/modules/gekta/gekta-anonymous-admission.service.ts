import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { hashRateLimitKey, resolveRateLimitHmacKey } from '../../common/security/rate-limit.service';

const DEFAULT_FREE_ANSWERS = 10;
const MAX_FREE_ANSWERS = 1_000;

type AdmissionRow = Readonly<{ allowed: boolean }>;

function freeAnswerLimit(env: NodeJS.ProcessEnv = process.env): number {
  const value = Number.parseInt(String(env.GEKTA_ANONYMOUS_FREE_ANSWERS || ''), 10);
  if (!Number.isSafeInteger(value) || value < 1) return DEFAULT_FREE_ANSWERS;
  return Math.min(MAX_FREE_ANSWERS, value);
}

/**
 * Durable authority for anonymous answer consumption.
 *
 * The database function consumes the unique ticket and increments the browser
 * session counter in one transaction. Only HMAC digests cross the SQL boundary;
 * neither the opaque session id nor the answer ticket is persisted or logged.
 */
@Injectable()
export class GektaAnonymousAdmissionService {
  private readonly hmacKey = resolveRateLimitHmacKey();

  constructor(private readonly prisma: PrismaService) {}

  async consume(sid: string, ticket: string): Promise<{ allowed: boolean }> {
    const ticketHash = hashRateLimitKey(`gekta-answer-ticket-v1:${sid}:${ticket}`, this.hmacKey);
    const sessionHash = hashRateLimitKey(`gekta-answer-session-v1:${sid}`, this.hmacKey);
    const rows = await this.prisma.$queryRaw<AdmissionRow[]>(Prisma.sql`
      SELECT security.consume_gekta_anonymous_answer(
        ${ticketHash},
        ${sessionHash},
        ${freeAnswerLimit()}::integer
      ) AS allowed
    `);
    const row = rows[0];
    if (!row || typeof row.allowed !== 'boolean') {
      throw new Error('Gekta anonymous answer admission returned no decision.');
    }
    return { allowed: row.allowed };
  }
}

export const _gektaAnonymousAdmissionTesting = { freeAnswerLimit };
