import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

const LEAD_INTERESTS = new Set(['demo', 'manager_contact', 'controlled_pilot', 'bank_partner', 'regional_pilot', 'integration', 'other']);
const LEAD_SOURCES = new Set(['homepage_hero', 'homepage_lead_form', 'homepage_trust_strip', 'support_consultation', 'contact_page', 'unknown']);
const EMAIL_TIMEOUT_MS = 2800;
const CRM_TIMEOUT_MS = 3000;

type LeadPayload = Record<string, unknown>;
type Lead = ReturnType<typeof normalizeLead>;

function clean(value: unknown, limit = 1600) {
  return String(value || '').trim().slice(0, limit);
}

function compact(value: unknown, limit = 260) {
  return clean(value, limit).replace(/\s+/g, ' ');
}

function hasHtml(value: string) {
  return /<[^>]*>|javascript:/i.test(value);
}

function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function looksLikePhone(value: string) {
  return /^[+()\d\s-]{7,22}$/.test(value);
}

function safeErrorReason(error: unknown) {
  if (error instanceof Error) return `${error.name}:${error.message}`.slice(0, 220);
  return String(error || 'unknown_error').slice(0, 220);
}

function leadId() {
  return `P7-L-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

async function readPayload(request: Request): Promise<{ payload: LeadPayload | null; formMode: boolean }> {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return { payload: await request.json().catch(() => null), formMode: false };
  }

  const form = await request.formData().catch(() => null);
  if (!form) return { payload: null, formMode: true };

  const payload: LeadPayload = {};
  form.forEach((value, key) => {
    payload[key] = typeof value === 'string' ? value : value.name;
  });
  return { payload, formMode: true };
}

function pickInterest(value: unknown) {
  const raw = compact(value, 40);
  return LEAD_INTERESTS.has(raw) ? raw : 'demo';
}

function pickSource(value: unknown) {
  const raw = compact(value, 80);
  return LEAD_SOURCES.has(raw) ? raw : 'homepage_lead_form';
}

function normalizeLead(payload: LeadPayload, request: Request) {
  const email = compact(payload.email ?? payload.contactEmail ?? payload.contact, 120).toLowerCase();
  const phone = compact(payload.phone, 40);
  const source = pickSource(payload.source);
  const id = compact(payload.leadId, 80) || leadId();

  return {
    id,
    createdAt: new Date().toISOString(),
    source,
    interest: pickInterest(payload.interest),
    name: compact(payload.name, 90),
    organization: compact(payload.organization, 140),
    role: compact(payload.role, 100),
    email,
    phone,
    message: clean(payload.message, 1800),
    consent: compact(payload.consent, 20),
    website: compact(payload.website, 120),
    pagePath: compact(payload.pagePath, 240) || new URL(request.url).pathname,
    referrer: compact(payload.referrer || request.headers.get('referer'), 420),
    utmSource: compact(payload.utmSource, 120),
    utmMedium: compact(payload.utmMedium, 120),
    utmCampaign: compact(payload.utmCampaign, 160),
    userAgent: compact(request.headers.get('user-agent'), 420),
  };
}

function validateLead(lead: Lead) {
  if (lead.website) return 'bot_trap';
  if (!lead.name || lead.name.length < 2) return 'name_required';
  if (!lead.organization || lead.organization.length < 2) return 'organization_required';
  if (!lead.email && !lead.phone) return 'contact_required';
  if (lead.email && !looksLikeEmail(lead.email)) return 'email_invalid';
  if (lead.phone && !looksLikePhone(lead.phone)) return 'phone_invalid';
  if (lead.message && lead.message.length > 1800) return 'message_too_long';
  if (lead.consent !== 'yes') return 'consent_required';
  if ([lead.name, lead.organization, lead.role, lead.email, lead.phone, lead.message].some(hasHtml)) return 'unsafe_input';
  return null;
}

function analyticsPayload(lead: Lead) {
  return {
    event: 'generate_lead',
    leadId: lead.id,
    source: lead.source,
    interest: lead.interest,
    organization: lead.organization,
    role: lead.role || 'not_specified',
    pagePath: lead.pagePath,
    utmSource: lead.utmSource,
    utmMedium: lead.utmMedium,
    utmCampaign: lead.utmCampaign,
    createdAt: lead.createdAt,
  };
}

function leadText(lead: Lead) {
  return [
    'Новая заявка с главной страницы platform-v7',
    '',
    `Lead ID: ${lead.id}`,
    `Время: ${lead.createdAt}`,
    `Источник: ${lead.source}`,
    `Интерес: ${lead.interest}`,
    `Страница: ${lead.pagePath}`,
    `UTM: ${lead.utmSource || '—'} / ${lead.utmMedium || '—'} / ${lead.utmCampaign || '—'}`,
    '',
    `Имя: ${lead.name}`,
    `Организация: ${lead.organization}`,
    `Роль / функция: ${lead.role || '—'}`,
    `Email: ${lead.email || '—'}`,
    `Телефон: ${lead.phone || '—'}`,
    '',
    'Комментарий:',
    lead.message || '—',
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

async function pushToCrm(lead: Lead): Promise<{ sent: boolean; reason: string }> {
  const webhookUrl = process.env.PLATFORM_V7_CRM_WEBHOOK_URL || process.env.CRM_WEBHOOK_URL;
  if (!webhookUrl) return { sent: false, reason: 'crm_webhook_not_configured' };

  const token = process.env.PLATFORM_V7_CRM_WEBHOOK_TOKEN || process.env.CRM_WEBHOOK_TOKEN;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Platform': 'platform-v7',
    'X-Lead-Event': 'generate_lead',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const response = await fetchWithTimeout(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        event: 'generate_lead',
        pipeline: 'platform_v7_commercial_leads',
        lead: {
          id: lead.id,
          createdAt: lead.createdAt,
          source: lead.source,
          interest: lead.interest,
          status: 'new',
          product: 'Прозрачная Цена / platform-v7',
          maturity: 'controlled-pilot / pre-integration',
        },
        contact: {
          name: lead.name,
          organization: lead.organization,
          role: lead.role,
          email: lead.email,
          phone: lead.phone,
        },
        message: lead.message,
        analytics: analyticsPayload(lead),
        attribution: {
          pagePath: lead.pagePath,
          referrer: lead.referrer,
          utmSource: lead.utmSource,
          utmMedium: lead.utmMedium,
          utmCampaign: lead.utmCampaign,
          userAgent: lead.userAgent,
        },
      }),
    }, CRM_TIMEOUT_MS);

    if (!response.ok) return { sent: false, reason: `crm_webhook_${response.status}` };
    return { sent: true, reason: 'crm_webhook_sent' };
  } catch (error) {
    return { sent: false, reason: `crm_webhook_failed:${safeErrorReason(error)}` };
  }
}

async function sendInternalEmail(lead: Lead): Promise<{ sent: boolean; reason: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: 'email_provider_not_configured' };

  const leadTo = process.env.LEAD_TO_EMAIL || 'pachaninm@gmail.com';
  const leadFrom = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

  try {
    const response = await fetchWithTimeout('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: leadFrom,
        to: [leadTo],
        subject: `Прозрачная Цена — заявка на демо — ${lead.organization}`,
        text: leadText(lead),
      }),
    }, EMAIL_TIMEOUT_MS);

    if (!response.ok) return { sent: false, reason: `email_provider_${response.status}` };
    return { sent: true, reason: 'email_sent' };
  } catch (error) {
    return { sent: false, reason: `email_provider_failed:${safeErrorReason(error)}` };
  }
}

async function sendAutoReply(lead: Lead): Promise<{ sent: boolean; reason: string }> {
  if (!lead.email) return { sent: false, reason: 'no_email_for_autoreply' };
  if (process.env.PLATFORM_V7_AUTO_REPLY_ENABLED === 'false') return { sent: false, reason: 'autoreply_disabled' };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: 'email_provider_not_configured' };

  const leadFrom = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  const managerContact = process.env.PLATFORM_V7_MANAGER_CONTACT || process.env.LEAD_TO_EMAIL || 'pachaninm@gmail.com';

  const text = [
    `${lead.name}, добрый день.`,
    '',
    'Заявка по платформе «Прозрачная Цена» получена.',
    'Следующий корректный шаг — короткое демо по controlled pilot: контур сделки, роли, документы, логистика, приёмка, основание для расчёта и спор.',
    '',
    `Прямой контакт менеджера: ${managerContact}`,
    '',
    'Важно: платформа находится в стадии controlled-pilot / pre-integration. Боевые банковские, ФГИС и ЭДО-подключения обсуждаются отдельно после проверки сценария и договора.',
    '',
    'Прозрачная Цена',
  ].join('\n');

  try {
    const response = await fetchWithTimeout('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: leadFrom,
        to: [lead.email],
        subject: 'Прозрачная Цена — заявка получена, следующий шаг — демо',
        text,
      }),
    }, EMAIL_TIMEOUT_MS);

    if (!response.ok) return { sent: false, reason: `autoreply_provider_${response.status}` };
    return { sent: true, reason: 'autoreply_sent' };
  } catch (error) {
    return { sent: false, reason: `autoreply_failed:${safeErrorReason(error)}` };
  }
}

function formRedirect(request: Request, status: 'sent' | 'error', error?: string) {
  const url = new URL('/platform-v7', request.url);
  url.hash = 'lead-request';
  if (status === 'sent') url.searchParams.set('lead', 'sent');
  if (error) url.searchParams.set('leadError', error.slice(0, 80));
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
      return formMode ? formRedirect(request, 'error', 'invalid_payload') : jsonResponse({ accepted: false, error: 'invalid_payload' }, 400);
    }

    const lead = normalizeLead(read.payload, request);
    const error = validateLead(lead);

    if (error === 'bot_trap') {
      console.info('platform_v7_lead_bot_trap');
      return formMode ? formRedirect(request, 'sent') : jsonResponse({ accepted: true, ignored: true });
    }

    if (error) {
      return formMode ? formRedirect(request, 'error', error) : jsonResponse({ accepted: false, error }, 400);
    }

    const [crm, internalEmail, autoReply] = await Promise.all([pushToCrm(lead), sendInternalEmail(lead), sendAutoReply(lead)]);
    const analytics = analyticsPayload(lead);

    console.info('platform_v7_generate_lead', JSON.stringify({ ...analytics, crmSent: crm.sent, crmReason: crm.reason, emailSent: internalEmail.sent, autoReplySent: autoReply.sent }));

    if (formMode) return formRedirect(request, 'sent');

    return jsonResponse({
      accepted: true,
      leadId: lead.id,
      analyticsEventName: 'generate_lead',
      analytics,
      crmDelivered: crm.sent,
      crmReason: crm.reason,
      internalEmailDelivered: internalEmail.sent,
      internalEmailReason: internalEmail.reason,
      autoReplyDelivered: autoReply.sent,
      autoReplyReason: autoReply.reason,
    }, crm.sent || internalEmail.sent ? 200 : 202);
  } catch (error) {
    console.error('platform_v7_lead_failed', safeErrorReason(error));
    return formMode ? formRedirect(request, 'sent') : jsonResponse({ accepted: true, error: 'accepted_with_provider_failure' }, 202);
  }
}

export async function GET() {
  return jsonResponse({
    ok: true,
    endpoint: 'platform_v7_leads',
    event: 'generate_lead',
    crmConfigured: Boolean(process.env.PLATFORM_V7_CRM_WEBHOOK_URL || process.env.CRM_WEBHOOK_URL),
    emailConfigured: Boolean(process.env.RESEND_API_KEY),
  });
}
