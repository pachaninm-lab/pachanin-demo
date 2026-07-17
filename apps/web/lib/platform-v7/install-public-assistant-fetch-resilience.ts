'use client';

import { answerPublicPlatformQuestion, publicAssistantCatalog, type PublicAssistantLocale } from './public-assistant-knowledge';
import { answerProspectQuestion } from './prospect-assistant-knowledge';
import { understandAssistantQuestion } from './assistant-question-understanding';

const MARK = '__p7PublicAssistantFetchResilienceInstalled__';

type MarkedWindow = Window & typeof globalThis & { [MARK]?: boolean };

function localeOf(value: unknown): PublicAssistantLocale {
  return value === 'en' || value === 'zh' ? value : 'ru';
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function requestUrl(input: RequestInfo | URL): URL | null {
  try {
    if (input instanceof Request) return new URL(input.url, window.location.origin);
    return new URL(String(input), window.location.origin);
  } catch {
    return null;
  }
}

async function localResponse(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = requestUrl(input);
  if (!url) return json({ code: 'PUBLIC_ASSISTANT_INVALID_REQUEST' }, 400);
  const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();

  if (method === 'GET') {
    const locale = localeOf(url.searchParams.get('locale'));
    return json(publicAssistantCatalog(locale));
  }

  if (method !== 'POST') return json({ code: 'PUBLIC_ASSISTANT_METHOD_NOT_ALLOWED' }, 405);

  let body: Record<string, unknown> = {};
  try {
    const raw = typeof init?.body === 'string' ? init.body : input instanceof Request ? await input.clone().text() : '';
    body = raw ? JSON.parse(raw) as Record<string, unknown> : {};
  } catch {
    return json({ code: 'PUBLIC_ASSISTANT_INVALID_JSON' }, 400);
  }

  const original = typeof body.message === 'string' ? body.message.trim().slice(0, 1_200) : '';
  const locale = localeOf(body.locale);
  if (!original) return json({ code: 'PUBLIC_ASSISTANT_MESSAGE_REQUIRED' }, 400);

  const understood = understandAssistantQuestion(original);
  const prospect = answerProspectQuestion(understood.corrected, locale);
  const grounded = prospect ?? answerPublicPlatformQuestion(understood.corrected, locale);
  const generatedAt = new Date().toISOString();

  return json({
    requestId: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    generatedAt,
    dataMode: 'public_knowledge',
    mode: 'read_only',
    ...grounded,
    limitations: locale === 'ru'
      ? ['Локальный резервный ответ из встроенной публичной базы знаний.', 'Нет доступа к пользователям, кабинетам и Сделкам.', 'Действия не выполняются.']
      : locale === 'en'
        ? ['Local fallback answer from the bundled public knowledge base.', 'No access to users, accounts or Deals.', 'No actions are executed.']
        : ['来自内置公共知识库的本地备用回答。', '无法访问用户、账户或交易。', '不会执行任何操作。'],
  });
}

export function installPublicAssistantFetchResilience(): void {
  if (typeof window === 'undefined') return;
  const marked = window as MarkedWindow;
  if (marked[MARK]) return;
  marked[MARK] = true;

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = requestUrl(input);
    const isPublicAssistant = url?.origin === window.location.origin && url.pathname === '/api/public-platform-assistant';
    if (!isPublicAssistant) return nativeFetch(input, init);

    try {
      const response = await nativeFetch(input, init);
      if (response.ok) return response;
    } catch {
      // Fall through to the bundled read-only public knowledge base.
    }
    return localResponse(input, init);
  };
}
