import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  answerPublicPlatformQuestion,
  publicAssistantCatalog,
  type PublicAssistantLocale,
} from '@/lib/platform-v7/public-assistant-knowledge';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_MESSAGE_LENGTH = 1_200;
const MAX_BODY_BYTES = 8_192;

function localeFrom(value: unknown): PublicAssistantLocale {
  return value === 'en' || value === 'zh' ? value : 'ru';
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function isCrossSite(request: NextRequest): boolean {
  const fetchSite = request.headers.get('sec-fetch-site');
  return fetchSite === 'cross-site';
}

export async function GET(request: NextRequest) {
  const locale = localeFrom(request.nextUrl.searchParams.get('locale'));
  return json(publicAssistantCatalog(locale));
}

export async function POST(request: NextRequest) {
  if (isCrossSite(request)) {
    return json({ code: 'PUBLIC_ASSISTANT_CROSS_SITE_DENIED', message: 'Cross-site requests are not accepted.' }, 403);
  }

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return json({ code: 'PUBLIC_ASSISTANT_JSON_REQUIRED', message: 'Content-Type application/json is required.' }, 415);
  }

  const contentLength = Number(request.headers.get('content-length') || '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return json({ code: 'PUBLIC_ASSISTANT_BODY_TOO_LARGE', message: 'Request body is too large.' }, 413);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ code: 'PUBLIC_ASSISTANT_INVALID_JSON', message: 'Invalid JSON body.' }, 400);
  }

  const body = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : null;
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  const locale = localeFrom(body?.locale);

  if (!message) {
    return json({ code: 'PUBLIC_ASSISTANT_MESSAGE_REQUIRED', message: 'Message is required.' }, 400);
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return json({ code: 'PUBLIC_ASSISTANT_MESSAGE_TOO_LONG', message: `Maximum length is ${MAX_MESSAGE_LENGTH} characters.` }, 400);
  }

  const generatedAt = new Date().toISOString();
  const answer = answerPublicPlatformQuestion(message, locale);

  return json({
    requestId: randomUUID(),
    generatedAt,
    dataMode: 'public_knowledge',
    mode: 'read_only',
    ...answer,
    limitations: [
      locale === 'en'
        ? 'No user, account or Deal data is available in public mode.'
        : locale === 'zh'
          ? '公共模式无法访问用户、账户或交易数据。'
          : 'В публичном режиме нет доступа к пользователям, кабинетам и Сделкам.',
      locale === 'en'
        ? 'The assistant cannot execute actions or confirm external integrations.'
        : locale === 'zh'
          ? '助手不能执行操作，也不能确认外部集成已上线。'
          : 'Помощник не выполняет действия и не подтверждает неподключённые внешние интеграции.',
    ],
  });
}
