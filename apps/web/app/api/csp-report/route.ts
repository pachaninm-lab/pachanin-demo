import { NextRequest, NextResponse } from 'next/server';

import { readBoundedBody } from '../../../lib/uploads/bounded-body';
import {
  ACCEPTED_CONTENT_TYPES,
  MAX_BODY_BYTES,
  admit,
  extractReports,
} from '../../../lib/security/csp-report';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Ответ всегда 204 и всегда пустой.
 *
 * Браузер отчёты не повторяет, поэтому различать коды ошибок ему незачем, а
 * для постороннего отправителя одинаковый ответ на любой вход означает, что
 * точка не работает оракулом: по коду нельзя узнать ни предел размера, ни
 * состояние бюджета, ни то, разобралось ли тело.
 */
function noContent(): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: { 'cache-control': 'no-store' },
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const contentType = (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (!ACCEPTED_CONTENT_TYPES.includes(contentType)) return noContent();

  if (!admit(Date.now())) return noContent();

  const raw = await readBoundedBody(request.body, MAX_BODY_BYTES);
  if (raw === null) return noContent();

  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return noContent();
  }

  for (const report of extractReports(payload)) {
    console.warn(
      `[csp-report] directive=${report.directive} blocked=${report.blocked}`
      + ` document=${report.document} disposition=${report.disposition}`,
    );
  }

  return noContent();
}
