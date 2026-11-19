import { GATEWAY_REFUSALS, type GatewayRefusal } from '@pc/ai-assistant-stream-contract';
import { refusalCopy } from '@/lib/platform-v7/ai-gateway-stream';
import type { GektaLocale } from './content';

export const GEKTA_INTERRUPTION_COPY = {
  ru: {
    error: 'Ответ не получен. Проверь соединение и повтори запрос.',
    timeout: 'Время ожидания ответа истекло. Повтори запрос.',
    stopped: 'Ответ остановлен.',
  },
  en: {
    error: 'No answer was received. Check the connection and retry.',
    timeout: 'The response timed out. Retry the request.',
    stopped: 'Answer stopped.',
  },
  zh: {
    error: '未收到回答。请检查网络连接后重试。',
    timeout: '等待回答超时，请重试。',
    stopped: '回答已停止。',
  },
} as const;

export function restoreGektaAssistantState(locale: GektaLocale, text: string, status?: unknown, refusal?: unknown):
  { status: 'answered' | 'refused'; refusal: GatewayRefusal | null } {
  if (status === 'refused') {
    return { status, refusal: GATEWAY_REFUSALS.find((reason) => reason === refusal) ?? null };
  }

  // Earlier history and the account API can contain message text alone.
  const copy = GEKTA_INTERRUPTION_COPY[locale];
  if (text === copy.stopped) return { status: 'refused', refusal: 'CANCELLED' };
  if (text === copy.error || text === copy.timeout || text === refusalCopy(locale, 'UPSTREAM_ERROR')) {
    return { status: 'refused', refusal: 'UPSTREAM_ERROR' };
  }
  if (text === refusalCopy(locale, 'ABSTAINED_NO_DATA')) return { status: 'refused', refusal: 'ABSTAINED_NO_DATA' };
  if (text === refusalCopy(locale, null)) return { status: 'refused', refusal: null };
  return { status: 'answered', refusal: null };
}
