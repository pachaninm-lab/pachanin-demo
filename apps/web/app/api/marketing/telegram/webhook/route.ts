import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  marketingAttributionSecret,
  signMarketingAttribution,
} from '@/lib/platform-v7/marketing-attribution.server';
import {
  parseTelegramStart,
  telegramRoleUrlKeyboard,
} from '@/lib/platform-v7/telegram-marketing-qualification';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 5;

const MAX_UPDATE_BYTES = 64 * 1024;
const WEBHOOK_SECRET_PATTERN = /^[A-Za-z0-9_-]{32,128}$/u;

type TelegramUpdate = {
  update_id?: number;
  message?: {
    text?: string;
    chat?: { id?: number; type?: string };
  };
};

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function webhookSecretConfigured(): string | null {
  const secret = String(process.env.MARKETING_TELEGRAM_WEBHOOK_SECRET ?? '').trim();
  return WEBHOOK_SECRET_PATTERN.test(secret) ? secret : null;
}

function secretMatches(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  return actualBuffer.length === expectedBuffer.length
    && timingSafeEqual(actualBuffer, expectedBuffer);
}

function positiveSafeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function enabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true';
}

function publicOrigin(): string | null {
  const raw = String(process.env.MARKETING_PUBLIC_ORIGIN ?? '').trim();
  try {
    const url = new URL(raw);
    if (
      url.protocol !== 'https:'
      || url.username
      || url.password
      || url.pathname !== '/'
      || url.search
      || url.hash
    ) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Telegram supports invoking a Bot API method directly from a successful
 * webhook response. This route therefore needs the webhook secret but never the
 * bot token. It stores no Telegram user id, name, username or message content.
 */
export async function POST(request: Request) {
  const expectedSecret = webhookSecretConfigured();
  if (!expectedSecret) {
    return json({ ok: false, code: 'WEBHOOK_NOT_CONFIGURED' }, 503);
  }

  const actualSecret = String(request.headers.get('x-telegram-bot-api-secret-token') ?? '');
  if (!secretMatches(actualSecret, expectedSecret)) {
    return json({ ok: false, code: 'UNAUTHORIZED' }, 401);
  }

  const rawBody = await request.text().catch(() => '');
  if (!rawBody || Buffer.byteLength(rawBody, 'utf8') > MAX_UPDATE_BYTES) {
    return json({ ok: false, code: rawBody ? 'REQUEST_TOO_LARGE' : 'INVALID_REQUEST' }, rawBody ? 413 : 400);
  }

  let update: TelegramUpdate;
  try {
    update = JSON.parse(rawBody) as TelegramUpdate;
  } catch {
    return json({ ok: false, code: 'INVALID_JSON' }, 400);
  }

  if (!Number.isSafeInteger(update.update_id)) {
    return json({ ok: false, code: 'INVALID_UPDATE' }, 400);
  }

  // Global kill switch also covers user-initiated community replies. Return 2xx
  // so Telegram does not retry a deliberately suppressed update.
  if (
    !enabled(process.env.MARKETING_OUTBOUND_ENABLED)
    || !enabled(process.env.MARKETING_TELEGRAM_COMMUNITY_ENABLED)
  ) {
    return json({ ok: true, suppressed: true });
  }

  const chatId = positiveSafeInteger(update.message?.chat?.id);
  if (!chatId || update.message?.chat?.type !== 'private') {
    return json({ ok: true, ignored: true });
  }

  const origin = publicOrigin();
  if (!origin) return json({ ok: false, code: 'PUBLIC_ORIGIN_NOT_CONFIGURED' }, 503);

  const attributionSecret = marketingAttributionSecret();
  if (!attributionSecret) {
    return json({ ok: false, code: 'ATTRIBUTION_AUTHORITY_NOT_CONFIGURED' }, 503);
  }

  const seed = parseTelegramStart(String(update.message?.text ?? ''));
  const replyMarkup = telegramRoleUrlKeyboard(
    origin,
    seed,
    (attribution) => signMarketingAttribution(attribution, attributionSecret),
  );

  return json({
    method: 'sendMessage',
    chat_id: chatId,
    text: 'Выберите вашу роль в АПК. Я открою защищённую форму листа запуска с уже выбранной ролью.',
    reply_markup: replyMarkup,
  });
}
