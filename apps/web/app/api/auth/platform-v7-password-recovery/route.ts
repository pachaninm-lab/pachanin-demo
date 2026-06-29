import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;
const MAX_FIELD_LENGTH = 500;
const RESEND_EMAILS_ENDPOINT = 'https://api.resend.com/emails';

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function noStore(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
    },
  });
}

function clean(input: unknown) {
  return typeof input === 'string' ? input.trim().slice(0, MAX_FIELD_LENGTH) : '';
}

function ipOf(request: NextRequest) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}

function rateLimit(key: string) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (current.count >= MAX_REQUESTS_PER_WINDOW) return false;
  current.count += 1;
  return true;
}

function htmlEscape(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildText(data: Record<string, string>) {
  return [
    'Запрос восстановления доступа к платформе «Прозрачная Цена».',
    '',
    `ID запроса: ${data.requestId}`,
    `Роль: ${data.role}`,
    `Логин: ${data.login}`,
    `Организация / ИНН: ${data.company}`,
    `Контакт для ответа: ${data.contact}`,
    `Комментарий: ${data.comment}`,
    `Время запроса: ${data.requestedAt}`,
    '',
    'Прошу проверить доступ и выдать новый пароль / код доступа.',
    'Пароль в письме не указывается.',
  ].join('\n');
}

function buildHtml(data: Record<string, string>) {
  const rows = [
    ['ID запроса', data.requestId],
    ['Роль', data.role],
    ['Логин', data.login],
    ['Организация / ИНН', data.company],
    ['Контакт для ответа', data.contact],
    ['Комментарий', data.comment],
    ['Время запроса', data.requestedAt],
  ];
  return `
    <div style="font-family:Inter,Arial,sans-serif;color:#071611;line-height:1.45">
      <h2 style="margin:0 0 12px">Запрос восстановления доступа</h2>
      <p style="margin:0 0 16px">Платформа «Прозрачная Цена».</p>
      <table style="border-collapse:collapse;width:100%;max-width:760px">
        ${rows.map(([label, value]) => `
          <tr>
            <td style="padding:8px 10px;border:1px solid #e3ebe5;color:#52615a;font-weight:700">${htmlEscape(label)}</td>
            <td style="padding:8px 10px;border:1px solid #e3ebe5;font-weight:800">${htmlEscape(value)}</td>
          </tr>`).join('')}
      </table>
      <p style="margin:16px 0 0">Прошу проверить доступ и выдать новый пароль / код доступа.</p>
      <p style="margin:6px 0 0;color:#52615a">Пароль в письме не указывается.</p>
    </div>`;
}

async function sendViaResend(data: Record<string, string>) {
  const apiKey = process.env.PC_MAIL_API_KEY;
  const from = process.env.PC_MAIL_FROM;
  const to = process.env.PC_RECOVERY_TO_EMAIL;
  if (!apiKey || !from || !to) return { ok: false, reason: 'mail_not_configured' };

  const response = await fetch(RESEND_EMAILS_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `Восстановление доступа — ${data.role}`,
      text: buildText(data),
      html: buildHtml(data),
    }),
  });

  if (!response.ok) return { ok: false, reason: 'mail_provider_failed', status: String(response.status) };
  return { ok: true, reason: 'sent' };
}

export async function POST(request: NextRequest) {
  const ip = ipOf(request);
  if (!rateLimit(`ip:${ip}`)) {
    return noStore(202, { ok: true, message: 'Если доступ зарегистрирован, запрос будет обработан.' });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return noStore(202, { ok: true, message: 'Если доступ зарегистрирован, запрос будет обработан.' });
  }

  const data = {
    requestId: crypto.randomUUID(),
    source: 'platform-v7',
    type: 'password_recovery_request',
    role: clean(payload.role) || 'не выбрана',
    login: clean(payload.login) || 'не указан',
    company: clean(payload.company) || 'не указано',
    contact: clean(payload.contact) || 'не указан',
    comment: clean(payload.comment) || 'без комментария',
    requestedAt: new Date().toISOString(),
  };

  if (!rateLimit(`login:${data.login.toLowerCase()}`)) {
    return noStore(202, { ok: true, message: 'Если доступ зарегистрирован, запрос будет обработан.' });
  }

  const result = await sendViaResend(data);
  if (!result.ok) {
    console.error('platform-v7 password recovery delivery failed', { requestId: data.requestId, reason: result.reason, status: result.status });
  } else {
    console.info('platform-v7 password recovery delivered', { requestId: data.requestId });
  }

  return noStore(202, {
    ok: true,
    message: 'Если доступ зарегистрирован, запрос будет обработан.',
    requestId: data.requestId,
  });
}
