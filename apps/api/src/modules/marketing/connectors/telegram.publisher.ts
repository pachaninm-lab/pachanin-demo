import { Injectable, ServiceUnavailableException } from '@nestjs/common';

const TELEGRAM_MAX_TEXT_LENGTH = 4096;
const TELEGRAM_TIMEOUT_MS = 10_000;
const TELEGRAM_BOT_TOKEN = /^\d{5,}:[A-Za-z0-9_-]{20,}$/u;

type TelegramSendMessageResponse = {
  ok?: boolean;
  result?: {
    message_id?: number;
    chat?: { id?: number | string };
  };
};

export interface TelegramPublishResult {
  externalId: string;
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new ServiceUnavailableException(`Marketing connector is not configured: ${name}`);
  }
  return value;
}

@Injectable()
export class TelegramPublisher {
  async publish(text: string): Promise<TelegramPublishResult> {
    const normalized = text.trim();
    if (!normalized || normalized.length > TELEGRAM_MAX_TEXT_LENGTH) {
      throw new ServiceUnavailableException(
        `Telegram content must contain 1-${TELEGRAM_MAX_TEXT_LENGTH} characters.`,
      );
    }

    const token = requiredEnvironment('MARKETING_TELEGRAM_BOT_TOKEN');
    if (!TELEGRAM_BOT_TOKEN.test(token)) {
      throw new ServiceUnavailableException('Telegram marketing bot token format is invalid.');
    }
    const chatId = requiredEnvironment('MARKETING_TELEGRAM_CHANNEL_ID');
    const endpoint = `https://api.telegram.org/bot${token}/sendMessage`;

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: normalized,
        }),
        // The bot token is part of the endpoint path. Never follow a redirect
        // that could replay that credential to a different origin.
        redirect: 'error',
        signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
      });
    } catch {
      // Never propagate the fetch error because it may contain a URL holding the bot token.
      throw new ServiceUnavailableException('Telegram publish transport failed.');
    }

    let payload: TelegramSendMessageResponse = {};
    try {
      payload = await response.json() as TelegramSendMessageResponse;
    } catch {
      // Keep the failure generic; upstream payloads can contain connector details.
    }

    const messageId = payload.result?.message_id;
    if (!response.ok || payload.ok !== true || !Number.isSafeInteger(messageId)) {
      throw new ServiceUnavailableException(`Telegram publish failed with HTTP ${response.status}.`);
    }

    return Object.freeze({ externalId: String(messageId) });
  }
}
