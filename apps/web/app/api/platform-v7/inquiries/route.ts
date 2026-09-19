import { NextResponse } from 'next/server';
import { connect as tlsConnect, type TLSSocket } from 'node:tls';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

const QUESTION_TYPES = new Set(['platform', 'pilot', 'bank_partner', 'region', 'technical', 'other']);
const SOURCES = new Set(['homepage', 'demo', 'footer', 'connect_form', 'platform_v7_contact_page', 'platform_v7_root', 'support_chat']);
const EMAIL_TIMEOUT_MS = 4500;
const OWNER_EMAIL = 'pachaninm@gmail.com';

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
  if (!inquiry.message) return 'message_required';
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

function recipients() {
  const configured = compact(process.env.LEAD_TO_EMAIL, 180);
  return Array.from(new Set([OWNER_EMAIL, configured].filter(Boolean)));
}

function encodedHeader(value: string) {
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

function buildMime(inquiry: Inquiry, from: string, to: string[]) {
  const subjectSuffix = inquiry.organization || inquiry.name || inquiry.type;
  const subject = `Прозрачная Цена — вопрос — ${subjectSuffix}`;
  return [
    `From: <${from}>`,
    `To: ${to.join(', ')}`,
    `Subject: ${encodedHeader(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    buildText(inquiry),
  ].join('\r\n');
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

function smtpConfigured() {
  return Boolean(process.env.PC_SMTP_HOST && process.env.PC_SMTP_USER && process.env.PC_SMTP_PASS);
}

async function readSmtpResponse(socket: TLSSocket, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const timeout = setTimeout(() => cleanup(new Error('smtp_timeout')), timeoutMs);
    function cleanup(error?: Error) {
      clearTimeout(timeout);
      socket.off('data', onData);
      socket.off('error', onError);
      if (error) reject(error);
    }
    function onError(error: Error) { cleanup(error); }
    function onData(data: Buffer) {
      buffer += data.toString('utf8');
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      const last = lines[lines.length - 1] || '';
      if (/^\d{3}\s/.test(last)) {
        cleanup();
        resolve(buffer);
      }
    }
    socket.on('data', onData);
    socket.on('error', onError);
  });
}

function assertSmtp(response: string, allowed: number[]) {
  const code = Number(response.slice(0, 3));
  if (!allowed.includes(code)) throw new Error(`smtp_${code || 'unknown'}`);
}

async function sendSmtpCommand(socket: TLSSocket, command: string, allowed: number[]) {
  socket.write(`${command}\r\n`);
  const response = await readSmtpResponse(socket, EMAIL_TIMEOUT_MS);
  assertSmtp(response, allowed);
}

async function sendViaSmtp(inquiry: Inquiry): Promise<{ sent: boolean; reason: string }> {
  if (!smtpConfigured()) return { sent: false, reason: 'smtp_not_configured' };

  const host = process.env.PC_SMTP_HOST as string;
  const port = Number(process.env.PC_SMTP_PORT || 465);
  const user = process.env.PC_SMTP_USER as string;
  const pass = process.env.PC_SMTP_PASS as string;
  const from = process.env.PC_MAIL_FROM || user;
  const to = recipients();
  const message = buildMime(inquiry, from, to);

  return new Promise((resolve) => {
    const socket = tlsConnect({ host, port, servername: host, rejectUnauthorized: true });
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve({ sent: false, reason: 'smtp_timeout' });
    }, EMAIL_TIMEOUT_MS + 2500);

    async function run() {
      try {
        assertSmtp(await readSmtpResponse(socket, EMAIL_TIMEOUT_MS), [220]);
        await sendSmtpCommand(socket, 'EHLO percent-agro.local', [250]);
        await sendSmtpCommand(socket, `AUTH PLAIN ${Buffer.from(`\u0000${user}\u0000${pass}`, 'utf8').toString('base64')}`, [235]);
        await sendSmtpCommand(socket, `MAIL FROM:<${from}>`, [250]);
        for (const address of to) await sendSmtpCommand(socket, `RCPT TO:<${address}>`, [250, 251]);
        await sendSmtpCommand(socket, 'DATA', [354]);
        socket.write(`${message}\r\n.\r\n`);
        assertSmtp(await readSmtpResponse(socket, EMAIL_TIMEOUT_MS), [250]);
        socket.write('QUIT\r\n');
        clearTimeout(timeout);
        socket.end();
        resolve({ sent: true, reason: 'smtp_sent' });
      } catch (error) {
        clearTimeout(timeout);
        socket.destroy();
        resolve({ sent: false, reason: `smtp_failed:${safeErrorReason(error)}` });
      }
    }

    socket.once('secureConnect', () => { void run(); });
    socket.once('error', (error) => {
      clearTimeout(timeout);
      resolve({ sent: false, reason: `smtp_failed:${safeErrorReason(error)}` });
    });
  });
}

async function sendViaResend(inquiry: Inquiry): Promise<{ sent: boolean; reason: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: 'resend_not_configured' };

  const leadFrom = process.env.RESEND_FROM_EMAIL || process.env.PC_MAIL_FROM || 'onboarding@resend.dev';
  const subjectSuffix = inquiry.organization || inquiry.name || inquiry.type;

  try {
    const response = await fetchWithTimeout('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: leadFrom,
        to: recipients(),
        subject: `Прозрачная Цена — вопрос — ${subjectSuffix}`,
        text: buildText(inquiry),
      }),
    }, EMAIL_TIMEOUT_MS);

    if (!response.ok) return { sent: false, reason: `resend_${response.status}` };
    return { sent: true, reason: 'resend_sent' };
  } catch (error) {
    return { sent: false, reason: `resend_failed:${safeErrorReason(error)}` };
  }
}

async function sendEmail(inquiry: Inquiry): Promise<{ sent: boolean; reason: string }> {
  const resend = await sendViaResend(inquiry);
  if (resend.sent) return resend;

  const smtp = await sendViaSmtp(inquiry);
  if (smtp.sent) return smtp;

  return { sent: false, reason: `${resend.reason};${smtp.reason}` };
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
    console.info('platform_v7_inquiry_received', JSON.stringify({ ...inquiry, emailSent: delivery.sent, emailReason: delivery.reason, emailTo: recipients() }));

    if (formMode) return delivery.sent ? formRedirect(request, 'sent') : formRedirect(request, 'error', delivery.reason);

    return jsonResponse({
      accepted: true,
      sent: delivery.sent,
      delivered: delivery.sent,
      next: delivery.reason,
    }, delivery.sent ? 200 : 503);
  } catch (error) {
    console.error('platform_v7_inquiry_failed', safeErrorReason(error));
    return formMode ? formRedirect(request, 'error', 'provider_failure') : jsonResponse({ accepted: false, sent: false, error: 'provider_failure' }, 503);
  }
}

export async function GET() {
  return jsonResponse({ ok: true, endpoint: 'platform_v7_inquiries', owner: OWNER_EMAIL, resend: Boolean(process.env.RESEND_API_KEY), smtp: smtpConfigured() });
}
