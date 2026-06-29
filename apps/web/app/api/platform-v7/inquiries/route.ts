import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const QUESTION_TYPES = new Set(['platform', 'pilot', 'bank_partner', 'region', 'technical', 'other']);
const SOURCES = new Set(['homepage', 'demo', 'footer', 'connect_form', 'platform_v7_contact_page', 'platform_v7_root']);

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

async function sendEmail(inquiry: Inquiry) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const leadTo = process.env.LEAD_TO_EMAIL || 'pachaninm@gmail.com';
  const leadFrom = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  const subjectSuffix = inquiry.organization || inquiry.name || inquiry.type;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: leadFrom,
      to: [leadTo],
      subject: `Прозрачная Цена — вопрос — ${subjectSuffix}`,
      text: buildText(inquiry),
    }),
  });

  return response.ok;
}

function formRedirect(request: Request, status: 'sent' | 'error', error?: string) {
  const url = new URL('/platform-v7/contact', request.url);
  if (status === 'sent') url.searchParams.set('sent', '1');
  if (error) url.searchParams.set('error', error);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  try {
    const { payload, formMode } = await readPayload(request);

    if (!payload) {
      return formMode ? formRedirect(request, 'error', 'invalid_payload') : NextResponse.json({ accepted: false, sent: false, error: 'invalid_payload' }, { status: 400 });
    }

    const inquiry = normalizeInquiry(payload);
    const error = validate(inquiry);

    if (error === 'bot_trap') {
      console.info('platform_v7_inquiry_bot_trap');
      return formMode ? formRedirect(request, 'sent') : NextResponse.json({ accepted: true, sent: false, ignored: true });
    }

    if (error) {
      return formMode ? formRedirect(request, 'error', error) : NextResponse.json({ accepted: false, sent: false, error }, { status: 400 });
    }

    let emailSent = false;
    try {
      emailSent = await sendEmail(inquiry);
    } catch (sendError) {
      console.error('platform_v7_inquiry_email_failed', sendError);
    }

    console.info('platform_v7_inquiry_received', JSON.stringify({ ...inquiry, emailSent }));

    if (formMode) return formRedirect(request, 'sent');

    return NextResponse.json({
      accepted: true,
      sent: emailSent,
      delivered: emailSent,
      next: emailSent ? 'email_sent' : 'email_provider_not_configured',
    }, { status: emailSent ? 200 : 202 });
  } catch (error) {
    console.error('platform_v7_inquiry_failed', error);
    return NextResponse.json({ accepted: false, sent: false, error: 'server_error' }, { status: 500 });
  }
}
