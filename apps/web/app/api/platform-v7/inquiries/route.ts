import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

const QUESTION_TYPES = new Set(['platform', 'pilot', 'bank_partner', 'region', 'technical', 'other']);
const SOURCES = new Set(['homepage', 'demo', 'footer', 'connect_form', 'platform_v7_contact_page', 'platform_v7_root', 'support_chat']);

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
    type: QUESTION_TYPES.has(rawType) ? rawType : 'other',
    source: SOURCES.has(rawSource) ? rawSource : 'platform_v7_contact_page',
    name: compact(payload.name, 80),
    organization: compact(payload.organization, 120),
    contact: compact(payload.contact, 120),
    message: clean(payload.message, 2000),
    consent: compact(payload.consent, 20),
    website: compact(payload.website, 120),
    locale: payload.locale === 'en' || payload.locale === 'zh' ? payload.locale : 'ru',
  };
}

function validate(inquiry: Inquiry) {
  if (inquiry.website) return 'bot_trap';
  if (!inquiry.name || inquiry.name.length < 2) return 'name_required';
  if (!inquiry.contact || inquiry.contact.length < 5) return 'contact_required';
  if (!inquiry.message) return 'message_required';
  if (inquiry.message.length > 2000) return 'message_too_long';
  if (inquiry.consent !== 'yes') return 'consent_required';
  if ([inquiry.name, inquiry.organization, inquiry.contact, inquiry.message].some(hasHtml)) return 'unsafe_input';
  return null;
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
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function apiUrl() {
  return String(process.env.API_URL || '').trim().replace(/\/$/, '');
}

function inquiryMessage(inquiry: Inquiry) {
  return [
    `Question type: ${inquiry.type}`,
    `Source: ${inquiry.source}`,
    inquiry.organization ? `Organization: ${inquiry.organization}` : '',
    '',
    inquiry.message,
  ].filter(Boolean).join('\n');
}

export async function POST(request: Request) {
  let formMode = true;
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();

  try {
    const read = await readPayload(request);
    formMode = read.formMode;
    if (!read.payload) {
      return formMode
        ? formRedirect(request, 'error', 'invalid_payload')
        : jsonResponse({ accepted: false, queued: false, error: 'invalid_payload', correlationId }, 400);
    }

    const inquiry = normalizeInquiry(read.payload);
    const error = validate(inquiry);
    if (error === 'bot_trap') {
      return formMode
        ? formRedirect(request, 'sent')
        : jsonResponse({ accepted: true, queued: false, ignored: true, correlationId }, 202);
    }
    if (error) {
      return formMode
        ? formRedirect(request, 'error', error)
        : jsonResponse({ accepted: false, queued: false, error, correlationId }, 400);
    }

    const upstream = apiUrl();
    if (!upstream) {
      return formMode
        ? formRedirect(request, 'error', 'service_unavailable')
        : jsonResponse({ accepted: false, queued: false, error: 'service_unavailable', correlationId }, 503);
    }

    const suppliedKey = String(request.headers.get('idempotency-key') || '').trim();
    const idempotencyKey = suppliedKey.length >= 16 && suppliedKey.length <= 128
      ? suppliedKey
      : `public-inquiry:${correlationId}`;
    const response = await fetch(`${upstream}/public-inquiries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'idempotency-key': idempotencyKey,
        'x-correlation-id': correlationId,
      },
      body: JSON.stringify({
        name: inquiry.name,
        contact: inquiry.contact,
        message: inquiryMessage(inquiry),
        consent: true,
        sourceUrl: inquiry.source,
        locale: inquiry.locale,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(7_000),
    });
    const payload = await response.json().catch(() => ({} as Record<string, unknown>));
    const queued = response.ok && payload.accepted === true && payload.queued === true;

    if (formMode) {
      return queued ? formRedirect(request, 'sent') : formRedirect(request, 'error', response.status === 429 ? 'rate_limited' : 'service_unavailable');
    }
    if (!response.ok) {
      return jsonResponse({
        accepted: false,
        queued: false,
        error: response.status === 429 ? 'rate_limited' : 'service_unavailable',
        correlationId,
      }, response.status === 429 ? 429 : response.status >= 500 ? 503 : 400);
    }
    return jsonResponse({
      accepted: true,
      queued,
      delivered: false,
      next: queued ? 'queued' : 'ignored',
      correlationId: String(payload.correlationId || correlationId),
    }, 202);
  } catch {
    return formMode
      ? formRedirect(request, 'error', 'service_unavailable')
      : jsonResponse({ accepted: false, queued: false, error: 'service_unavailable', correlationId }, 503);
  }
}

export async function GET() {
  return jsonResponse({
    ok: true,
    endpoint: 'platform_v7_inquiries',
    transport: 'durable_api_outbox',
    configured: Boolean(apiUrl()),
  });
}
