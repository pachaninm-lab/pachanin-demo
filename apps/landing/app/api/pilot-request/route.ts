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
    source: compact(payload.source, 140) || 'landing_email_form',
    intent: compact(payload.intent, 260) || 'Получить карту потерь сделки',
    name,
    company,
    phone,
    email,
    role: compact(payload.role, 180),
    region: compact(payload.region, 180),
    cropVolume: compact(payload.cropVolume, 180),
    risk: compact(payload.risk, 180),
    scenario: compact(payload.scenario, 220),
    timeline: compact(payload.timeline, 220),
    deal: clean(payload.deal, 2200),
  };
}

function buildText(lead: Lead) {
  return [
    'Новая заявка с лендинга Прозрачная Цена',
    '',
    `Время: ${lead.createdAt}`,
    `Источник: ${lead.source}`,
    `Цель: ${lead.intent}`,
    '',
    `Имя: ${lead.name}`,
    `Компания: ${lead.company}`,
    `Роль: ${lead.role || '—'}`,
    `Телефон: ${lead.phone || '—'}`,
    `Email: ${lead.email || '—'}`,
    `Регион: ${lead.region || '—'}`,
    `Культура и объём: ${lead.cropVolume || '—'}`,
    `Ключевой риск: ${lead.risk || '—'}`,
    `Сценарий: ${lead.scenario || '—'}`,
    `Срок: ${lead.timeline || '—'}`,
    '',
    'Описание сделки:',
    lead.deal || '—',
  ].filter(Boolean).join('\n');
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
      subject: `Прозрачная Цена — заявка — ${subjectSuffix}`,
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
    const leadText = buildText(lead);

    try {
      emailSent = await sendEmail(lead);
    } catch (error) {
      console.error('pilot_request_email_failed', error);
    }

    console.info('pilot_request_received', JSON.stringify({ ...lead, emailSent }));

    return NextResponse.json({
      accepted: true,
      sent: emailSent,
      delivered: emailSent,
      leadText,
      next: emailSent ? 'email_sent' : 'email_provider_not_configured',
    }, { status: emailSent ? 200 : 202 });
  } catch (error) {
    console.error('pilot_request_failed', error);
    return NextResponse.json({ accepted: false, sent: false, error: 'server_error' }, { status: 500 });
  }
}
