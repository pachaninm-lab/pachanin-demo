import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type LeadPayload = Record<string, unknown>;

type Lead = ReturnType<typeof normalizeLead>;

function clean(value: unknown, limit = 1600) {
  return String(value || '').trim().slice(0, limit);
}

function compact(value: unknown, limit = 260) {
  return clean(value, limit).replace(/\s+/g, ' ');
}

function normalizeLead(payload: LeadPayload) {
  const company = compact(payload.company) || 'Не указано';
  const name = compact(payload.name) || 'Не указано';
  const phone = compact(payload.phone, 90);
  const email = compact(payload.email, 180);

  return {
    createdAt: new Date().toISOString(),
    source: compact(payload.source, 140) || 'landing',
    intent: compact(payload.intent, 260) || 'Получить карту потерь сделки',
    interestLevel: compact(payload.interestLevel, 140),
    interestSummary: compact(payload.interestSummary, 320),
    name,
    company,
    phone,
    email,
    role: compact(payload.role, 180),
    region: compact(payload.region, 180),
    cropVolume: compact(payload.cropVolume, 180),
    risk: compact(payload.risk, 180),
    urgency: compact(payload.urgency, 180),
    readiness: compact(payload.readiness, 180),
    dealSize: compact(payload.dealSize, 180),
    scenario: compact(payload.scenario, 220),
    timeline: compact(payload.timeline, 220),
    deal: clean(payload.deal, 2200),
  };
}

function buildText(lead: Lead) {
  return [
    'Новый сигнал с лендинга Прозрачная Цена',
    '',
    `Время: ${lead.createdAt}`,
    `Источник: ${lead.source}`,
    `Цель: ${lead.intent}`,
    `Интерес: ${lead.interestLevel || '—'}`,
    lead.interestSummary ? `Вывод: ${lead.interestSummary}` : '',
    '',
    `Имя: ${lead.name}`,
    `Компания: ${lead.company}`,
    `Роль: ${lead.role || '—'}`,
    `Телефон: ${lead.phone || '—'}`,
    `Email: ${lead.email || '—'}`,
    `Регион: ${lead.region || '—'}`,
    `Культура и объём: ${lead.cropVolume || '—'}`,
    `Ключевой риск: ${lead.risk || '—'}`,
    `Срочность: ${lead.urgency || '—'}`,
    `Готовность: ${lead.readiness || '—'}`,
    `Масштаб: ${lead.dealSize || '—'}`,
    `Сценарий: ${lead.scenario || '—'}`,
    `Срок: ${lead.timeline || '—'}`,
    '',
    'Описание:',
    lead.deal || '—',
  ].filter(Boolean).join('\n');
}

function buildTelegramText(lead: Lead) {
  return [
    'Новый лид: Прозрачная Цена',
    lead.interestLevel ? `Интерес: ${lead.interestLevel}` : '',
    `Роль: ${lead.role || '—'}`,
    `Боль: ${lead.risk || '—'}`,
    `Срочность: ${lead.urgency || '—'}`,
    `Готовность: ${lead.readiness || '—'}`,
    `Масштаб: ${lead.dealSize || '—'}`,
    `Имя: ${lead.name}`,
    `Телефон: ${lead.phone || '—'}`,
    lead.deal ? `Описание: ${lead.deal.slice(0, 900)}` : '',
  ].filter(Boolean).join('\n');
}

async function sendWebhook(lead: Lead) {
  const webhookUrl = process.env.PILOT_WEBHOOK_URL;
  if (!webhookUrl) return false;

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lead, leadText: buildText(lead) }),
  });

  return response.ok;
}

async function sendTelegram(lead: Lead) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: buildTelegramText(lead),
      disable_web_page_preview: true,
    }),
  });

  return response.ok;
}

async function sendEmail(lead: Lead) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const leadTo = process.env.LEAD_TO_EMAIL || 'pachaninm@gmail.com';
  const leadFrom = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  const subjectSuffix = lead.company && lead.company !== 'Не указано' ? lead.company : lead.role || 'лендинг';

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: leadFrom,
      to: [leadTo],
      subject: `Прозрачная Цена — ${subjectSuffix}`,
      text: buildText(lead),
    }),
  });

  return response.ok;
}

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => null) as LeadPayload | null;

    if (!payload) {
      return NextResponse.json({ accepted: false, sent: false, error: 'invalid_payload' }, { status: 400 });
    }

    if (clean(payload.website)) {
      return NextResponse.json({ accepted: true, sent: false, ignored: true });
    }

    const lead = normalizeLead(payload);

    if (!lead.phone && !lead.email) {
      return NextResponse.json({ accepted: false, sent: false, error: 'contact_required' }, { status: 400 });
    }

    let emailSent = false;
    let webhookSent = false;
    let telegramSent = false;
    const leadText = buildText(lead);

    try {
      emailSent = await sendEmail(lead);
    } catch (error) {
      console.error('pilot_request_email_failed', error);
    }

    try {
      webhookSent = await sendWebhook(lead);
    } catch (error) {
      console.error('pilot_request_webhook_failed', error);
    }

    try {
      telegramSent = await sendTelegram(lead);
    } catch (error) {
      console.error('pilot_request_telegram_failed', error);
    }

    console.info('pilot_request_received', JSON.stringify({ ...lead, emailSent, webhookSent, telegramSent }));

    const delivered = emailSent || webhookSent || telegramSent;

    return NextResponse.json({
      accepted: true,
      sent: emailSent,
      routedToWebhook: webhookSent,
      routedToTelegram: telegramSent,
      delivered,
      leadText,
      next: delivered ? 'lead_routed' : 'lead_logged_without_provider',
    }, { status: delivered ? 200 : 202 });
  } catch (error) {
    console.error('pilot_request_failed', error);
    return NextResponse.json({ accepted: false, sent: false, error: 'server_error' }, { status: 500 });
  }
}
