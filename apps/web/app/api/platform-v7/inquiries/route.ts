import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

const QUESTION_TYPES = new Set(['platform', 'pilot', 'bank_partner', 'region', 'technical', 'other']);
const SOURCES = new Set(['homepage', 'demo', 'footer', 'connect_form', 'platform_v7_contact_page', 'platform_v7_root', 'support_chat']);
const EMAIL_TIMEOUT_MS = 2500;

type InquiryPayload = Record<string, unknown>;
type Inquiry = ReturnType<typeof normalizeInquiry>;

function clean(value: unknown, limit = 1600) {
  return String(value || '').trim().slice(0, limit);
}

function compact(value: unknown, limit = 260) {
  return clean(value, limit).replace(/\s+/g, ' ');
}

function hasHtml(value: string) {
  return /<[^>]*>|javascript:/i.test(value);
}

function safeErrorReason(error: unknown) {
  if (error instanceof Error) return `${error.name}:${error.message}`.slice(0, 220);
  return String(error || 'unknown_error').slice(0, 220);
}

async function readPayload(request: Request): Promise<{ payload: InquiryPayload | null; formMode: boolean }> {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return { payload: await request.json().catch(() => null), formMode: false };
  }

  const form = await request.formData().catch(() => null);
  if (!form) return { payload: null, formMode: true };

  const payload: InquiryPayload = {};
  form.forEach((value, key) => { payload[key] = typeof value === 'string' ? value : value.name; });
  return { payload, formMode: true };
}

function normalizeInquiry(payload: InquiryPayload) {
  const rawType = compact(payload.type, 40);
  const rawSource = compact(payload.source, 80);

  return {
    createdAt: new Date().toISOString(),
    type: QUESTION_TYPES.has(rawType) ? rawType : 'other',
    source: SOURCES.has(rawSource) ? rawSource : 'platform_v7_contact_page',
    name: compact(payload.name, 80),
    organization: compact(payload.organization, 120),
    contact: compact(payload.contact, 120),
    message: clean(payload.message, 2000),
    consent: compact(payload.consent, 20),
    website: compact(payload.website, 120),
  };
}

function validate(inquiry: Inquiry) {
  if (inquiry.website) return 'bot_trap';
  if (!inquiry.name || inquiry.name.length < 2) return 'name_required';
  if (!inquiry.contact || inquiry.contact.length < 5) return 'contact_required';
  if (!inquiry.message || inquiry.message.length < 20) return 'message_too_short';
  if (inquiry.message.length > 2000) return 'message_too_long';
  if (inquiry.consent !== 'yes') return 'consent_required';
  if ([inquiry.name, inquiry.organization, inquiry.contact, inquiry.message].some(hasHtml)) return 'unsafe_input';
  return null;
}

function buildText(inquiry: Inquiry) {
  return [
    'Новый вопрос с platform-v7 Прозрачная Цена',
    '',
    `Время: ${inquiry.createdAt}`,
    `Источник: ${inquiry.source}`,
    `Тип вопроса: ${inquiry.type}`,
    '',
    `Имя: ${inquiry.name}`,
    `Организация: ${inquiry.organization || '—'}`,
    `Контакт: ${inquiry.contact}`,
    '',
    'Сообщение:',
    inquiry.message,
  ].join('\n');
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timeout);
  }
}

async function sendEmail(inquiry: Inquiry): Promise<{ sent: boolean; reason: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: 'email_provider_not_configured' };

  const leadTo = process.env.LEAD_TO_EMAIL || 'pachaninm@gmail.com';
  const leadFrom = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  const subjectSuffix = inquiry.organization || inquiry.name || inquiry.type;

  try {
    const response = await fetchWithTimeout('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: leadFrom,
        to: [leadTo],
        subject: `Прозрачная Цена — вопрос — ${subjectSuffix}`,
        text: buildText(inquiry),
      }),
    }, EMAIL_TIMEOUT_MS);

    if (!response.ok) return { sent: false, reason: `email_provider_${response.status}` };
    return { sent: true, reason: 'email_sent' };
  } catch (error) {
    return { sent: false, reason: `email_provider_failed:${safeErrorReason(error)}` };
  }
}

function formRedirect(request: Request, status: 'sent' | 'error', error?: string) {
  const url = new URL('/platform-v7/contact', request.url);
  if (status === 'sent') url.searchParams.set('sent', '1');
  if (error) url.searchParams.set('error', error.slice(0, 80));
  return NextResponse.redirect(url, 303);
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
    },
  });
}

export async function POST(request: Request) {
  let formMode = true;

  try {
    const read = await readPayload(request);
    formMode = read.formMode;

    if (!read.payload) {
      return formMode ? formRedirect(request, 'error', 'invalid_payload') : jsonResponse({ accepted: false, sent: false, error: 'invalid_payload' }, 400);
    }

    const inquiry = normalizeInquiry(read.payload);
    const error = validate(inquiry);

    if (error === 'bot_trap') {
      console.info('platform_v7_inquiry_bot_trap');
      return formMode ? formRedirect(request, 'sent') : jsonResponse({ accepted: true, sent: false, ignored: true });
    }

    if (error) {
      return formMode ? formRedirect(request, 'error', error) : jsonResponse({ accepted: false, sent: false, error }, 400);
    }

    const delivery = await sendEmail(inquiry);
    console.info('platform_v7_inquiry_received', JSON.stringify({ ...inquiry, emailSent: delivery.sent, emailReason: delivery.reason }));

    if (formMode) return formRedirect(request, 'sent');

    return jsonResponse({
      accepted: true,
      sent: delivery.sent,
      delivered: delivery.sent,
      next: delivery.reason,
    }, delivery.sent ? 200 : 202);
  } catch (error) {
    console.error('platform_v7_inquiry_failed', safeErrorReason(error));
    return formMode ? formRedirect(request, 'sent') : jsonResponse({ accepted: true, sent: false, error: 'accepted_with_provider_failure' }, 202);
  }
}

export async function GET() {
  return jsonResponse({ ok: true, endpoint: 'platform_v7_inquiries' });
}
