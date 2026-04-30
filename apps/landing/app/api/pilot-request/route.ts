import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function clean(value: unknown) {
  return String(value || '').trim().slice(0, 1200);
}

function compact(value: unknown) {
  return clean(value).replace(/\s+/g, ' ');
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);

  if (!payload) {
    return NextResponse.json({ sent: false, error: 'invalid_payload' }, { status: 400 });
  }

  if (clean(payload.website)) {
    return NextResponse.json({ sent: true, ignored: true });
  }

  const name = compact(payload.name);
  const company = compact(payload.company);
  const phone = compact(payload.phone);
  const deal = clean(payload.deal);
  const email = compact(payload.email);
  const role = compact(payload.role);
  const region = compact(payload.region);
  const cropVolume = compact(payload.cropVolume);
  const risk = compact(payload.risk);
  const intent = compact(payload.intent) || 'Получить карту потерь сделки';
  const source = compact(payload.source) || 'landing';

  if (!name || !company || !phone || !deal) {
    return NextResponse.json({ sent: false, error: 'missing_required_fields' }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const leadTo = process.env.LEAD_TO_EMAIL || 'pachaninm@gmail.com';
  const leadFrom = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

  if (!apiKey) {
    return NextResponse.json({ sent: false, error: 'mail_provider_not_configured' }, { status: 202 });
  }

  const text = [
    'Новая заявка с лендинга Прозрачная Цена',
    '',
    `Цель: ${intent}`,
    `Источник: ${source}`,
    '',
    `Имя: ${name}`,
    `Компания: ${company}`,
    `Роль: ${role || '—'}`,
    `Телефон: ${phone}`,
    `Email: ${email || '—'}`,
    `Регион: ${region || '—'}`,
    `Культура и объём: ${cropVolume || '—'}`,
    `Ключевой риск: ${risk || '—'}`,
    '',
    'Что нужно разобрать:',
    deal,
  ].join('\n');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: leadFrom,
      to: [leadTo],
      subject: `Карта потерь сделки — ${company}`,
      text,
    }),
  });

  if (!response.ok) {
    return NextResponse.json({ sent: false, error: 'email_provider_error' }, { status: 502 });
  }

  return NextResponse.json({ sent: true });
}
