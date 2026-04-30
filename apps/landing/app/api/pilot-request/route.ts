import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function clean(value: unknown) {
  return String(value || '').trim().slice(0, 1000);
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);

  if (!payload) {
    return NextResponse.json({ sent: false, error: 'invalid_payload' }, { status: 400 });
  }

  const name = clean(payload.name);
  const company = clean(payload.company);
  const phone = clean(payload.phone);
  const deal = clean(payload.deal);

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
    'Новая заявка на controlled pilot Прозрачная Цена',
    '',
    `Имя: ${name}`,
    `Компания: ${company}`,
    `Роль: ${clean(payload.role)}`,
    `Телефон: ${phone}`,
    `Email: ${clean(payload.email)}`,
    `Регион: ${clean(payload.region)}`,
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
      subject: `Заявка на пилот Прозрачная Цена — ${company}`,
      text,
    }),
  });

  if (!response.ok) {
    return NextResponse.json({ sent: false, error: 'email_provider_error' }, { status: 502 });
  }

  return NextResponse.json({ sent: true });
}
